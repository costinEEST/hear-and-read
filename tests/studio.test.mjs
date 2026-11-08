import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEMO, parseText, estimate, publisherTimings, activeAt, validateTimings, pinTimings, validateSession } from '../timing.js';

test('Hungarian sentence offsets preserve repeated words, leading spaces and paragraphs', () => {
  const text = '  Jó reggelt! Jó napot.\n\nŐ is itt van.';
  const parsed = parseText(text);
  assert.equal(parsed.sentences.length,3);
  assert.deepEqual(parsed.words.map(word => text.slice(word.start,word.start+word.text.length)),parsed.words.map(word=>word.text));
  assert.notEqual(parsed.words[0].start,parsed.words[2].start);
  assert.equal(parseText(DEMO.text).sentences.length,DEMO.translations.length);
});
test('publisher segments retain their true boundaries and the introduction gap', () => {
  const segments = [{text:'Jó reggelt!',start:3.124,end:9.596},{text:'Jó napot.',start:9.597,end:12.772}];
  const parsed = parseText(segments.map(s=>s.text).join('\n\n'));
  const timings = publisherTimings(parsed,segments);
  assert.equal(timings[0].start,3.124);
  assert.ok(Math.abs(timings[1].end-9.596)<1e-9);
  assert.equal(timings[2].start,9.597);
  assert.equal(activeAt(timings,0),-1);
  assert.equal(activeAt(timings,9.5965),-1);
  assert.equal(activeAt(timings,13),-1);
});
test('imports map repeated words by position and reject partial, mismatched and overlapping input', () => {
  const {words} = parseText('Jó reggelt! Jó napot.');
  const timings = words.map((word,i)=>({word:word.text,start:i,end:i+.9}));
  assert.equal(validateTimings(timings,words)[2].start,2);
  assert.throws(()=>validateTimings(timings.slice(0,2),words),/exactly/);
  assert.throws(()=>validateTimings(timings.map((t,i)=>i===2?{...t,word:'Más'}:t),words),/does not match/);
  assert.throws(()=>validateTimings(timings.map((t,i)=>i===2?{...t,start:1.5}:t),words),/overlapping/);
  assert.throws(()=>validateTimings(timings.map((t,i)=>i===2?{...t,end:NaN}:t),words),/Invalid/);
});
test('sync keeps multiple anchors and rejects a nonmonotonic pin', () => {
  const {words} = parseText('Egy kettő három négy öt.');
  const anchors = new Map([[1,2],[3,7]]);
  const timings = pinTimings(words,10,anchors);
  assert.equal(timings[1].start,2);
  assert.equal(timings[3].start,7);
  assert.equal(timings.at(-1).end,10);
  assert.throws(()=>pinTimings(words,10,new Map([[1,8],[3,7]])),/out of order/);
});
test('session validation rejects unsafe URLs and preserves manually aligned data', () => {
  const words = parseText(DEMO.text).words;
  const session = {version:1,text:DEMO.text,timings:estimate(words,20),mode:'audio',timingSource:'manual',audioUrl:'https://example.org/audio.mp3',speed:.75};
  const restored = validateSession(session);
  assert.deepEqual(restored.timings,session.timings);
  assert.equal(restored.speed,.75);
  assert.equal(restored.timingSource,'manual');
  assert.throws(()=>validateSession({...session,audioUrl:'javascript:alert(1)'}),/HTTPS/);
  assert.throws(()=>validateSession({...session,version:2}),/Invalid session/);
});
test('source credits and pronunciation survive saving; unsafe source links are rejected', () => {
  const session = {version:1,text:DEMO.text,timings:estimate(parseText(DEMO.text).words,20),mode:'tts',source:{name:'Wiktionary',url:'https://hu.wiktionary.org/wiki/alma',licenseName:'CC BY-SA 4.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/',historyUrl:'https://hu.wiktionary.org/w/index.php?title=alma&action=history'},pronunciationUrl:'https://upload.wikimedia.org/example/Hu-alma.ogg.mp3'};
  const restored = validateSession(session);
  assert.equal(restored.source.name,'Wiktionary');
  assert.equal(restored.pronunciationUrl,session.pronunciationUrl);
  assert.throws(()=>validateSession({...session,source:{name:'Bad',url:'javascript:alert(1)'}}));
  assert.throws(()=>validateSession({...session,pronunciationUrl:'https://evil.test/word.mp3'}));
  assert.equal(validateSession({...session,source:undefined,pronunciationUrl:undefined}).source,null);
});

test('session sound settings preserve mute and default legacy sessions to normal pitch', () => {
  const base = { version: 1, text: DEMO.text, mode: 'tts',
    timings: estimate(parseText(DEMO.text).words, 20) };
  const legacy = validateSession(base);
  assert.equal(legacy.volume, 1);
  assert.equal(legacy.pitch, 1);
  const muted = validateSession({ ...base, volume: 0, pitch: 1.25 });
  assert.equal(muted.volume, 0);
  assert.equal(muted.pitch, 1.25);
  const invalid = validateSession({ ...base, volume: Infinity, pitch: NaN });
  assert.equal(invalid.volume, 1);
  assert.equal(invalid.pitch, 1);
  const clamped = validateSession({ ...base, volume: -2, pitch: 9 });
  assert.equal(clamped.volume, 0);
  assert.equal(clamped.pitch, 2);
});
