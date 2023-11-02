import type { UserException } from '@glimmer/util/lib';

import type { Nullable } from './core';

export type ConstantReference = 0;
export type ComputeReference = 1;
export type UnboundReference = 2;
export type InvokableReference = 3;

export interface ReferenceTypes {
  readonly Constant: ConstantReference;
  readonly Compute: ComputeReference;
  readonly Unbound: UnboundReference;
  readonly Invokable: InvokableReference;
}

export type ReferenceType =
  | ConstantReference
  | ComputeReference
  | UnboundReference
  | InvokableReference;

declare const REFERENCE: unique symbol;
export type ReferenceSymbol = typeof REFERENCE;

export interface Reference<T = unknown> {
  [REFERENCE]: ReferenceType;
  error: UserException | null;
  debugLabel?: string | undefined;
  debug?: { isPrimitive: boolean } | undefined;
  compute: Nullable<() => T>;
  children: null | Map<string | Reference, Reference>;
}
