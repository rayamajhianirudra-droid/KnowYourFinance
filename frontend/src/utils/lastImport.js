// Remembers which transactions the most recent statement import added, so
// the person can undo it with one click if they picked the wrong file.
// It lives in this browser only, and every read and write is guarded
// because storage can be blocked or empty.

const KEY = "kyf-last-import";

/** Ids of every transaction a saved batch response added, across all files. */
export function importedIds(response) {
  return (response?.files ?? [])
    .filter((file) => file.success && file.result)
    .flatMap((file) => file.result.transactions ?? [])
    .map((row) => row.id)
    .filter((id) => id != null);
}

export function rememberImport(ids) {
  try {
    if (ids.length === 0) {
      window.localStorage.removeItem(KEY);
    } else {
      window.localStorage.setItem(KEY, JSON.stringify({ ids, savedAt: new Date().toISOString() }));
    }
  } catch {
    // Storage is blocked: undo simply is not offered after a refresh.
  }
}

export function lastImport() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(KEY) ?? "null");
    return saved && Array.isArray(saved.ids) && saved.ids.length > 0 ? saved : null;
  } catch {
    return null;
  }
}

export function forgetImport() {
  rememberImport([]);
}
