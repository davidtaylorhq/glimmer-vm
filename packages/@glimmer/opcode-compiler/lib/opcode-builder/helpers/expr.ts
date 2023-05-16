import type { WireFormat } from '@glimmer/interfaces';

import type { PushExpressionOp } from '../../syntax/compilers';
import { EXPRESSIONS } from '../../syntax/expressions';
import { PushPrimitive } from './vm';
import { PRIMITIVE_REFERENCE_OP } from '@glimmer/vm';

export function expr(op: PushExpressionOp, expression: WireFormat.Expression): void {
  if (Array.isArray(expression)) {
    EXPRESSIONS.compile(op, expression);
  } else {
    PushPrimitive(op, expression);
    op(PRIMITIVE_REFERENCE_OP);
  }
}
