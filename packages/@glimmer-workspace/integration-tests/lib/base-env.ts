import type { Destroyable, Destructor } from '@glimmer/interfaces';
import type { EnvironmentDelegate } from '@glimmer/runtime';

interface Scheduled {
  destroyable: Destroyable;
  destructor: Destructor<any>;
}

let scheduled: Scheduled[] = [];
let scheduledFinishDestruction: (() => void)[] = [];

export function scheduleWillDestroy(task: Scheduled) {
  scheduled.push(task);
}

export function scheduleDidDestroy(fn: () => void) {
  scheduledFinishDestruction.push(fn);
}

export const BaseEnvironment: EnvironmentDelegate = {
  isInteractive: true,

  enableDebugTooling: false,

  onTransactionCommit() {
    for (const { destroyable, destructor } of scheduled) {
      destructor(destroyable);
    }

    for (const fn of scheduledFinishDestruction) fn();

    scheduled = [];
    scheduledFinishDestruction = [];
  },
};

export {};
