/* This file is generated by build/debug.js */

import { type MachineOp, type Op } from '@glimmer/interfaces';

export function isMachineOp(value: number): value is MachineOp {
  return value >= 0 && value <= 15;
}

export function isOp(value: number): value is Op {
  return value >= 16;
}
