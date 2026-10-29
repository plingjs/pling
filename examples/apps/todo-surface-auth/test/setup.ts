function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => void values.delete(key),
    setItem: (key, value) => void values.set(key, String(value)),
  };
}

for (const name of ["localStorage", "sessionStorage"] as const) {
  if (!(name in globalThis) || globalThis[name] === undefined) {
    Object.defineProperty(globalThis, name, { configurable: true, value: memoryStorage() });
  }
}

if (!("clipboard" in navigator)) {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: async () => undefined },
  });
}
