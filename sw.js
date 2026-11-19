// The asset build replaces these values using the public files' contents.
const CACHE_NAME = "hear-and-read.shell.__BUILD_HASH__";
const SHELL_URLS = /* __PRECACHE_URLS__ */ [];
const shellPaths = new Set(SHELL_URLS);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        cache.addAll(
          SHELL_URLS.map((url) => new Request(url, { cache: "reload" })),
        ),
      ),
  );
  // Keep the normal waiting lifecycle so updates cannot interrupt practice.
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter(
              (name) =>
                name.startsWith("hear-and-read.shell.") && name !== CACHE_NAME,
            )
            .map((name) => caches.delete(name)),
        ),
      ),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  // APIs, external recordings, blobs and non-GET requests stay network-only.
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  const isHome =
    request.mode === "navigate" &&
    (url.pathname === "/" || url.pathname === "/index.html");
  if (!isHome && (!shellPaths.has(url.pathname) || url.search)) return;
  const key = isHome ? "/" : url.pathname;
  event.respondWith(
    caches
      .open(CACHE_NAME)
      .then(async (cache) => (await cache.match(key)) || fetch(request)),
  );
});
