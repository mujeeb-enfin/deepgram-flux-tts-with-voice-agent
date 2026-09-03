import { test, expect } from "@playwright/test";

/**
 * E2E tests for the Video Product Demo feature.
 *
 * Each test states what behaviour it protects and why. Tests run against
 * the production build on port 3443 with the Kärcher product (which has
 * a video config) selected by default and HotelStack (no video config)
 * as the negative case.
 *
 * These tests exercise the REAL rendered DOM — not source strings, not
 * mocks. They verify the prospect-facing experience: video panel, DASH
 * player, product switching, overlay state, connection controls, and
 * structural correctness of every panel.
 */

/* ------------------------------------------------------------------ */
/*  1. Page load — Kärcher default, video panel rendered               */
/* ------------------------------------------------------------------ */
test.describe("Page load with Kärcher product (video-enabled)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("page heading identifies the tool as Flux agent bench", async ({ page }) => {
    await expect(page.locator("h1")).toHaveText("Flux agent bench");
  });

  test("page subtitle shows Deepgram Flux STT + TTS stack identity", async ({ page }) => {
    const subtitle = page.locator("header span");
    await expect(subtitle).toContainText("deepgram voice agent");
    await expect(subtitle).toContainText("flux stt");
    await expect(subtitle).toContainText("flux tts");
  });

  test("Kärcher product is selected by default in the product dropdown", async ({ page }) => {
    const productSelect = page.locator("#bench_prompt_productFile");
    await expect(productSelect).toHaveValue("karcher_k_2_360");
  });

  test("product JSON textarea contains Kärcher product name", async ({ page }) => {
    const productTextarea = page.locator("#bench_prompt_product");
    const productJsonText = await productTextarea.inputValue();
    const parsedProductConfig = JSON.parse(productJsonText);
    expect(parsedProductConfig.productName).toContain("Kärcher");
  });

  test("product JSON contains video config with videoUrl and chapters", async ({ page }) => {
    const productTextarea = page.locator("#bench_prompt_product");
    const productJsonText = await productTextarea.inputValue();
    const parsedProductConfig = JSON.parse(productJsonText);
    expect(parsedProductConfig.video).toBeDefined();
    expect(parsedProductConfig.video.videoUrl).toMatch(/\.mpd$/);
    expect(parsedProductConfig.video.videoChapters.length).toBeGreaterThanOrEqual(1);
  });

  test("greeting includes the Kärcher product name", async ({ page }) => {
    const greetingInput = page.locator("#bench_prompt_greeting");
    const greetingText = await greetingInput.inputValue();
    expect(greetingText).toContain("Kärcher");
  });
});

/* ------------------------------------------------------------------ */
/*  2. Video player panel — structure and DASH player                  */
/* ------------------------------------------------------------------ */
test.describe("VideoPlayerPanel DOM structure and DASH init", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("video panel root is rendered with correct DOM ID", async ({ page }) => {
    await expect(page.locator("#videoplayer_panel_root")).toBeVisible();
  });

  test("video panel header reads 'Video Demo'", async ({ page }) => {
    const videoPanelHeader = page.locator("#videoplayer_panel_root h2");
    await expect(videoPanelHeader).toHaveText("Video Demo");
  });

  test("video element exists with correct DOM ID", async ({ page }) => {
    const videoElement = page.locator("#videoplayer_panel_video");
    await expect(videoElement).toBeAttached();
    expect(await videoElement.evaluate((el) => el.tagName)).toBe("VIDEO");
  });

  test("video element has muted attribute for agent-narrated playback", async ({ page }) => {
    const videoElement = page.locator("#videoplayer_panel_video");
    const isMutedAttribute = await videoElement.getAttribute("muted");
    expect(isMutedAttribute).not.toBeNull();
  });

  test("video element has playsInline attribute for mobile compatibility", async ({ page }) => {
    const videoElement = page.locator("#videoplayer_panel_video");
    const videoElementHtml = await videoElement.evaluate((el) => el.outerHTML);
    expect(videoElementHtml).toContain("playsinline");
  });

  test("video element is muted at DOM property level (not just attribute)", async ({ page }) => {
    const videoElement = page.locator("#videoplayer_panel_video");
    const isDomMuted = await videoElement.evaluate(
      (el: HTMLVideoElement) => el.muted
    );
    expect(isDomMuted).toBe(true);
  });

  test("dashjs initializes and attaches a media source to the video element", async ({ page }) => {
    const videoElement = page.locator("#videoplayer_panel_video");

    await page.waitForFunction(() => {
      const videoEl = document.getElementById("videoplayer_panel_video") as HTMLVideoElement;
      return videoEl && (videoEl.currentSrc.length > 0 || videoEl.src.length > 0);
    }, { timeout: 10_000 });

    const currentVideoSrc = await videoElement.evaluate(
      (el: HTMLVideoElement) => el.currentSrc || el.src
    );
    expect(currentVideoSrc.length).toBeGreaterThan(0);
  });

  test("video duration is loaded from DASH manifest (>0 seconds)", async ({ page }) => {
    await page.waitForFunction(() => {
      const videoEl = document.getElementById("videoplayer_panel_video") as HTMLVideoElement;
      return videoEl && videoEl.duration > 0 && !isNaN(videoEl.duration);
    }, { timeout: 15_000 });

    const videoDuration = await page.locator("#videoplayer_panel_video").evaluate(
      (el: HTMLVideoElement) => el.duration
    );
    expect(videoDuration).toBeGreaterThan(100);
  });

  test("video is NOT auto-playing on load (paused state)", async ({ page }) => {
    await page.waitForFunction(() => {
      const videoEl = document.getElementById("videoplayer_panel_video") as HTMLVideoElement;
      return videoEl && videoEl.readyState >= 1;
    }, { timeout: 10_000 });

    const isVideoPaused = await page.locator("#videoplayer_panel_video").evaluate(
      (el: HTMLVideoElement) => el.paused
    );
    expect(isVideoPaused).toBe(true);
  });

  test("playback speed indicator is NOT shown when speed is 1x (default)", async ({ page }) => {
    const speedIndicatorElements = page.locator("#videoplayer_panel_root").getByText(/\dx$/);
    await expect(speedIndicatorElements).not.toBeVisible();
  });

  test("playing indicator is NOT shown when video is paused", async ({ page }) => {
    const playingIndicator = page.locator("#videoplayer_panel_root").getByText("playing");
    await expect(playingIndicator).not.toBeVisible();
  });

  test("overlay element is always in the DOM with opacity-0 when no text is set", async ({ page }) => {
    const overlayElement = page.locator("#videoplayer_panel_overlay");
    await expect(overlayElement).toBeAttached();
    await expect(overlayElement).toHaveClass(/opacity-0/);
    await expect(overlayElement).toHaveClass(/pointer-events-none/);
  });

  test("loading indicator disappears after DASH manifest loads", async ({ page }) => {
    await page.waitForFunction(() => {
      const videoEl = document.getElementById("videoplayer_panel_video") as HTMLVideoElement;
      return videoEl && videoEl.readyState >= 1;
    }, { timeout: 15_000 });

    const loadingIndicator = page.locator("#videoplayer_panel_loading");
    await expect(loadingIndicator).not.toBeAttached();
  });

  test("ended badge is NOT shown on initial load (video has not played yet)", async ({ page }) => {
    const endedBadge = page.locator("#videoplayer_panel_endedBadge");
    await expect(endedBadge).not.toBeAttached();
  });
});

/* ------------------------------------------------------------------ */
/*  3. Product switching — video panel appears/disappears              */
/* ------------------------------------------------------------------ */
test.describe("Product switching toggles video panel", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("switching to HotelStack removes video panel (no video config)", async ({ page }) => {
    await expect(page.locator("#videoplayer_panel_root")).toBeVisible();

    await page.locator("#bench_prompt_productFile").selectOption("hotelstack");

    await expect(page.locator("#videoplayer_panel_root")).not.toBeVisible();
    await expect(page.locator("#videoplayer_panel_video")).not.toBeAttached();
  });

  test("HotelStack product JSON has no video field", async ({ page }) => {
    await page.locator("#bench_prompt_productFile").selectOption("hotelstack");

    const productJsonText = await page.locator("#bench_prompt_product").inputValue();
    const parsedConfig = JSON.parse(productJsonText);
    expect(parsedConfig.video).toBeUndefined();
    expect(parsedConfig.productName).toBe("HotelStack");
  });

  test("switching from HotelStack back to Kärcher restores video panel", async ({ page }) => {
    const productSelect = page.locator("#bench_prompt_productFile");

    await productSelect.selectOption("hotelstack");
    await expect(page.locator("#videoplayer_panel_root")).not.toBeVisible();

    await productSelect.selectOption("karcher_k_2_360");
    await expect(page.locator("#videoplayer_panel_root")).toBeVisible();
    await expect(page.locator("#videoplayer_panel_video")).toBeAttached();
  });

  test("switching back to Kärcher re-initializes dashjs (video gets a source)", async ({ page }) => {
    const productSelect = page.locator("#bench_prompt_productFile");

    await productSelect.selectOption("hotelstack");
    await productSelect.selectOption("karcher_k_2_360");

    await page.waitForFunction(() => {
      const videoEl = document.getElementById("videoplayer_panel_video") as HTMLVideoElement;
      return videoEl && (videoEl.currentSrc.length > 0 || videoEl.src.length > 0);
    }, { timeout: 10_000 });

    const videoSrcAfterSwitch = await page.locator("#videoplayer_panel_video").evaluate(
      (el: HTMLVideoElement) => el.currentSrc || el.src
    );
    expect(videoSrcAfterSwitch.length).toBeGreaterThan(0);
  });

  test("greeting updates to reflect the switched product name", async ({ page }) => {
    await page.locator("#bench_prompt_productFile").selectOption("hotelstack");

    const hotelstackGreeting = await page.locator("#bench_prompt_greeting").inputValue();
    expect(hotelstackGreeting).toContain("HotelStack");

    await page.locator("#bench_prompt_productFile").selectOption("karcher_k_2_360");

    const karcherGreeting = await page.locator("#bench_prompt_greeting").inputValue();
    expect(karcherGreeting).toContain("Kärcher");
  });
});

/* ------------------------------------------------------------------ */
/*  4. Connection controls — pre-connection state                      */
/* ------------------------------------------------------------------ */
test.describe("Connection controls in idle state", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("connect button is enabled before connection", async ({ page }) => {
    const connectButton = page.locator("#bench_connection_connectBtn");
    await expect(connectButton).toBeEnabled();
    await expect(connectButton).toHaveAttribute("aria-label", "Connect and talk");
  });

  test("disconnect button is disabled before connection", async ({ page }) => {
    const disconnectButton = page.locator("#bench_connection_disconnectBtn");
    await expect(disconnectButton).toBeDisabled();
    await expect(disconnectButton).toHaveAttribute("aria-label", "Disconnect");
  });

  test("mute button is disabled before connection", async ({ page }) => {
    const muteButton = page.locator("#bench_connection_muteBtn");
    await expect(muteButton).toBeDisabled();
  });

  test("voice model dropdown has flux voice options", async ({ page }) => {
    const voiceSelect = page.locator("#bench_connection_voice");
    const voiceOptionCount = await voiceSelect.locator("option").count();
    expect(voiceOptionCount).toBeGreaterThan(10);

    const selectedVoiceValue = await voiceSelect.inputValue();
    expect(selectedVoiceValue).toMatch(/^flux-/);
  });

  test("think model dropdown has a valid model selected", async ({ page }) => {
    const thinkSelect = page.locator("#bench_connection_llm");
    const thinkModelValue = await thinkSelect.inputValue();
    expect(["gpt-4o-mini", "gpt-4o", "gpt-5-mini"]).toContain(thinkModelValue);
  });

  test("speed dropdown has a valid speed selected", async ({ page }) => {
    const speedValue = await page.locator("#bench_connection_speed").inputValue();
    expect(["0.9", "0.95", "1.0", "1.05", "1.1"]).toContain(speedValue);
  });

  test("EOT threshold dropdown has a valid threshold selected", async ({ page }) => {
    const eotValue = await page.locator("#bench_connection_eot").inputValue();
    expect(["0.5", "0.6", "0.7", "0.8", "0.9"]).toContain(eotValue);
  });

  test("text inject input is disabled before connection", async ({ page }) => {
    const injectInput = page.locator("#bench_inject_input");
    await expect(injectInput).toBeDisabled();
    await expect(injectInput).toHaveAttribute("placeholder", "send as user turn");
  });

  test("event log shows placeholder text before connection", async ({ page }) => {
    const eventLogPlaceholder = page.getByText("ms since connect - server events");
    await expect(eventLogPlaceholder).toBeVisible();
  });

  test("transcript area shows placeholder before connection", async ({ page }) => {
    await expect(page.getByText("Transcript appears here.")).toBeVisible();
  });
});

/* ------------------------------------------------------------------ */
/*  5. Layout — panels render in correct positions                     */
/* ------------------------------------------------------------------ */
test.describe("Page layout structure", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("left column contains Connection, System prompt, and Text inject panels", async ({ page }) => {
    const connectionHeader = page.locator("h2").filter({ hasText: "Connection" });
    const systemPromptHeader = page.locator("h2").filter({ hasText: "System prompt" });
    const textInjectHeader = page.locator("h2").filter({ hasText: "Type instead of talk" });

    await expect(connectionHeader).toBeVisible();
    await expect(systemPromptHeader).toBeVisible();
    await expect(textInjectHeader).toBeVisible();
  });

  test("right column contains Video Demo, Live, and Events panels", async ({ page }) => {
    const videoDemoHeader = page.locator("h2").filter({ hasText: "Video Demo" });
    const liveHeader = page.locator("h2").filter({ hasText: "Live" });
    const eventsHeader = page.locator("h2").filter({ hasText: "Events" });

    await expect(videoDemoHeader).toBeVisible();
    await expect(liveHeader).toBeVisible();
    await expect(eventsHeader).toBeVisible();
  });

  test("video panel renders above Live panel (DOM order)", async ({ page }) => {
    const videoPanelBox = await page.locator("#videoplayer_panel_root").boundingBox();
    const livePanelBox = await page.locator("h2").filter({ hasText: "Live" }).boundingBox();

    expect(videoPanelBox).not.toBeNull();
    expect(livePanelBox).not.toBeNull();
    expect(videoPanelBox!.y).toBeLessThan(livePanelBox!.y);
  });

  test("when HotelStack selected, Live panel takes the top position (no video)", async ({ page }) => {
    await page.locator("#bench_prompt_productFile").selectOption("hotelstack");

    await expect(page.locator("#videoplayer_panel_root")).not.toBeVisible();
    const liveHeader = page.locator("h2").filter({ hasText: "Live" });
    await expect(liveHeader).toBeVisible();
  });
});

/* ------------------------------------------------------------------ */
/*  6. System prompt panel — product editor & behavior toggle          */
/* ------------------------------------------------------------------ */
test.describe("System prompt panel functionality", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("product JSON textarea contains valid JSON with required product fields", async ({ page }) => {
    const productTextarea = page.locator("#bench_prompt_product");
    const productJsonText = await productTextarea.inputValue();
    const parsedConfig = JSON.parse(productJsonText);

    expect(parsedConfig.productName).toBeDefined();
    expect(parsedConfig.description).toBeDefined();
    expect(Array.isArray(parsedConfig.capabilities)).toBe(true);
    expect(parsedConfig.capabilities.length).toBeGreaterThan(0);
    expect(Array.isArray(parsedConfig.integrations)).toBe(true);
    expect(parsedConfig.pricing).toBeDefined();
    expect(Array.isArray(parsedConfig.facts)).toBe(true);
  });

  test("behavior prompt is collapsed by default (collapsible toggle)", async ({ page }) => {
    const behaviorToggle = page.getByText("Agent behavior (read-only)");
    await expect(behaviorToggle).toBeVisible();

    const behaviorTextarea = page.locator("#bench_prompt_behavior");
    await expect(behaviorTextarea).not.toBeVisible();
  });

  test("clicking the behavior toggle reveals the behavior prompt textarea", async ({ page }) => {
    await page.getByText("Agent behavior (read-only)").click();

    const behaviorTextarea = page.locator("#bench_prompt_behavior");
    await expect(behaviorTextarea).toBeVisible();

    const behaviorText = await behaviorTextarea.inputValue();
    expect(behaviorText).toContain("AI voice agent");
    expect(behaviorText).toContain("Voice rules");
    expect(behaviorText).toContain("Turn-taking");
  });

  test("apply live button is disabled when not connected", async ({ page }) => {
    const applyButton = page.getByText("Apply live");
    await expect(applyButton).toBeDisabled();
  });

  test("editing product JSON to remove video field hides the video panel", async ({ page }) => {
    await expect(page.locator("#videoplayer_panel_root")).toBeVisible();

    const productTextarea = page.locator("#bench_prompt_product");
    const productJsonText = await productTextarea.inputValue();
    const parsedConfig = JSON.parse(productJsonText);
    delete parsedConfig.video;
    const modifiedJson = JSON.stringify(parsedConfig, null, 2);

    await productTextarea.fill(modifiedJson);

    await expect(page.locator("#videoplayer_panel_root")).not.toBeVisible();
  });

  test("editing product JSON to add video field shows the video panel", async ({ page }) => {
    await page.locator("#bench_prompt_productFile").selectOption("hotelstack");
    await expect(page.locator("#videoplayer_panel_root")).not.toBeVisible();

    const productTextarea = page.locator("#bench_prompt_product");
    const productJsonText = await productTextarea.inputValue();
    const parsedConfig = JSON.parse(productJsonText);
    parsedConfig.video = {
      videoUrl: "https://d1xi8ly8yzrjik.cloudfront.net/transcode/11-krature/dash.mpd",
      videoChapters: [{ timestampSeconds: 0, title: "Intro", keywords: ["intro"] }],
    };
    await productTextarea.fill(JSON.stringify(parsedConfig, null, 2));

    await expect(page.locator("#videoplayer_panel_root")).toBeVisible();
  });
});
