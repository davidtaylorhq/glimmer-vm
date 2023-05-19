import {
  check,
  CheckElement,
  CheckMaybe,
  CheckNode,
  CheckOption,
  CheckString,
} from '@glimmer/debug';
import { associateDestroyableChild, destroy } from '@glimmer/destroyable';
import type {
  CapturedPositionalArguments,
  Environment,
  ModifierDefinition,
  ModifierDefinitionState,
  ModifierInstance,
  Nullable,
  Owner,
  UpdatingOpcode,
  UpdatingVM,
} from '@glimmer/interfaces';
import { createComputeRef, isConstRef, type Reference, valueForRef } from '@glimmer/reference';
import { debugToString, expect, isObject } from '@glimmer/util';
import {
  consumeTag,
  CURRENT_TAG,
  type Revision,
  type Tag,
  validateTag,
  valueForTag,
} from '@glimmer/validator';
import {
  $t0,
  CLOSE_ELEMENT_OP,
  COMMENT_OP,
  DYNAMIC_ATTR_OP,
  DYNAMIC_MODIFIER_OP,
  FLUSH_ELEMENT_OP,
  MODIFIER_OP,
  OPEN_DYNAMIC_ELEMENT_OP,
  OPEN_ELEMENT_OP,
  POP_REMOTE_ELEMENT_OP,
  PUSH_REMOTE_ELEMENT_OP,
  STATIC_ATTR_OP,
  TEXT_OP,
  CURRIED_MODIFIER,
} from '@glimmer/vm-constants';

import { type CurriedValue, isCurriedType, resolveCurriedValue } from '../../curried-value';
import { define } from '../../opcodes';
import { CONSTANTS } from '../../symbols';
import type { DynamicAttribute } from '../../vm/attributes/dynamic';
import { CheckArguments, CheckOperations, CheckReference } from './-debug-strip';
import { Assert } from './vm';

define(TEXT_OP, (vm, { op1: text }) => {
  vm._elements_().appendText(vm[CONSTANTS].getValue(text));
});

define(COMMENT_OP, (vm, { op1: text }) => {
  vm._elements_().appendComment(vm[CONSTANTS].getValue(text));
});

define(OPEN_ELEMENT_OP, (vm, { op1: tag }) => {
  vm._elements_().openElement(vm[CONSTANTS].getValue(tag));
});

define(OPEN_DYNAMIC_ELEMENT_OP, (vm) => {
  let tagName = check(valueForRef(check(vm.stack.pop(), CheckReference)), CheckString);
  vm._elements_().openElement(tagName);
});

define(PUSH_REMOTE_ELEMENT_OP, (vm) => {
  let elementReference = check(vm.stack.pop(), CheckReference);
  let insertBeforeReference = check(vm.stack.pop(), CheckReference);
  let guidReference = check(vm.stack.pop(), CheckReference);

  let element = check(valueForRef(elementReference), CheckElement);
  let insertBefore = check(valueForRef(insertBeforeReference), CheckMaybe(CheckOption(CheckNode)));
  let guid = valueForRef(guidReference) as string;

  if (!isConstRef(elementReference)) {
    vm._updateWith_(new Assert(elementReference));
  }

  if (insertBefore !== undefined && !isConstRef(insertBeforeReference)) {
    vm._updateWith_(new Assert(insertBeforeReference));
  }

  let block = vm._elements_().pushRemoteElement(element, guid, insertBefore);
  if (block) vm._associateDestroyable_(block);
});

define(POP_REMOTE_ELEMENT_OP, (vm) => {
  vm._elements_().popRemoteElement();
});

define(FLUSH_ELEMENT_OP, (vm) => {
  let operations = check(vm._fetchValue_($t0), CheckOperations);
  let modifiers: Nullable<ModifierInstance[]> = null;

  if (operations) {
    modifiers = operations.flush(vm);
    vm._loadValue_($t0, null);
  }

  vm._elements_().flushElement(modifiers);
});

define(CLOSE_ELEMENT_OP, (vm) => {
  let modifiers = vm._elements_().closeElement();

  if (modifiers) {
    for (const modifier of modifiers) {
      vm.env.scheduleInstallModifier(modifier);
      let { manager, state } = modifier;
      let d = manager.getDestroyable(state);

      if (d) {
        vm._associateDestroyable_(d);
      }
    }
  }
});

define(MODIFIER_OP, (vm, { op1: handle }) => {
  if (vm.env.isInteractive === false) {
    return;
  }

  let owner = vm._getOwner_();
  let args = check(vm.stack.pop(), CheckArguments);
  let definition = vm[CONSTANTS].getValue<ModifierDefinition>(handle);

  let { manager } = definition;

  let { _constructing_ } = vm._elements_();

  let state = manager.create(
    owner,
    expect(_constructing_, 'BUG: ElementModifier could not find the element it applies to'),
    definition.state,
    args.capture()
  );

  let instance: ModifierInstance = {
    manager,
    state,
    definition,
  };

  let operations = expect(
    check(vm._fetchValue_($t0), CheckOperations),
    'BUG: ElementModifier could not find operations to append to'
  );

  operations.addModifier(instance);

  let tag = manager.getTag(state);

  if (tag !== null) {
    consumeTag(tag);
    return vm._updateWith_(new UpdateModifierOpcode(tag, instance));
  }
});

define(DYNAMIC_MODIFIER_OP, (vm) => {
  if (vm.env.isInteractive === false) {
    return;
  }

  let { stack, [CONSTANTS]: constants } = vm;
  let reference = check(stack.pop(), CheckReference);
  let args = check(stack.pop(), CheckArguments).capture();
  let { _constructing_ } = vm._elements_();
  let initialOwner = vm._getOwner_();

  let instanceReference = createComputeRef(() => {
    let value = valueForRef(reference);
    let owner: Owner;

    if (!isObject(value)) {
      return;
    }

    let hostDefinition: CurriedValue | ModifierDefinitionState;

    if (isCurriedType(value, CURRIED_MODIFIER)) {
      let {
        definition: resolvedDefinition,
        owner: curriedOwner,
        positional,
        named,
      } = resolveCurriedValue(value);

      hostDefinition = resolvedDefinition;
      owner = curriedOwner;

      if (positional !== undefined) {
        args.positional = positional.concat(args.positional) as CapturedPositionalArguments;
      }

      if (named !== undefined) {
        args.named = Object.assign({}, ...named, args.named);
      }
    } else {
      hostDefinition = value;
      owner = initialOwner;
    }

    let handle = constants.modifier(hostDefinition, null, true);

    if (import.meta.env.DEV && handle === null) {
      throw new Error(
        `Expected a dynamic modifier definition, but received an object or function that did not have a modifier manager associated with it. The dynamic invocation was \`{{${
          reference.debugLabel
        }}}\`, and the incorrect definition is the value at the path \`${
          reference.debugLabel
        }\`, which was: ${debugToString!(hostDefinition)}`
      );
    }

    let definition = constants.getValue<ModifierDefinition>(
      expect(handle, 'BUG: modifier handle expected')
    );

    let { manager } = definition;

    let state = manager.create(
      owner,
      expect(_constructing_, 'BUG: ElementModifier could not find the element it applies to'),
      definition.state,
      args
    );

    return {
      manager,
      state,
      definition,
    };
  });

  let instance = valueForRef(instanceReference);
  let tag = null;

  if (instance !== undefined) {
    let operations = expect(
      check(vm._fetchValue_($t0), CheckOperations),
      'BUG: ElementModifier could not find operations to append to'
    );

    operations.addModifier(instance);

    tag = instance.manager.getTag(instance.state);

    if (tag !== null) {
      consumeTag(tag);
    }
  }

  if (!isConstRef(reference) || tag) {
    return vm._updateWith_(new UpdateDynamicModifierOpcode(tag, instance, instanceReference));
  }
});

export class UpdateModifierOpcode implements UpdatingOpcode {
  #lastUpdated: Revision;
  readonly #tag: Tag;
  readonly #modifier: ModifierInstance;
  constructor(tag: Tag, modifier: ModifierInstance) {
    this.#tag = tag;
    this.#modifier = modifier;
    this.#lastUpdated = valueForTag(tag);
  }

  evaluate(vm: UpdatingVM) {
    let tag = this.#tag;

    consumeTag(tag);

    if (!validateTag(tag, this.#lastUpdated)) {
      vm.env.scheduleUpdateModifier(this.#modifier);
      this.#lastUpdated = valueForTag(tag);
    }
  }
}

export class UpdateDynamicModifierOpcode implements UpdatingOpcode {
  #lastUpdated: Revision;
  #tag: Tag | null;
  #instance: ModifierInstance | undefined;
  readonly #instanceRef: Reference<ModifierInstance | undefined>;

  constructor(
    tag: Tag | null,
    instance: ModifierInstance | undefined,
    instanceReference: Reference<ModifierInstance | undefined>
  ) {
    this.#tag = tag;
    this.#instance = instance;
    this.#instanceRef = instanceReference;
    this.#lastUpdated = valueForTag(tag ?? CURRENT_TAG);
  }

  evaluate(vm: UpdatingVM) {
    let tag = this.#tag;
    let lastUpdated = this.#lastUpdated;
    let instance = this.#instance;
    let instanceReference = this.#instanceRef;

    let newInstance = valueForRef(instanceReference);

    if (newInstance !== instance) {
      if (instance !== undefined) {
        let destroyable = instance.manager.getDestroyable(instance.state);

        if (destroyable !== null) {
          destroy(destroyable);
        }
      }

      if (newInstance !== undefined) {
        let { manager, state } = newInstance;
        let destroyable = manager.getDestroyable(state);

        if (destroyable !== null) {
          associateDestroyableChild(this, destroyable);
        }

        tag = manager.getTag(state);

        if (tag !== null) {
          this.#lastUpdated = valueForTag(tag);
        }

        this.#tag = tag;
        vm.env.scheduleInstallModifier(newInstance);
      }

      this.#instance = newInstance;
    } else if (tag !== null && !validateTag(tag, lastUpdated)) {
      vm.env.scheduleUpdateModifier(instance!);
      this.#lastUpdated = valueForTag(tag);
    }

    if (tag !== null) {
      consumeTag(tag);
    }
  }
}

define(STATIC_ATTR_OP, (vm, { op1: _name, op2: _value, op3: _namespace }) => {
  let name = vm[CONSTANTS].getValue<string>(_name);
  let value = vm[CONSTANTS].getValue<string>(_value);
  let namespace = _namespace ? vm[CONSTANTS].getValue<string>(_namespace) : null;

  vm._elements_().setStaticAttribute(name, value, namespace);
});

define(DYNAMIC_ATTR_OP, (vm, { op1: _name, op2: _trusting, op3: _namespace }) => {
  let name = vm[CONSTANTS].getValue<string>(_name);
  let trusting = vm[CONSTANTS].getValue<boolean>(_trusting);
  let reference = check(vm.stack.pop(), CheckReference);
  let value = valueForRef(reference);
  let namespace = _namespace ? vm[CONSTANTS].getValue<string>(_namespace) : null;

  let attribute = vm._elements_().setDynamicAttribute(name, value, trusting, namespace);

  if (!isConstRef(reference)) {
    vm._updateWith_(new UpdateDynamicAttributeOpcode(reference, attribute, vm.env));
  }
});

export class UpdateDynamicAttributeOpcode implements UpdatingOpcode {
  readonly #updateRef: Reference;

  constructor(reference: Reference<unknown>, attribute: DynamicAttribute, environment: Environment) {
    let initialized = false;

    this.#updateRef = createComputeRef(() => {
      let value = valueForRef(reference);

      if (initialized === true) {
        attribute.update(value, environment);
      } else {
        initialized = true;
      }
    });

    valueForRef(this.#updateRef);
  }

  evaluate() {
    valueForRef(this.#updateRef);
  }
}
