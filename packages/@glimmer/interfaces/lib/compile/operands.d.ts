import type { CompilableTemplate, STDLibraryOpcode as STDLibraryOpcode } from '../template';
import type { SymbolTable } from '../tier1/symbol-table';
import type * as WireFormat from './wire-format/api';

export type LabelOperandType = 1;
export type IsStrictModeOperandType = 2;
export type DebugSymbolsOperandType = 3;
export type BlockOperandType = 4;
export type StdLibraryOperandType = 5;
export type NonSmallIntOperandType = 6;
export type SymbolTableOperandType = 7;
export type LayoutOperandType = 8;

export type OperandType =
  | LabelOperandType
  | IsStrictModeOperandType
  | DebugSymbolsOperandType
  | BlockOperandType
  | StdLibraryOperandType
  | NonSmallIntOperandType
  | SymbolTableOperandType
  | LayoutOperandType;

export interface LabelOperand {
  type: LabelOperandType;
  value: string;
}

export interface IsStrictModeOperand {
  type: IsStrictModeOperandType;
  value: undefined;
}

export interface DebugSymbolsOperand {
  type: DebugSymbolsOperandType;
  value: undefined;
}

export interface BlockOperand {
  type: BlockOperandType;
  value: WireFormat.SerializedInlineBlock | WireFormat.SerializedBlock;
}

export interface StdLibraryOperand {
  type: StdLibraryOperandType;
  value: STDLibraryOpcode;
}

export interface NonSmallIntOperand {
  type: NonSmallIntOperandType;
  value: number;
}

export interface SymbolTableOperand {
  type: SymbolTableOperandType;
  value: SymbolTable;
}

export interface LayoutOperand {
  type: LayoutOperandType;
  value: CompilableTemplate;
}

export type HighLevelBuilderOperand =
  | LabelOperand
  | IsStrictModeOperand
  | DebugSymbolsOperand
  | StdLibraryOperand
  | BlockOperand
  | NonSmallIntOperand
  | SymbolTableOperand
  | LayoutOperand;

export type SingleBuilderOperand =
  | HighLevelBuilderOperand
  | number
  | string
  | boolean
  | undefined
  | null
  | number[]
  | string[];

export type Operand = number;

export type EncoderOperands = [] | [Operand] | [Operand, Operand] | [Operand, Operand, Operand];
