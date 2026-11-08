import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bestVoices, rankVoices, LANGUAGES, DEMOS } from '../speech.js';
import { parseText, estimate, validateSession } from '../timing.js';

const voice = (name, lang, extra = {}) => ({ name, lang, voiceURI:name, localService:true, default:false, ...extra });

test('Hungarian natural voices outrank a default standard system voice', () => {
  const voices = [voice('Tünde','hu-HU',{default:true}),voice('Microsoft Noemi Online (Natural) - Hungarian','hu-HU',{localService:false})];
  const best = bestVoices(voices,'hu');
  assert.equal(best.length,1);
  assert.match(best[0].voice.name,/Noemi/);
  assert.equal(best[0].quality,'Natural / neural');
});
test('premium and enhanced variants are detected from names or voice URIs', () => {
  const voices = [voice('Tünde','hu-HU'),voice('Tünde (Enhanced)','hu-HU'),voice('Tünde Premium','hu-HU')];
  assert.equal(bestVoices(voices,'hu')[0].voice.name,'Tünde Premium');
  const uriVoice=voice('Tünde','hu_HU',{voiceURI:'com.apple.voice.enhanced.hu-HU.Tunde'});
  assert.equal(bestVoices([voices[0],uriVoice],'hu')[0].quality,'Enhanced');
});
test('novelty and low-quality engines are excluded and languages never cross-fallback', () => {
  const voices=[voice('Albert (Enhanced)','de-DE'),voice('German eSpeak','de-DE'),voice('Anna','de-DE'),voice('Tünde','hu-HU')];
  assert.deepEqual(rankVoices(voices,'de').map(v=>v.voice.name),['Anna']);
  assert.equal(bestVoices(voices,'es').length,0);
  assert.equal(bestVoices([], 'hu').length,0);
  assert.equal(bestVoices([voice('MBROLA Hungarian','hu-HU')],'hu').length,0);
});
test('only the best quality tier is offered, with Spanish dialect alternatives retained', () => {
  const voices=[voice('Mónica','es-ES'),voice('Spanish Premium','es-ES'),voice('Mexican Premium','es-MX'),voice('Anna Premium','de-DE')];
  const best=bestVoices(voices,'es');
  assert.equal(best.length,2);
  assert.equal(best[0].voice.lang,'es-ES');
  assert.ok(best.every(item=>item.quality==='Premium'));
  const system = bestVoices([voice('Mónica','es-ES'),voice('Paulina','es-MX'),voice('Eddy (Spanish (Spain))','es-ES')],'es');
  assert.deepEqual(system.map(item=>item.voice.name),['Mónica','Paulina']);
});
test('discovery can progress from empty to standard to natural without changing language', () => {
  assert.equal(bestVoices([],'hu').length,0);
  const standard=voice('Tünde','hu-HU');
  assert.equal(bestVoices([standard],'hu')[0].quality,'Standard voice');
  assert.equal(bestVoices([standard,voice('TamasNeural','hu-HU')],'hu')[0].quality,'Natural / neural');
});
test('all three demos have aligned sentence translations and accurate offsets', () => {
  assert.deepEqual(Object.keys(LANGUAGES),['hu','es','de']);
  for (const [code,demo] of Object.entries(DEMOS)) {
    const parsed=parseText(demo.text,code);
    assert.equal(parsed.sentences.length,demo.translations.length,code);
    assert.ok(parsed.words.every(word=>demo.text.slice(word.start,word.start+word.text.length)===word.text));
  }
});
test('session language and voice choice round-trip; legacy sessions remain Hungarian', () => {
  const demo=DEMOS.es;
  const session={version:1,title:demo.title,text:demo.text,timings:estimate(parseText(demo.text,'es').words,20),mode:'tts',language:'es',voiceChoice:'Spanish Premium'};
  assert.equal(validateSession(session).language,'es');
  assert.equal(validateSession(session).voiceChoice,'Spanish Premium');
  assert.equal(validateSession({...session,language:undefined}).language,'hu');
  assert.throws(()=>validateSession({...session,language:'fr'}),/Hungarian, Spanish or German/);
});
