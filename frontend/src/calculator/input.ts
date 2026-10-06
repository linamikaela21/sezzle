const MAX_DIGITS = 12;
const SCIENTIFIC_UPPER = 1e12;
const SCIENTIFIC_LOWER = 1e-6;
const SCIENTIFIC_FRACTION_DIGITS = 6;
const RESULT_PRECISION = 12;

export function digitCount(value: string): number {
  return value.replace(/[^0-9]/g, "").length;
}

export function appendDigit(current: string, digit: string): string {
  const negative = current.startsWith("-");
  const body = negative ? current.slice(1) : current;
  if (body === "0") {
    if (digit === "0") return current;
    return negative ? `-${digit}` : digit;
  }
  if (digitCount(body) >= MAX_DIGITS) return current;
  return current + digit;
}

export function appendDot(current: string): string {
  if (current.includes(".")) return current;
  if (current === "" || current === "-") return `${current}0.`;
  return `${current}.`;
}

export function toggleSign(current: string): string {
  if (current.startsWith("-")) return current.slice(1);
  if (current === "0") return "-0";
  return `-${current}`;
}

export function backspace(current: string): string {
  if (current.length <= 1) return "0";
  const next = current.slice(0, -1);
  if (next === "" || next === "-") return "0";
  return next;
}

export function parseDisplay(value: string): number {
  return Number(value);
}

export function formatResult(value: number): string | null {
  if (!Number.isFinite(value)) return null;
  if (Object.is(value, -0)) return "0";
  const abs = Math.abs(value);
  if (abs !== 0 && (abs >= SCIENTIFIC_UPPER || abs < SCIENTIFIC_LOWER)) {
    return value.toExponential(SCIENTIFIC_FRACTION_DIGITS);
  }
  return String(Number(value.toPrecision(RESULT_PRECISION)));
}
