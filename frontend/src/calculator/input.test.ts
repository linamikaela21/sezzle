import { describe, expect, it } from "vitest";
import { appendDigit, appendDot, backspace, formatResult, toggleSign } from "./input";

describe("entrada del display", () => {
  it("ignora un segundo punto decimal", () => {
    expect(appendDot("")).toBe("0.");
    expect(appendDot("-")).toBe("-0.");
    expect(appendDot(appendDot("1"))).toBe("1.");
    expect(appendDigit(appendDot(appendDot("1")), "2")).toBe("1.2");
  });

  it("descarta ceros a la izquierda salvo el cero de 0.", () => {
    expect(appendDigit("0", "0")).toBe("0");
    expect(appendDigit("0", "5")).toBe("5");
    expect(appendDigit("-0", "5")).toBe("-5");
    expect(appendDigit(appendDot("0"), "0")).toBe("0.0");
  });

  it("no acepta más de 12 dígitos", () => {
    const full = "123456789012";
    expect(appendDigit(full, "3")).toBe(full);
    expect(appendDot(full)).toBe("123456789012.");
    expect(appendDigit("-123456789012", "4")).toBe("-123456789012");
  });

  it("formatea resultados finitos y rechaza los que no lo son", () => {
    expect(formatResult(220)).toBe("220");
    expect(formatResult(0.5)).toBe("0.5");
    expect(formatResult(-0)).toBe("0");
    expect(formatResult(1e13)).toBe((1e13).toExponential(6));
    expect(formatResult(1e-8)).toBe((1e-8).toExponential(6));
    expect(formatResult(Number.NaN)).toBeNull();
    expect(formatResult(Number.POSITIVE_INFINITY)).toBeNull();
  });

  it("cambia el signo y borra un dígito", () => {
    expect(toggleSign("0")).toBe("-0");
    expect(toggleSign("-12")).toBe("12");
    expect(backspace("12")).toBe("1");
    expect(backspace("-5")).toBe("0");
    expect(backspace("0.")).toBe("0");
  });
});
