import { Reference, valueForRef, isConstRef, createComputeRef } from '@glimmer/reference';
import { Revision, Tag, valueForTag, validateTag, consumeTag } from '@glimmer/validator';
import {
  check,
  CheckString,
  CheckElement,
  CheckOption,
  CheckNode,
  CheckMaybe,
} from '@glimmer/debug';
import {
  Op,
  Option,
  ModifierDefinition,
  ModifierInstance,
  VMArguments,
  Owner,
  CurriedType,
  ModifierDefinitionState,
  Environment,
} from '@glimmer/interfaces';
import { $t0 } from '@glimmer/vm';
import { APPEND_OPCODES, UpdatingOpcode } from '../../opcodes';
import { UpdatingVM } from '../../vm';
import { Assert } from './vm';
import { DynamicAttribute } from '../../vm/attributes/dynamic';
import { CheckReference, CheckArguments, CheckOperations } from './-debug-strip';
import { CONSTANTS } from '../../symbols';
import { debugToString, expect } from '@glimmer/util';
import { InternalVM } from '../../vm/append';
import { CurriedValue, isCurriedType, resolveCurriedValue } from '../../curried-value';
import { DEBUG } from '@glimmer/env';

APPEND_OPCODES.add(Op.Text, (vm, { op1: text }) => {
  vm.elements().appendText(vm[CONSTANTS].getValue(text));
});

APPEND_OPCODES.add(Op.Comment, (vm, { op1: text }) => {
  vm.elements().appendComment(vm[CONSTANTS].getValue(text));
});

APPEND_OPCODES.add(Op.OpenElement, (vm, { op1: tag }) => {
  vm.elements().openElement(vm[CONSTANTS].getValue(tag));
});

APPEND_OPCODES.add(Op.OpenDynamicElement, (vm) => {
  let tagName = check(valueForRef(check(vm.stack.popJs(), CheckReference)), CheckString);
  vm.elements().openElement(tagName);
});

APPEND_OPCODES.add(Op.PushRemoteElement, (vm) => {
  let elementRef = check(vm.stack.popJs(), CheckReference);
  let insertBeforeRef = check(vm.stack.popJs(), CheckReference);
  let guidRef = check(vm.stack.popJs(), CheckReference);

  let element = check(valueForRef(elementRef), CheckElement);
  let insertBefore = check(valueForRef(insertBeforeRef), CheckMaybe(CheckOption(CheckNode)));
  let guid = valueForRef(guidRef) as string;

  if (!isConstRef(elementRef)) {
    vm.updateWith(new Assert(elementRef));
  }

  if (insertBefore !== undefined && !isConstRef(insertBeforeRef)) {
    vm.updateWith(new Assert(insertBeforeRef));
  }

  let block = vm.elements().pushRemoteElement(element, guid, insertBefore);
  if (block) vm.associateDestroyable(block);
});

APPEND_OPCODES.add(Op.PopRemoteElement, (vm) => {
  vm.elements().popRemoteElement();
});

APPEND_OPCODES.add(Op.FlushElement, (vm) => {
  let operations = check(vm.fetchValue($t0), CheckOperations);
  let modifiers: Option<ModifierInstance[]> = null;

  if (operations) {
    modifiers = operations.flush(vm);
    vm.loadValue($t0, null);
  }

  vm.elements().flushElement(modifiers);
});

APPEND_OPCODES.add(Op.CloseElement, (vm) => {
  let modifiers = vm.elements().closeElement();

  if (modifiers) {
    modifiers.forEach((modifier) => {
      vm.env.scheduleInstallModifier(modifier);
      let { manager, state } = modifier;
      let d = manager.getDestroyable(state);

      if (d) {
        vm.associateDestroyable(d);
      }
    });
  }
});

APPEND_OPCODES.add(Op.Modifier, (vm, { op1: handle }) => {
  if (vm.env.isInteractive === false) {
    return;
  }

  let owner = vm.getOwner();
  let args = check(vm.stack.popJs(), CheckArguments);
  let definition = vm[CONSTANTS].getValue<ModifierDefinition>(handle);

  invokeModifier(vm, owner, args, definition);
});

APPEND_OPCODES.add(Op.DynamicModifier, (vm) => {
  if (vm.env.isInteractive === false) {
    return;
  }

  let { stack, [CONSTANTS]: constants } = vm;
  let ref = check(stack.popJs(), CheckReference);
  let args = check(stack.popJs(), CheckArguments);
  let value = valueForRef(ref);
  let owner: Owner;

  if (typeof value !== 'function' && (typeof value !== 'object' || value === null)) {
    return;
  }

  let hostDefinition: CurriedValue | ModifierDefinitionState;

  if (isCurriedType(value, CurriedType.Modifier)) {
    let [curriedValue, curriedOwner] = resolveCurriedValue(value, args);
    hostDefinition = curriedValue;
    owner = curriedOwner;
  } else {
    hostDefinition = value;
    owner = vm.getOwner();
  }

  let handle = constants.modifier(hostDefinition, null, true);

  if (DEBUG && handle === null) {
    throw new Error(
      `Expected a dynamic modifier definition, but received an object or function that did not have a modifier manager associated with it. The dynamic invocation was \`{{${
        ref.debugLabel
      }}}\`, and the incorrect definition is the value at the path \`${
        ref.debugLabel
      }\`, which was: ${debugToString!(hostDefinition)}`
    );
  }

  let definition = constants.getValue<ModifierDefinition>(
    expect(handle, 'BUG: modifier handle expected')
  );

  invokeModifier(vm, owner, args, definition);
});

function invokeModifier(
  vm: InternalVM,
  owner: Owner,
  args: VMArguments,
  definition: ModifierDefinition
) {
  let { manager } = definition;

  let { constructing, updateOperations } = vm.elements();
  let dynamicScope = vm.dynamicScope();

  let state = manager.create(
    owner,
    expect(constructing, 'BUG: ElementModifier could not find the element it applies to'),
    definition.state,
    args,
    dynamicScope,
    updateOperations
  );

  let instance: ModifierInstance = {
    manager,
    state,
    definition,
  };

  let operations = expect(
    check(vm.fetchValue($t0), CheckOperations),
    'BUG: ElementModifier could not find operations to append to'
  );

  operations.addModifier(instance);

  let tag = manager.getTag(state);

  if (tag !== null) {
    consumeTag(tag);
    vm.updateWith(new UpdateModifierOpcode(tag, instance));
  }
}

export class UpdateModifierOpcode extends UpdatingOpcode {
  public type = 'update-modifier';
  private lastUpdated: Revision;

  constructor(public tag: Tag, private modifier: ModifierInstance) {
    super();
    this.lastUpdated = valueForTag(tag);
  }

  evaluate(vm: UpdatingVM) {
    let { modifier, tag, lastUpdated } = this;

    consumeTag(tag);

    if (!validateTag(tag, lastUpdated)) {
      vm.env.scheduleUpdateModifier(modifier);
      this.lastUpdated = valueForTag(tag);
    }
  }
}

APPEND_OPCODES.add(Op.StaticAttr, (vm, { op1: _name, op2: _value, op3: _namespace }) => {
  let name = vm[CONSTANTS].getValue<string>(_name);
  let value = vm[CONSTANTS].getValue<string>(_value);
  let namespace = _namespace ? vm[CONSTANTS].getValue<string>(_namespace) : null;

  vm.elements().setStaticAttribute(name, value, namespace);
});

APPEND_OPCODES.add(Op.DynamicAttr, (vm, { op1: _name, op2: _trusting, op3: _namespace }) => {
  let name = vm[CONSTANTS].getValue<string>(_name);
  let trusting = vm[CONSTANTS].getValue<boolean>(_trusting);
  let reference = check(vm.stack.popJs(), CheckReference);
  let value = valueForRef(reference);
  let namespace = _namespace ? vm[CONSTANTS].getValue<string>(_namespace) : null;

  let attribute = vm.elements().setDynamicAttribute(name, value, trusting, namespace);

  if (!isConstRef(reference)) {
    vm.updateWith(new UpdateDynamicAttributeOpcode(reference, attribute, vm.env));
  }
});

export class UpdateDynamicAttributeOpcode extends UpdatingOpcode {
  public type = 'patch-element';

  private updateRef: Reference;

  constructor(reference: Reference<unknown>, attribute: DynamicAttribute, env: Environment) {
    super();

    let initialized = false;

    this.updateRef = createComputeRef(() => {
      let value = valueForRef(reference);

      if (initialized === true) {
        attribute.update(value, env);
      } else {
        initialized = true;
      }
    });

    valueForRef(this.updateRef);
  }

  evaluate() {
    valueForRef(this.updateRef);
  }
}
