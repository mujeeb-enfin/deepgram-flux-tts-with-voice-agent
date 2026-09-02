/**
 * AudioWorklet processor for mic capture. Runs on the audio rendering thread,
 * immune to main-thread jank (React re-renders, GC pauses). Batches 128-sample
 * render quanta into ~4096-sample chunks before posting to the main thread.
 *
 * Mute/suppress state is received via MessagePort from the main thread.
 * Resampling happens on the main thread (single source of truth in sample-rate.ts).
 */
class MicWorkletProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._muted = false;
    this._suppressed = false;
    this._buffer = [];
    this._bufferLength = 0;
    this._batchSize = 4096;
    this.port.onmessage = (event) => {
      if (event.data.type === "mute") this._muted = event.data.value;
      if (event.data.type === "suppress") this._suppressed = event.data.value;
    };
  }

  process(inputs) {
    const input = inputs[0]?.[0];
    if (!input || this._muted || this._suppressed) {
      this._buffer = [];
      this._bufferLength = 0;
      return true;
    }

    this._buffer.push(new Float32Array(input));
    this._bufferLength += input.length;

    if (this._bufferLength >= this._batchSize) {
      const merged = new Float32Array(this._bufferLength);
      let offset = 0;
      for (const chunk of this._buffer) {
        merged.set(chunk, offset);
        offset += chunk.length;
      }
      this.port.postMessage({ type: "audio", samples: merged }, [merged.buffer]);
      this._buffer = [];
      this._bufferLength = 0;
    }

    return true;
  }
}

registerProcessor("mic-worklet-processor", MicWorkletProcessor);
