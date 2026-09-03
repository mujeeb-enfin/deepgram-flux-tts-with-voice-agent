import { describe, it, expect, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import {
  buildVideoPromptSection,
  type ProductVideoConfig,
} from "../FluxAgentBench";

/* ------------------------------------------------------------------ */
/*  buildVideoPromptSection — real function call assertions            */
/* ------------------------------------------------------------------ */
describe("buildVideoPromptSection (prompt generation for LLM)", () => {
  const testVideoConfig: ProductVideoConfig = {
    videoUrl: "https://example.com/demo.mpd",
    videoChapters: [
      { timestampSeconds: 0, title: "Product overview", keywords: ["intro", "overview"] },
      { timestampSeconds: 30, title: "Spray gun assembly", keywords: ["assembly", "gun"] },
      { timestampSeconds: 90, title: "High-pressure wash", keywords: ["wash", "pressure"] },
    ],
  };

  let generatedPromptSection: string;

  beforeEach(() => {
    generatedPromptSection = buildVideoPromptSection(testVideoConfig);
  });

  it("includes every chapter timestamp so the LLM can seek correctly", () => {
    expect(generatedPromptSection).toContain("(0s)");
    expect(generatedPromptSection).toContain("(30s)");
    expect(generatedPromptSection).toContain("(90s)");
    expect(generatedPromptSection).toContain("0:00");
    expect(generatedPromptSection).toContain("0:30");
    expect(generatedPromptSection).toContain("1:30");
  });

  it("includes chapter titles and keywords so the LLM can match topics", () => {
    expect(generatedPromptSection).toContain("Product overview");
    expect(generatedPromptSection).toContain("Spray gun assembly");
    expect(generatedPromptSection).toContain("High-pressure wash");
    expect(generatedPromptSection).toContain("intro, overview");
    expect(generatedPromptSection).toContain("assembly, gun");
    expect(generatedPromptSection).toContain("wash, pressure");
  });

  it("references all 5 video tool names", () => {
    const expectedToolNames = [
      "seek_and_play",
      "pause_video",
      "resume_video",
      "set_playback_speed",
      "show_overlay_text",
    ];
    for (const toolName of expectedToolNames) {
      expect(generatedPromptSection).toContain(toolName);
    }
  });

  it("includes narration behavioral guardrails", () => {
    expect(generatedPromptSection).toContain(
      "Do not describe what is visually happening"
    );
    expect(generatedPromptSection).toContain(
      "Never mention the tools by name"
    );
  });

  it("includes barge-in auto-pause rule so LLM knows to resume after interruptions", () => {
    expect(generatedPromptSection).toContain(
      "the video automatically pauses"
    );
    expect(generatedPromptSection).toContain("resume_video");
  });

  it("starts with Video Demo Tools header", () => {
    expect(generatedPromptSection).toMatch(/^## Video Demo Tools/);
  });
});

/* ------------------------------------------------------------------ */
/*  Product config schema — real JSON parsing (already real tests)     */
/* ------------------------------------------------------------------ */
function readProductConfig(productFile: string): string {
  return fs.readFileSync(
    path.resolve(process.cwd(), `products/${productFile}.json`),
    "utf8"
  );
}

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
    const chapters = videoConfig.videoChapters as Array<
      Record<string, unknown>
    >;
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
    const chapters = videoConfig.videoChapters as Array<
      Record<string, unknown>
    >;
    for (
      let chapterIndex = 1;
      chapterIndex < chapters.length;
      chapterIndex++
    ) {
      expect(
        chapters[chapterIndex].timestampSeconds as number
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
