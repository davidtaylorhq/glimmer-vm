import { LOCAL_DEBUG } from '@glimmer/local-debug-flags';
import { deprecate } from '@glimmer/util';

import { ASTv1 as AST, VisitorKey, VisitorKeys, visitorKeys } from '../-internal';
import {
  cannotRemoveNode,
  cannotReplaceNode,
  cannotReplaceOrRemoveInKeyHandlerYet,
  KeyHandler,
  KeyTraversal,
  NodeHandler,
  NodeTraversal,
  NodeVisitor,
  WalkerPath,
} from './-internal';

function getEnterFunction<N extends AST.Node>(
  handler: NodeTraversal<N>
): NodeHandler<N> | undefined;
function getEnterFunction<N extends AST.Node, K extends VisitorKey<N>>(
  handler: KeyTraversal<N, K>
): KeyHandler<N, K> | undefined;
function getEnterFunction<N extends AST.Node, K extends VisitorKey<N>>(
  handler: NodeTraversal<N> | KeyTraversal<N, K>
): NodeHandler<N> | KeyHandler<N, K> | undefined {
  if (typeof handler === 'function') {
    return handler;
  } else {
    return handler.enter as NodeHandler<N> | KeyHandler<N, K>;
  }
}

function getExitFunction<N extends AST.Node>(handler: NodeTraversal<N>): NodeHandler<N> | undefined;
function getExitFunction<N extends AST.Node, K extends VisitorKey<N>>(
  handler: KeyTraversal<N, K>
): KeyHandler<N, K> | undefined;
function getExitFunction<N extends AST.Node, K extends VisitorKey<N>>(
  handler: NodeTraversal<N> | KeyTraversal<N, K>
): NodeHandler<N> | KeyHandler<N, K> | undefined {
  if (typeof handler === 'function') {
    return undefined;
  } else {
    return handler.exit as NodeHandler<N> | KeyHandler<N, K>;
  }
}

function getKeyHandler<N extends AST.Node, K extends VisitorKey<N>>(
  handler: NodeTraversal<N>,
  key: K
): KeyTraversal<N, K> | KeyTraversal<N, VisitorKey<N>> | undefined {
  let keyVisitor = typeof handler !== 'function' ? handler.keys : undefined;
  if (keyVisitor === undefined) return;

  let keyHandler = keyVisitor[key];
  if (keyHandler !== undefined) {
    return keyHandler as KeyTraversal<N, K>;
  }
  return keyVisitor.All;
}

function getNodeHandler<N extends AST.Node>(
  visitor: NodeVisitor,
  nodeType: N['type']
): NodeTraversal<N>;
function getNodeHandler(visitor: NodeVisitor, nodeType: 'All'): NodeTraversal<AST.Node>;
function getNodeHandler<N extends AST.Node>(
  visitor: NodeVisitor,
  nodeType: N['type']
): NodeTraversal<AST.Node> | undefined {
  if (nodeType === 'Template' || nodeType === 'Block') {
    if (visitor.Program) {
      if (LOCAL_DEBUG) {
        deprecate(
          `The 'Program' visitor node is deprecated. Use 'Template' or 'Block' instead (node was '${nodeType}') `
        );
      }

      return visitor.Program as NodeTraversal<AST.Node>;
    }
  }

  let handler = visitor[nodeType];
  if (handler !== undefined) {
    return (handler as unknown) as NodeTraversal<AST.Node>;
  }
  return visitor.All;
}

function visitNode<N extends AST.Node>(
  visitor: NodeVisitor,
  path: WalkerPath<N>
): AST.Node | AST.Node[] | undefined | null | void {
  let { node, parent, parentKey } = path;

  let handler: NodeTraversal<N> = getNodeHandler(visitor, node.type);
  let enter;
  let exit;

  if (handler !== undefined) {
    enter = getEnterFunction(handler);
    exit = getExitFunction(handler);
  }

  let result: AST.Node | AST.Node[] | undefined | null | void;
  if (enter !== undefined) {
    result = enter(node, path);
  }

  if (result !== undefined && result !== null) {
    if (JSON.stringify(node) === JSON.stringify(result)) {
      result = undefined;
    } else if (Array.isArray(result)) {
      visitArray(visitor, result, parent, parentKey);
      return result;
    } else {
      let path = new WalkerPath(result, parent, parentKey);
      return visitNode(visitor, path) || result;
    }
  }

  if (result === undefined) {
    let keys = visitorKeys[node.type];

    for (let i = 0; i < keys.length; i++) {
      let key = keys[i] as VisitorKeys[N['type']] & keyof N;
      // we know if it has child keys we can widen to a ParentNode
      visitKey(visitor, handler, path, key);
    }

    if (exit !== undefined) {
      result = exit(node, path);
    }
  }

  return result;
}

function get<N extends AST.Node>(
  node: N,
  key: VisitorKeys[N['type']] & keyof N
): AST.Node | AST.Node[] {
  return (node[key] as unknown) as AST.Node | AST.Node[];
}

function set<N extends AST.Node, K extends keyof N>(node: N, key: K, value: N[K]): void {
  node[key] = value;
}

function visitKey<N extends AST.Node>(
  visitor: NodeVisitor,
  handler: NodeTraversal<N>,
  path: WalkerPath<N>,
  key: VisitorKeys[N['type']] & keyof N
) {
  let { node } = path;

  let value = get(node, key);
  if (!value) {
    return;
  }

  let keyEnter;
  let keyExit;

  if (handler !== undefined) {
    let keyHandler = getKeyHandler(handler, key);
    if (keyHandler !== undefined) {
      keyEnter = getEnterFunction(keyHandler);
      keyExit = getExitFunction(keyHandler);
    }
  }

  if (keyEnter !== undefined) {
    if (keyEnter(node, key) !== undefined) {
      throw cannotReplaceOrRemoveInKeyHandlerYet(node, key);
    }
  }

  if (Array.isArray(value)) {
    visitArray(visitor, value, path, key);
  } else {
    let keyPath = new WalkerPath(value, path, key);
    let result = visitNode(visitor, keyPath);
    if (result !== undefined) {
      // TODO: dynamically check the results by having a table of
      // expected node types in value space, not just type space
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      assignKey(node, key, value, result as any);
    }
  }

  if (keyExit !== undefined) {
    if (keyExit(node, key) !== undefined) {
      throw cannotReplaceOrRemoveInKeyHandlerYet(node, key);
    }
  }
}

function visitArray(
  visitor: NodeVisitor,
  array: AST.Node[],
  parent: WalkerPath<AST.Node> | null,
  parentKey: string | null
) {
  for (let i = 0; i < array.length; i++) {
    let node = array[i];
    let path = new WalkerPath(node, parent, parentKey);
    let result = visitNode(visitor, path);
    if (result !== undefined) {
      i += spliceArray(array, i, result) - 1;
    }
  }
}

function assignKey<N extends AST.Node, K extends VisitorKey<N>>(
  node: N,
  key: K,
  value: AST.Node,
  result: N[K] | [N[K]] | null
) {
  if (result === null) {
    throw cannotRemoveNode(value, node, key);
  } else if (Array.isArray(result)) {
    if (result.length === 1) {
      set(node, key, result[0]);
    } else {
      if (result.length === 0) {
        throw cannotRemoveNode(value, node, key);
      } else {
        throw cannotReplaceNode(value, node, key);
      }
    }
  } else {
    set(node, key, result);
  }
}

function spliceArray(array: AST.Node[], index: number, result: AST.Node | AST.Node[] | null) {
  if (result === null) {
    array.splice(index, 1);
    return 0;
  } else if (Array.isArray(result)) {
    array.splice(index, 1, ...result);
    return result.length;
  } else {
    array.splice(index, 1, result);
    return 1;
  }
}

export default function traverse(node: AST.Node, visitor: NodeVisitor): void {
  let path = new WalkerPath(node);
  visitNode(visitor, path);
}
