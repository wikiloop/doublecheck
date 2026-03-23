// Mock chrome.* APIs for testing

type MessageListener = (
  message: unknown,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
) => boolean | void;

const listeners: MessageListener[] = [];
const storage: Record<string, Record<string, unknown>> = {
  session: {},
  local: {},
};

function createStorageArea(areaName: string): chrome.storage.StorageArea {
  return {
    get: vi.fn(async (keys?: string | string[] | Record<string, unknown> | null) => {
      const area = storage[areaName] ?? {};
      if (!keys) return { ...area };
      if (typeof keys === "string") {
        return keys in area ? { [keys]: area[keys] } : {};
      }
      if (Array.isArray(keys)) {
        const result: Record<string, unknown> = {};
        for (const key of keys) {
          if (key in area) result[key] = area[key];
        }
        return result;
      }
      // Object with defaults
      const result: Record<string, unknown> = {};
      for (const [key, defaultValue] of Object.entries(keys)) {
        result[key] = key in area ? area[key] : defaultValue;
      }
      return result;
    }),
    set: vi.fn(async (items: Record<string, unknown>) => {
      storage[areaName] = { ...storage[areaName], ...items };
    }),
    remove: vi.fn(async (keys: string | string[]) => {
      const keysArray = typeof keys === "string" ? [keys] : keys;
      for (const key of keysArray) {
        delete storage[areaName]![key];
      }
    }),
    clear: vi.fn(async () => {
      storage[areaName] = {};
    }),
    getBytesInUse: vi.fn(async () => 0),
    setAccessLevel: vi.fn(async () => {}),
    onChanged: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
      hasListener: vi.fn(() => false),
      hasListeners: vi.fn(() => false),
      addRules: vi.fn(),
      removeRules: vi.fn(),
      getRules: vi.fn(),
    },
    QUOTA_BYTES: 5242880,
  } as unknown as chrome.storage.StorageArea;
}

export const chromeMock = {
  runtime: {
    onMessage: {
      addListener: vi.fn((listener: MessageListener) => {
        listeners.push(listener);
      }),
      removeListener: vi.fn((listener: MessageListener) => {
        const index = listeners.indexOf(listener);
        if (index >= 0) listeners.splice(index, 1);
      }),
      hasListener: vi.fn((listener: MessageListener) => listeners.includes(listener)),
      hasListeners: vi.fn(() => listeners.length > 0),
    },
    sendMessage: vi.fn(async (message: unknown) => {
      for (const listener of listeners) {
        let response: unknown;
        const result = listener(
          message,
          {} as chrome.runtime.MessageSender,
          (r) => { response = r; },
        );
        if (result === true) {
          // Async — wait a tick
          await new Promise((resolve) => setTimeout(resolve, 0));
          return response;
        }
      }
      return undefined;
    }),
    onInstalled: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
      hasListener: vi.fn(() => false),
      hasListeners: vi.fn(() => false),
    },
    onStartup: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
      hasListener: vi.fn(() => false),
      hasListeners: vi.fn(() => false),
    },
    getURL: vi.fn((path: string) => `chrome-extension://test-id/${path}`),
  },
  storage: {
    session: createStorageArea("session"),
    local: createStorageArea("local"),
    sync: createStorageArea("sync"),
    onChanged: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
      hasListener: vi.fn(() => false),
      hasListeners: vi.fn(() => false),
    },
  },
  tabs: {
    query: vi.fn((_queryInfo: unknown, callback?: (tabs: chrome.tabs.Tab[]) => void) => {
      const tabs: chrome.tabs.Tab[] = [];
      if (callback) callback(tabs);
      return Promise.resolve(tabs);
    }),
    sendMessage: vi.fn(async () => undefined),
  },
  identity: {
    getRedirectURL: vi.fn((path?: string) => `https://test-id.chromiumapp.org/${path ?? ""}`),
    launchWebAuthFlow: vi.fn(async () => ""),
  },
  i18n: {
    getUILanguage: vi.fn(() => "en"),
  },
};

/**
 * Install the chrome mock on the global object.
 */
export function installChromeMock(): void {
  (globalThis as Record<string, unknown>).chrome = chromeMock;
}

/**
 * Reset all chrome mock state.
 */
export function resetChromeMock(): void {
  listeners.length = 0;
  storage.session = {};
  storage.local = {};
  storage.sync = {};
  vi.clearAllMocks();
}

// Auto-install
installChromeMock();
