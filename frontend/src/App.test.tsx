import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("muestra la calculadora", () => {
    render(<App />);
    expect(screen.getByRole("button", { name: (value) => value === "AC" })).toBeInTheDocument();
    expect(screen.getByTestId("display").textContent).toBe("0");
  });
});
