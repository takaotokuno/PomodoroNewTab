import { getTimer } from "./timer-store.js";
import { notify } from "./notification.js";
import { enableBlock, disableBlock } from "./sites-guard.js";
import Constants from "../constants.js";

/**
 * Routes for handling messages from UI/content scripts.
 * Each key is a message type, mapped to a function that mutates or queries TimerState.
 */
export const routes = {
  "timer/start": async ({ minutes }) => {
    getTimer().instance.start(minutes);
    await enableBlock();
  },
  "timer/pause": () => getTimer().instance.pause(),
  "timer/resume": () => getTimer().instance.resume(),
  "timer/reset": async () => {
    getTimer().instance.reset();
    await disableBlock();
  },
  "timer/update": async () => {
    const res = getTimer().instance.update();
    await handleEvents(res);
    return {
      isActive: getTimer().instance.isActive,
      isPaused: getTimer().instance.isPaused,
      totalRemaining: getTimer().instance.getTotalRemaining(),
      currentSessionType: getTimer().instance.currentSessionType,
      currentSessionRemaining: getTimer().instance.getCurrentSessionRemaining(),
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
  if (!res || !getTimer().instance) return;

  if (res.isTotalComplete) {
    await notify({
      id: "complete",
      title: "ポモドーロ完了",
      message: "お疲れ様！また頑張ろう",
    });
    await disableBlock();
    return;
  }
  if (res.isSessionComplete) {
    const isWork =
      getTimer().instance.currentSessionType === Constants.SESSION_TYPES.WORK;
    await notify({
      id: "switch",
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

    return;
  }
}
