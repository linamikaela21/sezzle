import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KEY } from "../calculator/keys";
import { Calculator } from "./Calculator";

let fetchMock: ReturnType<typeof vi.fn>;

function ok(result: number) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ result }),
  };
}

function button(name: string) {
  return screen.getByRole("button", { name: (value) => value === name });
}

async function pressKeys(labels: string[]) {
  const user = userEvent.setup();
  for (const label of labels) {
    await user.click(button(label));
  }
  return user;
}

describe("calculadora", () => {
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("ignora un segundo punto decimal", async () => {
    render(<Calculator />);
    await pressKeys(["1", KEY.dot, KEY.dot, "2"]);
    expect(screen.getByTestId("display").textContent).toBe("1.2");
  });

  it("la división por cero deja Error y bloquea dígitos hasta AC", async () => {
    render(<Calculator />);
    const user = await pressKeys(["8", KEY.div, "0", KEY.eq]);
    expect(screen.getByTestId("display").textContent).toBe("Error");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(button("5")).toBeDisabled();
    await user.click(button(KEY.ac));
    expect(screen.getByTestId("display").textContent).toBe("0");
    await user.click(button("5"));
    expect(screen.getByTestId("display").textContent).toBe("5");
  });

  it("la raíz de un negativo deja Error", async () => {
    render(<Calculator />);
    await pressKeys(["9", KEY.sign, KEY.sqrt]);
    expect(screen.getByTestId("display").textContent).toBe("Error");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(button("1")).toBeDisabled();
  });

  it("200 + 10% llama a add(200, 20) y muestra 220", async () => {
    fetchMock.mockResolvedValue(ok(220));
    render(<Calculator />);
    await pressKeys(["2", "0", "0", KEY.add, "1", "0", KEY.percent]);
    await waitFor(() => expect(screen.getByTestId("display").textContent).toBe("220"));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      operation: "add",
      a: 200,
      b: 20,
    });
  });

  it("muestra el micro historial de la operación en curso", async () => {
    fetchMock.mockResolvedValue(ok(4));
    render(<Calculator />);
    const user = await pressKeys(["2", KEY.add, "2", KEY.add]);
    await waitFor(() =>
      expect(screen.getByTestId("pending-op").textContent).toBe(`2 ${KEY.add} 2 ${KEY.add}`),
    );
    expect(screen.getByTestId("display").textContent).toBe("4");
    await user.click(button("5"));
    expect(screen.getByTestId("pending-op").textContent).toBe(`2 ${KEY.add} 2 ${KEY.add} 5`);
    expect(screen.getByTestId("display").textContent).toBe("5");
  });

  it("pulsar otro operador reemplaza al pendiente", async () => {
    render(<Calculator />);
    await pressKeys(["5", KEY.add, KEY.sub]);
    expect(screen.getByTestId("pending-op").textContent).toBe(`5 ${KEY.sub}`);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("un fallo de red muestra Sin conexión y = reintenta", async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError("offline"))
      .mockResolvedValueOnce(ok(4));
    render(<Calculator />);
    const user = await pressKeys(["2", KEY.add, "2", KEY.eq]);
    await screen.findByText("Sin conexión");
    expect(screen.getByTestId("display").textContent).toBe("2");
    await user.click(button(KEY.eq));
    await waitFor(() => expect(screen.getByTestId("display").textContent).toBe("4"));
    expect(screen.queryByText("Sin conexión")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("AC ignora una respuesta que llega tarde", async () => {
    let settle: (value: unknown) => void = () => {};
    fetchMock.mockReturnValue(
      new Promise((resolve) => {
        settle = resolve;
      }),
    );
    render(<Calculator />);
    const user = await pressKeys(["2", KEY.add, "2", KEY.eq]);
    await user.click(button(KEY.ac));
    settle(ok(99));
    await waitFor(() => expect(screen.getByTestId("display").textContent).toBe("0"));
  });

  it("un 400 del API entra en el mismo estado de error", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: "non-finite result" }),
    });
    render(<Calculator />);
    await pressKeys(["2", KEY.add, "2", KEY.eq]);
    await waitFor(() => expect(screen.getByTestId("display").textContent).toBe("Error"));
    expect(button("7")).toBeDisabled();
  });
});
