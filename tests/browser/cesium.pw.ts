import { expect, test } from "@playwright/test";

test("renders worker-created geometry with local assets", async ({ page, baseURL }) => {
  const errors: string[] = [];
  const workerRequests: string[] = [];
  let workers = 0;
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("requestfailed", (request) =>
    errors.push(`${request.url()}: ${request.failure()?.errorText}`),
  );
  page.on("response", (response) => {
    if (response.status() >= 400) errors.push(`${response.status()}: ${response.url()}`);
    if (response.url().includes("/app/cesium/Workers/")) workerRequests.push(response.url());
  });
  page.on("worker", () => workers++);
  await page.route("**/*", (route) => {
    if (new URL(route.request().url()).origin === new URL(baseURL!).origin) return route.continue();
    return route.abort("internetdisconnected");
  });

  await page.goto("./");
  await expect(page.locator("#status")).toHaveText("ready", { timeout: 20_000 });
  await expect(page.locator(".cesium-widget")).toHaveCSS("height", "600px");
  await expect
    .poll(() =>
      page.locator("canvas").evaluate((canvas: HTMLCanvasElement) => {
        const gl = canvas.getContext("webgl2")!;
        const pixel = new Uint8Array(4);
        gl.readPixels(canvas.width / 2, canvas.height / 2, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
        return pixel[0] > 200 && pixel[1] < 50 && pixel[2] < 50;
      }),
    )
    .toBe(true);
  expect(workers).toBeGreaterThan(0);
  expect(workerRequests.some((url) => url.includes("createGeometry.js"))).toBe(true);
  expect(errors).toEqual([]);
});
