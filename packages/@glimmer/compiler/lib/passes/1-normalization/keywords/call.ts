import { CURRIED_COMPONENT, CURRIED_HELPER, CURRIED_MODIFIER } from '@glimmer/vm-constants';
import { keywords } from './impl';
import { curryKeyword } from './utils/curry';
import { getDynamicVarKeyword as getDynamicVariableKeyword } from './utils/dynamic-vars';
import { hasBlockKeyword } from './utils/has-block';
import { ifUnlessInlineKeyword } from './utils/if-unless';
import { logKeyword } from './utils/log';

export const CALL_KEYWORDS = keywords('Call')
  .kw('has-block', hasBlockKeyword('has-block'))
  .kw('has-block-params', hasBlockKeyword('has-block-params'))
  .kw('-get-dynamic-var', getDynamicVariableKeyword)
  .kw('log', logKeyword)
  .kw('if', ifUnlessInlineKeyword('if'))
  .kw('unless', ifUnlessInlineKeyword('unless'))
  .kw('component', curryKeyword(CURRIED_COMPONENT))
  .kw('helper', curryKeyword(CURRIED_HELPER))
  .kw('modifier', curryKeyword(CURRIED_MODIFIER));
