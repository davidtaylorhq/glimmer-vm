import type { PresentArray } from './array';
import type { Operand, SerializedInlineBlock, SerializedTemplateBlock } from './compile';
import type { EncoderError } from './compile/encoder';
import type { Nullable } from './core';
import type { InternalComponentCapabilities } from './managers/internal/component';
import type { CompileTimeCompilationContext, ConstantPool, SerializedHeap } from './program';
import type { Owner } from './runtime';
import type { BlockSymbolTable, ProgramSymbolTable, SymbolTable } from './tier1/symbol-table';

export interface CompilableProgram extends CompilableTemplate<ProgramSymbolTable> {
  moduleName: string;
}

export type CompilableBlock = CompilableTemplate<BlockSymbolTable>;

export interface LayoutWithContext {
  readonly id: string;
  readonly block: SerializedTemplateBlock;
  readonly moduleName: string;
  readonly owner: Owner | null;
  readonly scope: (() => unknown[]) | undefined | null;
  readonly isStrictMode: boolean;
}

export interface BlockWithContext {
  readonly block: SerializedInlineBlock;
  readonly containingLayout: LayoutWithContext;
}

/**
 * Environment specific template.
 */
export interface TemplateOk {
  result: 'ok';

  /**
   * Module name associated with the template, used for debugging purposes
   */
  moduleName: string;

  // internal casts, these are lazily created and cached
  asLayout(): CompilableProgram;
  asWrappedLayout(): CompilableProgram;
}

export interface TemplateError {
  result: 'error';

  problem: string;
  span: {
    start: number;
    end: number;
  };
}

export type Template = TemplateOk | TemplateError;

export type TemplateFactory = (owner?: Owner) => Template;

export type ISTDLIB_MAIN = 0;
export type ISTDLIB_TRUSTING_GUARDED_APPEND = 1;
export type ISTDLIB_CAUTIOUS_GUARDED_APPEND = 2;
export type ISTDLIB_TRUSTING_NON_DYNAMIC_APPEND = 3;
export type ISTDLIB_CAUTIOUS_NON_DYNAMIC_APPEND = 4;

export type STDLibraryOpcode =
  | ISTDLIB_MAIN
  | ISTDLIB_TRUSTING_GUARDED_APPEND
  | ISTDLIB_CAUTIOUS_GUARDED_APPEND
  | ISTDLIB_TRUSTING_NON_DYNAMIC_APPEND
  | ISTDLIB_CAUTIOUS_NON_DYNAMIC_APPEND;

export type STDLibrary = [
  main: number,
  trustingGuardedAppend: number,
  cautiousGuardedAppend: number,
  trustingNonDynamicAppend: number,
  cautiousNonDynamicAppend: number
];

export type SerializedStdlib = [number, number, number];

export type CompilerBuffer = Array<Operand>;

export interface ResolvedLayout {
  handle: number;
  capabilities: InternalComponentCapabilities;
  compilable: Nullable<CompilableProgram>;
}

export type OkHandle = number;
export interface ErrorHandle {
  handle: number;
  errors: PresentArray<EncoderError>;
}

export type HandleResult = OkHandle | ErrorHandle;

export interface NamedBlocks {
  get(name: string): Nullable<SerializedInlineBlock>;
  has(name: string): boolean;
  with(name: string, block: Nullable<SerializedInlineBlock>): NamedBlocks;
  hasAny: boolean;
  names: string[];
}

export interface ContainingMetadata {
  evalSymbols: Nullable<string[]>;
  upvars: Nullable<string[]>;
  scopeValues: unknown[] | null;
  isStrictMode: boolean;
  moduleName: string;
  owner: Owner | null;
  size: number;
}

export interface CompilerArtifacts {
  heap: SerializedHeap;
  constants: ConstantPool;
}

export interface CompilableTemplate<S extends SymbolTable = SymbolTable> {
  symbolTable: S;
  compile(context: CompileTimeCompilationContext): HandleResult;
}
