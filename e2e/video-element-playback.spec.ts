import { test, expect } from "@playwright/test";

/**
 * E2E tests that exercise the real <video> element in a browser.
 *
 * Since handleVideoFunctionCall cannot be triggered without a live Deepgram
 * WebSocket (and the "no test-only backdoors" rule forbids exposing it),
 * these tests operate directly on the video DOM element via page.evaluate().
 *
 * They verify that the browser's video APIs work correctly with the DASH
 * stream: play, pause, seek, speed changes, and lifecycle on product switch.
 */

const VIDEO_ELEMENT_SELECTOR = "#videoplayer_panel_video";

async function waitForDashInitialization(page: import("@playwright/test").Page) {
  await page.waitForFunction(
    () => {
      const videoEl = document.getElementById("videoplayer_panel_video") as HTMLVideoElement;
      return videoEl && videoEl.readyState >= 1 && videoEl.duration > 0 && !isNaN(videoEl.duration);
    },
    { timeout: 15_000 }
  );
}

/* ------------------------------------------------------------------ */
/*  1. Video element playback controls via DOM                         */
/* ------------------------------------------------------------------ */
test.describe("Video element playback via DOM API", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForDashInitialization(page);
  });

  test("video can be programmatically played and paused", async ({ page }) => {
    const isPlayingAfterPlay = await page.evaluate(() => {
      const videoEl = document.getElementById("videoplayer_panel_video") as HTMLVideoElement;
      return videoEl.play().then(() => !videoEl.paused);
    });
    expect(isPlayingAfterPlay).toBe(true);

    const isPausedAfterPause = await page.evaluate(() => {
      const videoEl = document.getElementById("videoplayer_panel_video") as HTMLVideoElement;
      videoEl.pause();
      return videoEl.paused;
    });
    expect(isPausedAfterPause).toBe(true);
  });

  test("video currentTime can be set to seek within the DASH stream", async ({ page }) => {
    await page.evaluate(() => {
      const videoEl = document.getElementById("videoplayer_panel_video") as HTMLVideoElement;
      videoEl.currentTime = 30;
    });

    await page.waitForFunction(
      () => {
        const videoEl = document.getElementById("videoplayer_panel_video") as HTMLVideoElement;
        return Math.abs(videoEl.currentTime - 30) < 2;
      },
      { timeout: 10_000 }
    );

    const seekedCurrentTime = await page.locator(VIDEO_ELEMENT_SELECTOR).evaluate(
      (el: HTMLVideoElement) => el.currentTime
    );
    expect(seekedCurrentTime).toBeGreaterThan(28);
    expect(seekedCurrentTime).toBeLessThan(32);
  });

  test("video playbackRate can be changed on the DASH stream", async ({ page }) => {
    const appliedPlaybackRate = await page.evaluate(() => {
      const videoEl = document.getElementById("videoplayer_panel_video") as HTMLVideoElement;
      videoEl.playbackRate = 2;
      return videoEl.playbackRate;
    });
    expect(appliedPlaybackRate).toBe(2);
  });

  test.describe("all allowed playback speeds work with DASH", () => {
    for (const allowedSpeed of [0.5, 1, 1.5, 2]) {
      test(`playbackRate ${allowedSpeed}x is accepted`, async ({ page }) => {
        const appliedRate = await page.evaluate(
          (targetSpeed) => {
            const videoEl = document.getElementById("videoplayer_panel_video") as HTMLVideoElement;
            videoEl.playbackRate = targetSpeed;
            return videoEl.playbackRate;
          },
          allowedSpeed
        );
        expect(appliedRate).toBe(allowedSpeed);
      });
    }
  });

  test("video reports non-zero duration from the DASH manifest", async ({ page }) => {
    const videoDuration = await page.locator(VIDEO_ELEMENT_SELECTOR).evaluate(
      (el: HTMLVideoElement) => el.duration
    );
    expect(videoDuration).toBeGreaterThan(100);
  });
});

/* ------------------------------------------------------------------ */
/*  2. DASH player initialization and teardown                         */
/* ------------------------------------------------------------------ */
test.describe("DASH player lifecycle", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForDashInitialization(page);
  });

  test("switching product destroys and recreates video element with fresh source", async ({ page }) => {
    const originalVideoSrc = await page.locator(VIDEO_ELEMENT_SELECTOR).evaluate(
      (el: HTMLVideoElement) => el.currentSrc
    );
    expect(originalVideoSrc.length).toBeGreaterThan(0);

    await page.locator("#bench_prompt_productFile").selectOption("hotelstack");
    await expect(page.locator(VIDEO_ELEMENT_SELECTOR)).not.toBeAttached();

    await page.locator("#bench_prompt_productFile").selectOption("karcher_k_2_360");
    await waitForDashInitialization(page);

    const restoredVideoSrc = await page.locator(VIDEO_ELEMENT_SELECTOR).evaluate(
      (el: HTMLVideoElement) => el.currentSrc
    );
    expect(restoredVideoSrc.length).toBeGreaterThan(0);
  });

  test("rapid product switching does not leave orphan players", async ({ page }) => {
    const productDropdown = page.locator("#bench_prompt_productFile");
    await productDropdown.selectOption("hotelstack");
    await productDropdown.selectOption("karcher_k_2_360");
    await productDropdown.selectOption("hotelstack");
    await productDropdown.selectOption("karcher_k_2_360");

    await waitForDashInitialization(page);

    const videoElementCount = await page.evaluate(() => {
      return document.querySelectorAll("#videoplayer_panel_video").length;
    });
    expect(videoElementCount).toBe(1);

    const finalVideoSrc = await page.locator(VIDEO_ELEMENT_SELECTOR).evaluate(
      (el: HTMLVideoElement) => el.currentSrc || el.src
    );
    expect(finalVideoSrc.length).toBeGreaterThan(0);
  });

  test("dashjs creates a MediaSource-backed source (blob: URL)", async ({ page }) => {
    const videoSourceUrl = await page.locator(VIDEO_ELEMENT_SELECTOR).evaluate(
      (el: HTMLVideoElement) => el.currentSrc
    );
    expect(videoSourceUrl).toMatch(/^blob:/);
  });
});

/* ------------------------------------------------------------------ */
/*  3. Video element state verification                                */
/* ------------------------------------------------------------------ */
test.describe("Video element state invariants", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForDashInitialization(page);
  });

  test("video starts paused with currentTime near zero", async ({ page }) => {
    const videoInitialState = await page.locator(VIDEO_ELEMENT_SELECTOR).evaluate(
      (el: HTMLVideoElement) => ({
        isPaused: el.paused,
        videoCurrentTime: el.currentTime,
      })
    );
    expect(videoInitialState.isPaused).toBe(true);
    expect(videoInitialState.videoCurrentTime).toBeLessThan(1);
  });

  test("seeking during playback does not pause the video", async ({ page }) => {
    await page.evaluate(async () => {
      const videoEl = document.getElementById("videoplayer_panel_video") as HTMLVideoElement;
      await videoEl.play();
      videoEl.currentTime = 60;
    });

    const isStillPlaying = await page.locator(VIDEO_ELEMENT_SELECTOR).evaluate(
      (el: HTMLVideoElement) => !el.paused
    );
    expect(isStillPlaying).toBe(true);
  });

  test("video.muted remains true through all operations", async ({ page }) => {
    const isMutedAfterAllOperations = await page.evaluate(async () => {
      const videoEl = document.getElementById("videoplayer_panel_video") as HTMLVideoElement;
      await videoEl.play();
      videoEl.currentTime = 30;
      videoEl.playbackRate = 2;
      return videoEl.muted;
    });
    expect(isMutedAfterAllOperations).toBe(true);
  });
});
