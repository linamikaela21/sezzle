import { describe, expect, it } from "vitest";
import { KEY } from "./keys";
import { expressionLine, failNetwork, initialState, press, succeed, toError, type Step } from "./machine";

function applyKeys(keys: string[]): Step {
  let state = initialState;
  let last: Step = { type: "state", state };
  for (const key of keys) {
    last = press(state, key);
    if (last.type === "call") return last;
    state = last.state;
  }
  return last;
}

describe("máquina de la calculadora", () => {
  it("reemplaza el operador pendiente", () => {
    const step = applyKeys(["5", KEY.add, KEY.sub]);
    expect(step.type).toBe("state");
    if (step.type === "state") {
      expect(step.state.pending).toBe("sub");
      expect(step.state.phase).toBe("operator");
      expect(step.state.display).toBe("5");
    }
  });

  it("al pulsar igual justo después de un operador repite el operando", () => {
    const step = applyKeys(["5", KEY.add, KEY.eq]);
    expect(step.type).toBe("call");
    if (step.type === "call") {
      expect(step.request).toEqual({ operation: "add", a: 5, b: 5 });
    }
  });

  it("200 + 10% pide add(200, 20)", () => {
    const step = applyKeys(["2", "0", "0", KEY.add, "1", "0", KEY.percent]);
    expect(step.type).toBe("call");
    if (step.type === "call") {
      expect(step.request).toEqual({ operation: "add", a: 200, b: 20 });
    }
  });

  it("la división por cero y la raíz negativa no llaman al API", () => {
    const div = applyKeys(["8", KEY.div, "0", KEY.eq]);
    expect(div).toEqual({ type: "state", state: toError() });

    const root = applyKeys(["9", KEY.sign, KEY.sqrt]);
    expect(root).toEqual({ type: "state", state: toError() });
  });

  it("en error solo AC recupera, y los dígitos no entran", () => {
    const stuck = press(toError(), "5");
    expect(stuck).toEqual({ type: "state", state: toError() });
    const cleared = press(toError(), KEY.ac);
    expect(cleared).toEqual({ type: "state", state: initialState });
  });

  it("cubre el tope de dígitos, el borrado y el cero a la izquierda", () => {
    const typed = applyKeys(["0", "0", "1", KEY.dot, "2", KEY.backspace]);
    expect(typed.type).toBe("state");
    if (typed.type === "state") expect(typed.state.display).toBe("1.");

    let state = initialState;
    for (const digit of "1234567890123") {
      const step = press(state, digit);
      if (step.type !== "state") throw new Error("expected state");
      state = step.state;
    }
    expect(state.display).toBe("123456789012");

    const cleared = press({ ...state, pending: "add", acc: 5, phase: "entering" }, KEY.clear);
    expect(cleared.type).toBe("state");
    if (cleared.type === "state") {
      expect(cleared.state.display).toBe("0");
      expect(cleared.state.pending).toBe("add");
    }
  });

  it("resuelve el porcentaje en suma, resta, producto, división y sin operación", () => {
    const sub = applyKeys(["2", "0", "0", KEY.sub, "1", "0", KEY.percent]);
    const mul = applyKeys(["2", "0", "0", KEY.mul, "1", "0", KEY.percent]);
    const div = applyKeys(["2", "0", "0", KEY.div, "1", "0", KEY.percent]);
    const plain = applyKeys(["5", "0", KEY.percent]);
    for (const step of [sub, mul, div, plain]) expect(step.type).toBe("call");
    if (sub.type === "call") expect(sub.request).toEqual({ operation: "sub", a: 200, b: 20 });
    if (mul.type === "call") expect(mul.request).toEqual({ operation: "mul", a: 200, b: 0.1 });
    if (div.type === "call") expect(div.request).toEqual({ operation: "div", a: 200, b: 0.1 });
    if (plain.type === "call") expect(plain.request).toEqual({ operation: "percent", a: 50, b: 0 });
  });

  it("encadena operaciones y la división por cero no llama al API", () => {
    const chain = applyKeys(["2", KEY.add, "3", KEY.mul]);
    expect(chain.type).toBe("call");
    if (chain.type === "call") {
      expect(chain.request).toEqual({ operation: "add", a: 2, b: 3 });
      expect(chain.next).toBe("mul");
    }
    const bad = applyKeys(["8", KEY.div, "0", KEY.add]);
    expect(bad).toEqual({ type: "state", state: toError() });
  });

  it("reintenta la última petición cuando no hay conexión", () => {
    const offline = failNetwork(initialState, { operation: "add", a: 2, b: 2 }, "result");
    const retry = press(offline, KEY.eq);
    expect(retry.type).toBe("call");
    if (retry.type === "call") expect(retry.request).toEqual({ operation: "add", a: 2, b: 2 });

    const moved = press(offline, "4");
    expect(moved.type).toBe("state");
    if (moved.type === "state") expect(moved.state.networkError).toBe(false);
  });

  it("tras un operador, el punto y el signo empiezan el segundo número", () => {
    const armed = applyKeys(["5", KEY.add]);
    if (armed.type !== "state") throw new Error("expected state");
    const dotted = press(armed.state, KEY.dot);
    if (dotted.type !== "state") throw new Error("expected state");
    expect(dotted.state.display).toBe("0.");
    expect(dotted.state.pending).toBe("add");

    const signed = press(armed.state, KEY.sign);
    if (signed.type !== "state") throw new Error("expected state");
    expect(signed.state.display).toBe("-5");
    expect(signed.state.acc).toBe(-5);

    const ignored = press(armed.state, "no-es-una-tecla");
    expect(ignored.type).toBe("state");
    if (ignored.type === "state") expect(ignored.state.display).toBe("5");
  });

  it("borra un resultado, ignora el retroceso tras un operador y el igual sin operación no calcula", () => {
    const shown = succeed(12, { operation: "add", a: 7, b: 5 }, "result");
    const signed = press(shown, KEY.sign);
    expect(signed.type).toBe("state");
    if (signed.type === "state") {
      expect(signed.state.display).toBe("-12");
      expect(expressionLine(signed.state)).toBe("");
    }
    const erased = press(shown, KEY.backspace);
    expect(erased.type).toBe("state");
    if (erased.type === "state") expect(erased.state.display).toBe("1");

    const waiting = press(initialState, "5");
    if (waiting.type !== "state") throw new Error("expected state");
    const withOp = press(waiting.state, KEY.add);
    if (withOp.type !== "state") throw new Error("expected state");
    const kept = press(withOp.state, KEY.backspace);
    expect(kept).toEqual(withOp);

    const same = press(shown, KEY.eq);
    expect(same.type).toBe("state");
    if (same.type === "state") expect(same.state.display).toBe("12");

    const chained = succeed(8, { operation: "add", a: 5, b: 3 }, "mul");
    expect(chained.phase).toBe("operator");
    expect(chained.pending).toBe("mul");
    expect(chained.display).toBe("8");
  });

  it("un resultado no finito entra en error y la raíz válida pide sqrt", () => {
    expect(succeed(Number.POSITIVE_INFINITY, { operation: "exp", a: 10, b: 400 }, "result").phase).toBe(
      "error",
    );
    const root = applyKeys(["9", KEY.sqrt]);
    expect(root.type).toBe("call");
    if (root.type === "call") {
      expect(root.request).toEqual({ operation: "sqrt", a: 9, b: 0 });
      expect(expressionLine(root.state)).toBe("√9");
    }
  });

  it("arma el micro historial de la operación en curso", () => {
    const started = applyKeys(["2", KEY.add]);
    expect(started.type).toBe("state");
    if (started.type === "state") expect(expressionLine(started.state)).toBe(`2 ${KEY.add}`);

    const second = applyKeys(["2", KEY.add, "2"]);
    expect(second.type).toBe("state");
    if (second.type === "state") expect(expressionLine(second.state)).toBe(`2 ${KEY.add} 2`);

    const chained = applyKeys(["2", KEY.add, "2", KEY.add]);
    expect(chained.type).toBe("call");
    if (chained.type === "call") {
      expect(expressionLine(chained.state)).toBe(`2 ${KEY.add} 2 ${KEY.add}`);
      const done = succeed(4, chained.request, chained.next, chained.state.history);
      expect(expressionLine(done)).toBe(`2 ${KEY.add} 2 ${KEY.add}`);
      const typing = press(done, "5");
      expect(typing.type).toBe("state");
      if (typing.type === "state") expect(expressionLine(typing.state)).toBe(`2 ${KEY.add} 2 ${KEY.add} 5`);
    }

    const replaced = applyKeys(["5", KEY.add, KEY.sub]);
    if (replaced.type === "state") expect(expressionLine(replaced.state)).toBe(`5 ${KEY.sub}`);

    const finished = applyKeys(["2", KEY.add, "2", KEY.eq]);
    if (finished.type === "call") expect(expressionLine(finished.state)).toBe(`2 ${KEY.add} 2 =`);

    const percent = applyKeys(["2", "0", "0", KEY.add, "1", "0", KEY.percent]);
    if (percent.type === "call") expect(expressionLine(percent.state)).toBe(`200 ${KEY.add} 10%`);
  });
});
