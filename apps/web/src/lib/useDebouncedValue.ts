import { useEffect, useState } from "react";

// Returns `value` after it has stopped changing for `delayMs`. Used so a
// search box fires one request per pause in typing rather than one per key.
export function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);

    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
