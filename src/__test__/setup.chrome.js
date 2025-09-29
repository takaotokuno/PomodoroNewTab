import { vi } from "vitest";

export function setupChromeMock() {
  const chromeMock = {
    storage: {
      local: {
        get: vi.fn().mockResolvedValue({}),
        set: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined),
        clear: vi.fn().mockResolvedValue(undefined),
      },
    },
    runtime: {
      sendMessage: vi.fn(),
    },
  };

  vi.stubGlobal("chrome", chromeMock);
  return chromeMock;
}
