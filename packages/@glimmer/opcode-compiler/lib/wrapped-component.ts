import type {
  BuilderOp,
  CompilableProgram,
  CompileTimeCompilationContext,
  BlockMetadata,
  HandleResult,
  HighLevelOp,
  LayoutWithContext,
  Nullable,
  ProgramSymbolTable,
} from '@glimmer/interfaces';
import { LOCAL_TRACE_LOGGING } from '@glimmer/local-debug-flags';

import { debugCompiler } from './compiler';
import { templateCompilationContext } from './opcode-builder/context';
import { encodeOp } from './opcode-builder/encoder';
import { ATTRS_BLOCK, WrappedComponent } from './opcode-builder/helpers/components';
import { meta } from './opcode-builder/helpers/shared';
import { definePushOp, type HighLevelStatementOp } from './syntax/compilers';
import { IS_COMPILABLE_TEMPLATE } from '@glimmer/util';

export class WrappedBuilder implements CompilableProgram {
  public symbolTable: ProgramSymbolTable;
  private compiled: Nullable<number> = null;
  private attrsBlockNumber: number;
  readonly meta: BlockMetadata;
  readonly [IS_COMPILABLE_TEMPLATE] = true;

  constructor(
    private layout: LayoutWithContext,
    public moduleName: string
  ) {
    let { block } = layout;
    let [, symbols, hasDebug] = block;

    this.meta = meta(layout);
    symbols = symbols.slice();

    // ensure ATTRS_BLOCK is always included (only once) in the list of symbols
    let attrsBlockIndex = symbols.indexOf(ATTRS_BLOCK);
    if (attrsBlockIndex === -1) {
      this.attrsBlockNumber = symbols.push(ATTRS_BLOCK);
    } else {
      this.attrsBlockNumber = attrsBlockIndex + 1;
    }

    this.symbolTable = {
      hasDebug,
      symbols,
    };
  }

  compile(syntax: CompileTimeCompilationContext): HandleResult {
    if (this.compiled !== null) return this.compiled;

    let m = meta(this.layout);
    let context = templateCompilationContext(syntax, m);

    let {
      encoder,
      program: { constants, resolver },
    } = context;

    function pushOp(...op: BuilderOp | HighLevelOp | HighLevelStatementOp) {
      encodeOp(encoder, constants, resolver, m, op as BuilderOp | HighLevelOp);
    }

    WrappedComponent(definePushOp(pushOp), this.layout, this.attrsBlockNumber);

    let handle = context.encoder.commit(m.size);

    if (typeof handle !== 'number') {
      return handle;
    }

    this.compiled = handle;

    if (LOCAL_TRACE_LOGGING) {
      debugCompiler(context, handle);
    }

    return handle;
  }
}
