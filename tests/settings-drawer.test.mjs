import test from "node:test";
import assert from "node:assert/strict";
import { initSettingsDrawer } from "../settings-drawer.js";

class Element extends EventTarget {
  attributes = new Map();
  dataset = {};
  open = false;
  setAttribute(name, value) {
    this.attributes.set(name, value);
  }
  showModal() {
    this.open = true;
  }
  close() {
    this.open = false;
    this.dispatchEvent(new Event("close"));
  }
  getBoundingClientRect() {
    return { left: 200, right: 500, top: 0, bottom: 600 };
  }
}
function setup({ nativeDismiss = false } = {}) {
  const drawer = new Element(),
    settings = new Element(),
    edit = new Element();
  if (nativeDismiss) drawer.closedBy = "any";
  const section = new Element();
  let scrolled = false,
    stops = 0;
  const draft = { value: "Keep this unsaved text" };
  section.querySelector = () => ({
    scrollIntoView: () => {
      scrolled = true;
    },
  });
  edit.dataset.settingsSection = "settings-text";
  const nodes = new Map([
    ["settings-drawer", drawer],
    ["settings-text", section],
    ["text", draft],
  ]);
  const root = {
    getElementById: (id) => nodes.get(id),
    querySelectorAll: () => [settings, edit],
  };
  initSettingsDrawer({
    root,
    beforeOpen: () => {
      stops++;
    },
  });
  return {
    drawer,
    settings,
    edit,
    section,
    draft,
    get stops() {
      return stops;
    },
    get scrolled() {
      return scrolled;
    },
  };
}
function pointer(drawer, type, x, y = 100, pointerId = 1) {
  const event = new Event(type);
  Object.assign(event, { clientX: x, clientY: y, pointerId });
  drawer.dispatchEvent(event);
}

test("opening from a quick action stops playback, reveals the section and preserves drafts", () => {
  const ui = setup();
  ui.edit.dispatchEvent(new Event("click"));
  assert.equal(ui.stops, 1);
  assert.equal(ui.drawer.open, true);
  assert.equal(ui.section.open, true);
  assert.equal(ui.scrolled, true);
  assert.equal(ui.settings.attributes.get("aria-expanded"), "true");
  ui.settings.dispatchEvent(new Event("click"));
  assert.equal(
    ui.stops,
    1,
    "reopening must not interrupt a preview already inside the drawer",
  );
  ui.drawer.close();
  assert.equal(ui.settings.attributes.get("aria-expanded"), "false");
  assert.equal(ui.edit.attributes.get("aria-expanded"), "false");
  assert.equal(ui.draft.value, "Keep this unsaved text");
});

test("fallback light dismissal requires one gesture entirely outside", () => {
  const ui = setup();
  ui.settings.dispatchEvent(new Event("click"));
  pointer(ui.drawer, "pointerdown", 250);
  pointer(ui.drawer, "pointerup", 100);
  assert.equal(
    ui.drawer.open,
    true,
    "dragging a field out of the panel must preserve it",
  );
  pointer(ui.drawer, "pointerdown", 100);
  pointer(ui.drawer, "pointerup", 250);
  assert.equal(ui.drawer.open, true);
  pointer(ui.drawer, "pointerdown", 100);
  pointer(ui.drawer, "pointerup", 100);
  assert.equal(ui.drawer.open, false);
});

test("canceled or mismatched pointers cannot dismiss the drawer", () => {
  const ui = setup();
  ui.settings.dispatchEvent(new Event("click"));
  pointer(ui.drawer, "pointerdown", 100);
  pointer(ui.drawer, "pointercancel", 100);
  pointer(ui.drawer, "pointerup", 100);
  assert.equal(ui.drawer.open, true);
  pointer(ui.drawer, "pointerdown", 100, 100, 1);
  pointer(ui.drawer, "pointerup", 100, 100, 2);
  assert.equal(ui.drawer.open, true);
});

test("native light dismissal is left to the browser when available", () => {
  const ui = setup({ nativeDismiss: true });
  ui.settings.dispatchEvent(new Event("click"));
  pointer(ui.drawer, "pointerdown", 100);
  pointer(ui.drawer, "pointerup", 100);
  assert.equal(
    ui.drawer.open,
    true,
    "no duplicate pointer fallback on modern browsers",
  );
  ui.drawer.close();
  assert.equal(ui.settings.attributes.get("aria-expanded"), "false");
});
