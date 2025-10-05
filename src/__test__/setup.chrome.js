import { vi } from "vitest";

export function setupChromeMock() {
  const storageLocal = {
    get: vi.fn().mockResolvedValue({}),
    set: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
  };

  const runtime = {
    sendMessage: vi.fn(),
    onInstalled: { addListener: vi.fn() },
    onStartup: { addListener: vi.fn() },
    onMessage: { addListener: vi.fn() },
    getURL: vi.fn((path) => path),
  };

  const alarms = {
    create: vi.fn(),
    clear: vi.fn(),
    onAlarm: { addListener: vi.fn() },
  };

  const notifications = {
    create: vi.fn((_id, _options, cb) => cb && cb()),
  };

  const declarativeNetRequest = {
    updateDynamicRules: vi.fn().mockResolvedValue(undefined),
  };

  // Tabs API mock for synchronization testing
  const tabs = {
    query: vi.fn().mockResolvedValue([]),
    reload: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
  };

  const chromeMock = {
    storage: { local: storageLocal },
    runtime,
    alarms,
    notifications,
    declarativeNetRequest,
    tabs,
  };

  vi.stubGlobal("chrome", chromeMock);
  return chromeMock;
}
