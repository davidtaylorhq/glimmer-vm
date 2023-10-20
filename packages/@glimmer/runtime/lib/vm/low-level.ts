import type { Expand, Nullable, RuntimeHeap, RuntimeOp, RuntimeProgram } from '@glimmer/interfaces';
import { LOCAL_DEBUG } from '@glimmer/local-debug-flags';
import { assert } from '@glimmer/util';
import { $fp, $pc, $ra, $sp, $up, MachineOp } from '@glimmer/vm';

import { APPEND_OPCODES } from '../opcodes';
import type { VM } from './append';
import { CheckNumber, check } from '@glimmer/debug';
import { createTag } from '@glimmer/validator';

export type PackedRegisters = Expand<
  [$pc: number, $ra: number, $fp: number, $sp: number, $up: number]
>;

export function PackedRegisters(...registers: PackedRegisters): PackedRegisters {
  assert(registers.length === 5, `Invalid registers: ${JSON.stringify(registers)}`);
  assert(
    registers.every((register) => typeof register === 'number'),
    `Invalid registers: ${JSON.stringify(registers)}`
  );

  return registers;
}

export type FrameInfo = Expand<[$ra: number, $fp: number]>;

export class Registers {
  readonly #packed: PackedRegisters;

  constructor(packed: PackedRegisters) {
    this.#packed = PackedRegisters(...packed);
  }

  // @premerge consolidate
  goto(pc: number): void {
    assert(typeof pc === 'number', `Invalid pc: ${typeof pc}`);
    assert(!isNaN(pc), `Invalid pc: NaN`);

    this.#packed[$pc] = pc;
  }

  // @premerge consolidate
  call(pc: number): void {
    this.#packed[$ra] = this.#packed[$pc];
    this.goto(pc);
  }

  // @premerge consolidate
  returnTo(pc: number): void {
    this.#packed[$ra] = check(pc, CheckNumber);
  }

  // @premerge consolidate
  return() {
    this.#packed[$pc] = this.#packed[$ra];
  }

  // @premerge consolidate
  advance(size: number) {
    this.#packed[$pc] += size;
    check(this.#packed[$pc], CheckNumber);
    return size;
  }

  // @premerge consolidate
  advanceSp(size: number) {
    this.#packed[$sp] += size;
    check(this.#packed[$sp], CheckNumber);
    return size;
  }

  // @premerge consolidate
  push(): number {
    return ++this.#packed[$sp];
  }

  // @premerge consolidate
  pop(n = 1): number {
    return (this.#packed[$sp] -= check(n, CheckNumber));
  }

  // @premerge consolidate
  peek(offset = 0): number {
    return this.#packed[$sp] - check(offset, CheckNumber);
  }

  // @premerge consolidate
  /**
   * Remember the previous $fp, then update $fp to point to $sp. Return the previous $fp so it can
   * be pushed onto the stack.
   *
   * This creates a linked list of $fps on the stack.
   */
  pushFp() {
    let prevFp = this.#packed[$fp];
    // the current $sp contains the $ra we already pushed, so the $fp will point to the tuple of
    // $ra and $fp
    this.#packed[$fp] = this.#packed[$sp];
    return prevFp;
  }

  // @premerge consolidate
  popTo(ra: number, fp: number): void {
    // when popping a frame, we want to restore the $sp to the position immediately before we pushed
    // the $ra and $fp onto the stack, which will effectively continue execution at that point.
    let to = this.#packed[$fp] - 1;
    this.#packed[$ra] = check(ra, CheckNumber);
    this.#packed[$fp] = check(fp, CheckNumber);
    this.#packed[$sp] = check(to, CheckNumber);
  }

  catchUnwindFrame(up: number, ra: number, fp: number) {
    let to = this.#packed[$up] - 1;
    this.#packed[$up] = check(up, CheckNumber);
    this.#packed[$ra] = check(ra, CheckNumber);
    this.#packed[$fp] = check(fp, CheckNumber);
    this.#packed[$sp] = to;
  }

  /**
   * @deprecated Direct access to .packed will be removed once all use-cases are handled via
   * semantic methods.
   */
  get packed(): PackedRegisters {
    return this.#packed;
  }

  get pc(): number {
    return this.#packed[$pc];
  }

  get ra(): number {
    return this.#packed[$ra];
  }

  get sp(): number {
    return this.#packed[$sp];
  }

  get fp(): number {
    return this.#packed[$fp];
  }

  get up(): number {
    return this.#packed[$up];
  }
}

export interface ReadonlyStack {
  get<T = number>(position: number, base?: number): T;
  top<T>(offset?: number): T;
}

export interface CleanStack extends ReadonlyStack {
  push(...values: unknown[]): void;
  pop<T>(count?: number): T;
  dup(position?: number): void;
}

export interface InternalStack extends CleanStack {
  reset(): void;
}

export interface DebugStack extends InternalStack {
  toArray(): unknown[];
  all(): { before: unknown[]; frame: unknown[] };
}

export interface ArgumentsStack extends InternalStack, DebugStack {
  readonly registers: Registers;

  // @premerge consolidate (these are only used in Arguments)
  copy(from: number, to: number): void;
  set(value: unknown, offset: number, base?: number): void;
  slice<T = unknown>(start: number, end: number): T[];
  capture(items: number): unknown[];
  toArray(): unknown[];
}

export interface Externs {
  debugBefore(opcode: RuntimeOp): unknown;
  debugAfter(state: unknown): void;
}

export interface VmDebugState {
  readonly registers: Registers;
  readonly stack: DebugStack;
}

export class LowLevelVM {
  static create(
    stack: ArgumentsStack,
    heap: RuntimeHeap,
    program: RuntimeProgram,
    externs: Externs,
    registers: Registers
  ): LowLevelVM {
    return new LowLevelVM(stack, heap, program, externs, registers);
  }

  #currentOpSize = 0;
  readonly #registers: Registers;
  readonly #heap: RuntimeHeap;
  readonly #program: RuntimeProgram;
  readonly #stack: ArgumentsStack;

  private constructor(
    stack: ArgumentsStack,
    heap: RuntimeHeap,
    program: RuntimeProgram,
    readonly externs: Externs,
    registers: Registers
  ) {
    this.#stack = stack;
    this.#heap = heap;
    this.#program = program;
    this.#registers = registers;
  }

  // @premerge consolidate
  get stack(): CleanStack {
    return this.#stack;
  }

  // @premerge consolidate
  get internalStack(): InternalStack {
    return this.#stack;
  }

  // @premerge consolidate
  get forArguments(): ArgumentsStack {
    return this.#stack;
  }

  get debug(): VmDebugState {
    return {
      registers: this.#registers,
      stack: this.#stack,
    };
  }

  get pc(): number {
    return this.#registers.pc;
  }

  get sp(): number {
    return this.#registers.sp;
  }

  get fp(): number {
    return this.#registers.fp;
  }

  beginTry(catchPc: number) {
    let tag = createTag();

    // push the current $up onto the stack;
    // this makes the chain of $ups a linked list
    this.#stack.push(this.#registers.up);
    // save off the $sp of the beginning of the unwind frame
    let sp = this.#registers.sp;

    this.#stack.push(this.target(catchPc));
    this.#registers.packed[$up] = sp;
    // push the current $ra onto the stack
    this.#stack.push(this.#registers.ra);
    this.#stack.push(this.#registers.fp);
  }

  catch(e: unknown) {
    let up = this.#registers.up;
    let catchPc = this.#stack.get(1, up);

    this.#registers.catchUnwindFrame(
      this.#stack.get(0, up),
      this.#stack.get(2, up),
      this.#stack.get(3, up)
    );
    this.#registers.goto(catchPc);
  }

  finally() {
    let up = this.#registers.up;

    this.#registers.catchUnwindFrame(
      this.#stack.get(0, up),
      this.#stack.get(2, up),
      this.#stack.get(3, up)
    );
  }

  // Start a new frame and save $ra and $fp on the stack
  pushFrame() {
    this.#stack.push(this.#registers.ra);
    this.#stack.push(this.#registers.pushFp());
  }

  // Restore $ra, $sp and $fp
  popFrame() {
    let fp = this.#registers.fp;
    // get the previous $ra and $fp from the stack (relative to the *current* $fp), and restore them
    // to the registers.
    this.#registers.popTo(this.#stack.get(0, fp), this.#stack.get(1, fp));
  }

  // Jump to an address in `program`
  goto(offset: number) {
    let pc = this.target(offset);
    assert(typeof pc === 'number', `expected pc to be a number, but it was ${typeof pc}`);
    assert(!isNaN(pc), 'expected pc to not be NaN, but it was');
    this.#registers.goto(pc);
  }

  target(offset: number) {
    return this.#registers.pc + offset - this.#currentOpSize;
  }

  // Save $pc into $ra, then jump to a new address in `program` (jal in MIPS)
  call(handle: number) {
    assert(handle < 0xffffffff, `Jumping to placeholder address`);

    this.#registers.call(this.#heap.getaddr(handle));
  }

  // Put a specific `program` address in $ra
  returnTo(offset: number) {
    this.#registers.returnTo(this.target(offset));
  }

  // Return to the `program` address stored in $ra
  return() {
    this.#registers.return();
  }

  nextStatement(): Nullable<RuntimeOp> {
    let program = this.#program;
    let registers = this.#registers;

    let pc = registers.pc;

    assert(typeof pc === 'number', 'pc is a number');

    if (pc === -1) {
      return null;
    }

    // We have to save off the current operations size so that
    // when we do a jump we can calculate the correct offset
    // to where we are going. We can't simply ask for the size
    // in a jump because we have have already incremented the
    // program counter to the next instruction prior to executing.
    let opcode = program.opcode(pc);
    this.#currentOpSize = this.#registers.advance(opcode.size);

    return opcode;
  }

  evaluateOuter(opcode: RuntimeOp, vm: VM) {
    if (LOCAL_DEBUG) {
      let {
        externs: { debugBefore, debugAfter },
      } = this;
      let state = debugBefore(opcode);
      this.evaluateInner(opcode, vm);
      debugAfter(state);
    } else {
      this.evaluateInner(opcode, vm);
    }
  }

  evaluateInner(opcode: RuntimeOp, vm: VM) {
    if (opcode.isMachine) {
      this.evaluateMachine(opcode);
    } else {
      this.evaluateSyscall(opcode, vm);
    }
  }

  evaluateMachine(opcode: RuntimeOp) {
    switch (opcode.type) {
      case MachineOp.PushFrame:
        return this.pushFrame();
      case MachineOp.PopFrame:
        return this.popFrame();
      case MachineOp.InvokeStatic:
        return this.call(opcode.op1);
      case MachineOp.InvokeVirtual:
        return this.call(this.#stack.pop());
      case MachineOp.Jump:
        return this.goto(opcode.op1);
      case MachineOp.Return:
        return this.return();
      case MachineOp.ReturnTo:
        return this.returnTo(opcode.op1);
      case MachineOp.PushTryFrame:
        return this.beginTry(opcode.op1);
      case MachineOp.PopTryFrame:
        return this.finally();
    }
  }

  evaluateSyscall(opcode: RuntimeOp, vm: VM) {
    APPEND_OPCODES.evaluate(vm, opcode, opcode.type);
  }
}
