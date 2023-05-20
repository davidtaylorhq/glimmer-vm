import { registerDestructor } from '@glimmer/destroyable';
import type {
  Bounds,
  CapturedNamedArguments,
  CompilableProgram,
  Destroyable,
  Dict,
  DynamicScope,
  ElementOperations,
  Environment,
  InternalComponentCapabilities,
  Nullable,
  Owner,
  PreparedArguments,
  Reference,
  Template,
  VMArguments,
  WithCreateInstance,
  WithDynamicLayout,
  WithDynamicTagName,
} from '@glimmer/interfaces';
import { setInternalComponentManager } from '@glimmer/manager';
import {
  childRefFor,
  createComputeRef,
  createConstRef,
  createPrimitiveRef,
  valueForRef,
} from '@glimmer/reference';
import { reifyNamed, reifyPositional } from '@glimmer/runtime';
import { EMPTY_ARRAY, keys, unwrapTemplate } from '@glimmer/util';
import {
  consumeTag,
  createTag,
  type DirtyableTag,
  dirtyTag,
  dirtyTagFor,
} from '@glimmer/validator';

import type { TestJitRuntimeResolver } from '../modes/jit/resolver';
import type { TestComponentConstructor } from './types';

export type Attrs = Dict;
export type AttrsDiff = { oldAttrs: Nullable<Attrs>; newAttrs: Attrs };

export interface EmberishCurlyComponentFactory
  extends TestComponentConstructor<EmberishCurlyComponent> {
  fromDynamicScope?: string[];
  positionalParams: string | string[];
  create(options: { attrs: Attrs; targetObject: any }): EmberishCurlyComponent;
  new (...args: unknown[]): this;
}

let GUID = 1;

export class EmberishCurlyComponent {
  public static positionalParams: string[] | string = [];

  public dirtinessTag: DirtyableTag = createTag();
  public declare layout: Template;
  public declare name: string;
  public tagName: Nullable<string> = null;
  public attributeBindings: Nullable<string[]> = null;
  public declare attrs: Attrs;
  public declare element: Element;
  public declare bounds: Bounds;
  public parentView: Nullable<EmberishCurlyComponent> = null;
  public declare args: CapturedNamedArguments;

  public _guid: string;

  // create(options: { attrs: Attrs; targetObject: any }): EmberishCurlyComponent

  static create(args: { attrs: Attrs; targetObject: any }): EmberishCurlyComponent {
    let c = new this();

    for (let key of keys(args)) {
      (c as any)[key] = args[key];
    }

    return c;
  }

  init() {}

  constructor() {
    this._guid = `${GUID++}`;
    this.init();
  }

  set(key: string, value: unknown) {
    (this as any)[key] = value;
    dirtyTagFor(this, key);
  }

  setProperties(dict: Dict) {
    for (let key of keys(dict)) {
      this.set(key, dict[key]);
    }
  }

  recompute() {
    dirtyTag(this.dirtinessTag);
  }

  destroy() {}

  didInitAttrs(_options: { attrs: Attrs }) {}
  didUpdateAttrs(_diff: AttrsDiff) {}
  didReceiveAttrs(_diff: AttrsDiff) {}
  willInsertElement() {}
  willDestroyElement() {}
  willUpdate() {}
  willRender() {}
  didInsertElement() {}
  didUpdate() {}
  didRender() {}
}

export interface EmberishCurlyComponentState {
  component: EmberishCurlyComponent;
  selfRef: Reference;
}

const EMBERISH_CURLY_CAPABILITIES: InternalComponentCapabilities = {
  dynamicLayout: true,
  dynamicTag: true,
  prepareArgs: true,
  createArgs: true,
  attributeHook: true,
  elementHook: true,
  dynamicScope: true,
  createCaller: true,
  updateHook: true,
  createInstance: true,
  wrapped: true,
  willDestroy: true,
  hasSubOwner: false,
};

export class EmberishCurlyComponentManager
  implements
    WithCreateInstance<EmberishCurlyComponentState>,
    WithDynamicTagName<EmberishCurlyComponentState>,
    WithDynamicLayout<EmberishCurlyComponentState, TestJitRuntimeResolver>
{
  getDebugName(state: EmberishCurlyComponentFactory) {
    return state.name;
  }

  getCapabilities(): InternalComponentCapabilities {
    return EMBERISH_CURLY_CAPABILITIES;
  }

  getDynamicLayout({
    component: { layout },
  }: EmberishCurlyComponentState): CompilableProgram | null {
    if (layout) {
      return unwrapTemplate(layout).asWrappedLayout();
    }

    return null;
  }

  prepareArgs(
    definition: EmberishCurlyComponentFactory,
    args: VMArguments
  ): Nullable<PreparedArguments> {
    let { positionalParams } = definition || EmberishCurlyComponent;
    if (typeof positionalParams === 'string') {
      if (args.named.has(positionalParams)) {
        if (args.positional.length === 0) {
          return null;
        } else {
          throw new Error(
            `You cannot specify positional parameters and the hash argument \`${positionalParams}\`.`
          );
        }
      }

      let named = args.named.capture();
      let positional = args.positional.capture();
      named[positionalParams] = createComputeRef(() => reifyPositional(positional));

      return { positional: EMPTY_ARRAY, named } as PreparedArguments;
    } else if (Array.isArray(positionalParams)) {
      let named = { ...args.named.capture()};
      let count = Math.min(positionalParams.length, args.positional.length);

      for (let index = 0; index < count; index++) {
        let name = positionalParams[index] as string;

        if (named[name]) {
          throw new Error(
            `You cannot specify both a positional param (at position ${index}) and the hash argument \`${name}\`.`
          );
        }

        named[name] = args.positional.at(index);
      }

      return { positional: EMPTY_ARRAY, named } as PreparedArguments;
    } else {
      return null;
    }
  }

  create(
    _owner: Owner,
    definition: EmberishCurlyComponentFactory,
    _args: VMArguments,
    _environment: Environment,
    dynamicScope: DynamicScope,
    callerSelf: Reference,
    hasDefaultBlock: boolean
  ): EmberishCurlyComponentState {
    let klass = definition || EmberishCurlyComponent;
    let self = valueForRef(callerSelf);
    let args = _args.named.capture();
    let attributes = reifyNamed(args);
    let merged = {

      ...attributes,
      attrs: attributes,
      args,
      targetObject: self,
      HAS_BLOCK: hasDefaultBlock
    };
    let component = klass.create(merged);

    component.args = args;

    let dyn: Nullable<string[]> = klass.fromDynamicScope || null;

    if (dyn) {
      for (let element of dyn) {
        let name = element;
        component.set(name, valueForRef(dynamicScope.get(name)));
      }
    }

    consumeTag(component.dirtinessTag);

    component.didInitAttrs({ attrs: attributes });
    component.didReceiveAttrs({ oldAttrs: null, newAttrs: attributes });
    component.willInsertElement();
    component.willRender();

    registerDestructor(component, () => component.destroy());

    let selfReference = createConstRef(component, 'this');

    return { component, selfRef: selfReference };
  }

  getSelf({ selfRef }: EmberishCurlyComponentState): Reference<unknown> {
    return selfRef;
  }

  getTagName({ component: { tagName } }: EmberishCurlyComponentState): Nullable<string> {
    if (tagName) {
      return tagName;
    } else if (tagName === null) {
      return 'div';
    } else {
      return null;
    }
  }

  didCreateElement(
    { component, selfRef }: EmberishCurlyComponentState,
    element: Element,
    operations: ElementOperations
  ): void {
    component.element = element;

    operations.setAttribute('id', createPrimitiveRef(`ember${component._guid}`), false, null);
    operations.setAttribute('class', createPrimitiveRef('ember-view'), false, null);

    let bindings = component.attributeBindings;

    if (bindings) {
      for (let attribute of bindings) {
        let reference = childRefFor(selfRef, attribute);

        operations.setAttribute(attribute, reference, false, null);
      }
    }
  }

  didRenderLayout({ component }: EmberishCurlyComponentState, bounds: Bounds): void {
    component.bounds = bounds;
  }

  didCreate({ component }: EmberishCurlyComponentState): void {
    component.didInsertElement();
    registerDestructor(component, () => component.willDestroyElement(), true);

    component.didRender();
  }

  update({ component }: EmberishCurlyComponentState): void {
    let oldAttributes = component.attrs;
    let newAttributes = reifyNamed(component.args);
    let merged = { ...newAttributes, attrs: newAttributes};

    consumeTag(component.dirtinessTag);

    component.setProperties(merged);
    component.didUpdateAttrs({ oldAttrs: oldAttributes, newAttrs: newAttributes });
    component.didReceiveAttrs({ oldAttrs: oldAttributes, newAttrs: newAttributes });
    component.willUpdate();
    component.willRender();
  }

  didUpdateLayout(): void {}

  didUpdate({ component }: EmberishCurlyComponentState): void {
    component.didUpdate();
    component.didRender();
  }

  getDestroyable({ component }: EmberishCurlyComponentState): Destroyable {
    return component;
  }
}

const EMBERISH_CURLY_COMPONENT_MANAGER = new EmberishCurlyComponentManager();

setInternalComponentManager(EMBERISH_CURLY_COMPONENT_MANAGER, EmberishCurlyComponent);
