import {
  check,
  CheckDocumentFragment,
  CheckNode,
  CheckSafeString,
  CheckString,
} from '@glimmer/debug';
import { hasInternalComponentManager, hasInternalHelperManager } from '@glimmer/manager';
import { isConstRef, valueForRef } from '@glimmer/reference';
import { isObject, LOCAL_LOGGER } from '@glimmer/util';
import { ContentType, CurriedType, CurriedTypes, Op } from '@glimmer/vm';

import { isCurriedType } from '../../curried-value';
import { isEmpty, isFragment, isNode, isSafeString, shouldCoerce } from '../../dom/normalize';
import { APPEND_OPCODES } from '../../opcodes';
import DynamicTextContent from '../../vm/content/text';
import { CheckReference } from './-debug-strip';
import { AssertFilter } from './vm';
import { LOCAL_TRACE_LOGGING } from '@glimmer/local-debug-flags';

function toContentType(value: unknown) {
  if (shouldCoerce(value)) {
    return ContentType.String;
  } else if (
    isCurriedType(value, CurriedType.Component) ||
    hasInternalComponentManager(value as object)
  ) {
    return ContentType.Component;
  } else if (
    isCurriedType(value, CurriedType.Helper) ||
    hasInternalHelperManager(value as object)
  ) {
    return ContentType.Helper;
  } else if (isSafeString(value)) {
    return ContentType.SafeString;
  } else if (isFragment(value)) {
    return ContentType.Fragment;
  } else if (isNode(value)) {
    return ContentType.Node;
  } else {
    return ContentType.String;
  }
}

function toDynamicContentType(value: unknown): 0 | 1 | 2 {
  if (!isObject(value)) {
    return ContentType.String;
  }

  if (isCurriedType(value, CurriedTypes.Component) || hasInternalComponentManager(value)) {
    return ContentType.Component;
  } else {
    if (
      import.meta.env.DEV &&
      !isCurriedType(value, CurriedTypes.Helper) &&
      !hasInternalHelperManager(value)
    ) {
      if (LOCAL_TRACE_LOGGING) {
        LOCAL_LOGGER.error(
          `Attempted use a dynamic value as a component or helper, but that value did not have an associated component or helper manager. The value was:`,
          value
        );
      }
      throw new Error(
        `Attempted use a dynamic value as a component or helper, but that value did not have an associated component or helper manager.`
      );
    }

    return ContentType.Helper;
  }
}

APPEND_OPCODES.add(Op.ContentType, (vm) => {
  let reference = check(vm.stack.top(), CheckReference);

  try {
    vm.stack.push(toContentType(valueForRef(reference)));
  } catch (e) {
    vm.unwind(e);
  }

  if (!isConstRef(reference)) {
    vm.updateWith(new AssertFilter(reference, toContentType));
  }
});

APPEND_OPCODES.add(Op.DynamicContentType, (vm) => {
  let reference = check(vm.stack.top(), CheckReference);

  vm.stack.push(toDynamicContentType(valueForRef(reference)));

  if (!isConstRef(reference)) {
    vm.updateWith(new AssertFilter(reference, toDynamicContentType));
  }
});

APPEND_OPCODES.add(Op.AppendHTML, (vm) => {
  let reference = check(vm.stack.pop(), CheckReference);

  let rawValue = valueForRef(reference);
  let value = isEmpty(rawValue) ? '' : String(rawValue);

  vm.elements().appendDynamicHTML(value);
});

APPEND_OPCODES.add(Op.AppendSafeHTML, (vm) => {
  let reference = check(vm.stack.pop(), CheckReference);

  let rawValue = check(valueForRef(reference), CheckSafeString).toHTML();
  let value = isEmpty(rawValue) ? '' : check(rawValue, CheckString);

  vm.elements().appendDynamicHTML(value);
});

APPEND_OPCODES.add(Op.AppendText, (vm) => {
  let reference = check(vm.stack.pop(), CheckReference);

  let rawValue = valueForRef(reference);
  let value = isEmpty(rawValue) ? '' : String(rawValue);

  let node = vm.elements().appendDynamicText(value);

  if (!isConstRef(reference)) {
    vm.updateWith(new DynamicTextContent(node, reference, value));
  }
});

APPEND_OPCODES.add(Op.AppendDocumentFragment, (vm) => {
  let reference = check(vm.stack.pop(), CheckReference);

  let value = check(valueForRef(reference), CheckDocumentFragment);

  vm.elements().appendDynamicFragment(value);
});

APPEND_OPCODES.add(Op.AppendNode, (vm) => {
  let reference = check(vm.stack.pop(), CheckReference);

  let value = check(valueForRef(reference), CheckNode);

  vm.elements().appendDynamicNode(value);
});
