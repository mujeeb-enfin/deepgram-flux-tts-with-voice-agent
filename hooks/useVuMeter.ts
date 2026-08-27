"use client";

import { useRef, useCallback, useState } from "react";

function readAnalyserLevel(analyserNode: AnalyserNode | null): number {
  if (!analyserNode) return 0;
  const timeDomainData = new Uint8Array(analyserNode.frequencyBinCount);
  analyserNode.getByteTimeDomainData(timeDomainData);
  let sumOfSquares = 0;
  for (let i = 0; i < timeDomainData.length; i++) {
    const normalized = (timeDomainData[i] - 128) / 128;
    sumOfSquares += normalized * normalized;
  }
  return Math.min(1, Math.sqrt(sumOfSquares / timeDomainData.length) * 4);
}

export function useVuMeter() {
  const animationFrameRef = useRef<number | null>(null);
  const [userLevel, setUserLevel] = useState(0);
  const [agentLevel, setAgentLevel] = useState(0);

  const startMetering = useCallback(
    (
      micAnalyser: React.RefObject<AnalyserNode | null>,
      playbackAnalyser: React.RefObject<AnalyserNode | null>,
      isMicMuted: () => boolean
    ) => {
      const tick = () => {
        const micLevel = isMicMuted() ? 0 : readAnalyserLevel(micAnalyser.current);
        const agentLevelVal = readAnalyserLevel(playbackAnalyser.current);
        setUserLevel(micLevel);
        setAgentLevel(agentLevelVal);
        animationFrameRef.current = requestAnimationFrame(tick);
      };
      animationFrameRef.current = requestAnimationFrame(tick);
    },
    []
  );

  const stopMetering = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setUserLevel(0);
    setAgentLevel(0);
  }, []);

  return { userLevel, agentLevel, startMetering, stopMetering };
}
