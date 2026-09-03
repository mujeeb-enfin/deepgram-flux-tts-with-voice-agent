import { describe, it, expect, beforeEach } from "vitest";
import fs from "fs";
import path from "path";

function readFluxAgentBench(): string {
  return fs.readFileSync(
    path.resolve(process.cwd(), "components/FluxAgentBench.tsx"),
    "utf8"
  );
}

function readProductConfig(productFile: string): string {
  return fs.readFileSync(
    path.resolve(process.cwd(), `products/${productFile}.json`),
    "utf8"
  );
}

describe("video product demo integration (FluxAgentBench wiring)", () => {
  let benchSource: string;

  beforeEach(() => {
    benchSource = readFluxAgentBench();
  });

  it("imports VideoPlayerPanel and useVideoPlayer for video rendering", () => {
    expect(benchSource).toContain(
      'import { VideoPlayerPanel } from "@/components/VideoPlayerPanel"'
    );
    expect(benchSource).toContain(
      'import { useVideoPlayer } from "@/hooks/useVideoPlayer"'
    );
  });

  it("imports buildVideoFunctionDefinitions for Deepgram Settings payload", () => {
    expect(benchSource).toContain(
      'import { buildVideoFunctionDefinitions } from "@/lib/deepgram/function-call-types"'
    );
  });

  it("derives activeProductVideoConfig from productConfigJson", () => {
    expect(benchSource).toContain("activeProductVideoConfig");
    expect(benchSource).toContain("parsed.video ?? null");
  });

  it("conditionally renders VideoPlayerPanel only when video config exists", () => {
    expect(benchSource).toContain("{activeProductVideoConfig && (");
    expect(benchSource).toContain("<VideoPlayerPanel");
    expect(benchSource).toContain(
      "videoUrl={activeProductVideoConfig.videoUrl}"
    );
  });

  it("passes video function definitions to connect() only when product has video", () => {
    expect(benchSource).toContain(
      "const videoFunctions = activeProductVideoConfig"
    );
    expect(benchSource).toContain("buildVideoFunctionDefinitions()");
    expect(benchSource).toContain("functions: videoFunctions");
  });

  it("onFunctionCallRequest dispatches through handleVideoFunctionCallRef", () => {
    expect(benchSource).toContain(
      "handleVideoFunctionCallRef.current("
    );
    expect(benchSource).toContain("functionCall.name");
    expect(benchSource).toContain("functionCall.arguments");
  });

  it("onFunctionCallRequest sends response via sendFunctionCallResponseRef", () => {
    expect(benchSource).toContain(
      "sendFunctionCallResponseRef.current("
    );
    expect(benchSource).toContain("functionCall.id");
  });

  it("onDisconnected resets the video player", () => {
    expect(benchSource).toContain("resetVideoPlayerRef.current()");
  });

  it("buildCombinedPrompt includes video prompt section when chapters exist", () => {
    expect(benchSource).toContain("buildVideoPromptSection(parsed.video)");
    expect(benchSource).toContain(
      "parsed.video && parsed.video.videoChapters.length > 0"
    );
  });

  it("buildVideoPromptSection generates chapter guide with timestamps", () => {
    expect(benchSource).toContain("Video chapter guide");
    expect(benchSource).toContain("chapter.timestampSeconds");
    expect(benchSource).toContain("chapter.title");
    expect(benchSource).toContain("chapter.keywords.join");
  });

  it("buildVideoPromptSection includes narration rules for the agent", () => {
    expect(benchSource).toContain("Video narration rules");
    expect(benchSource).toContain("Do not describe what is visually happening");
    expect(benchSource).toContain(
      'Never mention the tools by name'
    );
  });

  it("refs are wired for stable function-call dispatch across renders", () => {
    expect(benchSource).toContain("sendFunctionCallResponseRef");
    expect(benchSource).toContain("handleVideoFunctionCallRef");
    expect(benchSource).toContain("resetVideoPlayerRef");

    expect(benchSource).toContain(
      "sendFunctionCallResponseRef.current = sendFunctionCallResponse"
    );
    expect(benchSource).toContain(
      "handleVideoFunctionCallRef.current = handleVideoFunctionCall"
    );
    expect(benchSource).toContain(
      "resetVideoPlayerRef.current = resetVideoPlayer"
    );
  });
});

describe("video product config (karcher_k_2_360.json)", () => {
  let karcherConfig: Record<string, unknown>;

  beforeEach(() => {
    karcherConfig = JSON.parse(readProductConfig("karcher_k_2_360"));
  });

  it("has a video property with videoUrl and videoChapters", () => {
    expect(karcherConfig.video).toBeDefined();
    const videoConfig = karcherConfig.video as Record<string, unknown>;
    expect(videoConfig.videoUrl).toBeDefined();
    expect(typeof videoConfig.videoUrl).toBe("string");
    expect(Array.isArray(videoConfig.videoChapters)).toBe(true);
  });

  it("videoUrl points to a DASH manifest (.mpd)", () => {
    const videoConfig = karcherConfig.video as Record<string, unknown>;
    expect(videoConfig.videoUrl).toMatch(/\.mpd$/);
  });

  it("has at least 1 video chapter", () => {
    const videoConfig = karcherConfig.video as Record<string, unknown>;
    const chapters = videoConfig.videoChapters as unknown[];
    expect(chapters.length).toBeGreaterThanOrEqual(1);
  });

  it("every chapter has timestampSeconds, title, and keywords array", () => {
    const videoConfig = karcherConfig.video as Record<string, unknown>;
    const chapters = videoConfig.videoChapters as Array<Record<string, unknown>>;
    for (const chapter of chapters) {
      expect(typeof chapter.timestampSeconds).toBe("number");
      expect(chapter.timestampSeconds).toBeGreaterThanOrEqual(0);
      expect(typeof chapter.title).toBe("string");
      expect((chapter.title as string).length).toBeGreaterThan(0);
      expect(Array.isArray(chapter.keywords)).toBe(true);
      expect((chapter.keywords as string[]).length).toBeGreaterThan(0);
    }
  });

  it("chapters are ordered by ascending timestampSeconds", () => {
    const videoConfig = karcherConfig.video as Record<string, unknown>;
    const chapters = videoConfig.videoChapters as Array<Record<string, unknown>>;
    for (let chapterIndex = 1; chapterIndex < chapters.length; chapterIndex++) {
      expect(
        (chapters[chapterIndex].timestampSeconds as number)
      ).toBeGreaterThanOrEqual(
        chapters[chapterIndex - 1].timestampSeconds as number
      );
    }
  });
});

describe("hotelstack.json has no video config (negative test)", () => {
  it("does not have a video property", () => {
    const hotelstackConfig = JSON.parse(readProductConfig("hotelstack"));
    expect(hotelstackConfig.video).toBeUndefined();
  });
});
