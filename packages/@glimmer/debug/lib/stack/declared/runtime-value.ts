import type { DebugState } from '../../render/state';
import { valueForRef, type Reference } from '@glimmer/reference';
import type { CompilableBlock, Nullable, Scope, ScopeBlock } from '@glimmer/interfaces';
import type { BlockSymbolTable } from '@glimmer/syntax';
import { define } from './define-runtime-value';
import { MISMATCH, ok } from './shared';
import { isReference } from '../../utils';
import type { FallibleCheckResult } from '../types';

export const RegisterRa = define(
  'register/ra',
  'the value of the $ra register',
  (value, debug: DebugState) => {
    return value === debug.registers.frame.$ra ? ok(value) : MISMATCH;
  }
);

export const RefFunction = define('ref/function', 'a function ref', (reference) => {
  if (isReference(reference)) {
    return deref(reference, (value): value is AnyFunction => typeof value === 'function');
  } else {
    return MISMATCH;
  }
});

function deref<const T, const U extends T>(
  reference: Reference<T>,
  check: (value: T) => value is U
): FallibleCheckResult<Deref<U>> {
  try {
    const value = valueForRef(reference);

    if (check(value)) {
      return ok({
        reference: reference as unknown as Reference<U>,
        value,
      } satisfies Deref<U>);
    } else {
      return MISMATCH;
    }
  } catch (e) {
    return { error: 'deref', threw: e };
  }
}

export type DebugTypeName = RuntimeValueSpec[0];
export type AnyFunction = (...args: any[]) => any;
export interface ErrorSpec {
  readonly expected: string;
  readonly got: number;
}

// Ideally this would have a type because we'd like to be able to present it in
// the debugger.
type TODO = unknown;

interface Deref<T> {
  readonly reference: Reference<T>;
  readonly value: T;
}

export type RuntimeValueSpec =
  | readonly ['register/ra', number]
  | readonly ['ref/function', Deref<AnyFunction>]
  | readonly ['ref/function?', Nullable<Deref<AnyFunction>>]
  | readonly ['ref/boolean', Deref<boolean>]
  | readonly ['ref/any', Deref<unknown>]
  | readonly ['block/compilable', CompilableBlock]
  | readonly ['block/compilable?', Nullable<CompilableBlock>]
  | readonly ['block/scope', ScopeBlock]
  | readonly ['block/scope?', Nullable<ScopeBlock>]
  | readonly ['scope', Scope]
  | readonly ['table/block', BlockSymbolTable]
  | readonly ['table/block?', Nullable<BlockSymbolTable>]
  | readonly ['args', TODO]
  // basically dynamic for now -- meant to be used with `peek`
  | readonly ['stack/args', void]
  | readonly ['deref/error', Error];
export type RuntimeValueSpecName = RuntimeValueSpec[0];
