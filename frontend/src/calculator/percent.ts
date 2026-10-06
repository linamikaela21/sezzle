import type { BinaryOp, CalcRequest } from "./types";

const PERCENT_DIVISOR = 100;

export function buildPercentRequest(
  pending: BinaryOp | null,
  base: number,
  current: number,
): CalcRequest {
  if (pending === "add" || pending === "sub") {
    return { operation: pending, a: base, b: base * (current / PERCENT_DIVISOR) };
  }
  if (pending === "mul" || pending === "div" || pending === "exp") {
    return { operation: pending, a: base, b: current / PERCENT_DIVISOR };
  }
  return { operation: "percent", a: current, b: 0 };
}
