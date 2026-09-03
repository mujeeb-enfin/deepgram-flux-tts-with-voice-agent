import { describe, it, expect, beforeEach } from "vitest";
import fs from "fs";
import path from "path";

function readUseDeepgramAgent(): string {
  return fs.readFileSync(
    path.resolve(process.cwd(), "hooks/useDeepgramAgent.ts"),
    "utf8"
  );
}

describe("useDeepgramAgent function calling support", () => {
  let agentSource: string;

  beforeEach(() => {
    agentSource = readUseDeepgramAgent();
  });

  it("AgentSettings accepts optional functions array", () => {
    expect(agentSource).toContain(
      "functions?: DeepgramFunctionDefinition[]"
    );
  });

  it("DeepgramAgentCallbacks includes optional onFunctionCallRequest", () => {
    expect(agentSource).toContain(
      "onFunctionCallRequest?: (functionCalls: DeepgramFunctionCallEntry[]) => void"
    );
  });

  it("Settings payload injects functions into agent.think when provided", () => {
    expect(agentSource).toContain(
      "settings.functions && settings.functions.length > 0"
    );
    expect(agentSource).toContain("{ functions: settings.functions }");
  });

  it("handles FunctionCallRequest message type from Deepgram", () => {
    expect(agentSource).toContain('case "FunctionCallRequest"');
  });

  it("filters for client_side functions only", () => {
    expect(agentSource).toContain("fc.client_side");
  });

  it("invokes onFunctionCallRequest callback with filtered functions", () => {
    expect(agentSource).toContain(
      "callbacks.onFunctionCallRequest?.(functionCalls)"
    );
  });

  it("logs function call request with tool names", () => {
    expect(agentSource).toContain(
      '<- FunctionCallRequest [${functionCalls.map((fc) => fc.name).join(", ")}]'
    );
  });

  it("sendFunctionCallResponse sends correct message structure", () => {
    expect(agentSource).toContain(
      'type: "FunctionCallResponse"'
    );
    expect(agentSource).toContain("id: functionCallId");
    expect(agentSource).toContain("name: functionName");
    expect(agentSource).toContain("content,");
  });

  it("sendFunctionCallResponse logs the function name", () => {
    expect(agentSource).toContain(
      "-> FunctionCallResponse [${functionName}]"
    );
  });

  it("sendFunctionCallResponse is exported from the hook return", () => {
    expect(agentSource).toContain("sendFunctionCallResponse,");
  });

  it("does not send when websocket is not open", () => {
    expect(agentSource).toContain(
      "if (!ws || ws.readyState !== WebSocket.OPEN) return"
    );
  });
});
