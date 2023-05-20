import type {
  ContainingMetadata,
  LayoutWithContext,
  NamedBlocks,
  Nullable,
  WireFormat,
} from '@glimmer/interfaces';
import { EMPTY_ARRAY, EMPTY_STRING_ARRAY } from '@glimmer/util';

import type { PushExpressionOp, PushStatementOp } from '../../syntax/compiler-impl';
import { PushYieldableBlock } from './blocks';
import { expr } from './expr';
import { PUSH_ARGS_OP, PUSH_EMPTY_ARGS_OP } from '@glimmer/vm-constants';

/**
 * Compile arguments, pushing an Arguments object onto the stack.
 *
 * @param args.params
 * @param args.hash
 * @param args.blocks
 * @param args.atNames
 */
export function CompileArguments(
  op: PushStatementOp,
  positional: WireFormat.Core.Params,
  named: WireFormat.Core.Hash,
  blocks: NamedBlocks,
  atNames: boolean
): void {
  let blockNames: string[] = blocks.names;
  for (let name of blockNames) {
    PushYieldableBlock(op, blocks.get(name));
  }

  let count = CompilePositional(op, positional);

  let flags = count << 4;

  if (atNames) flags |= 0b1000;

  if (blocks) {
    flags |= 0b111;
  }

  let names = EMPTY_ARRAY as readonly string[];

  if (named) {
    names = named[0];
    let value = named[1];
    for (let element of value) {
      expr(op, element);
    }
  }

  op(PUSH_ARGS_OP, names as string[], blockNames, flags);
}

export function SimpleArguments(
  op: PushExpressionOp,
  positional: Nullable<WireFormat.Core.Params>,
  named: Nullable<WireFormat.Core.Hash>,
  atNames: boolean
): void {
  if (positional === null && named === null) {
    op(PUSH_EMPTY_ARGS_OP);
    return;
  }

  let count = CompilePositional(op, positional);

  let flags = count << 4;

  if (atNames) flags |= 0b1000;

  let names = EMPTY_STRING_ARRAY;

  if (named) {
    names = named[0];
    let value = named[1];
    for (let element of value) {
      expr(op, element);
    }
  }

  op(PUSH_ARGS_OP, names, EMPTY_STRING_ARRAY, flags);
}

/**
 * Compile an optional list of positional arguments, which pushes each argument
 * onto the stack and returns the number of parameters compiled
 *
 * @param positional an optional list of positional arguments
 */
export function CompilePositional(
  op: PushExpressionOp,
  positional: Nullable<WireFormat.Core.Params>
): number {
  if (positional === null) return 0;

  for (let element of positional) {
    expr(op, element);
  }

  return positional.length;
}

export function meta(layout: LayoutWithContext): ContainingMetadata {
  let [, symbols, , upvars] = layout.block;

  return {
    evalSymbols: evalSymbols(layout),
    upvars: upvars,
    scopeValues: layout.scope?.() ?? null,
    isStrictMode: layout.isStrictMode,
    moduleName: layout.moduleName,
    owner: layout.owner,
    size: symbols.length,
  };
}

export function evalSymbols(layout: LayoutWithContext): Nullable<string[]> {
  let { block } = layout;
  let [, symbols, hasDebug] = block;

  return hasDebug ? symbols : null;
}
