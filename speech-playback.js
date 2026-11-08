/** Browser speech lifecycle, independent of the studio DOM and sentence model. */
export function createSpeechPlayback({
  synthesis = globalThis.speechSynthesis,
  Utterance = globalThis.SpeechSynthesisUtterance,
} = {}) {
  let current = null;
  let generation = 0;
  const available = Boolean(synthesis && Utterance);
  function stop() {
    generation++;
    current = null;
    synthesis?.cancel();
  }
  return {
    get available() { return available; },
    get active() { return current !== null; },
    get paused() { return current !== null && Boolean(synthesis?.paused); },
    get kind() { return current?.kind ?? null; },
    stop,
    pause() { if (current) synthesis.pause(); },
    resume() { if (current) synthesis.resume(); },
    play({ text, voice, lang, rate = 1, kind = 'narration',
      onboundary, onstart, onpause, onresume, onend, onerror }) {
      if (!available) throw new Error('Speech synthesis is unavailable. Use an original recording instead.');
      if (!voice) throw new Error('Select an available matching voice first.');
      stop();
      const token = generation;
      const utterance = new Utterance(text);
      utterance.voice = voice;
      utterance.lang = voice.lang || lang;
      utterance.rate = rate;
      current = { utterance, kind };
      for (const [name, callback] of Object.entries({
        boundary: onboundary, start: onstart, pause: onpause, resume: onresume,
        end: onend, error: onerror,
      })) {
        utterance[`on${name}`] = event => {
          if (token !== generation || current?.utterance !== utterance) return;
          if (name === 'end' || name === 'error') current = null;
          callback?.(event);
        };
      }
      // Keep a strong reference until completion; invalidate callbacks before cancel.
      try { synthesis.speak(utterance); }
      catch (error) { stop(); throw error; }
    },
  };
}
