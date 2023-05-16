import type { Dict, Scope } from '@glimmer/interfaces';
import { childRefFor, type Reference, valueForRef } from '@glimmer/reference';
import { decodeHandle, unwrap } from '@glimmer/util';

import { APPEND_OPCODES } from '../../opcodes';
import { CONSTANTS } from '../../symbols';
import { DEBUGGER_OP } from '@glimmer/vm-constants';

export type DebugGet = (path: string) => unknown;

export type DebugCallback = (context: unknown, get: DebugGet) => void;

function debugCallback(context: unknown, get: DebugGet): void {
  // eslint-disable-next-line no-console
  console.info('Use `context`, and `get(<path>)` to debug this template.');

  // for example...
  context === get('this');

  // eslint-disable-next-line no-debugger
  debugger;
}

let callback = debugCallback;

// For testing purposes
export function setDebuggerCallback(cb: DebugCallback) {
  if (import.meta.env.DEV) callback = cb;
}

export function resetDebuggerCallback() {
  if (import.meta.env.DEV) callback = debugCallback;
}

class ScopeInspector {
  readonly #locals: Dict<Reference> = {};
  readonly #scope: Scope;

  constructor(scope: Scope, symbols: string[], debugInfo: number[]) {
    this.#scope = scope;
    for (const slot of debugInfo) {
      let name = unwrap(symbols[slot - 1]);
      let ref = scope.getSymbol(slot);
      this.#locals[name] = ref;
    }
  }

  get(path: string): Reference {
    let locals = this.#locals;

    let parts = path.split('.');
    let [head, ...tail] = path.split('.') as [string, ...string[]];

    let ref: Reference;

    if (head === 'this') {
      ref = this.#scope.getSelf();
    } else if (locals[head]) {
      ref = unwrap(locals[head]);
    } else {
      ref = this.#scope.getSelf();
      tail = parts;
    }

    return tail.reduce((r, part) => childRefFor(r, part), ref);
  }
}

APPEND_OPCODES.add(DEBUGGER_OP, (vm, { op1: _symbols, op2: _debugInfo }) => {
  let symbols = vm[CONSTANTS].getArray<string>(_symbols);
  let debugInfo = vm[CONSTANTS].getArray<number>(decodeHandle(_debugInfo));
  let inspector = new ScopeInspector(vm._scope_(), symbols, debugInfo);
  callback(valueForRef(vm._getSelf_()), (path) => valueForRef(inspector.get(path)));
});
