import { getTimer } from "./timer-store.js";
import { startTick, stopTick } from "./setup-alarms.js";
import { notify } from "./notification.js";
import { enableBlock, disableBlock } from "./sites-guard.js";
import Constants from "../constants.js";

/**
 * Routes for handling messages from UI/content scripts.
 * Each key is a message type, mapped to a function that mutates or queries TimerState.
 */
export const routes = {
  "timer/start": async ({ minutes }) => {
    if (!minutes || minutes < 0) throw new Error("Invalid minutes");

    getTimer().start(minutes);
    await enableBlock();
    await startTick();
  },
  "timer/pause": async () => {
    getTimer().pause();
    await stopTick();
  },
  "timer/resume": async () => {
    getTimer().resume();
    await startTick();
  },
  "timer/reset": async () => {
    getTimer().reset();
    await disableBlock();
    await stopTick();
  },
  "timer/update": async () => {
    const res = getTimer().update();
    await handleEvents(res);
    return {
      mode: getTimer().mode,
      totalRemaining: getTimer().getTotalRemaining(),
      sessionType: getTimer().sessionType,
      sessionRemaining: getTimer().getSessionRemaining(),
    };
  },
};

/**
 * Handle events returned by TimerState.update().
 * - No-op if timer is inactive/paused.
 * - Show "complete" notification when total finishes.
 * - Show "switch" notification when a session ends,
 *   using currentSessionType after the switch.
 */
export async function handleEvents(res) {
  if (!res) return;

  if (res.mode === Constants.TIMER_MODES.COMPLETED) {
    await notify({
      id: "complete" + Date.now(),
      title: "ポモドーロ完了",
      message: "お疲れ様！また頑張ろう",
    });

    await disableBlock();
    await stopTick();
  } else if (res.isSessionComplete) {
    const isWork = res.sessionType === Constants.SESSION_TYPES.WORK;
    await notify({
      id: "switch" + Date.now(),
      title: isWork ? "作業開始！" : "休憩開始",
      message: isWork
        ? "SNSをブロックしたよ。作業に集中しよう"
        : "ブロックを解除したよ。肩の力を抜こう",
    });

    if (isWork) {
      await enableBlock();
    } else {
      await disableBlock();
    }
  }
}
