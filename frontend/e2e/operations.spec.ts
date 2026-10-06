import { expect, test, type Page } from "@playwright/test";

async function press(page: Page, keys: string[]) {
  for (const key of keys) {
    await page.getByRole("button", { name: key, exact: true }).click();
  }
}

async function expectDisplay(page: Page, value: string) {
  await expect(page.getByTestId("display")).toHaveText(value);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("suma", async ({ page }) => {
  await press(page, ["2", "+", "3", "="]);
  await expectDisplay(page, "5");
});

test("resta", async ({ page }) => {
  await press(page, ["8", "−", "3", "="]);
  await expectDisplay(page, "5");
});

test("multiplicación", async ({ page }) => {
  await press(page, ["6", "×", "7", "="]);
  await expectDisplay(page, "42");
});

test("división", async ({ page }) => {
  await press(page, ["8", "÷", "2", "="]);
  await expectDisplay(page, "4");
});

test("potencia", async ({ page }) => {
  await press(page, ["2", "xʸ", "3", "="]);
  await expectDisplay(page, "8");
});

test("raíz cuadrada", async ({ page }) => {
  await press(page, ["9", "√"]);
  await expectDisplay(page, "3");
});

test("porcentaje", async ({ page }) => {
  await press(page, ["5", "0", "%"]);
  await expectDisplay(page, "0.5");
});
