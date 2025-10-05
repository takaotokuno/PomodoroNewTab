/**
 * Unit tests for timer-store.js
 */
import {
    describe,
    test,
    expect,
    beforeEach,
    afterEach,
    vi,
} from "vitest";
import { setupChromeMock } from "../setup.chrome.js";
import Constants from "@/constants.js";
const { TIMER_MODES } = Constants;

describe("TimerStore", () => {
    const SNAPSHOT_KEY = "pomodoroTimerSnapshot";

    let chromeMock = setupChromeMock();
    let initTimer, getTimer, saveSnapshot;

    beforeEach(async () => {
        vi.resetModules();

        // Import fresh modules after reset
        const timerStore = await import("@/background/timer-store.js");
        initTimer = timerStore.initTimer;
        getTimer = timerStore.getTimer;
        saveSnapshot = timerStore.saveSnapshot;
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe("initTimer()", () => {
        test("should restore a new timer instance when no snapshot exists", async () => {
            const timer = await initTimer();

            expect(chromeMock.storage.local.get).toHaveBeenCalledWith(SNAPSHOT_KEY);
            expect(timer).toBeTruthy();
            expect(timer.mode).toBe(TIMER_MODES.SETUP);
        });

        test("should reuse the same instance when called multiple times", async () => {
            let timer = await initTimer();
            timer.start();

            timer = await initTimer();

            expect(timer.mode).toBe(TIMER_MODES.RUNNING);
        });

        test("should restore timer state from an existing snapshot", async () => {
            chromeMock.storage.local.get.mockResolvedValue({
                [SNAPSHOT_KEY]: { mode: TIMER_MODES.RUNNING },
            });

            const timer = await initTimer();

            expect(timer.mode).toBe(TIMER_MODES.RUNNING);
        });
    });

    describe("getTimer()", () => {
        test("should throw an error if initTimer has not been called", () => {
            expect(() => getTimer()).toThrow("Timer not initialized");
        });

        test("should return the existing timer after initialization", async () => {
            await initTimer();
            const timer = getTimer();

            expect(timer).toBeTruthy();
        });
    });

    describe("saveSnapshot()", () => {
        test("should do nothing if no timer instance exists", async () => {
            await saveSnapshot();

            expect(chromeMock.storage.local.set).not.toHaveBeenCalled();
        });

        test("should save the snapshot of the current timer state", async () => {
            await initTimer();
            const timer = getTimer();
            timer.start();

            await saveSnapshot();

            expect(chromeMock.storage.local.set).toHaveBeenCalledWith(
                expect.objectContaining({
                    [SNAPSHOT_KEY]: expect.any(Object),
                })
            );
        });
    });
});