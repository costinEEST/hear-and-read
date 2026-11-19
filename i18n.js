import { LANGUAGES } from "./languages.js";

const PREFERENCE = "hear-and-read.page-language.v1";
let locale = "en",
  messages = {},
  english = {},
  request = 0,
  onChange = () => {};
const cache = new Map(),
  textBindings = new Map(),
  attributeBindings = [];
let patterns = [];
export const currentLocale = () => locale;
const normalize = (value) => String(value).replace(/\s+/gu, " ").trim();
const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export function resolveLocale(value) {
  const code = String(value || "en")
    .toLowerCase()
    .split(/[-_]/u)[0];
  return Object.hasOwn(LANGUAGES, code) ? code : "en";
}
export function languageName(code) {
  try {
    return new Intl.DisplayNames(locale, { type: "language" }).of(code);
  } catch {
    return LANGUAGES[code]?.name || code;
  }
}
export function t(source) {
  const key = normalize(source);
  if (!key) return "";
  if (Object.hasOwn(messages, key)) return messages[key];
  for (const { key: template, regex, names } of patterns) {
    const match = key.match(regex);
    if (!match) continue;
    let result = messages[template] || english[template];
    if (!result) continue;
    const values = {};
    names.forEach((name, index) => {
      let value = match[index + 1];
      const isLanguage = index === 0 && /^(No suitable|Add |Practice language changed|Content imported|\{p0\} demo)/u.test(template);
      if (isLanguage) {
        const code = Object.keys(LANGUAGES).find(code => LANGUAGES[code].name === value);
        if (code) value = languageName(code);
      }
      const isFragment =
        (template.includes("Word highlighting depends") && [0,3,4,5].includes(index)) ||
        (template.startsWith("Import failed") && index === names.length - 1) ||
        ((template.startsWith("Loaded") || template.startsWith("Practice language changed") || template.startsWith("Content imported")) && index === 1) ||
        template.startsWith("Studio could not initialize");
      if (isFragment) value = tFragment(value);
      values[name] = value;
    });
    result = result.replace(/\{(p\d+)\}/gu, (token, name) => values[name] ?? token);
    return result;
  }
  return source;
}
function tFragment(value) {
  const key = normalize(value);
  return Object.hasOwn(messages, key) ? messages[key] : t(value);
}
export function uiText(element, value) {
  textBindings.set(element, value);
  const text = typeof value === "function" ? value() : value;
  element.textContent = t(text);
}
export function uiAttribute(element, attribute, value) {
  const existing = attributeBindings.find(
    (binding) => binding.element === element && binding.attribute === attribute,
  );
  if (existing) existing.value = value;
  else attributeBindings.push({ element, attribute, value });
  element.setAttribute(
    attribute,
    t(typeof value === "function" ? value() : value),
  );
}
export function countLabel(count, kind) {
  const category = new Intl.PluralRules(locale).select(count);
  const forms = messages[`count.${kind}`] || english[`count.${kind}`] || {one:`{count} ${kind === "words" ? "word" : kind === "sentences" ? "sentence" : "pin"}`,other:`{count} ${kind}`};
  return (forms[category] || forms.other).replaceAll(
    "{count}",
    new Intl.NumberFormat(locale).format(count),
  );
}
function registerStaticText() {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode,
      parent = node.parentElement;
    if (
      !normalize(node.data) ||
      !/[\p{L}]/u.test(node.data) ||
      parent.closest(
        "script,style,code,textarea,h1,#reader,#reading-title,#selected-word,#sessions,select",
      )
    )
      continue;
    const source = normalize(node.data);
    if (source === "Hear & Read") continue;
    textBindings.set(node, source);
  }
  for (const element of document.querySelectorAll(
    "[aria-label],[placeholder]",
  )) {
    for (const attribute of ["aria-label", "placeholder"]) {
      const value = element.getAttribute(attribute);
      if (value && !value.startsWith("https:"))
        attributeBindings.push({ element, attribute, value });
    }
  }
  for (const option of document.querySelectorAll(
    "select:not(#page-language):not(#practice-language) option",
  ))
    textBindings.set(option, option.textContent);
}
export function refreshTranslations() {
  for (const [node, source] of textBindings) {
    if (!node.isConnected) {
      textBindings.delete(node);
      continue;
    }
    const value = typeof source === "function" ? source() : source;
    // A Text node keeps surrounding inline elements (links, controls, emphasis) intact.
    if (node.nodeType === Node.TEXT_NODE) node.data = ` ${t(value)} `;
    else node.textContent = t(value);
  }
  for (let i = attributeBindings.length - 1; i >= 0; i--) {
    const { element, attribute, value } = attributeBindings[i];
    if (!element.isConnected) {
      attributeBindings.splice(i, 1);
      continue;
    }
    element.setAttribute(
      attribute,
      t(typeof value === "function" ? value() : value),
    );
  }
}
async function dictionary(code) {
  if (cache.has(code)) return cache.get(code);
  const response = await fetch(`locales/${code}.json`);
  if (!response.ok)
    throw new Error("Language could not load. Please try again.");
  const value = await response.json();
  if (!value || Array.isArray(value) || typeof value !== "object")
    throw new Error("Language could not load. Please try again.");
  for (const key of Object.keys(english))
    if (!Object.hasOwn(value, key))
      throw new Error("Language could not load. Please try again.");
  cache.set(code, value);
  return value;
}
export async function changeLocale(
  code,
  { history = true, remember = true } = {},
) {
  const token = ++request,
    previous = locale;
  const picker = document.getElementById("page-language");
  code = resolveLocale(code);
  try {
    const next = await dictionary(code);
    if (token !== request) return;
    if (history) {
      const url = new URL(location.href);
      url.searchParams.set("lang", code);
      if (url.href !== location.href) window.history.pushState(null, "", url);
    }
    locale = code;
    messages = next;
    document.documentElement.lang = code;
    document.documentElement.dir = "ltr";
    picker.value = code;
    picker.setCustomValidity("");
    const url = new URL(location.href);
    if (!history && !url.searchParams.has("lang") && code !== "en") {
      url.searchParams.set("lang", code); window.history.replaceState(window.history.state, "", url);
    }
    refreshTranslations();
    onChange();
    if (remember)
      try {
        localStorage.setItem(PREFERENCE, code);
      } catch {
        /* Visit still works with blocked storage. */
      }
  } catch {
    if (token !== request) return;
    picker.value = previous;
    picker.setCustomValidity(t("Language could not load. Please try again."));
    picker.reportValidity();
    if (!history) {
      const url = new URL(location.href); url.searchParams.set("lang", previous);
      window.history.replaceState(window.history.state, "", url);
    }
  }
}
export async function initI18n({ onChange: callback = () => {} } = {}) {
  onChange = callback;
  try { english = await dictionary("en"); }
  catch { english = {}; cache.set("en", english); }
  messages = english;
  patterns = Object.keys(english)
    .filter((key) => /\{p\d+\}/u.test(key))
    .sort(
      (a, b) =>
        b.replace(/\{p\d+\}/gu, "").length - a.replace(/\{p\d+\}/gu, "").length,
    )
    .map((key) => {
      const names = [...key.matchAll(/\{(p\d+)\}/gu)].map((match) => match[1]);
      return {
        key,
        names,
        regex: new RegExp(
          "^" +
            key
              .split(/\{p\d+\}/u)
              .map(escape)
              .join("([\\s\\S]*?)") +
            "$",
        ),
      };
    });
  registerStaticText();
  const picker = document.getElementById("page-language");
  picker.replaceChildren(
    ...Object.entries(LANGUAGES).map(([code, config]) => {
      const option = document.createElement("option");
      option.value = code;
      option.lang = code;
      option.textContent = config.nativeName;
      return option;
    }),
  );
  picker.addEventListener("change", () => changeLocale(picker.value));
  window.addEventListener("popstate", () =>
    changeLocale(new URL(location.href).searchParams.get("lang") || "en", {
      history: false,
    }),
  );
  // English is the first-visit default, regardless of browser/device language.
  let saved;
  try {
    saved = localStorage.getItem(PREFERENCE);
  } catch {
    /* Optional preference. */
  }
  await changeLocale(
    new URL(location.href).searchParams.get("lang") ?? saved ?? "en",
    { history: false, remember: false },
  );
}
