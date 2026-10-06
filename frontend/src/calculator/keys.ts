import type { BinaryOp } from "./types";

export const KEY = {
  ac: "AC",
  clear: "C",
  backspace: "⌫",
  sign: "±",
  dot: ".",
  eq: "=",
  percent: "%",
  sqrt: "√",
  exp: "xʸ",
  add: "+",
  sub: "−",
  mul: "×",
  div: "÷",
} as const;

export const PENDING_LABEL: Record<BinaryOp, string> = {
  add: KEY.add,
  sub: KEY.sub,
  mul: KEY.mul,
  div: KEY.div,
  exp: KEY.exp,
};
