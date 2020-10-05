import { PresentArray } from '@glimmer/interfaces';
import {
  ASTv2,
  BlockSymbolTable,
  node,
  ProgramSymbolTable,
  SourceSlice,
  SymbolTable,
} from '@glimmer/syntax';

import { AnyOptionalList, OptionalList, PresentList } from '../../shared/list';

export class Template extends node('Template').fields<{
  scope: ProgramSymbolTable;
  body: Content[];
}>() {}

export class InElement extends node('InElement').fields<{
  guid: string;
  insertBefore: ExpressionNode | Missing;
  destination: ExpressionNode;
  block: NamedBlock;
}>() {}

export class NamedBlocks extends node('NamedBlocks').fields<{
  blocks: OptionalList<NamedBlock>;
}>() {}

export class NamedBlock extends node('NamedBlock').fields<{
  scope: BlockSymbolTable;
  name: SourceSlice;
  body: Content[];
}>() {}
export class EndBlock extends node('EndBlock').fields() {}
export class AppendTrustedHTML extends node('AppendTrustedHTML').fields<{
  html: ExpressionNode;
}>() {}
export class AppendTextNode extends node('AppendTextNode').fields<{ text: ExpressionNode }>() {}
export class AppendComment extends node('AppendComment').fields<{ value: SourceSlice }>() {}

export class Component extends node('Component').fields<{
  tag: ExpressionNode;
  params: DynamicElementParameters;
  args: NamedArguments;
  blocks: NamedBlocks;
}>() {}

export interface AttrKind {
  // triple-curly
  trusting: boolean;
  // this attribute is on an element with component features:
  //   - <CapCase ...>
  //   - modifiers
  //   - <dynamic.tag ...>
  component: boolean;
}

export class StaticAttr extends node('StaticAttr').fields<{
  kind: { component: boolean };
  name: SourceSlice;
  value: SourceSlice;
  namespace?: string;
}>() {}

export class DynamicAttr extends node('DynamicAttr').fields<{
  kind: AttrKind;
  name: SourceSlice;
  value: ExpressionNode;
  namespace?: string;
}>() {}

export class SimpleElement extends node('SimpleElement').fields<{
  tag: SourceSlice;
  params: ElementAttrs;
  body: Content[];
}>() {}

export class DynamicElement extends node('DynamicElement').fields<{
  tag: SourceSlice;
  params: DynamicElementParameters;
  body: Content[];
}>() {}

export class DynamicElementParameters extends node('DynamicElementParameters').fields<{
  body: AnyOptionalList<DynamicElementAttr>;
}>() {}

export class ElementAttrs extends node('ElementAttrs').fields<{
  body: AnyOptionalList<ElementAttr>;
}>() {}

export class Yield extends node('Yield').fields<{
  target: SourceSlice;
  to: number;
  positional: Positional;
}>() {}
export class Partial extends node('Partial').fields<{
  target: ExpressionNode;
  scope: SymbolTable;
}>() {}
export class Debugger extends node('Debugger').fields<{ scope: SymbolTable }>() {}

export class CallExpression extends node('CallExpression').fields<{
  callee: ExpressionNode;
  args: Args;
}>() {}
export class Modifier extends node('Modifier').fields<{ callee: ExpressionNode; args: Args }>() {}
export class InvokeBlock extends node('InvokeBlock').fields<{
  head: ExpressionNode;
  args: Args;
  blocks: NamedBlocks;
}>() {}
export class SplatAttr extends node('SplatAttr').fields<{ symbol: number }>() {}
export class PathExpression extends node('PathExpression').fields<{
  head: ExpressionNode;
  tail: Tail;
}>() {}

export class GetSymbol extends node('GetSymbol').fields<{ symbol: number }>() {}
export class GetFreeWithContext extends node('GetFreeWithContext').fields<{
  symbol: number;
  context: ASTv2.FreeVarResolution;
}>() {}
/** strict mode */
export class GetFree extends node('GetFree').fields<{
  symbol: number;
}>() {}

export class Missing extends node('Missing').fields() {}
export class InterpolateExpression extends node('InterpolateExpression').fields<{
  parts: PresentList<ExpressionNode>;
}>() {}
export class HasBlock extends node('HasBlock').fields<{
  target: SourceSlice;
  symbol: number;
}>() {}
export class HasBlockParams extends node('HasBlockParams').fields<{
  target: SourceSlice;
  symbol: number;
}>() {}
export class Positional extends node('Positional').fields<{
  list: OptionalList<ExpressionNode>;
}>() {}
export class NamedArguments extends node('NamedArguments').fields<{
  entries: OptionalList<NamedArgument>;
}>() {
  isEmpty(): boolean {
    return !this.entries.toPresentArray();
  }
}
export class NamedArgument extends node('NamedArgument').fields<{
  key: SourceSlice;
  value: ExpressionNode;
}>() {}
export class Args extends node('Args').fields<{
  positional: Positional;
  named: NamedArguments;
}>() {}
export class Tail extends node('Tail').fields<{ members: PresentArray<SourceSlice> }>() {}

export type ExpressionNode =
  | ASTv2.LiteralExpression
  | Missing
  | PathExpression
  | ASTv2.VariableReference
  | InterpolateExpression
  | CallExpression
  | HasBlock
  | HasBlockParams;

export type ElementAttr = StaticAttr | DynamicAttr;
export type DynamicElementAttr = ElementAttr | SplatAttr | Modifier;

export type Internal =
  | Args
  | Positional
  | NamedArguments
  | NamedArgument
  | Tail
  | NamedBlock
  | NamedBlocks
  | ElementAttrs;
export type ExprLike = ExpressionNode | Internal;
export type Content =
  | InElement
  | Debugger
  | Yield
  | AppendTrustedHTML
  | AppendTextNode
  | Component
  | SimpleElement
  | DynamicElement
  | InvokeBlock
  | Partial
  | AppendComment;
