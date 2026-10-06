import { appendDigit, appendDot, backspace, formatResult, parseDisplay, toggleSign } from "./input";
import { KEY, PENDING_LABEL } from "./keys";
import { buildPercentRequest } from "./percent";
import type { BinaryOp, CalcRequest } from "./types";

export type Phase = "entering" | "operator" | "result" | "error";
export type FollowUp = "result" | BinaryOp;

export interface CalculatorState {
  display: string;
  phase: Phase;
  acc: number | null;
  pending: BinaryOp | null;
  lastRequest: CalcRequest | null;
  followUp: FollowUp;
  networkError: boolean;
  history: string[];
}

export const initialState: CalculatorState = {
  display: "0",
  phase: "entering",
  acc: null,
  pending: null,
  lastRequest: null,
  followUp: "result",
  networkError: false,
  history: [],
};

export type Step =
  | { type: "state"; state: CalculatorState }
  | { type: "call"; state: CalculatorState; request: CalcRequest; next: FollowUp };

const DIGITS = new Set(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]);

const OPERATORS: Record<string, BinaryOp> = {
  [KEY.add]: "add",
  [KEY.sub]: "sub",
  [KEY.mul]: "mul",
  [KEY.div]: "div",
  [KEY.exp]: "exp",
};

const OPERATOR_LABELS = new Set<string>(Object.values(PENDING_LABEL));

export function expressionLine(state: CalculatorState): string {
  if (state.phase === "error" || state.history.length === 0) return "";
  const last = state.history[state.history.length - 1];
  if (state.phase === "entering" && OPERATOR_LABELS.has(last)) {
    return [...state.history, state.display].join(" ");
  }
  return state.history.join(" ");
}

export function toError(): CalculatorState {
  return { ...initialState, display: "Error", phase: "error" };
}

export function isLocalError(request: CalcRequest): boolean {
  if (!Number.isFinite(request.a) || !Number.isFinite(request.b)) return true;
  if (request.operation === "div" && request.b === 0) return true;
  if (request.operation === "sqrt" && request.a < 0) return true;
  return false;
}

export function succeed(
  result: number,
  request: CalcRequest,
  next: FollowUp,
  history: string[] = [],
): CalculatorState {
  const text = formatResult(result);
  if (text === null) return toError();
  if (next === "result") {
    return {
      display: text,
      phase: "result",
      acc: result,
      pending: null,
      lastRequest: request,
      followUp: "result",
      networkError: false,
      history,
    };
  }
  return {
    display: text,
    phase: "operator",
    acc: result,
    pending: next,
    lastRequest: request,
    followUp: "result",
    networkError: false,
    history,
  };
}

export function failNetwork(
  state: CalculatorState,
  request: CalcRequest,
  next: FollowUp,
): CalculatorState {
  return {
    ...state,
    networkError: true,
    lastRequest: request,
    followUp: next,
  };
}

export function press(state: CalculatorState, key: string): Step {
  if (state.phase === "error") {
    if (key === KEY.ac) return { type: "state", state: initialState };
    return { type: "state", state };
  }
  if (key === KEY.ac) return { type: "state", state: initialState };

  if (key === KEY.eq && state.networkError && state.lastRequest) {
    return { type: "call", state, request: state.lastRequest, next: state.followUp };
  }

  const current = state.networkError ? { ...state, networkError: false } : state;

  if (DIGITS.has(key)) {
    return { type: "state", state: enterDigit(current, key) };
  }

  const operator = OPERATORS[key];
  if (operator) return enterOperator(current, operator);

  switch (key) {
    case KEY.dot:
      return { type: "state", state: enterDot(current) };
    case KEY.sign:
      return { type: "state", state: enterSign(current) };
    case KEY.backspace:
      return { type: "state", state: enterBackspace(current) };
    case KEY.clear:
      return { type: "state", state: enterClear(current) };
    case KEY.eq:
      return enterEquals(current);
    case KEY.percent:
      return enterPercent(current);
    case KEY.sqrt:
      return enterSqrt(current);
    default:
      return { type: "state", state: current };
  }
}

function startEntry(state: CalculatorState, display: string): CalculatorState {
  const keep = state.phase === "operator";
  return {
    ...state,
    phase: "entering",
    display,
    acc: keep ? state.acc : null,
    pending: keep ? state.pending : null,
    history: keep ? state.history : [],
  };
}

function enterDigit(state: CalculatorState, digit: string): CalculatorState {
  if (state.phase === "entering") {
    return { ...state, display: appendDigit(state.display, digit) };
  }
  return startEntry(state, appendDigit("0", digit));
}

function enterDot(state: CalculatorState): CalculatorState {
  if (state.phase !== "entering") {
    return startEntry(state, "0.");
  }
  return { ...state, display: appendDot(state.display) };
}

function enterSign(state: CalculatorState): CalculatorState {
  const display = toggleSign(state.display);
  if (state.phase === "entering") return { ...state, display };
  if (state.phase === "operator" && state.pending) {
    return {
      ...state,
      display,
      acc: parseDisplay(display),
      history: [display, PENDING_LABEL[state.pending]],
    };
  }
  return { ...state, display, acc: parseDisplay(display), history: [] };
}

function enterBackspace(state: CalculatorState): CalculatorState {
  if (state.phase === "operator") return state;
  if (state.phase === "result") {
    return { ...initialState, display: backspace(state.display), phase: "entering" };
  }
  return { ...state, display: backspace(state.display) };
}

function enterClear(state: CalculatorState): CalculatorState {
  if (state.pending === null || state.phase === "result") return { ...initialState };
  return { ...state, phase: "entering", display: "0" };
}

function enterOperator(state: CalculatorState, op: BinaryOp): Step {
  const label = PENDING_LABEL[op];
  if (state.phase === "operator") {
    const history = state.history.length > 0 ? [...state.history.slice(0, -1), label] : [state.display, label];
    return { type: "state", state: { ...state, pending: op, history } };
  }
  if (state.phase === "entering" && state.pending !== null && state.acc !== null) {
    return callOrError(
      { ...state, phase: "operator", history: [...state.history, state.display, label] },
      { operation: state.pending, a: state.acc, b: parseDisplay(state.display) },
      op,
    );
  }
  return {
    type: "state",
    state: {
      ...state,
      phase: "operator",
      acc: parseDisplay(state.display),
      pending: op,
      history: [state.display, label],
    },
  };
}

function enterEquals(state: CalculatorState): Step {
  if (state.pending !== null && state.acc !== null && (state.phase === "operator" || state.phase === "entering")) {
    const b = state.phase === "operator" ? state.acc : parseDisplay(state.display);
    return callOrError(
      { ...state, history: [...state.history, state.display, "="] },
      { operation: state.pending, a: state.acc, b },
      "result",
    );
  }
  return { type: "state", state: { ...state, phase: "result" } };
}

function enterPercent(state: CalculatorState): Step {
  const current = parseDisplay(state.display);
  if (state.phase === "entering" && state.pending !== null && state.acc !== null) {
    return callOrError(
      { ...state, history: [...state.history, `${state.display}%`] },
      buildPercentRequest(state.pending, state.acc, current),
      "result",
    );
  }
  return callOrError(
    { ...state, history: [`${state.display}%`] },
    { operation: "percent", a: current, b: 0 },
    "result",
  );
}

function enterSqrt(state: CalculatorState): Step {
  return callOrError(
    { ...state, history: [`√${state.display}`] },
    { operation: "sqrt", a: parseDisplay(state.display), b: 0 },
    "result",
  );
}

function callOrError(state: CalculatorState, request: CalcRequest, next: FollowUp): Step {
  if (isLocalError(request)) return { type: "state", state: toError() };
  return { type: "call", state, request, next };
}
