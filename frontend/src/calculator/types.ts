export type Operation = "add" | "sub" | "mul" | "div" | "exp" | "sqrt" | "percent";

export type BinaryOp = "add" | "sub" | "mul" | "div" | "exp";

export interface CalcRequest {
  operation: Operation;
  a: number;
  b: number;
}

export interface CalcSuccess {
  result: number;
}

export interface CalcFailure {
  error: string;
}
