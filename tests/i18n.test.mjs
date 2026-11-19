import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { LANGUAGES, sourceExample } from "../languages.js";
import { DEMO_LINES } from "../demos.js";
import { parseText, validateSession, estimate } from "../timing.js";

const read = async (code) =>
  JSON.parse(
    await readFile(new URL(`../locales/${code}.json`, import.meta.url), "utf8"),
  );
const slots = (value) =>
  [...String(value).matchAll(/\{(p\d+|count)\}/gu)]
    .map((match) => match[1])
    .sort();

test("all twelve dictionaries cover English messages and preserve substitution slots", async () => {
  const english = await read("en");
  for (const code of Object.keys(LANGUAGES)) {
    const messages = await read(code);
    assert.deepEqual(
      Object.keys(messages).sort(),
      Object.keys(english).sort(),
      code,
    );
    for (const [key, value] of Object.entries(english)) {
      const translated = messages[key];
      if (typeof value === "string") {
        assert.equal(typeof translated, "string", `${code}: ${key}`);
        assert.ok(translated.trim());
        assert.deepEqual(slots(translated), slots(value), `${code}: ${key}`);
      } else
        for (const form of Object.values(translated))
          assert.deepEqual(slots(form), ["count"]);
    }
  }
});
test("every practice language has aligned authored glosses, safe examples and session support", () => {
  for (const [code, config] of Object.entries(LANGUAGES)) {
    const text = DEMO_LINES[code].join("\n\n"),
      parsed = parseText(text, code);
    assert.equal(parsed.sentences.length, 5, code);
    assert.equal(
      new URL(sourceExample("wikipedia", code)).hostname,
      `${code}.wikipedia.org`,
    );
    assert.equal(
      new URL(sourceExample("wiktionary", code)).hostname,
      `${code}.wiktionary.org`,
    );
    assert.ok(new URL(sourceExample("jw", code)).pathname.length > 20);
    const session = validateSession({
      version: 1,
      text,
      language: code,
      mode: "tts",
      timings: estimate(parsed.words, 20),
    });
    assert.equal(session.language, code);
    assert.ok(config.nativeName);
  }
});

let instance = 0;
async function environment(initial = "en") {
  const nodes = new Map();
  const picker = {
    value: "en",
    isConnected: true,
    replaceChildren() {},
    addEventListener() {},
    setCustomValidity(value) {
      this.validationMessage = value;
    },
    reportValidity() {},
  };
  nodes.set("page-language", picker);
  globalThis.NodeFilter = { SHOW_TEXT: 4 };
  globalThis.Node = { TEXT_NODE: 3 };
  globalThis.document = {
    body: {},
    documentElement: {},
    createTreeWalker: () => ({ nextNode: () => false }),
    querySelectorAll: () => [],
    getElementById: (id) => nodes.get(id),
    createElement: () => ({}),
  };
  const events = {};
  globalThis.location = {
    href: `https://studio.test/?lang=${initial}&keep=yes#reader`,
  };
  globalThis.window = {
    addEventListener: (name, cb) => (events[name] = cb),
    history: {
      pushState(_, __, url) {
        location.href = String(url);
      },
    },
  };
  const storage = new Map();
  globalThis.localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  };
  const fetches = [];
  globalThis.fetch = async (path) => {
    fetches.push(path);
    const code = path.match(/(\w+)\.json$/u)[1];
    return { ok: true, json: () => read(code) };
  };
  const i18n = await import(`../i18n.js?test=${++instance}`);
  await i18n.initI18n();
  return { i18n, picker, events, storage, fetches };
}
test("English defaults, URL override, plural forms and dynamic bindings preserve state", async () => {
  const { i18n } = await environment();
  assert.equal(i18n.currentLocale(), "en");
  assert.equal(i18n.resolveLocale("sr-Latn"), "sr");
  assert.equal(i18n.resolveLocale("xx"), "en");
  const label = { isConnected: true, textContent: "" };
  i18n.uiText(label, "Play");
  await i18n.changeLocale("ro");
  assert.equal(label.textContent, "Redă");
  assert.equal(i18n.countLabel(1, "words"), "1 cuvânt");
  assert.equal(i18n.countLabel(2, "words"), "2 cuvinte");
  assert.equal(i18n.countLabel(41, "words"), "41 de cuvinte");
  assert.equal(new URL(location.href).searchParams.get("keep"), "yes");
  assert.equal(new URL(location.href).hash, "#reader");
  await i18n.changeLocale("uk");
  assert.equal(i18n.countLabel(1, "words"), "1 слово");
  assert.equal(i18n.countLabel(2, "words"), "2 слова");
  assert.equal(i18n.countLabel(5, "words"), "5 слів");
  assert.equal(
    i18n.t("Expected exactly 12 timing entries in text order."),
    "Потрібно рівно 12 міток у порядку тексту.",
  );
});
test("failed and obsolete locale requests leave the committed locale intact", async () => {
  const { i18n, picker } = await environment("ro");
  const english = await read("en");
  let release;
  globalThis.fetch = (path) =>
    path.endsWith("/fr.json")
      ? new Promise((resolve) => {
          release = () => resolve({ ok: true, json: () => read("fr") });
        })
      : Promise.resolve({ ok: false });
  const pending = i18n.changeLocale("fr");
  await i18n.changeLocale("en");
  release();
  await pending;
  assert.equal(i18n.currentLocale(), "en");
  await i18n.changeLocale("de");
  assert.equal(i18n.currentLocale(), "en");
  assert.equal(picker.value, "en");
  assert.match(picker.validationMessage, /could not load/u);
  assert.ok(english.Play);
});
