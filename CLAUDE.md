# CLAUDE

All product specific  DEMO files should be placed in the product id or name specific folder.

_Memory file for the Claude agent._

<!-- MR-MULTI-CODER:CODER-REF -->
## Project conventions

Read **@CODER.md** (at the repository root) first. It is the single source
of truth for how to work on this codebase. Treat its rules as binding for every task.

See also: [././CODER.md](././CODER.md)
<!-- /MR-MULTI-CODER:CODER-REF -->

## Hard rules

- **NEVER rename existing variables, constants, functions, or exports** without explicit owner approval. Add new ones alongside if needed — never change existing names.
- **All LLM-facing prompts live in `prompts.ts`** — this is the single source of truth for every system prompt, situation description, steering instruction, and spoken line template the AI uses. Never define prompts inline in other files; import them from `prompts.ts`.
- **No bandaids, no trickery — enterprise-grade only.** Every fix must address the ROOT CAUSE, not paper over symptoms. Circuit breakers that bypass validation, counters that skip consent checks, magic thresholds that ignore failures — these are bandaids. Enterprise-grade means: (1) understand WHY the failure happens, (2) fix the actual broken path, (3) if a safety net is genuinely needed, it must VALIDATE rather than BYPASS (e.g. pass evidence to verify, not skip verification after N failures). A workaround that "works" is still technical debt if it masks the real problem. If the proper fix is too large for the current scope, document the gap explicitly and get approval — never silently ship a shortcut.

## Known recurring bugs

Entries here are bugs that have shipped, regressed, and re-shipped. Read this section BEFORE proposing a fix to anything that sounds adjacent — the mistake pattern that caused them is usually still in the code.

### Audio play/stuck cycle (TTS-tail bleed → barge → latch → self-heal → barge) — owner-reported 2026-08-05

- **Symptom.** Agent audio plays, stops, plays, stops on a ~2s cadence with a real prospect holding the mic silent. Logs look healthy. Prospect perceives a broken mic / broken agent. *Note: not a memory / resource issue — the 1.2s period is the `DROP_AUDIO_SELF_HEAL_MS` backstop, not a GC or buffer-fill cadence.*
- **Root cause.** The agent's TTS tail bleeds through laptop speakers for ~3–5s after `voice:agent_speaking(false)`. The VAD re-fires `barge_in` against that bleed, `dropAudioRef` latches, the 1.2s VAD-tick self-heal re-opens it, the next bleed re-latches — a sustained play/stuck cycle. The previously shipped `BARGE_LATCH_COOLDOWN_MS + SELF_HEAL_QUIET_MS` chain was a *bandaid*: it slowed the cycle but did not close it. Worse, the `lastStuckHealLogAtRef`-throttled `warn` made the cycle silent in OTEL (a 2s cadence only logged once per 5s, appeared to be one-off).
- **Why it repeats.** Anything that throttles a "this is unhealthy" log below the cadence of the unhealthy state is a hole, not a fix. The cycle lives in the gap between `agent_speaking(false)` and the physical end of the TTS tail — no amount of "cooldown" closes a window the cycle was already designed to live inside.
- **Fix A (root cause, in `src/hooks/use-voice-agent.ts`).** Stamp TTS-end moment on `voice:agent_speaking(false)` via `agentTtsEndAtRef = Date.now()`; reject any `voice:barge_in` whose `Date.now() - agentTtsEndAtRef.current <= TTS_ECHO_TAIL_MS` (currently `3500`). Reset `agentTtsEndAtRef = 0` on `voice:agent_speaking(true)` so a fresh turn opens a clean window. **Fix A holds.** This is the actual cycle-closer.
- **Fix B (observability).** Count (latch, self-heal) pairs in a sliding 10s window via `cycleDetectCountRef`/`cycleDetectFirstAtRef`. When the count crosses `CYCLE_DETECT_THRESHOLD` (currently 4) inside `CYCLE_DETECT_WINDOW_MS`, emit `logOtelClientEntry({ level: "error", component: "use_voice_agent", event: "audio_play_stuck_cycle", ... })` and reset. Reset `cycleDetectCountRef` / `cycleDetectFirstAtRef` on every fresh `voice:agent_speaking(true)` so a stale pair from a prior turn cannot trip the signal for an unrelated healthy turn.
- **Regression coverage.** `src/hooks/__tests__/audio-gate-event-driven.test.ts` — `describe("audio stuck/play cycle — TTS-ECHO-CANCELLER (Fix A, 2026-08-05)")` asserts the `agentTtsEndAtRef` + `TTS_ECHO_TAIL_MS` declaration, the stamp on `agent_speaking(false)`, the reset on `agent_speaking(true)`, and the extended 4-condition barge gate.
- **What to check next time something looks like this.**
  1. Grep `lastStuckHealLogAtRef` / `lastStuckHealLogAt` — any "throttle this warn" pattern adjacent to a `dropAudioRef` / `dropAudioSinceRef` block is the cycle fingerprint.
  2. Grep `TTS_ECHO_TAIL_MS` and `agentTtsEndAtRef` — if either is missing, the regression returned. Do NOT restore the old cooldowns as a bandaid; re-open the echo canceller window.
  3. In OTEL, the smoking-gun event is `audio_play_stuck_cycle` at level `error` from `component: "use_voice_agent"` — anything weaker (e.g. a `warn` under that name) means the signal has been re-throttled and the cycle is invisible again.

### Fix B (cycle counter) — v2 SHIPPED 2026-08-10 — the three review gaps are closed

Fix A is the actual cycle-closer and holds. Fix B (the observability counter) had three gaps found in the MANDATORY post-implementation review. **Fix B v2 shipped 2026-08-10 closes all three.** The sliding-window math now lives in the pure module `src/lib/voice/cycle-detector.ts` (`recordCyclePairEvent`), behaviorally tested in `src/lib/voice/__tests__/cycle-detector.test.ts`; the hook's `recordCyclePairEvent` adapter in `use-voice-agent.ts` (near `CYCLE_DETECT_THRESHOLD`) is the single emit site every latch/heal funnels through. The gaps and how each was closed:

1. **Cold-start blind spot — CLOSED.** v1 gated the latch-side increment behind `lastSelfHealAtRef.current > 0`; the very first cycle of a session could emit ZERO signals. v2 counts latches unconditionally (the `voice:barge_in` case and the host-facing `interrupt` both call `recordCyclePairEvent()` with no prior-self-heal precondition).
2. **Same-tick latch+heal reset race — CLOSED.** v1 reset `cycleDetectCountRef` to 0 on each emit, so a same-tick latch+heal re-seeded from zero. v2's total is MONOTONIC — never zeroed on emit. A window restarts by re-anchoring the start count (`cycleDetectWindowStartCountRef`); the counter resets ONLY on `voice:agent_speaking(true)` (and teardown).
3. **`clearAudioDrop()` third gate-clear path — CLOSED.** `clearAudioDrop` (silence-nudge / resume / typed input) now counts as a heal when it actually clears a latched gate (`wasLatched` guard — a no-op clear is not counted).

**What still counts and what deliberately does not (v2):**
- **Fed into the counter:** `voice:barge_in` latch, host `interrupt()` latch, VAD-tick self-heal, real `clearAudioDrop` gate-clear.
- **Deliberately excluded (healthy / real-speech paths, would false-positive):** `voice:tour_step` heal, `audio_gate_gap_heal`, muted/unmute clears, `voice:user_speaking` clear, the local-VAD *confirmed-real-barge* latch, and the `drop_audio_hard_ceiling_force_open` (only fires while the prospect is speaking). The fresh-turn boundary (`voice:agent_speaking(true)`) resets the whole counter, so real barges never accumulate.

**Incident response (post-v2):** `audio_play_stuck_cycle` at `error` remains a smoking gun AND the three blind-spot paths that previously hid a cycle are now closed. But the detector is observability, not a fix — Fix A is the cycle-closer. A cycle that surfaces ONLY as "prospect hears play/stuck" without the event means a path outside the above list (or a Fix A regression), so still pair OTEL with the prospect's perception. The repro is in the **mic indicator + the prospect's ears**, not in OTEL.

**Regression coverage:** behavioral `src/lib/voice/__tests__/cycle-detector.test.ts` (cold-start count, same-tick pair counted as two, path-agnostic clearAudioDrop events, window expiry, monotonic-total invariant) + source assertions in `src/hooks/__tests__/audio-gate-event-driven.test.ts` (Fix B v2 describe).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
