import { describe, expect, it } from "vitest";
import { buildPercentRequest } from "./percent";

describe("porcentaje de calculadora", () => {
  it("sin operación pendiente divide entre 100", () => {
    expect(buildPercentRequest(null, 0, 50)).toEqual({
      operation: "percent",
      a: 50,
      b: 0,
    });
  });

  it("con suma o resta usa el porcentaje del primero", () => {
    expect(buildPercentRequest("add", 200, 10)).toEqual({
      operation: "add",
      a: 200,
      b: 20,
    });
    expect(buildPercentRequest("sub", 200, 10)).toEqual({
      operation: "sub",
      a: 200,
      b: 20,
    });
  });

  it("con multiplicación, división o potencia convierte el segundo número en fracción", () => {
    expect(buildPercentRequest("mul", 200, 10)).toEqual({
      operation: "mul",
      a: 200,
      b: 0.1,
    });
    expect(buildPercentRequest("div", 200, 10)).toEqual({
      operation: "div",
      a: 200,
      b: 0.1,
    });
    expect(buildPercentRequest("exp", 200, 10)).toEqual({
      operation: "exp",
      a: 200,
      b: 0.1,
    });
  });
});
