/** Browser speech lifecycle, independent of the studio DOM and sentence model. */
export function createSpeechPlayback({
  synthesis = globalThis.speechSynthesis,
  Utterance = globalThis.SpeechSynthesisUtterance,
  onstatechange = () => {},
} = {}) {
  let current = null;
  let generation = 0;
  const available = Boolean(synthesis && Utterance);
  let status = 'idle';
  function transition(next, kind = current?.kind ?? null) {
    status = next;
    onstatechange({ status, kind });
  }
  function stop() {
    generation++;
    current = null;
    synthesis?.cancel();
    transition('idle');
  }
  return {
    get available() { return available; },
    get active() { return current !== null; },
    get paused() { return current !== null && status === 'paused'; },
    get status() { return status; },
    get kind() { return current?.kind ?? null; },
    stop,
    pause() { if (current && status === 'speaking') { transition('pausing'); synthesis.pause(); } },
    resume() { if (current && status === 'paused') { transition('resuming'); synthesis.resume(); } },
    play({ text, voice, lang, rate = 1, kind = 'narration',
      onboundary, onstart, onpause, onresume, onend, onerror, onwordstatus }) {
      if (!available) throw new Error('Speech synthesis is unavailable. Use an original recording instead.');
      if (!voice) throw new Error('Select an available matching voice first.');
      stop();
      const token = generation;
      const utterance = new Utterance(text);
      utterance.voice = voice;
      utterance.lang = voice.lang || lang;
      utterance.rate = rate;
      current = { utterance, kind };
      transition('starting');
      let wordObserved = false;
      onwordstatus?.('checking');
      for (const [name, callback] of Object.entries({
        boundary: onboundary, start: onstart, pause: onpause, resume: onresume,
        end: onend, error: onerror,
      })) {
        utterance[`on${name}`] = event => {
          if (token !== generation || current?.utterance !== utterance) return;
          if (name === 'start' || name === 'resume') transition('speaking');
          if (name === 'pause') transition('paused');
          if (name === 'boundary') {
            // A sentence event (even at index zero) is not evidence of word support.
            const validWord = event.name === 'word' && Number.isInteger(event.charIndex)
              && event.charIndex >= 0 && event.charIndex < text.length;
            if (!validWord) return;
            if (!wordObserved) { wordObserved = true; onwordstatus?.('word'); }
          }
          if (name === 'end' && !wordObserved) onwordstatus?.('sentence');
          if (name === 'end' || name === 'error') {
            const kind = current.kind;
            current = null;
            transition(name === 'error' ? 'error' : 'idle', kind);
          }
          callback?.(event);
        };
      }
      // Keep a strong reference until completion; invalidate callbacks before cancel.
      try { synthesis.speak(utterance); }
      catch (error) { stop(); throw error; }
    },
  };
}
