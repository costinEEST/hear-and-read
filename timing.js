/** Text, alignment and persistence validation shared by the UI and Node tests. */
import { DEMOS, languageConfig } from './speech.js';
export const DEMO = DEMOS.hu;

export function parseText(text, language = 'hu') {
  const config = languageConfig(language);
  const sentences = [], words = [];
  const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter(config.locale, { granularity: 'sentence' }) : null;
  for (const paragraph of text.matchAll(/[^\n]+(?:\n(?!\s*\n)[^\n]+)*/gu)) {
    const chunks = segmenter ? [...segmenter.segment(paragraph[0])] :
      [...paragraph[0].matchAll(/[^.!?]+(?:[.!?]+|$)/gu)].map(m => ({ segment:m[0], index:m.index }));
    for (const chunk of chunks) {
      const sentence = { text:chunk.segment.trim(), start:paragraph.index + chunk.index, paragraph:paragraph.index, words:[] };
      for (const match of chunk.segment.matchAll(/\S+/gu)) {
        const word = { text:match[0], start:sentence.start + match.index, sentence:sentences.length, index:words.length };
        words.push(word); sentence.words.push(word);
      }
      if (sentence.words.length) sentences.push(sentence);
    }
  }
  return { words, sentences };
}

export function estimate(words, duration, offset = 0) {
  if (!words.length || !Number.isFinite(duration) || duration <= 0) return [];
  const weights = words.map(word => Math.max(.25, Math.min(1.2, word.text.length * .09)));
  const total = weights.reduce((a,b) => a+b, 0);
  let current = offset;
  return weights.map((weight,index) => {
    const start = current;
    current = index === weights.length - 1 ? offset + duration : current + duration * weight / total;
    return { start, end:current };
  });
}

export function publisherTimings(parsed, segments) {
  const timings = [];
  let offset = 0;
  for (const segment of segments) {
    const words = parsed.words.filter(word => word.start >= offset && word.start < offset + segment.text.length);
    timings.push(...estimate(words, segment.end - segment.start, segment.start));
    offset += segment.text.length + 2;
  }
  return validateTimings(timings, parsed.words);
}

export function activeAt(timings, time) {
  let low = 0, high = timings.length - 1, result = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (timings[mid].start <= time) { result = mid; low = mid + 1; } else high = mid - 1;
  }
  return result >= 0 && time < timings[result].end ? result : -1;
}

export function validateTimings(input, words) {
  if (!Array.isArray(input) || input.length !== words.length || !input.length) throw new Error(`Expected exactly ${words.length} timing entries in text order.`);
  let previousEnd = 0;
  return input.map((entry, index) => {
    if (!entry || !Number.isFinite(entry.start) || !Number.isFinite(entry.end) || entry.start < 0 || entry.end <= entry.start || entry.start < previousEnd - .000001) {
      throw new Error(`Invalid or overlapping timing at word ${index + 1}. Use nonnegative, increasing start/end seconds.`);
    }
    if (entry.word !== undefined && String(entry.word).normalize('NFC') !== words[index].text.normalize('NFC')) throw new Error(`Word ${index + 1} does not match “${words[index].text}”. Entries must follow text order, including repeated words.`);
    previousEnd = entry.end;
    return { start:entry.start, end:entry.end };
  });
}

export function pinTimings(words, duration, anchors) {
  const points = new Map([[0,0], [words.length,duration], ...anchors]);
  const sorted = [...points].sort((a,b) => a[0]-b[0]);
  const result = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const [first,start] = sorted[i], [last,end] = sorted[i+1];
    if (start < 0 || end <= start || last <= first || end > duration) throw new Error('This pin would place words out of order. Choose a time between its neighboring pins.');
    result.push(...estimate(words.slice(first,last),end-start,start));
  }
  return validateTimings(result,words);
}

export function validateSession(data) {
  if (!data || data.version !== 1 || typeof data.text !== 'string' || data.text.length > 100000 || !data.text.trim()) throw new Error('Invalid session: expected version 1 and nonempty text (up to 100,000 characters).');
  const language = data.language ?? 'hu';
  languageConfig(language);
  const parsed = parseText(data.text, language);
  const timings = validateTimings(data.timings,parsed.words);
  if (!['tts','audio'].includes(data.mode)) throw new Error('Invalid audio mode.');
  let audioUrl = '';
  if (data.audioUrl) {
    const url = new URL(data.audioUrl);
    if (url.protocol !== 'https:') throw new Error('Saved audio URLs must use HTTPS.');
    audioUrl = url.href;
  }
  return {
    version:1, title:String(data.title || 'Untitled practice').slice(0,200), text:data.text, language,
    voiceChoice:typeof data.voiceChoice === 'string' ? data.voiceChoice.slice(0,1000) : 'auto',
    timings, timingSource:['estimated','publisher','imported','manual'].includes(data.timingSource) ? data.timingSource : 'imported',
    speed:Number.isFinite(data.speed) ? Math.max(.5,Math.min(1.5,data.speed)) : 1,
    volume:Number.isFinite(data.volume) ? Math.max(0,Math.min(1,data.volume)) : 1,
    pitch:Number.isFinite(data.pitch) ? Math.max(0,Math.min(2,data.pitch)) : 1,
    mode:data.mode, audioUrl, audioName:String(data.audioName || ''),
    source:validateSource(data.source), pronunciationUrl:validatePronunciation(data.pronunciationUrl),
  };
}

export function validateSource(source) {
  if (!source) return null;
  const url = new URL(source.url);
  const hosts = ['www.jw.org','jw.org','hu.wikipedia.org','hu.wiktionary.org'];
  if (url.protocol !== 'https:' || !hosts.includes(url.hostname) || url.username || url.password) throw new Error('Invalid content source URL.');
  const result = {name:String(source.name || url.hostname).slice(0,100),url:url.href,edited:source.edited === true};
  if (source.licenseUrl && source.historyUrl) {
    const license = new URL(source.licenseUrl), history = new URL(source.historyUrl);
    if (license.protocol !== 'https:' || license.hostname !== 'creativecommons.org' || history.protocol !== 'https:' || history.hostname !== url.hostname) throw new Error('Invalid source attribution links.');
    result.licenseName = String(source.licenseName || 'License');
    result.licenseUrl = license.href; result.historyUrl = history.href;
  }
  return result;
}

export function validatePronunciation(url) {
  if (!url) return '';
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'upload.wikimedia.org' || parsed.username || parsed.password) throw new Error('Invalid pronunciation recording URL.');
  return parsed.href;
}

export function formatTime(time) {
  time = Number.isFinite(time) ? Math.max(0,time) : 0;
  return `${Math.floor(time/60)}:${String(Math.floor(time%60)).padStart(2,'0')}`;
}
