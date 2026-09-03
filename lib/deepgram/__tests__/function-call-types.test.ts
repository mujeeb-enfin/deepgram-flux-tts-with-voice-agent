import { describe, it, expect } from "vitest";
import {
  buildVideoFunctionDefinitions,
  type DeepgramFunctionDefinition,
} from "../function-call-types";

describe("buildVideoFunctionDefinitions", () => {
  let videoFunctionDefinitions: DeepgramFunctionDefinition[];

  it("returns exactly 5 video tool definitions — one per tool in the protocol", () => {
    videoFunctionDefinitions = buildVideoFunctionDefinitions();
    expect(videoFunctionDefinitions).toHaveLength(5);
  });

  it("includes all expected tool names in the correct order", () => {
    videoFunctionDefinitions = buildVideoFunctionDefinitions();
    const toolNames = videoFunctionDefinitions.map((def) => def.name);
    expect(toolNames).toEqual([
      "seek_and_play",
      "pause_video",
      "resume_video",
      "set_playback_speed",
      "show_overlay_text",
    ]);
  });

  it("seek_and_play requires timestamp_seconds as a number", () => {
    videoFunctionDefinitions = buildVideoFunctionDefinitions();
    const seekDefinition = videoFunctionDefinitions.find(
      (def) => def.name === "seek_and_play"
    )!;
    expect(seekDefinition.parameters.type).toBe("object");
    expect(seekDefinition.parameters.properties.timestamp_seconds.type).toBe(
      "number"
    );
    expect(seekDefinition.parameters.required).toContain("timestamp_seconds");
  });

  it("pause_video and resume_video take no required parameters", () => {
    videoFunctionDefinitions = buildVideoFunctionDefinitions();
    const pauseDefinition = videoFunctionDefinitions.find(
      (def) => def.name === "pause_video"
    )!;
    const resumeDefinition = videoFunctionDefinitions.find(
      (def) => def.name === "resume_video"
    )!;
    expect(pauseDefinition.parameters.required).toBeUndefined();
    expect(resumeDefinition.parameters.required).toBeUndefined();
    expect(Object.keys(pauseDefinition.parameters.properties)).toHaveLength(0);
    expect(Object.keys(resumeDefinition.parameters.properties)).toHaveLength(0);
  });

  it("set_playback_speed requires speed with enum constraints", () => {
    videoFunctionDefinitions = buildVideoFunctionDefinitions();
    const speedDefinition = videoFunctionDefinitions.find(
      (def) => def.name === "set_playback_speed"
    )!;
    expect(speedDefinition.parameters.properties.speed.type).toBe("number");
    expect(speedDefinition.parameters.properties.speed.enum).toEqual([
      0.5, 1, 1.5, 2,
    ]);
    expect(speedDefinition.parameters.required).toContain("speed");
  });

  it("show_overlay_text requires text, duration_seconds is optional", () => {
    videoFunctionDefinitions = buildVideoFunctionDefinitions();
    const overlayDefinition = videoFunctionDefinitions.find(
      (def) => def.name === "show_overlay_text"
    )!;
    expect(overlayDefinition.parameters.properties.text.type).toBe("string");
    expect(
      overlayDefinition.parameters.properties.duration_seconds.type
    ).toBe("number");
    expect(overlayDefinition.parameters.required).toEqual(["text"]);
  });

  it("every definition has a non-empty description for the LLM", () => {
    videoFunctionDefinitions = buildVideoFunctionDefinitions();
    for (const definition of videoFunctionDefinitions) {
      expect(definition.description.length).toBeGreaterThan(10);
    }
  });

  it("every definition has parameters.type === 'object' per JSON Schema", () => {
    videoFunctionDefinitions = buildVideoFunctionDefinitions();
    for (const definition of videoFunctionDefinitions) {
      expect(definition.parameters.type).toBe("object");
    }
  });
});
