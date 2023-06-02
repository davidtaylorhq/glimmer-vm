import { destroy } from '@glimmer/destroyable';
import type {
  ComponentDefinitionState,
  Dict,
  DynamicScope,
  Helper,
  Maybe,
  Nullable,
  RenderResult,
  SimpleElement,
  SimpleNode,
} from '@glimmer/interfaces';
import { inTransaction } from '@glimmer/runtime';
import type { ASTPluginBuilder } from '@glimmer/syntax';
import { assert, clearElement, dict, expect, isPresent, unwrap } from '@glimmer/util';
import { dirtyTagFor } from '@glimmer/validator';
import type { NTuple } from '@glimmer-workspace/test-utils';

import {
  type ComponentBlueprint,
  type ComponentKind,
  type ComponentTypes,
  CURLY_TEST_COMPONENT,
  GLIMMER_TEST_COMPONENT,
} from './components';
import { assertElementShape, assertEmberishElement } from './dom/assertions';
import { assertingElement, toInnerHTML } from './dom/simple-utils';
import type { UserHelper } from './helpers';
import type { TestModifierConstructor } from './modifiers';
import type RenderDelegate from './render-delegate';
import { equalTokens, isServerMarker, type NodesSnapshot, normalizeSnapshot } from './snapshot';

type Expand<T> = T extends infer O ? { [K in keyof O]: O[K] } : never;
type Present<T> = Exclude<T, null | undefined>;

export interface IRenderTest {
  readonly count: Count;
  testType: ComponentKind;
  beforeEach?(): void;
  afterEach?(): void;
}

export class Count {
  private expected: Record<string, number> = {};
  private actual: Record<string, number> = {};

  expect(name: string, count = 1) {
    this.expected[name] = count;
    let previous = this.actual[name] ?? 0;
    this.actual[name] = previous + 1;
  }

  assert() {
    if (Object.keys(this.actual).length > 0 || Object.keys(this.expected).length > 0) {
      QUnit.assert.deepEqual(
        this.actual,
        this.expected,
        `counts match expectations (${JSON.stringify(this.expected)})`
      );
    } else {
      // FIXME: this means that the test has no assertions
      QUnit.assert.pushResult({
        result: true,
        message: `no counts found`,
      });
    }
  }
}

export class RenderTest implements IRenderTest {
  testType: ComponentKind = 'unknown';

  protected assert = QUnit.assert;
  protected context: Dict = dict();
  protected renderResult: Nullable<RenderResult> = null;
  protected helpers = dict<UserHelper>();
  protected snapshot: NodesSnapshot = [];
  protected delegate: RenderDelegate;
  readonly count = new Count();

  constructor(delegate: RenderDelegate) {
    this.delegate = delegate;
  }

  #currentBuilderElement(): Element | SimpleElement {
    return this.delegate.getCurrentBuilder()._currentElement_ as Element | SimpleElement;
  }

  capture<T>() {
    let instance: T;
    return {
      capture: (value: T) => (instance = value),
      get captured(): T {
        return unwrap(instance);
      },
    };
  }

  registerPlugin(plugin: ASTPluginBuilder): void {
    this.delegate.registerPlugin(plugin);
  }

  registerHelper(name: string, helper: UserHelper): void {
    this.delegate.registerHelper(name, helper);
  }

  registerInternalHelper(name: string, helper: Helper): void {
    this.delegate.registerInternalHelper(name, helper);
  }

  registerModifier(name: string, ModifierClass: TestModifierConstructor): void {
    this.delegate.registerModifier(name, ModifierClass);
  }

  registerComponent<K extends ComponentKind>(
    type: K,
    name: string,
    layout: string,
    Class?: ComponentTypes[K]
  ): void {
    this.delegate.registerComponent(type, this.testType, name, layout, Class);
  }

  buildComponent(blueprint: ComponentBlueprint): string {
    let invocation = '';
    switch (this.testType) {
      case 'Glimmer':
        invocation = this.buildGlimmerComponent(blueprint);
        break;
      case 'Curly':
        invocation = this.buildCurlyComponent(blueprint);
        break;
      case 'Dynamic':
        invocation = this.buildDynamicComponent(blueprint);
        break;
      case 'TemplateOnly':
        invocation = this.buildTemplateOnlyComponent(blueprint);
        break;

      default:
        throw new Error(`Invalid test type ${this.testType}`);
    }

    return invocation;
  }

  private buildArgs(args: Dict): string {
    let { testType } = this;
    let sigil = '';
    let needsCurlies = false;

    if (testType === 'Glimmer' || testType === 'TemplateOnly') {
      sigil = '@';
      needsCurlies = true;
    }

    return `${Object.keys(args)
      .map((argument) => {
        let rightSide: string;

        let value = args[argument] as Maybe<string[]>;
        if (needsCurlies) {
          let isString = value && (value[0] === "'" || value[0] === '"');
          rightSide = isString ? `${value}` : `{{${value}}}`;
        } else {
          rightSide = `${value}`;
        }

        return `${sigil}${argument}=${rightSide}`;
      })
      .join(' ')}`;
  }

  private buildBlockParams(blockParameters: string[]): string {
    return `${blockParameters.length > 0 ? ` as |${blockParameters.join(' ')}|` : ''}`;
  }

  private buildElse(elseBlock: string | undefined): string {
    return `${elseBlock ? `{{else}}${elseBlock}` : ''}`;
  }

  private buildAttributes(attributes: Dict = {}): string {
    return Object.keys(attributes)
      .map((attribute) => `${attribute}=${attributes[attribute]}`)
      .join(' ');
  }

  private buildAngleBracketComponent(blueprint: ComponentBlueprint): string {
    let {
      args = {},
      attributes = {},
      template,
      name = GLIMMER_TEST_COMPONENT,
      blockParams: blockParameters = [],
    } = blueprint;

    let invocation: string | string[] = [];

    invocation.push(`<${name}`);

    let componentArgs = this.buildArgs(args);

    if (componentArgs !== '') {
      invocation.push(componentArgs);
    }

    let attributes_ = this.buildAttributes(attributes);
    if (attributes_ !== '') {
      invocation.push(attributes_);
    }

    let open = invocation.join(' ');
    invocation = [open];

    if (template) {
      let block: string | string[] = [];
      let parameters = this.buildBlockParams(blockParameters);
      if (parameters !== '') {
        block.push(parameters);
      }
      block.push(`>`, template, `</${name}>`);
      invocation.push(block.join(''));
    } else {
      invocation.push(' ', `/>`);
    }

    return invocation.join('');
  }

  private buildGlimmerComponent(blueprint: ComponentBlueprint): string {
    let { tag = 'div', layout, name = GLIMMER_TEST_COMPONENT } = blueprint;
    let invocation = this.buildAngleBracketComponent(blueprint);
    let layoutAttributes = this.buildAttributes(blueprint.layoutAttributes);
    this.assert.ok(
      true,
      `generated glimmer layout as ${`<${tag} ${layoutAttributes} ...attributes>${layout}</${tag}>`}`
    );
    this.delegate.registerComponent(
      'Glimmer',
      this.testType,
      name,
      `<${tag} ${layoutAttributes} ...attributes>${layout}</${tag}>`
    );
    this.assert.ok(true, `generated glimmer invocation as ${invocation}`);
    return invocation;
  }

  private buildCurlyBlockTemplate(
    name: string,
    template: string,
    blockParameters: string[],
    elseBlock?: string
  ): string {
    let block: string[] = [];
    block.push(
      this.buildBlockParams(blockParameters),
      '}}',
      template,
      this.buildElse(elseBlock),
      `{{/${name}}}`
    );
    return block.join('');
  }

  private buildCurlyComponent(blueprint: ComponentBlueprint): string {
    let {
      args = {},
      layout,
      template,
      attributes,
      else: elseBlock,
      name = CURLY_TEST_COMPONENT,
      blockParams: blockParameters = [],
    } = blueprint;

    if (attributes) {
      throw new Error('Cannot pass attributes to curly components');
    }

    let invocation: string[] | string = [];

    if (template) {
      invocation.push(`{{#${name}`);
    } else {
      invocation.push(`{{${name}`);
    }

    let componentArgs = this.buildArgs(args);

    if (componentArgs !== '') {
      invocation.push(' ', componentArgs);
    }

    if (template) {
      invocation.push(this.buildCurlyBlockTemplate(name, template, blockParameters, elseBlock));
    } else {
      invocation.push('}}');
    }
    this.assert.ok(true, `generated curly layout as ${layout}`);
    this.delegate.registerComponent('Curly', this.testType, name, layout);
    invocation = invocation.join('');
    this.assert.ok(true, `generated curly invocation as ${invocation}`);
    return invocation;
  }

  private buildTemplateOnlyComponent(blueprint: ComponentBlueprint): string {
    let { layout, name = GLIMMER_TEST_COMPONENT } = blueprint;
    let invocation = this.buildAngleBracketComponent(blueprint);
    this.assert.ok(true, `generated fragment layout as ${layout}`);
    this.delegate.registerComponent('TemplateOnly', this.testType, name, `${layout}`);
    this.assert.ok(true, `generated fragment invocation as ${invocation}`);
    return invocation;
  }

  private buildDynamicComponent(blueprint: ComponentBlueprint): string {
    let {
      args = {},
      layout,
      template,
      attributes,
      else: elseBlock,
      name = GLIMMER_TEST_COMPONENT,
      blockParams: blockParameters = [],
    } = blueprint;

    if (attributes) {
      throw new Error('Cannot pass attributes to curly components');
    }

    let invocation: string | string[] = [];
    if (template) {
      invocation.push('{{#component this.componentName');
    } else {
      invocation.push('{{component this.componentName');
    }

    let componentArgs = this.buildArgs(args);

    if (componentArgs !== '') {
      invocation.push(' ', componentArgs);
    }

    if (template) {
      invocation.push(
        this.buildCurlyBlockTemplate('component', template, blockParameters, elseBlock)
      );
    } else {
      invocation.push('}}');
    }

    this.assert.ok(true, `generated dynamic layout as ${layout}`);
    this.delegate.registerComponent('Curly', this.testType, name, layout);
    invocation = invocation.join('');
    this.assert.ok(true, `generated dynamic invocation as ${invocation}`);

    return invocation;
  }

  shouldBeVoid(tagName: string) {
    let element = this.#currentBuilderElement();
    clearElement(element);
    let builder = this.delegate.getCurrentBuilder();

    let html = '<' + tagName + " data-foo='bar'><p>hello</p>";
    this.delegate.renderTemplate(html, this.context, builder, () => this.takeSnapshot());

    let tag = '<' + tagName + ' data-foo="bar">';
    let closing = '</' + tagName + '>';
    let extra = '<p>hello</p>';
    html = toInnerHTML(element);

    QUnit.assert.pushResult({
      result: html === tag + extra || html === tag + closing + extra,
      actual: html,
      expected: tag + closing + extra,
      message: tagName + ' should be a void element',
    });
  }

  render(template: string | ComponentBlueprint, properties: Dict<unknown> = {}): void {
    try {
      QUnit.assert.ok(true, `Rendering ${template}${formatArgs(properties)}`);
    } catch {
      // couldn't stringify, possibly has a circular dependency
    }

    if (typeof template === 'object') {
      let blueprint = template;
      template = this.buildComponent(blueprint);

      if (this.testType === 'Dynamic' && properties['componentName'] === undefined) {
        properties['componentName'] = blueprint.name || GLIMMER_TEST_COMPONENT;
      }
    }

    this.setProperties(properties);
    let builder = this.delegate.getCurrentBuilder();
    let element = builder._currentElement_;

    this.renderResult = this.delegate.renderTemplate(template, this.context, builder, () =>
      this.takeSnapshot(element)
    );
  }

  renderComponent(
    component: ComponentDefinitionState,
    args: Dict<unknown> = {},
    dynamicScope?: DynamicScope
  ): void {
    try {
      QUnit.assert.step(`[rendering] ${String(component)}${formatArgs(args)}`);
    } catch {
      // couldn't stringify, possibly has a circular dependency
    }

    assert(
      !!this.delegate.renderComponent,
      'Attempted to render a component, but the delegate did not implement renderComponent'
    );

    this.renderResult = this.delegate.renderComponent(
      component,
      args,
      this.delegate.getInitialBuilder(),
      dynamicScope
    );
  }

  rerender(properties: Dict<unknown> = {}, message?: string): void {
    let stepMessage = message ? `[rerender] ${message}` : `[rerender]`;

    try {
      QUnit.assert.step(
        Object.keys(properties).length > 0 ? `${stepMessage}${formatArgs(properties)}` : stepMessage
      );
    } catch {
      // couldn't stringify, possibly has a circular dependency
    }

    this.setProperties(properties);

    let result = expect(this.renderResult, 'the test should call render() before rerender()');

    try {
      result.environment.begin();
      result.rerender();
    } finally {
      result.environment.commit();
    }
  }

  destroy(): void {
    let result = expect(this.renderResult, 'the test should call render() before destroy()');

    inTransaction(result.environment, () => destroy(result));
  }

  protected set(key: string, value: unknown): void {
    this.context[key] = value;
    dirtyTagFor(this.context, key);
  }

  protected setProperties(properties: Dict<unknown>): void {
    for (let key in properties) {
      this.set(key, properties[key]);
    }
  }

  protected takeSnapshot(
    element: Element | SimpleElement = this.#currentBuilderElement()
  ): NodesSnapshot {
    let snapshot: NodesSnapshot = (this.snapshot = []);

    let node: Nullable<Node | SimpleNode> = element.firstChild;
    let upped = false;

    while (node && node !== element) {
      if (upped) {
        if (node.nextSibling) {
          node = node.nextSibling;
          upped = false;
        } else {
          snapshot.push('up');
          node = node.parentNode;
        }
      } else {
        if (!isServerMarker(node)) snapshot.push(node);

        if (node.firstChild) {
          snapshot.push('down');
          node = node.firstChild;
        } else if (node.nextSibling) {
          node = node.nextSibling;
        } else {
          snapshot.push('up');
          node = node.parentNode;
          upped = true;
        }
      }
    }

    return snapshot;
  }

  protected assertStableRerender() {
    this.takeSnapshot(this.delegate.getCurrentBuilder()._currentElement_);
    this.runTask(() => this.rerender());
    this.assertStableNodes();
  }

  protected guard(condition: any, message: string): asserts condition {
    if (condition) {
      this.assert.ok(condition, message);
    } else {
      throw new Error(`Guard Failed: message`);
    }
  }

  protected guardWith<T, U extends T, K extends string>(
    desc: { [P in K]: T },
    { condition }: { condition: (value: T) => value is U }
  ): U {
    let [description, value] = Object.entries(desc)[0] as [string, T];

    if (condition(value)) {
      this.assert.ok(
        condition(value),
        `${description} satisfied ${condition.name ?? '{anonymous guard}'}`
      );
      return value;
    } else {
      throw new Error(
        `Guard Failed: ${description} didn't satisfy ${condition.name ?? '{anonymous guard}'}`
      );
    }
  }

  protected guardPresent<T, K extends string>(desc: { [P in K]: T }): Present<T> {
    let [description, value] = Object.entries(desc)[0] as [string, T];

    let missing = value === undefined || value === null;

    if (missing) {
      throw new Error(`Guard Failed: ${description} was not present (was ${String(value)})`);
    }

    this.assert.ok(!missing, `${description} was present`);

    return value as Present<T>;
  }

  protected guardArray<T extends Maybe<unknown>[], K extends string>(desc: { [P in K]: T }): {
    [K in keyof T]: Present<T[K]>;
  };
  protected guardArray<T, K extends string, N extends number>(
    desc: { [P in K]: Iterable<T> | ArrayLike<T> },
    options: { min: N }
  ): Expand<NTuple<N, Present<T>>>;
  protected guardArray<T, U extends T, K extends string, N extends number>(
    desc: { [P in K]: Iterable<T> | ArrayLike<T> },
    options: { min: N; condition: (value: T) => value is U }
  ): Expand<NTuple<N, U>>;
  protected guardArray<T, K extends string, A extends ArrayLike<T>>(desc: { [P in K]: A }): Expand<
    NTuple<A['length'], Present<T>>
  >;
  protected guardArray<T, K extends string>(desc: {
    [P in K]: Iterable<T> | ArrayLike<T>;
  }): Present<T>[];
  protected guardArray<T, K extends string, U extends T>(
    desc: {
      [P in K]: Iterable<T> | ArrayLike<T>;
    },
    options: { condition: (value: T) => value is U; min?: number }
  ): U[];
  protected guardArray(
    desc: Record<string, Iterable<unknown> | ArrayLike<unknown>>,
    options?: {
      min?: Maybe<number>;
      condition?: (value: unknown) => boolean;
    }
  ): unknown[] {
    let [message, list] = Object.entries(desc)[0] as [string, unknown[]];

    let array: unknown[] = [...list];
    let condition: (value: unknown) => boolean;

    if (typeof options?.min === 'number') {
      if (array.length < options.min) {
        throw new Error(
          `Guard Failed: expected to have at least ${options.min} (of ${message}), but got ${array.length}`
        );
      }

      array = array.slice(0, options.min);
      condition = (value) => value !== null && value !== undefined;
      message = `${message}: ${options.min} present elements`;
    } else if (options?.condition) {
      condition = options.condition;
    } else {
      condition = isPresent;
      message = `${message}: all are present`;
    }

    let succeeds = array.every(condition);

    if (succeeds) {
      this.assert.ok(succeeds, message);
    } else {
      throw new Error(`Guard Failed: ${message}`);
    }

    return array;
  }

  protected assertHTML(html: string, elementOrMessage?: SimpleElement | string, message?: string) {
    let element = this.#currentBuilderElement();
    if (typeof elementOrMessage === 'object') {
      equalTokens(elementOrMessage || element, html, message ? `${html} (${message})` : html);
    } else {
      equalTokens(element, html, elementOrMessage ? `${html} (${elementOrMessage})` : html);
    }
    this.takeSnapshot(element);
  }

  protected assertComponent(content: string, attributes: Object = {}) {
    let parent = this.#currentBuilderElement();

    let element = assertingElement(parent.firstChild);

    switch (this.testType) {
      case 'Glimmer':
        assertElementShape(element, 'div', attributes, content);
        break;
      default:
        assertEmberishElement(element, 'div', attributes, content);
    }

    this.takeSnapshot(element);
  }

  private runTask<T>(callback: () => T): T {
    return callback();
  }

  protected assertStableNodes(
    // eslint-disable-next-line unicorn/no-object-as-default-parameter
    { except: _except }: { except: SimpleNode | SimpleNode[] } = {
      except: [],
    }
  ) {
    let except: Array<SimpleNode>;

    except = Array.isArray(_except) ? uniq(_except) : [_except];

    let { oldSnapshot, newSnapshot } = normalizeSnapshot(
      this.snapshot,
      this.takeSnapshot(this.#currentBuilderElement()),
      except
    );

    this.assert.deepEqual(oldSnapshot, newSnapshot, 'DOM nodes are stable');
  }
}

export class BrowserRenderTest extends RenderTest {
  get element() {
    return this.delegate.getCurrentBuilder()._currentElement_;
  }
}

function uniq(array: any[]) {
  return [...new Set(array)];
}

function formatArgs(properties: Dict<unknown>) {
  if (Object.keys(properties).length === 0) {
    return '';
  }

  return (
    ' with ' +
    Object.entries(properties)
      .map(([key, value]) => `@${key}=${JSON.stringify(value)}`)
      .join(' ')
  );
}
