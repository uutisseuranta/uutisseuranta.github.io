// Node 22+:n oma kokeellinen `localStorage`-globaali (webstorage) ohittaa jsdomin
// tarjoaman version ilman --localstorage-file-lippua, mikä rikkoo testit Node-versiosta
// riippuen. Korvataan globaali yksinkertaisella in-memory-toteutuksella, joka toimii
// samoin joka ympäristössä.
function createLocalStorageMock() {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => {
      store.set(String(key), String(value));
    },
    removeItem: (key) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    key: (index) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  };
}

Object.defineProperty(globalThis, 'localStorage', {
  value: createLocalStorageMock(),
  writable: true,
  configurable: true,
});
