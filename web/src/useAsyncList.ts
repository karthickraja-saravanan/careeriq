import { useCallback, useEffect, useRef, useState } from "react";

/** Loads a list and re-polls every 1.5s while `shouldPoll` says any item is still processing. */
export function useAsyncList<T>(load: () => Promise<T[]>, shouldPoll: (items: T[]) => boolean) {
  const [items, setItems] = useState<T[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loadRef = useRef(load);
  loadRef.current = load;

  const refresh = useCallback(async () => {
    try {
      setItems(await loadRef.current());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load data");
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!items || !shouldPoll(items)) return;
    const t = setTimeout(() => void refresh(), 1500);
    return () => clearTimeout(t);
  }, [items, shouldPoll, refresh]);

  return { items, error, refresh };
}
