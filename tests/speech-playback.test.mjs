import test from 'node:test';
import assert from 'node:assert/strict';
import { createSpeechPlayback } from '../speech-playback.js';

function fixture() {
  const spoken = [];
  const synthesis = {
    paused: false,
    cancel() { spoken.at(-1)?.onerror?.({ error: 'canceled' }); this.paused = false; },
    speak(utterance) { spoken.push(utterance); },
    pause() { this.paused = true; },
    resume() { this.paused = false; },
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
  spoken[0].onstart({}); spoken[0].onboundary({ charIndex: 2 }); spoken[0].onend({});
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
