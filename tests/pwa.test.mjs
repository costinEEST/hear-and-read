import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
execFileSync(process.execPath, ["scripts/build-assets.mjs"], { cwd: root });
const source = await readFile(new URL("dist/public/sw.js", root), "utf8");

function worker({ failInstall = false } = {}) {
  const listeners = {},
    stores = new Map(),
    requests = [];
  const caches = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name);
      return {
        async addAll(items) {
          if (failInstall) throw new Error("Download failed");
          for (const item of items)
            store.set(new URL(item.url).pathname, new Response(item.url));
        },
        async match(key) {
          return store.get(key)?.clone();
        },
      };
    },
    async keys() {
      return [...stores.keys()];
    },
    async delete(name) {
      return stores.delete(name);
    },
  };
  // The browser resolves relative Request URLs against the worker origin.
  class WorkerRequest extends Request {
    constructor(url, options) {
      super(new URL(url, "https://studio.test"), options);
    }
  }
  const context = vm.createContext({
    self: {
      location: new URL("https://studio.test/sw.js"),
      addEventListener(name, handler) {
        listeners[name] = handler;
      },
    },
    caches,
    Request: WorkerRequest,
    URL,
    fetch: async (request) => {
      requests.push(request);
      throw new Error("Offline");
    },
  });
  vm.runInContext(source, context);
  async function lifecycle(name) {
    let work;
    listeners[name]({
      waitUntil(promise) {
        work = promise;
      },
    });
    await work;
  }
  function fetchEvent(path, { method = "GET", mode = "cors" } = {}) {
    let response;
    listeners.fetch({
      request: { url: new URL(path, "https://studio.test").href, method, mode },
      respondWith(promise) {
        response = promise;
      },
    });
    return response;
  }
  return { stores, requests, lifecycle, fetchEvent };
}

test("offline shell serves home query variants, every language and script without network", async () => {
  const sw = worker();
  await sw.lifecycle("install");
  for (const path of ["/?lang=hu", "/index.html?lang=fr"]) {
    const response = await sw.fetchEvent(path, { mode: "navigate" });
    assert.equal(await response.text(), "https://studio.test/");
  }
  const html = await readFile(new URL("index.html", root), "utf8");
  const modules = [
    ...html.matchAll(/<script type="module" src="([^"]+)"/gu),
  ].map((match) => match[1]);
  for (const path of [
    "styles.css",
    "settings-drawer.js",
    ...modules,
    "timing.js",
    "speech.js",
    "speech-playback.js",
    "languages.js",
    "demos.js",
    "i18n.js",
  ]) {
    assert.equal((await sw.fetchEvent(`/${path}`)).status, 200, path);
  }
  const { LANGUAGES } = await import("../languages.js");
  for (const code of Object.keys(LANGUAGES))
    assert.equal(
      (await sw.fetchEvent(`/locales/${code}.json`)).status,
      200,
      code,
    );
  assert.equal(sw.requests.length, 0);
});

test("API calls, remote audio, unknown pages and modified asset URLs bypass the shell", async () => {
  const sw = worker();
  await sw.lifecycle("install");
  for (const path of [
    "/api/sources",
    "/api/import",
    "https://audio.test/recording.mp3",
    "/recording.mp3",
    "/app.js?v=unknown",
    "/unknown",
  ]) {
    assert.equal(sw.fetchEvent(path), undefined, path);
  }
  assert.equal(
    sw.fetchEvent("/", { method: "POST", mode: "navigate" }),
    undefined,
  );
  assert.equal(sw.fetchEvent("/unknown", { mode: "navigate" }), undefined);
});

test("failed precaching rejects installation; activation cleans only old app shell caches", async () => {
  await assert.rejects(
    worker({ failInstall: true }).lifecycle("install"),
    /Download failed/u,
  );
  const sw = worker();
  await sw.lifecycle("install");
  const [current] = sw.stores.keys();
  sw.stores.set("hear-and-read.shell.old", new Map());
  sw.stores.set("other-app", new Map());
  await sw.lifecycle("activate");
  assert.deepEqual([...sw.stores.keys()], [current, "other-app"]);
  // Lifecycle methods such as skipWaiting/clients.claim are absent in the harness:
  // install/activate must succeed without taking over an active practice window.
});

test("install manifest has a stable identity and correctly sized public PNG icons", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("dist/public/manifest.webmanifest", root), "utf8"),
  );
  assert.equal(manifest.id, "/");
  assert.equal(manifest.start_url, "/");
  assert.equal(manifest.scope, "/");
  assert.equal(manifest.display, "standalone");
  for (const icon of [
    ...manifest.icons,
    { src: "/assets/apple-touch-icon.png", sizes: "180x180" },
  ]) {
    const png = await readFile(new URL(`dist/public${icon.src}`, root));
    assert.equal(png.subarray(1, 4).toString(), "PNG");
    assert.equal(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`, icon.sizes);
  }
  assert.ok(!source.includes("__BUILD_HASH__"));
  assert.ok(!source.includes("__PRECACHE_URLS__"));
});
