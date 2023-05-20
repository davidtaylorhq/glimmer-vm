import { precompile } from '@glimmer/compiler';
import type { WireFormat } from '@glimmer/interfaces';
import type { TemplateWithIdAndReferrer } from '@glimmer/opcode-compiler';
import { assert as glimmerAssert, unwrapTemplate } from '@glimmer/util';

import { preprocess } from '../..';
import { module } from '../support';
import {
  WIRE_CLOSE_ELEMENT,
  WIRE_FLUSH_ELEMENT,
  WIRE_GET_FREE_AS_COMPONENT_HEAD,
  WIRE_GET_LEXICAL_SYMBOL,
  WIRE_OPEN_ELEMENT,
} from '@glimmer/wire-format';

module('[glimmer-compiler] Compile options', ({ test }) => {
  test('moduleName option is passed into meta', (assert) => {
    let moduleName = "It ain't hard to tell";
    let template = unwrapTemplate(
      preprocess('Hi, {{name}}!', { meta: { moduleName } })
    ) as TemplateWithIdAndReferrer;
    assert.strictEqual(template.referrer.moduleName, moduleName, 'Template has the moduleName');
  });
});

function compile(
  template: string,
  locals: string[],
  evaluate: (source: string) => WireFormat.SerializedTemplateWithLazyBlock
) {
  let source = precompile(template, {
    lexicalScope: (variable: string) => locals.includes(variable),
  });

  let wire = evaluate(`(${source})`);

  return {
    ...wire,
    block: JSON.parse(wire.block),
  };
}

module('[glimmer-compiler] precompile', ({ test }) => {
  test('returned module name correct', (assert) => {
    let wire = JSON.parse(
      precompile('Hi, {{name}}!', {
        meta: { moduleName: 'my/module-name' },
      })
    );

    assert.strictEqual(wire.moduleName, 'my/module-name', 'Template has correct meta');
  });

  test('lexicalScope is used if present', (assert) => {
    let wire = compile(`<hello /><div />`, ['hello'], (source) => eval(source));

    let hello = { varname: 'hello' };
    assert.ok(hello, 'avoid unused variable lint');

    let [statements] = wire.block;
    let [[, componentNameExpr], ...divExpr] = statements as [
      WireFormat.Statements.Component,
      ...WireFormat.Statement[]
    ];

    assert.deepEqual(wire.scope?.(), [hello]);

    assert.deepEqual(
      componentNameExpr,
      [WIRE_GET_LEXICAL_SYMBOL, 0],
      'The component invocation is for the lexical symbol `hello` (the 0th lexical entry)'
    );

    assert.deepEqual(divExpr, [[WIRE_OPEN_ELEMENT, 0], [WIRE_FLUSH_ELEMENT], [WIRE_CLOSE_ELEMENT]]);
  });

  test('lexicalScope works if the component name is a path', (assert) => {
    let wire = compile(`<f.hello /><div />`, ['f'], (source) => eval(source));

    let f = {};
    assert.ok(f, 'avoid unused variable lint');

    let [statements] = wire.block;
    let [[, componentNameExpr], ...divExpr] = statements as [
      WireFormat.Statements.Component,
      ...WireFormat.Statement[]
    ];

    assert.deepEqual(wire.scope?.(), [f]);
    assert.deepEqual(
      componentNameExpr,
      [WIRE_GET_LEXICAL_SYMBOL, 0, ['hello']],
      'The component invocation is for the lexical symbol `hello` (the 0th lexical entry)'
    );

    assert.deepEqual(divExpr, [[WIRE_OPEN_ELEMENT, 0], [WIRE_FLUSH_ELEMENT], [WIRE_CLOSE_ELEMENT]]);
  });

  test('customizeComponentName is used if present', function (assert) {
    let wire = JSON.parse(
      precompile('<XFoo />', {
        customizeComponentName(input: string) {
          return [...input].reverse().join('');
        },
      })
    );

    let block: WireFormat.SerializedTemplateBlock = JSON.parse(wire.block);
    let [[, componentNameExpr]] = block[0] as [WireFormat.Statements.Component];

    glimmerAssert(
      Array.isArray(componentNameExpr) && componentNameExpr[0] === WIRE_GET_FREE_AS_COMPONENT_HEAD,
      `component name is a free variable lookup`
    );

    let componentName = block[3][componentNameExpr[1]];
    assert.strictEqual(componentName, 'ooFX', 'customized component name was used');
  });

  test('customizeComponentName does not cause components to conflict with existing symbols', function (assert) {
    let wire = JSON.parse(
      precompile('{{#let @model as |rental|}}<Rental @renter={{rental}} />{{/let}}', {
        customizeComponentName(input: string) {
          return input.toLowerCase();
        },
      })
    );

    let block: WireFormat.SerializedTemplateBlock = JSON.parse(wire.block);

    // eslint-disable-next-line unicorn/no-unreadable-array-destructuring
    let [[, , letBlock]] = block[0] as [WireFormat.Statements.Let];
    let [[, componentNameExpr]] = letBlock[0] as [WireFormat.Statements.Component];

    glimmerAssert(
      Array.isArray(componentNameExpr) && componentNameExpr[0] === WIRE_GET_FREE_AS_COMPONENT_HEAD,
      `component name is a free variable lookup`
    );

    let componentName = block[3][componentNameExpr[1]];
    assert.strictEqual(componentName, 'rental', 'customized component name was used');
  });

  test('customizeComponentName is not invoked on curly components', function (assert) {
    let wire = JSON.parse(
      precompile('{{#my-component}}hello{{/my-component}}', {
        customizeComponentName(input: string) {
          return input.toUpperCase();
        },
      })
    );

    let block: WireFormat.SerializedTemplateBlock = JSON.parse(wire.block);

    let [[, componentNameExpr]] = block[0] as [WireFormat.Statements.Block];

    glimmerAssert(
      Array.isArray(componentNameExpr) && componentNameExpr[0] === WIRE_GET_FREE_AS_COMPONENT_HEAD,
      `component name is a free variable lookup`
    );

    let componentName = block[3][componentNameExpr[1]];
    assert.strictEqual(componentName, 'my-component', 'original component name was used');
  });

  test('customizeComponentName is not invoked on angle-bracket-like name invoked with curlies', function (assert) {
    let wire = JSON.parse(
      precompile('{{#MyComponent}}hello{{/MyComponent}}', {
        customizeComponentName(input: string) {
          return input.toUpperCase();
        },
      })
    );

    let block: WireFormat.SerializedTemplateBlock = JSON.parse(wire.block);

    let [[, componentNameExpr]] = block[0] as [WireFormat.Statements.Block];

    glimmerAssert(
      Array.isArray(componentNameExpr) && componentNameExpr[0] === WIRE_GET_FREE_AS_COMPONENT_HEAD,
      `component name is a free variable lookup`
    );

    let componentName = block[3][componentNameExpr[1]];
    assert.strictEqual(componentName, 'MyComponent', 'original component name was used');
  });

  test('lowercased names are not resolved or customized in resolution mode', (assert) => {
    let wire = JSON.parse(
      precompile('<rental />', {
        customizeComponentName(input: string) {
          return [...input].reverse().join('');
        },
      })
    );

    let block: WireFormat.SerializedTemplateBlock = JSON.parse(wire.block);
    let [openElementExpr] = block[0] as [WireFormat.Statements.OpenElement];

    glimmerAssert(
      Array.isArray(openElementExpr) && openElementExpr[0] === WIRE_OPEN_ELEMENT,
      `expr is open element`
    );

    let elementName = openElementExpr[1];
    assert.strictEqual(elementName, 'rental', 'element name is correct');
  });
});
