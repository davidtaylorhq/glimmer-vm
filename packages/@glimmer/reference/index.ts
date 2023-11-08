export {
  type AbstractIterator,
  createIteratorItemRef,
  createIteratorRef,
  type IterationItem,
  type IteratorDelegate,
  type OpaqueIterationItem,
  type OpaqueIterator,
} from './lib/iterable';
export {
  Accessor,
  clearError,
  createDebugAliasRef,
  createPrimitiveCell,
  DeeplyConstant,
  FALLIBLE_FORMULA as FALLIBLE_FORMULA_TYPE,
  FallibleFormula,
  FALSE_REFERENCE,
  getLastRevision,
  getReactiveProperty,
  hasError,
  INFALLIBLE_FORMULA as INFALLIBLE_FORMULA_TYPE,
  InfallibleFormula,
  ACCESSOR as INVOKABLE_TYPE,
  isAccessor,
  isConstant,
  isUpdatableRef,
  Marker,
  MUTABLE_CELL as MUTABLE_CELL_TYPE,
  MutableCell,
  NULL_REFERENCE,
  REACTIVE_DESCRIPTIONS,
  readCell,
  READONLY_CELL as READONLY_CELL_TYPE,
  ReadonlyCell,
  readReactive,
  REFERENCE,
  type ReferenceEnvironment,
  ResultAccessor,
  ResultFormula,
  type SomeReactive,
  toMut,
  toReadonly,
  TRUE_REFERENCE,
  DEEPLY_CONSTANT as UNBOUND_TYPE,
  UNDEFINED_REFERENCE,
  unwrapReactive,
  updateReactive,
  updateRef,
  validateReactive,
  writeCell,
} from './lib/reference';
