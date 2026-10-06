import { afterEach, describe, expect, it, vi } from "vitest";
import { calculate, DomainError, NetworkError } from "./calculate";

const request = { operation: "add" as const, a: 200, b: 20 };

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe("cliente del API", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("envía POST /api/calculate y devuelve result", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { result: 220 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(calculate(request, "http://127.0.0.1:8081")).resolves.toBe(220);

    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:8081/api/calculate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
  });

  it("traduce un 400 en error de dominio", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(400, { error: "division by zero" })),
    );

    await expect(calculate(request, "http://api.test")).rejects.toBeInstanceOf(DomainError);
  });

  it("distingue un cuerpo ilegible, un 400 sin mensaje, un 500 y un resultado no finito", async () => {
    const request = { operation: "div" as const, a: 1, b: 0 };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error("no json");
        },
      }),
    );
    await expect(calculate(request, "http://api.test")).rejects.toBeInstanceOf(NetworkError);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => {
          throw new Error("no json");
        },
      }),
    );
    await expect(calculate(request, "http://api.test")).rejects.toMatchObject({
      name: "DomainError",
      message: "invalid response",
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error("no json");
        },
      }),
    );
    await expect(calculate(request, "http://api.test")).rejects.toMatchObject({
      name: "DomainError",
      message: "invalid response",
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(400, { error: 12 })),
    );
    await expect(calculate(request, "http://api.test")).rejects.toMatchObject({ message: "error" });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(502, { error: "down" })),
    );
    await expect(calculate(request, "http://api.test")).rejects.toBeInstanceOf(NetworkError);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(200, { result: "220" })),
    );
    await expect(calculate(request, "http://api.test")).rejects.toMatchObject({
      message: "non-finite result",
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(200, { result: Number.POSITIVE_INFINITY })),
    );
    await expect(calculate(request, "http://api.test")).rejects.toMatchObject({
      message: "non-finite result",
    });

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, null)));
    await expect(calculate(request, "http://api.test")).rejects.toMatchObject({
      message: "non-finite result",
    });

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, [1])));
    await expect(calculate(request, "http://api.test")).rejects.toMatchObject({
      message: "non-finite result",
    });
  });

  it("no serializa NaN ni Infinity: el JSON los convertiría en null", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      calculate({ operation: "add", a: Number.NaN, b: 1 }, "http://api.test"),
    ).rejects.toMatchObject({ name: "DomainError", message: "non-finite result" });
    await expect(
      calculate({ operation: "mul", a: 2, b: Number.POSITIVE_INFINITY }, "http://api.test"),
    ).rejects.toBeInstanceOf(DomainError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("traduce un fallo de red en Sin conexión", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("failed")));

    await expect(calculate(request, "http://api.test")).rejects.toMatchObject({
      name: "NetworkError",
      message: "Sin conexión",
    });
    await expect(calculate(request, "http://api.test")).rejects.toBeInstanceOf(NetworkError);
  });
});
