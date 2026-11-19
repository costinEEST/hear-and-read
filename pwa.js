// Registration is independent of playback and localization initialization.
// Updates wait until all app windows close; never reload an active practice.
if (window.isSecureContext && "serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("/sw.js", { updateViaCache: "none" })
    .catch((failure) =>
      console.warn("Offline support could not initialize.", failure),
    );
}
