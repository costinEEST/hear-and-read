import test from 'node:test';
import assert from 'node:assert/strict';
import { createSpeechPlayback } from '../speech-playback.js';

function fixture() {
  const spoken = [];
  const synthesis = {
    paused: false,
    cancel() { spoken.at(-1)?.onerror?.({ error: 'canceled' }); this.paused = false; },
    speak(utterance) { spoken.push(utterance); },
    pause() { this.paused = true; spoken.at(-1)?.onpause({}); },
    resume() { this.paused = false; spoken.at(-1)?.onresume({}); },
  };
  class Utterance { constructor(text) { this.text = text; } }
  return { controller: createSpeechPlayback({ synthesis, Utterance }), synthesis, spoken };
}
const voice = { lang: 'es-MX' };

test('narration configures locale/rate and forwards lifecycle events until completion', () => {
  const { controller, spoken } = fixture();
  const events = [];
  controller.play({ text: 'Hola.', voice, lang: 'es-ES', rate: .75,
    onstart: () => events.push('start'), onboundary: e => events.push(e.charIndex),
    onend: () => events.push('end') });
  assert.equal(controller.active, true);
  assert.equal(controller.kind, 'narration');
  assert.equal(spoken[0].lang, 'es-MX');
  assert.equal(spoken[0].rate, .75);
  spoken[0].onstart({}); spoken[0].onboundary({ name: 'word', charIndex: 2 }); spoken[0].onend({});
  spoken[0].onboundary({ charIndex: 4 });
  assert.deepEqual(events, ['start', 2, 'end']);
  assert.equal(controller.active, false);
});

test('stop and replacement suppress synchronous cancellation and delayed callbacks', () => {
  const { controller, spoken } = fixture();
  let stale = 0;
  controller.play({ text: 'Old', voice, onerror: () => stale++, onend: () => stale++ });
  const old = spoken[0];
  controller.play({ text: 'Preview', voice, kind: 'preview' });
  old.onend({}); old.onerror({});
  assert.equal(stale, 0);
  assert.equal(controller.kind, 'preview');
  controller.stop();
  assert.equal(controller.active, false);
});

test('pause/resume preserve the utterance and terminal errors release it', () => {
  const { controller, spoken } = fixture();
  let error;
  controller.play({ text: 'Hallo', voice, onerror: e => { error = e.error; } });
  spoken[0].onstart({});
  controller.pause(); assert.equal(controller.paused, true);
  controller.resume(); assert.equal(controller.paused, false);
  assert.equal(spoken.length, 1);
  spoken[0].onerror({ error: 'network' });
  assert.equal(error, 'network'); assert.equal(controller.active, false);
});

test('completion may start the next sentence without clearing the new utterance', () => {
  const { controller, spoken } = fixture();
  controller.play({ text: 'One', voice, onend: () => controller.play({ text: 'Two', voice }) });
  spoken[0].onend({});
  assert.equal(controller.active, true); assert.equal(spoken[1].text, 'Two');
});

test('missing APIs and synchronous engine failures leave no retained utterance', () => {
  const unavailable = createSpeechPlayback({ synthesis: null, Utterance: null });
  assert.equal(unavailable.available, false);
  assert.throws(() => unavailable.play({ text: 'Hi', voice }), /unavailable/);
  unavailable.stop();
  const { controller, synthesis } = fixture();
  synthesis.speak = () => { throw new Error('engine failed'); };
  assert.throws(() => controller.play({ text: 'Hi', voice }), /engine failed/);
  assert.equal(controller.active, false);
});


test('word support requires a valid named word event and reports once per playback', () => {
  const { controller, spoken } = fixture();
  const statuses = [], boundaries = [];
  controller.play({ text: 'Hola mundo', voice,
    onwordstatus: s => statuses.push(s), onboundary: e => boundaries.push(e.charIndex) });
  for (const event of [{ name: 'sentence', charIndex: 0 }, { charIndex: 0 },
    { name: 'word', charIndex: -1 }, { name: 'word', charIndex: 99 },
    { name: 'word', charIndex: NaN }]) spoken[0].onboundary(event);
  assert.deepEqual(statuses, ['checking']);
  assert.deepEqual(boundaries, []);
  spoken[0].onboundary({ name: 'word', charIndex: 0 });
  spoken[0].onboundary({ name: 'word', charIndex: 5 });
  spoken[0].onend({});
  assert.deepEqual(statuses, ['checking', 'word']);
  assert.deepEqual(boundaries, [0, 5]);
});

test('missing events are reported only after completion, never from cancellation or errors', () => {
  const { controller, spoken } = fixture();
  const statuses = [];
  const play = () => controller.play({ text: 'Hallo.', voice, onwordstatus: s => statuses.push(s) });
  play(); controller.pause(); controller.resume();
  assert.deepEqual(statuses, ['checking']);
  controller.stop(); spoken[0].onend({});
  assert.deepEqual(statuses, ['checking']);
  play(); spoken[1].onerror({ error: 'network' });
  assert.deepEqual(statuses, ['checking', 'checking']);
  play(); spoken[2].onboundary({ name: 'sentence', charIndex: 0 }); spoken[2].onend({});
  assert.deepEqual(statuses, ['checking', 'checking', 'checking', 'sentence']);
});


test('lifecycle state waits for start, pause and resume acknowledgements', () => {
  const events = [], spoken = [];
  const synthesis = { cancel() {}, speak(u) { spoken.push(u); }, pause() {}, resume() {} };
  class Utterance { constructor(text) { this.text = text; } }
  const controller = createSpeechPlayback({ synthesis, Utterance, onstatechange: e => events.push(e) });
  controller.play({ text: 'Hola', voice });
  assert.equal(controller.status, 'starting');
  spoken[0].onstart({}); assert.equal(controller.status, 'speaking');
  controller.pause(); assert.equal(controller.status, 'pausing');
  controller.pause(); assert.equal(controller.status, 'pausing');
  spoken[0].onpause({}); assert.equal(controller.status, 'paused');
  controller.resume(); assert.equal(controller.status, 'resuming');
  spoken[0].onresume({}); assert.equal(controller.status, 'speaking');
  spoken[0].onend({}); assert.equal(controller.status, 'idle');
  assert.deepEqual(events.map(e => e.status), ['idle', 'starting', 'speaking', 'pausing', 'paused', 'resuming', 'speaking', 'idle']);
  controller.play({ text: 'Sample', voice, kind: 'preview' });
  controller.stop(); spoken[1].onstart({});
  assert.equal(controller.status, 'idle');
});

// Deliver every callback an interrupted engine might still enqueue. None may
// mutate the replacement, report missing boundaries, or advance its sentence.
function lateEvents(utterance) {
  utterance.onstart({});
  utterance.onpause({});
  utterance.onresume({});
  utterance.onboundary({ name: 'word', charIndex: 0 });
  utterance.onerror({ error: 'interrupted' });
  utterance.onend({});
}

test('rapid voice changes retain only the latest voice, locale and callbacks', () => {
  const { controller, spoken } = fixture();
  const completed = [], words = [];
  const voices = [
    { voiceURI: 'hungarian', lang: 'hu-HU' },
    { voiceURI: 'spanish', lang: 'es-MX' },
    { voiceURI: 'german', lang: 'de-DE' },
  ];
  for (const selected of voices) {
    controller.play({ text: 'Sample', voice: selected,
      onend: () => completed.push(selected.voiceURI),
      onwordstatus: status => { if (status !== 'checking') words.push(selected.voiceURI); } });
  }
  lateEvents(spoken[0]); lateEvents(spoken[1]);
  assert.equal(controller.status, 'starting');
  assert.deepEqual(completed, []);
  assert.deepEqual(words, []);
  assert.equal(spoken[2].voice, voices[2]);
  assert.equal(spoken[2].lang, 'de-DE');
  spoken[2].onstart({});
  spoken[2].onboundary({ name: 'word', charIndex: 0 });
  spoken[2].onend({});
  assert.deepEqual(completed, ['german']);
  assert.deepEqual(words, ['german']);
  assert.equal(controller.status, 'idle');
});

test('narration interrupts a playing preview without running preview completion', () => {
  const { controller, spoken } = fixture();
  let previewCallbacks = 0, narrationCompletions = 0;
  controller.play({ text: 'Preview', voice, kind: 'preview',
    onend: () => previewCallbacks++, onerror: () => previewCallbacks++ });
  spoken[0].onstart({});
  controller.play({ text: 'Narration', voice,
    onend: () => narrationCompletions++ });
  spoken[1].onstart({});
  lateEvents(spoken[0]);
  assert.equal(controller.kind, 'narration');
  assert.equal(controller.status, 'speaking');
  assert.equal(previewCallbacks, 0);
  spoken[1].onend({});
  assert.equal(narrationCompletions, 1);
});

test('preview interrupts paused narration without advancing to the next sentence', () => {
  const { controller, spoken } = fixture();
  let nextSentences = 0;
  controller.play({ text: 'Sentence', voice, onend: () => nextSentences++ });
  spoken[0].onstart({}); controller.pause();
  assert.equal(controller.paused, true);
  controller.play({ text: 'Preview', voice, kind: 'preview' });
  spoken[1].onstart({});
  lateEvents(spoken[0]);
  assert.equal(controller.kind, 'preview');
  assert.equal(controller.status, 'speaking');
  assert.equal(nextSentences, 0);
  controller.stop(); lateEvents(spoken[1]);
  assert.equal(controller.active, false);
  assert.equal(controller.status, 'idle');
});

test('repeated pause/resume cycles keep one utterance and stop cancels late events', () => {
  const { controller, spoken } = fixture();
  let completion = 0;
  controller.play({ text: 'Long sentence', voice, onend: () => completion++ });
  spoken[0].onstart({});
  for (let cycle = 0; cycle < 3; cycle++) {
    controller.pause();
    assert.equal(controller.status, 'paused');
    controller.resume();
    assert.equal(controller.status, 'speaking');
  }
  assert.equal(spoken.length, 1);
  controller.pause(); controller.stop();
  controller.pause(); controller.resume();
  lateEvents(spoken[0]);
  assert.equal(controller.status, 'idle');
  assert.equal(controller.active, false);
  assert.equal(completion, 0);
});

test('word support is re-observed for each utterance and never inherited from a preview', () => {
  const { controller, spoken } = fixture();
  const preview = [], narration = [];
  controller.play({ text: 'Sample', voice, kind: 'preview',
    onwordstatus: status => preview.push(status) });
  spoken[0].onstart({});
  spoken[0].onboundary({ name: 'word', charIndex: 0 });
  spoken[0].onend({});
  controller.play({ text: 'Sentence', voice, onwordstatus: status => narration.push(status) });
  spoken[1].onstart({});
  spoken[1].onboundary({ name: 'sentence', charIndex: 0 });
  assert.deepEqual(narration, ['checking']);
  spoken[1].onend({});
  assert.deepEqual(preview, ['checking', 'word']);
  assert.deepEqual(narration, ['checking', 'sentence']);
  assert.equal(controller.status, 'idle');
});


test('standalone pronunciation completes once without queuing narration', () => {
  const { controller, spoken } = fixture();
  controller.play({ text: 'Guten Morgen', voice, kind: 'pronunciation', rate: .75 });
  spoken[0].onstart({});
  assert.equal(controller.kind, 'pronunciation');
  assert.equal(spoken[0].text, 'Guten Morgen');
  assert.equal(spoken[0].rate, .75);
  spoken[0].onend({});
  lateEvents(spoken[0]);
  assert.equal(spoken.length, 1);
  assert.equal(controller.active, false);
  assert.equal(controller.status, 'idle');
});

test('volume and pitch default safely, preserve mute and clamp API ranges', () => {
  const { controller, spoken } = fixture();
  for (const kind of ['narration', 'preview', 'pronunciation']) {
    controller.play({ text: 'Hallo', voice, kind, volume: 0, pitch: 1.25 });
    assert.equal(spoken.at(-1).volume, 0);
    assert.equal(spoken.at(-1).pitch, 1.25);
  }
  controller.play({ text: 'Hallo', voice });
  assert.equal(spoken.at(-1).volume, 1);
  assert.equal(spoken.at(-1).pitch, 1);
  controller.play({ text: 'Hallo', voice, volume: 3, pitch: -1 });
  assert.equal(spoken.at(-1).volume, 1);
  assert.equal(spoken.at(-1).pitch, 0);
  controller.play({ text: 'Hallo', voice, volume: NaN, pitch: Infinity });
  assert.equal(spoken.at(-1).volume, 1);
  assert.equal(spoken.at(-1).pitch, 1);
});
