export interface DeepgramFunctionDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<
      string,
      {
        type: string;
        description?: string;
        enum?: unknown[];
      }
    >;
    required?: string[];
  };
}

export interface DeepgramFunctionCallEntry {
  id: string;
  name: string;
  arguments: string;
  client_side: boolean;
}

export interface DeepgramFunctionCallRequestMessage {
  type: "FunctionCallRequest";
  functions: DeepgramFunctionCallEntry[];
}

export interface DeepgramFunctionCallResponseMessage {
  type: "FunctionCallResponse";
  id: string;
  name: string;
  content: string;
}

export type VideoFunctionName =
  | "seek_and_play"
  | "pause_video"
  | "resume_video"
  | "set_playback_speed"
  | "show_overlay_text";

export function buildVideoFunctionDefinitions(): DeepgramFunctionDefinition[] {
  return [
    {
      name: "seek_and_play",
      description:
        "Seek the product demo video to a specific timestamp in seconds and start playing. Use this to show the relevant section of the video while narrating.",
      parameters: {
        type: "object",
        properties: {
          timestamp_seconds: {
            type: "number",
            description: "The timestamp in seconds to seek to (e.g. 30 for 30 seconds into the video)",
          },
        },
        required: ["timestamp_seconds"],
      },
    },
    {
      name: "pause_video",
      description:
        "Pause the product demo video playback. Use when you want the viewer to focus on what you are saying rather than the video.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "resume_video",
      description:
        "Resume playing the product demo video from where it was paused.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "set_playback_speed",
      description:
        "Change the playback speed of the product demo video.",
      parameters: {
        type: "object",
        properties: {
          speed: {
            type: "number",
            description: "Playback speed multiplier",
            enum: [0.5, 1, 1.5, 2],
          },
        },
        required: ["speed"],
      },
    },
    {
      name: "show_overlay_text",
      description:
        "Display a text overlay on the product demo video. Use to highlight key points, feature names, or specs while narrating.",
      parameters: {
        type: "object",
        properties: {
          text: {
            type: "string",
            description: "The text to display on the video overlay",
          },
          duration_seconds: {
            type: "number",
            description: "How long to show the overlay in seconds (default 5)",
          },
        },
        required: ["text"],
      },
    },
  ];
}
