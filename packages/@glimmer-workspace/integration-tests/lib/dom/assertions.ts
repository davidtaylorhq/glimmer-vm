import type { Dict, SimpleElement, SimpleNode } from '@glimmer/interfaces';
import { dict, isSimpleElement } from '@glimmer/util';

export interface DebugElement {
  element: SimpleElement | null | undefined;
  description: string;
}

function isDebugElement(element: SimpleNode | Node | DebugElement): element is DebugElement {
  return !('nodeType' in element);
}

function extract(node: EqualsElement): DebugElement {
  if (node === null || node === undefined) {
    return { element: node, description: 'element' };
  } else if (isDebugElement(node)) {
    return node;
  } else if (isSimpleElement(node)) {
    return { element: node, description: `${node.tagName}` };
  } else {
    return { element: null, description: `${node.constructor.name}` };
  }
}

export type EqualsElement = SimpleNode | Node | null | undefined | DebugElement;

export function equalsElement(
  input: EqualsElement,
  tagName: string,
  attributes: Dict,
  content: string | null
) {
  let { element, description } = extract(input);

  if (element === null || element === undefined) {
    QUnit.assert.pushResult({
      result: false,
      actual: element,
      expected: true,
      message: `failed - expected ${description} to be present (it was ${
        element === null ? 'null' : 'missing'
      })`,
    });
    return;
  }

  QUnit.assert.pushResult({
    result: element.tagName === tagName.toUpperCase(),
    actual: element.tagName.toLowerCase(),
    expected: tagName,
    message: `expect ${description}'s tagName to be ${tagName}`,
  });

  let expectedAttributes: Dict<Matcher> = dict<Matcher>();

  let expectedCount = 0;
  for (let [property, expected] of Object.entries(attributes)) {
    expectedCount++;

    let matcher: Matcher = isMatcher(expected) ? expected : equalsAttr(expected);
    expectedAttributes[property] = matcher;

    QUnit.assert.pushResult({
      result: matcher.match(element && element.getAttribute(property)),
      actual: matcher.fail(element && element.getAttribute(property)),
      expected: matcher.fail(element && element.getAttribute(property)),
      message: `Expected ${description}'s ${property} attribute ${matcher.expected()}`,
    });
  }

  let actualAttributes = dict();
  if (element) {
    // eslint-disable-next-line unicorn/prefer-spread
    for (let attribute of Array.from(element.attributes)) {
      actualAttributes[attribute.name] = attribute.value;
    }
  }

  if (element instanceof HTMLElement) {
    QUnit.assert.pushResult({
      result: element.attributes.length === expectedCount,
      actual: element.attributes.length,
      expected: expectedCount,
      message: `Expected ${expectedCount} attributes; got ${element.outerHTML}`,
    });

    if (content !== null) {
      QUnit.assert.pushResult({
        result: element.innerHTML === content,
        actual: element.innerHTML,
        expected: content,
        message: `${description} had '${content}' as its content`,
      });
    }
  } else {
    QUnit.assert.pushResult({
      result: element instanceof HTMLElement,
      actual: null,
      expected: null,
      message: 'Element must be an HTML Element, not an SVG Element',
    });
  }
}

// TODO: Consider removing this
interface CompatibleTagNameMap extends ElementTagNameMap {
  foreignobject: SVGForeignObjectElement;
}

export function assertIsElement(node: SimpleNode | null): node is SimpleElement {
  let nodeType = node === null ? null : node.nodeType;
  QUnit.assert.pushResult({
    result: nodeType === 1,
    expected: 1,
    actual: nodeType,
    message: 'expected node to be an element',
  });
  return nodeType === 1;
}

export function assertNodeTagName<
  T extends keyof CompatibleTagNameMap,
  U extends CompatibleTagNameMap[T]
>(node: SimpleNode | null, tagName: T): node is SimpleNode & U {
  if (assertIsElement(node)) {
    let lowerTagName = node.tagName.toLowerCase();
    let nodeTagName = node.tagName;

    QUnit.assert.pushResult({
      result: lowerTagName === tagName || nodeTagName === tagName,
      expected: tagName,
      actual: nodeTagName,
      message: `expected tagName to be ${tagName} but was ${nodeTagName}`,
    });
    return nodeTagName === tagName || lowerTagName === tagName;
  }
  return false;
}

export function equalsAttr(expected: any): Matcher {
  return {
    '3d4ef194-13be-4ccf-8dc7-862eea02c93e': true,
    match(actual: any) {
      return expected === actual;
    },

    expected() {
      return `to equal ${expected}`;
    },

    fail(actual: any) {
      return `${actual} did not equal ${expected}`;
    },
  };
}

export function assertEmberishElement(
  element: SimpleElement | Element,
  tagName: string,
  attributes: Object,
  contents: string
): void;
export function assertEmberishElement(
  element: SimpleElement | Element,
  tagName: string,
  attributes: Object
): void;
export function assertEmberishElement(
  element: SimpleElement | Element,
  tagName: string,
  contents: string
): void;
export function assertEmberishElement(element: SimpleElement | Element, tagName: string): void;
export function assertEmberishElement(...args: any[]): void {
  let [element, tagName, attributes, contents] = processAssertComponentArgs(args);

  let fullAttributes = {
    class: classes('ember-view'),
    id: regex(/^ember\d*$/u),
    ...attributes,
  };

  equalsElement(element, tagName, fullAttributes, contents);
}

export function assertSerializedInElement(result: string, expected: string, message?: string) {
  let matched = /<script glmr="%cursor:\d*.%"><\/script>/u.exec(result);

  if (matched) {
    QUnit.assert.ok(true, `has cursor ${matched[0]}`);
    let [, trimmed] = result.split(matched[0]);
    QUnit.assert.strictEqual(trimmed, expected, message);
  } else {
    QUnit.assert.ok(false, `does not have a cursor`);
  }
}

export function classes(expected: string) {
  return {
    '3d4ef194-13be-4ccf-8dc7-862eea02c93e': true,
    match(actual: string) {
      return actual && expected.split(' ').sort().join(' ') === actual.split(' ').sort().join(' ');
    },
    expected() {
      return `to include '${expected}'`;
    },
    fail(actual: string) {
      return `'${actual}'' did not match '${expected}'`;
    },
  };
}

export function regex(r: RegExp) {
  return {
    '3d4ef194-13be-4ccf-8dc7-862eea02c93e': true,
    match(v: string) {
      return r.test(v);
    },
    expected() {
      return `to match ${r}`;
    },
    fail(actual: string) {
      return `${actual} did not match ${r}`;
    },
  };
}

interface Matcher {
  '3d4ef194-13be-4ccf-8dc7-862eea02c93e': boolean;
  match(actual: any): boolean;
  fail(actual: any): string;
  expected(): string;
}

export const MATCHER = '3d4ef194-13be-4ccf-8dc7-862eea02c93e';

export function isMatcher(input: unknown): input is Matcher {
  if (typeof input !== 'object' || input === null) return false;
  return MATCHER in input;
}

/**
  Accomodates the various signatures of `assertEmberishElement` and `assertElement`, which can be any of:

  - element, tagName, attrs, contents
  - element, tagName, contents
  - element, tagName, attrs
  - element, tagName

  TODO: future refactorings should clean up this interface (likely just making all callers pass a POJO)
*/
export function processAssertComponentArgs(
  args: any[]
): [SimpleElement, string, any, string | null] {
  let element = args[0];

  if (args.length === 3) {
    return typeof args[2] === 'string'
      ? [element, args[1], {}, args[2]]
      : [element, args[1], args[2], null];
  } else if (args.length === 2) {
    return [element, args[1], {}, null];
  } else {
    return [args[0], args[1], args[2], args[3]];
  }
}

export function assertElementShape(
  element: SimpleElement | Element,
  tagName: string,
  attributes: Object,
  contents: string
): void;
export function assertElementShape(
  element: SimpleElement | Element,
  tagName: string,
  attributes: Object
): void;
export function assertElementShape(
  element: SimpleElement | Element,
  tagName: string,
  contents: string
): void;
export function assertElementShape(element: SimpleElement | Element, tagName: string): void;
export function assertElementShape(...args: any[]): void {
  let [element, tagName, attributes, contents] = processAssertComponentArgs(args);

  equalsElement(element, tagName, attributes, contents);
}
