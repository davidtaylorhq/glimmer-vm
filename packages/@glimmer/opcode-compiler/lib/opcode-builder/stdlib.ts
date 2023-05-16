import type {
  ISTDLIB_CAUTIOUS_GUARDED_APPEND,
  ISTDLIB_CAUTIOUS_NON_DYNAMIC_APPEND,
  ISTDLIB_MAIN,
  ISTDLIB_TRUSTING_GUARDED_APPEND,
  ISTDLIB_TRUSTING_NON_DYNAMIC_APPEND,
} from '@glimmer/interfaces';

export const STDLIB_MAIN = 0 satisfies ISTDLIB_MAIN;
export const STDLIB_TRUSTING_GUARDED_APPEND = 1 satisfies ISTDLIB_TRUSTING_GUARDED_APPEND;
export const STDLIB_CAUTIOUS_GUARDED_APPEND = 2 satisfies ISTDLIB_CAUTIOUS_GUARDED_APPEND;
export const STDLIB_TRUSTING_NON_DYNAMIC_APPEND = 3 satisfies ISTDLIB_TRUSTING_NON_DYNAMIC_APPEND;
export const STDLIB_CAUTIOUS_NON_DYNAMIC_APPEND = 4 satisfies ISTDLIB_CAUTIOUS_NON_DYNAMIC_APPEND;

export function getStdlibAppend(trusting: boolean) {
  return trusting ? STDLIB_TRUSTING_GUARDED_APPEND : STDLIB_CAUTIOUS_GUARDED_APPEND;
}
