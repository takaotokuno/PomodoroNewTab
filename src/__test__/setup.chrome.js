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
  };

  const alarms = {
    create: vi.fn(),
    onAlarm: { addListener: vi.fn() },
  };

  const chromeMock = {
    storage: { local: storageLocal },
    runtime,
    alarms,
  };

  vi.stubGlobal("chrome", chromeMock);
  return chromeMock;
}
