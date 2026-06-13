let lastNavMs = 0;

export function guardedNavigate(fn: () => void, debounceMs = 500) {
  const now = Date.now();
  if (now - lastNavMs < debounceMs) return;
  lastNavMs = now;
  fn();
}
