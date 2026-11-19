import test from "node:test";
import assert from "node:assert/strict";
import { createPlaybackLabel } from "../playback-label.js";

function setup() {
  let now = 0,
    id = 0;
  const timers = new Map(),
    rendered = [];
  const label = createPlaybackLabel({
    render: (value) => rendered.push(value),
    schedule: (fn, delay) => {
      timers.set(++id, { fn, at: now + delay });
      return id;
    },
    cancel: (id) => timers.delete(id),
  });
  function advance(ms) {
    now += ms;
    for (const [id, timer] of timers)
      if (timer.at <= now) {
        timers.delete(id);
        timer.fn();
      }
  }
  return { label, rendered, advance };
}

test("fast start, pause and resume skip transient labels", () => {
  const { label, rendered, advance } = setup();
  for (const [pending, acknowledged] of [
    ["Cancel start", "Pause"],
    ["Cancel pause", "Resume"],
    ["Cancel resume", "Pause"],
  ]) {
    label.pending(pending);
    advance(11);
    label.show(acknowledged);
    advance(200);
  }
  assert.deepEqual(rendered, ["Pause", "Resume", "Pause"]);
});

test("slow engines expose pending state, and cancellation cannot be overwritten", () => {
  const { label, rendered, advance } = setup();
  label.pending("Cancel start");
  advance(149);
  assert.deepEqual(rendered, []);
  advance(1);
  assert.deepEqual(rendered, ["Cancel start"]);
  label.show("Pause");
  label.pending("Cancel pause");
  label.show("Play");
  advance(300);
  assert.deepEqual(rendered, ["Cancel start", "Pause", "Play"]);
});

test("sentence handoffs and replacement pending states cancel obsolete timers", () => {
  const { label, rendered, advance } = setup();
  label.pending("Cancel start");
  label.cancelPending();
  advance(300);
  assert.deepEqual(rendered, []);
  label.pending("Cancel pause");
  advance(100);
  label.pending("Cancel resume");
  advance(50);
  assert.deepEqual(rendered, []);
  advance(100);
  assert.deepEqual(rendered, ["Cancel resume"]);
});
