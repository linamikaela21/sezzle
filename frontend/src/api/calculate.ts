import type { CalcFailure, CalcRequest, CalcSuccess } from "../calculator/types";

const API_PATH = "/api/calculate";
const HTTP_BAD_REQUEST = 400;
export const NETWORK_MESSAGE = "Sin conexión";
const INVALID_RESPONSE_MESSAGE = "invalid response";
const GENERIC_DOMAIN_MESSAGE = "error";
const NON_FINITE_MESSAGE = "non-finite result";

export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}

export class NetworkError extends Error {
  constructor(message = NETWORK_MESSAGE) {
    super(message);
    this.name = "NetworkError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readSuccess(value: unknown): CalcSuccess | undefined {
  if (!isRecord(value) || typeof value.result !== "number" || !Number.isFinite(value.result)) {
    return undefined;
  }
  return { result: value.result };
}

function readFailure(value: unknown): CalcFailure | undefined {
  if (!isRecord(value) || typeof value.error !== "string") return undefined;
  return { error: value.error };
}

export async function calculate(request: CalcRequest, baseUrl?: string): Promise<number> {
  if (!Number.isFinite(request.a) || !Number.isFinite(request.b)) {
    throw new DomainError(NON_FINITE_MESSAGE);
  }

  const configured = baseUrl ?? import.meta.env.VITE_API_URL ?? "";
  const base = configured.replace(/\/$/, "");

  let response: Response;
  try {
    response = await fetch(`${base}${API_PATH}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
  } catch {
    throw new NetworkError();
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    if (response.status === HTTP_BAD_REQUEST || response.ok) {
      throw new DomainError(INVALID_RESPONSE_MESSAGE);
    }
    throw new NetworkError();
  }

  if (response.status === HTTP_BAD_REQUEST) {
    throw new DomainError(readFailure(payload)?.error ?? GENERIC_DOMAIN_MESSAGE);
  }
  if (!response.ok) throw new NetworkError();
  const success = readSuccess(payload);
  if (!success) throw new DomainError(NON_FINITE_MESSAGE);
  return success.result;
}
