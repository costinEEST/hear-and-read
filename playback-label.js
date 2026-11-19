// Brief engine transitions should not flash a pending label. This delays only
// presentation: playback and cancellation still happen immediately.
export function createPlaybackLabel({
  render,
  delay = 150,
  schedule = setTimeout,
  cancel = clearTimeout,
}) {
  let timer = null;
  function cancelPending() {
    if (timer !== null) cancel(timer);
    timer = null;
  }
  return {
    cancelPending,
    show(source) {
      cancelPending();
      render(source);
    },
    pending(source) {
      cancelPending();
      timer = schedule(() => {
        timer = null;
        render(source);
      }, delay);
    },
  };
}
