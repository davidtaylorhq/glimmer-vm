import { TemplateMorph, ContentMorph } from '../morph';
import { ElementStack, DelegatingOperations, NestedOperations, NullHandler } from '../builder';
import { ComponentDefinition, ComponentClass, Component, Block, Scope, Frame } from '../environment';
import Template, { Templates, Hash, EvaluatedHash, StaticAttr, DynamicAttr, Value, AttributeSyntax, hashToAttrList } from '../template';
import { LITERAL, InternedString } from 'htmlbars-util';
import { isWhitespace } from '../dom';
import { RootReference } from 'htmlbars-reference';

interface ComponentOptions {
  definition: ComponentDefinition,
  attrs: Hash,
  templates: Templates
}

class YieldedContents extends TemplateMorph {
  init({ template }) {
    this.template = template;
  }
}

export default class ComponentMorph extends TemplateMorph {
  private attrs: EvaluatedHash;
  private attrSyntax: AttributeSyntax[];
  private klass: ComponentClass;
  private component: Component;
  private innerTemplates: Templates;
  private layoutScope: Scope;
  private definition: ComponentDefinition;

  init({ definition, attrs: hash, templates }: ComponentOptions) {
    this.template = definition.layout.clone();
    this.klass = definition['class'];
    this.innerTemplates = templates;
    this.definition = definition;

    this.attrSyntax = hashToAttrList(hash);
    this.attrs = hash.evaluate(this.frame);
  }

  append(stack: ElementStack) {
    this.willAppend(stack);

    let { frame, innerTemplates, template, definition, attrs } = this;

    let invokeFrame = frame;
    let layoutFrame = this.frame = frame.child();
    let layoutScope = this.layoutScope = layoutFrame.resetScope();
    let attrsValue = attrs.value();
    let create: any = definition.creationObjectForAttrs(this.klass, attrsValue);
    let component = this.component = new this.klass(create);

    layoutScope.bindSelf(component);

    for (let key in innerTemplates) {
      if (!innerTemplates[key]) continue;
      layoutScope.bindBlock(<InternedString>key, new Block(innerTemplates[key], invokeFrame));
    }

    definition.setupLayoutScope(layoutScope, template, innerTemplates.default);

    definition.mergeAttrs(component, template, this.attrSyntax, layoutFrame, invokeFrame);
    let handler = new ComponentHandler(layoutFrame, null);

    this.willAppend(stack);
    definition.hooks.didReceiveAttrs(component);
    definition.hooks.willRender(component);
    super.appendTemplate(template, { handler, nextSibling: stack.nextSibling });

    if (!handler.rootElement) {
      throw new Error("A component must have a single root element at the top level");
    }

    definition.rootElement(component, handler.rootElement);
    this.frame.didCreate(component, definition);
  }

  update() {
    let { frame, definition, component, attrs, layoutScope } = this;

    definition.updateObjectFromAttrs(component, attrs.value());
    layoutScope.updateSelf(component);
    definition.hooks.didReceiveAttrs(component);
    definition.hooks.willUpdate(component);
    definition.hooks.willRender(component);

    super.update();

    frame.didUpdate(component, definition);
  }
}

export class ComponentHandler extends NullHandler {
  public rootElement: Element = null;
  private attrs: AttributeSyntax[];
  private frame: Frame;

  constructor(frame: Frame, attrs: AttributeSyntax[]) {
    super();
    this.frame = frame;
    this.attrs = attrs;
  }

  willOpenElement(tag: string) {
    if (this.rootElement) {
      throw new Error("You cannot create multiple root elements in a component's layout");
    }
  }

  didOpenElement(element: Element) {
    if (this.attrs) this.attrs.forEach(attr => this.stack.appendStatement(attr, this.frame))
    this.rootElement = element;
  }

  willAppendText(text: string) {
    if (isWhitespace(text)) return;
    throw new Error("You cannot have non-whitespace text at the root of a component's layout");
  }

  willCreateContentMorph(Type: typeof ContentMorph, attrs: Object) {
    if (Type.hasStaticElement) return;
    throw new Error("You cannot have curlies (`{{}}`) at the root of a component's layout")
  }
}