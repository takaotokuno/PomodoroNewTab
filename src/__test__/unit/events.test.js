import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as timerStore from "@/background/timer-store.js";
import * as notification from "@/background/notification.js";
import Constants from "@/constants.js";
import { routes } from "@/background/events.js";

describe("routes", () => {
  let instanceMock;

  beforeEach(() => {
    instanceMock = {
      start: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      reset: vi.fn(),
      update: vi.fn(),
      isActive: true,
      isPaused: false,
      getTotalRemaining: vi.fn().mockReturnValue(123),
      currentSessionType: "WORK",
      getCurrentSessionRemaining: vi.fn().mockReturnValue(45),
    };
    vi.spyOn(timerStore, "getTimer").mockReturnValue({ instance: instanceMock });
    vi.spyOn(notification, "notify").mockResolvedValue();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('"timer/start" calls start with minutes', () => {
    routes["timer/start"]({ minutes: 25 });
    expect(instanceMock.start).toHaveBeenCalledWith(25);
  });

  it('"timer/pause" calls pause', () => {
    routes["timer/pause"]();
    expect(instanceMock.pause).toHaveBeenCalled();
  });

  it('"timer/resume" calls resume', () => {
    routes["timer/resume"]();
    expect(instanceMock.resume).toHaveBeenCalled();
  });

  it('"timer/reset" calls reset', () => {
    routes["timer/reset"]();
    expect(instanceMock.reset).toHaveBeenCalled();
  });

  it('"timer/update" calls update and returns timer state', async () => {
    instanceMock.update.mockReturnValue({});
    const result = await routes["timer/update"]();
    expect(instanceMock.update).toHaveBeenCalled();
    expect(result).toEqual({
      isActive: instanceMock.isActive,
      isPaused: instanceMock.isPaused,
      totalRemaining: 123,
      currentSessionType: "WORK",
      currentSessionRemaining: 45,
    });
  });

  it('"timer/update" notifies "complete" if isTotalComplete', async () => {
    instanceMock.update.mockReturnValue({ isTotalComplete: true });
    await routes["timer/update"]();
    expect(notification.notify).toHaveBeenCalledWith(
      expect.objectContaining({ id: "complete" })
    );
  });

  it('"timer/update" notifies "switch" if isSessionComplete (WORK)', async () => {
    instanceMock.update.mockReturnValue({ isSessionComplete: true });
    instanceMock.currentSessionType = Constants.SESSION_TYPES.WORK;
    await routes["timer/update"]();
    expect(notification.notify).toHaveBeenCalledWith(
      expect.objectContaining({ id: "switch", title: "作業開始！" })
    );
  });

  it('"timer/update" notifies "switch" if isSessionComplete (BREAK)', async () => {
    instanceMock.update.mockReturnValue({ isSessionComplete: true });
    instanceMock.currentSessionType = Constants.SESSION_TYPES.BREAK;
    await routes["timer/update"]();
    expect(notification.notify).toHaveBeenCalledWith(
      expect.objectContaining({ id: "switch", title: "休憩開始" })
    );
  });
});