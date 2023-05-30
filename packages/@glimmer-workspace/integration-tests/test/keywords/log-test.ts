/* eslint-disable no-console */
import { LOCAL_LOGGER } from '@glimmer/util';
import { jitSuite, RenderTest, test } from '../..';

class LogTest extends RenderTest {
  static suiteName = '{{log}} keyword';

  originalLog?: () => void;
  logCalls: unknown[] = [];

  beforeEach() {
    this.originalLog = console.log;
    console.log = (...args: unknown[]) => {
      if (LOCAL_LOGGER.isInternalLog) return;
      this.logCalls.push(...args);
    };
  }

  afterEach() {
    console.log = this.originalLog!;
  }

  assertLog(values: unknown[]) {
    this.assertHTML('');
    this.assert.strictEqual(this.logCalls.length, values.length);

    for (let index = 0, length = values.length; index < length; index++) {
      this.assert.strictEqual(this.logCalls[index], values[index]);
    }
  }

  @test
  'correctly logs primitives'() {
    this.render(`{{log "one" 1 true}}`);

    this.assertLog(['one', 1, true]);
  }

  @test
  'correctly logs a property'() {
    this.render(`{{log this.value}}`, {
      value: 'one',
    });

    this.assertLog(['one']);
  }

  @test
  'correctly logs multiple arguments'() {
    this.render(`{{log "my variable:" this.value}}`, {
      value: 'one',
    });

    this.assertLog(['my variable:', 'one']);
  }

  @test
  'correctly logs `this`'() {
    this.render(`{{log this}}`);

    this.assertLog([this.context]);
  }

  @test
  'correctly logs as a subexpression'() {
    this.render(`{{if (log "one" 1 true) "Hello!"}}`);

    this.assertLog(['one', 1, true]);
  }

  @test
  'correctly logs when values update'() {
    this.render(`{{log this.foo}}`, { foo: 123 });

    this.rerender({ foo: 456 });
    this.rerender({ foo: true });

    this.assertLog([123, 456, true]);
  }
}

jitSuite(LogTest);
