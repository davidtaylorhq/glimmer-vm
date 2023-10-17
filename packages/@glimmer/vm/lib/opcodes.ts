import type {
  VmAppendDocumentFragment,
  VmAppendHTML,
  VmAppendNode,
  VmAppendSafeHTML,
  VmAppendText,
  VmAssertSame,
  VmBeginComponentTransaction,
  VmBindDynamicScope,
  VmBindEvalScope,
  VmCaptureArgs,
  VmChildScope,
  VmCloseElement,
  VmComment,
  VmCommitComponentTransaction,
  VmCompileBlock,
  VmComponentAttr,
  VmConcat,
  VmConstant,
  VmConstantReference,
  VmContentType,
  VmCreateComponent,
  VmCurry,
  VmDebugger,
  VmDidCreateElement,
  VmDidRenderLayout,
  VmDup,
  VmDynamicAttr,
  VmDynamicContentType,
  VmDynamicHelper,
  VmDynamicModifier,
  VmEnter,
  VmEnterList,
  VmExit,
  VmExitList,
  VmFetch,
  VmFlushElement,
  VmGetBlock,
  VmGetComponentLayout,
  VmGetComponentSelf,
  VmGetComponentTagName,
  VmGetDynamicVar,
  VmGetProperty,
  VmGetVariable,
  VmHasBlock,
  VmHasBlockParams,
  VmHelper,
  VmIfInline,
  VmInvokeComponentLayout,
  VmInvokeYield,
  VmIterate,
  VmJumpEq,
  VmJumpIf,
  VmJumpUnless,
  VmLoad,
  VmLog,
  VmMachineInvokeStatic,
  VmMachineInvokeVirtual,
  VmMachineJump,
  VmMachineOp,
  VmMachinePopFrame,
  VmMachinePopTryFrame,
  VmMachinePushFrame,
  VmMachinePushTryFrame,
  VmMachineReturn,
  VmMachineReturnTo,
  VmMachineSize,
  VmMachineUnwindTypeFrame,
  VmMain,
  VmModifier,
  VmNot,
  VmOp,
  VmOpenDynamicElement,
  VmOpenElement,
  VmPop,
  VmPopArgs,
  VmPopDynamicScope,
  VmPopRemoteElement,
  VmPopScope,
  VmPopulateLayout,
  VmPrepareArgs,
  VmPrimitive,
  VmPrimitiveReference,
  VmPushArgs,
  VmPushBlockScope,
  VmPushComponentDefinition,
  VmPushDynamicComponentInstance,
  VmPushDynamicScope,
  VmPushEmptyArgs,
  VmPushRemoteElement,
  VmPushSymbolTable,
  VmPutComponentOperations,
  VmRegisterComponentDestructor,
  VmReifyU32,
  VmResolveCurriedComponent,
  VmResolveDynamicComponent,
  VmResolveMaybeLocal,
  VmRootScope,
  VmSetBlock,
  VmSetBlocks,
  VmSetNamedVariables,
  VmSetupForEval,
  VmSetVariable,
  VmSize,
  VmSpreadBlock,
  VmStaticAttr,
  VmStaticComponentAttr,
  VmText,
  VmToBoolean,
  VmVirtualRootScope,
} from '@glimmer/interfaces';

export const MachineOp = {
  PushFrame: 0 satisfies VmMachinePushFrame,
  PopFrame: 1 satisfies VmMachinePopFrame,
  InvokeVirtual: 2 satisfies VmMachineInvokeVirtual,
  InvokeStatic: 3 satisfies VmMachineInvokeStatic,
  Jump: 4 satisfies VmMachineJump,
  Return: 5 satisfies VmMachineReturn,
  ReturnTo: 6 satisfies VmMachineReturnTo,
  PushTryFrame: 7 satisfies VmMachinePushTryFrame,
  PopTryFrame: 8 satisfies VmMachinePopTryFrame,
  UnwindTypeFrame: 9 satisfies VmMachineUnwindTypeFrame,
  Size: 10 satisfies VmMachineSize,
} as const;

export const Op = {
  Helper: 16 satisfies VmHelper,
  SetNamedVariables: 17 satisfies VmSetNamedVariables,
  SetBlocks: 18 satisfies VmSetBlocks,
  SetVariable: 19 satisfies VmSetVariable,
  SetBlock: 20 satisfies VmSetBlock,
  GetVariable: 21 satisfies VmGetVariable,
  GetProperty: 22 satisfies VmGetProperty,
  GetBlock: 23 satisfies VmGetBlock,
  SpreadBlock: 24 satisfies VmSpreadBlock,
  HasBlock: 25 satisfies VmHasBlock,
  HasBlockParams: 26 satisfies VmHasBlockParams,
  Concat: 27 satisfies VmConcat,
  Constant: 28 satisfies VmConstant,
  ConstantReference: 29 satisfies VmConstantReference,
  Primitive: 30 satisfies VmPrimitive,
  PrimitiveReference: 31 satisfies VmPrimitiveReference,
  ReifyU32: 32 satisfies VmReifyU32,
  Dup: 33 satisfies VmDup,
  Pop: 34 satisfies VmPop,
  Load: 35 satisfies VmLoad,
  Fetch: 36 satisfies VmFetch,
  RootScope: 37 satisfies VmRootScope,
  VirtualRootScope: 38 satisfies VmVirtualRootScope,
  ChildScope: 39 satisfies VmChildScope,
  PopScope: 40 satisfies VmPopScope,
  Text: 41 satisfies VmText,
  Comment: 42 satisfies VmComment,
  AppendHTML: 43 satisfies VmAppendHTML,
  AppendSafeHTML: 44 satisfies VmAppendSafeHTML,
  AppendDocumentFragment: 45 satisfies VmAppendDocumentFragment,
  AppendNode: 46 satisfies VmAppendNode,
  AppendText: 47 satisfies VmAppendText,
  OpenElement: 48 satisfies VmOpenElement,
  OpenDynamicElement: 49 satisfies VmOpenDynamicElement,
  PushRemoteElement: 50 satisfies VmPushRemoteElement,
  StaticAttr: 51 satisfies VmStaticAttr,
  DynamicAttr: 52 satisfies VmDynamicAttr,
  ComponentAttr: 53 satisfies VmComponentAttr,
  FlushElement: 54 satisfies VmFlushElement,
  CloseElement: 55 satisfies VmCloseElement,
  PopRemoteElement: 56 satisfies VmPopRemoteElement,
  Modifier: 57 satisfies VmModifier,
  BindDynamicScope: 58 satisfies VmBindDynamicScope,
  PushDynamicScope: 59 satisfies VmPushDynamicScope,
  PopDynamicScope: 60 satisfies VmPopDynamicScope,
  CompileBlock: 61 satisfies VmCompileBlock,
  PushBlockScope: 62 satisfies VmPushBlockScope,
  PushSymbolTable: 63 satisfies VmPushSymbolTable,
  InvokeYield: 64 satisfies VmInvokeYield,
  JumpIf: 65 satisfies VmJumpIf,
  JumpUnless: 66 satisfies VmJumpUnless,
  JumpEq: 67 satisfies VmJumpEq,
  AssertSame: 68 satisfies VmAssertSame,
  Enter: 69 satisfies VmEnter,
  Exit: 70 satisfies VmExit,
  ToBoolean: 71 satisfies VmToBoolean,
  EnterList: 72 satisfies VmEnterList,
  ExitList: 73 satisfies VmExitList,
  Iterate: 74 satisfies VmIterate,
  Main: 75 satisfies VmMain,
  ContentType: 76 satisfies VmContentType,
  Curry: 77 satisfies VmCurry,
  PushComponentDefinition: 78 satisfies VmPushComponentDefinition,
  PushDynamicComponentInstance: 79 satisfies VmPushDynamicComponentInstance,
  ResolveDynamicComponent: 80 satisfies VmResolveDynamicComponent,
  ResolveCurriedComponent: 81 satisfies VmResolveCurriedComponent,
  PushArgs: 82 satisfies VmPushArgs,
  PushEmptyArgs: 83 satisfies VmPushEmptyArgs,
  PopArgs: 84 satisfies VmPopArgs,
  PrepareArgs: 85 satisfies VmPrepareArgs,
  CaptureArgs: 86 satisfies VmCaptureArgs,
  CreateComponent: 87 satisfies VmCreateComponent,
  RegisterComponentDestructor: 88 satisfies VmRegisterComponentDestructor,
  PutComponentOperations: 89 satisfies VmPutComponentOperations,
  GetComponentSelf: 90 satisfies VmGetComponentSelf,
  GetComponentTagName: 91 satisfies VmGetComponentTagName,
  GetComponentLayout: 92 satisfies VmGetComponentLayout,
  BindEvalScope: 93 satisfies VmBindEvalScope,
  SetupForEval: 94 satisfies VmSetupForEval,
  PopulateLayout: 95 satisfies VmPopulateLayout,
  InvokeComponentLayout: 96 satisfies VmInvokeComponentLayout,
  BeginComponentTransaction: 97 satisfies VmBeginComponentTransaction,
  CommitComponentTransaction: 98 satisfies VmCommitComponentTransaction,
  DidCreateElement: 99 satisfies VmDidCreateElement,
  DidRenderLayout: 100 satisfies VmDidRenderLayout,
  ResolveMaybeLocal: 102 satisfies VmResolveMaybeLocal,
  Debugger: 103 satisfies VmDebugger,
  StaticComponentAttr: 104 satisfies VmStaticComponentAttr,
  DynamicContentType: 105 satisfies VmDynamicContentType,
  DynamicHelper: 106 satisfies VmDynamicHelper,
  DynamicModifier: 107 satisfies VmDynamicModifier,
  IfInline: 108 satisfies VmIfInline,
  Not: 109 satisfies VmNot,
  GetDynamicVar: 110 satisfies VmGetDynamicVar,
  Log: 111 satisfies VmLog,
  Size: 112 satisfies VmSize,
} as const;

export function isMachineOp(value: number): value is VmMachineOp {
  return value >= 0 && value <= 15;
}

export function isOp(value: number): value is VmOp {
  return value >= 16;
}
