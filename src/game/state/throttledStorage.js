/**
 * Throttled JSON storage adapter for zustand persist.
 *
 * The shared game clock advances `time` via store.set() on every
 * requestAnimationFrame (~60fps), and drainNeeds mutates the store each
 * tick too. Without throttling, the persist middleware would JSON.stringify
 * AND write the ENTIRE save to localStorage at that rate — a major main-
 * thread jank source on the big island.
 *
 * This adapter implements the full zustand persist storage interface
 * (`getItem`/`setItem`/`removeItem` operating on the JSON state object),
 * so BOTH the stringify and the write are coalesced to at most one per
 * window, always keeping the latest state. A flush on `pagehide` (and on
 * the following timers) ensures nothing is lost on reload/close.
 */
const FLUSH_MS = 500;

function makeThrottledStorage() {
  let writeTimer = null;
  let pendingName = null;
  let pendingValue = null;

  const flush = () => {
    if (writeTimer !== null) {
      clearTimeout(writeTimer);
      writeTimer = null;
    }
    if (pendingValue !== null) {
      const name = pendingName;
      const value = pendingValue;
      pendingName = null;
      pendingValue = null;
      try {
        localStorage.setItem(name, JSON.stringify(value));
      } catch {
        /* storage full / private mode — the game just won't persist */
      }
    }
  };

  // Flush any pending write when the tab is hidden/closed/reloaded so the
  // last few hundred ms of progress isn't dropped.
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
  }

  return {
    getItem: (name) => {
      // Return the freshest value: a pending (not-yet-flushed) write wins
      // over whatever last hit the disk.
      if (pendingName === name && pendingValue !== null) {
        return pendingValue;
      }
      try {
        const raw = localStorage.getItem(name);
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    },
    setItem: (name, value) => {
      pendingName = name;
      pendingValue = value;
      if (writeTimer === null) {
        writeTimer = setTimeout(flush, FLUSH_MS);
      }
    },
    removeItem: (name) => {
      if (pendingName === name) {
        pendingName = null;
        pendingValue = null;
      }
      if (writeTimer !== null) {
        clearTimeout(writeTimer);
        writeTimer = null;
      }
      try {
        localStorage.removeItem(name);
      } catch {
        /* ignore */
      }
    },
  };
}

export const throttledStorage = makeThrottledStorage();
