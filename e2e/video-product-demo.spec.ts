import { test, expect } from "@playwright/test";

test.describe("Video Product Demo Feature", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("page loads with Flux agent bench heading", async ({ page }) => {
    const heading = page.locator("h1");
    await expect(heading).toHaveText("Flux agent bench");
  });

  test("Kärcher product is selected by default and video panel is visible", async ({
    page,
  }) => {
    const videoPanel = page.locator("#videoplayer_panel_root");
    await expect(videoPanel).toBeVisible();

    const videoElement = page.locator("#videoplayer_panel_video");
    await expect(videoElement).toBeAttached();
  });

  test("video element is muted (agent narrates, video stays silent)", async ({
    page,
  }) => {
    const videoElement = page.locator("#videoplayer_panel_video");
    await expect(videoElement).toHaveAttribute("muted", "");
  });

  test("video panel header shows 'Video Demo' label", async ({ page }) => {
    const videoPanel = page.locator("#videoplayer_panel_root");
    const headerText = videoPanel.locator("h2");
    await expect(headerText).toHaveText("Video Demo");
  });

  test("video overlay is not visible by default", async ({ page }) => {
    const overlay = page.locator("#videoplayer_panel_overlay");
    await expect(overlay).not.toBeVisible();
  });

  test("connection panel is visible with connect controls", async ({
    page,
  }) => {
    const connectButton = page.locator("#bench_connection_connectBtn");
    await expect(connectButton).toBeVisible();
  });

  test("live panel shows 'Transcript appears here' when not connected", async ({
    page,
  }) => {
    const transcriptPlaceholder = page.getByText("Transcript appears here.");
    await expect(transcriptPlaceholder).toBeVisible();
  });

  test("system prompt panel is visible with behavior and product config", async ({
    page,
  }) => {
    const behaviorTextarea = page.locator("textarea").first();
    await expect(behaviorTextarea).toBeVisible();
  });
});

test.describe("Product Switching — Video Panel Conditional Rendering", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("switching to HotelStack hides the video panel (no video config)", async ({
    page,
  }) => {
    const videoPanel = page.locator("#videoplayer_panel_root");
    await expect(videoPanel).toBeVisible();

    const productSelect = page.locator("#bench_prompt_productFile");
    await productSelect.selectOption("hotelstack");
    await expect(videoPanel).not.toBeVisible();
  });

  test("switching back to Kärcher restores the video panel", async ({
    page,
  }) => {
    const videoPanel = page.locator("#videoplayer_panel_root");
    const productSelect = page.locator("#bench_prompt_productFile");

    await productSelect.selectOption("hotelstack");
    await expect(videoPanel).not.toBeVisible();

    await productSelect.selectOption("karcher_k_2_360");
    await expect(videoPanel).toBeVisible();
  });
});

test.describe("DASH Player Initialization", () => {
  test("dashjs initializes and video element receives a source", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const videoElement = page.locator("#videoplayer_panel_video");
    await expect(videoElement).toBeAttached();

    await page.waitForTimeout(2000);

    const videoSrc = await videoElement.evaluate(
      (videoEl: HTMLVideoElement) => videoEl.currentSrc || videoEl.src
    );
    expect(videoSrc.length).toBeGreaterThan(0);
  });
});
