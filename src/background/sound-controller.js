import { getTimer } from "./timer-store.js";
import Constants from "../constants.js";
const { TIMER_MODES, SESSION_TYPES } = Constants;

let isPlaying = false;
let initPromise = null;

/**
 * Handle sound playback based on timer state
 * @throws {Error} If sound control fails
 */
export async function handleSound() {
  let timer = getTimer();

  if (
    !timer.soundEnabled ||
    timer.mode !== TIMER_MODES.RUNNING ||
    timer.sessionType !== SESSION_TYPES.WORK
  ) {
    await stopAudio();
    return;
  }

  if (isPlaying) return;

  await playAudio();
}

export async function playAudio() {
  try {
    isPlaying = true;
    await sendAudioMessage("PLAY", {
      soundFile: "resources/nature-sound.mp3",
      volume: getTimer().soundVolume,
      loop: true,
    });
    console.log("Audio playback started");
  } catch (error) {
    isPlaying = false;
    throw error;
  }
}

export async function stopAudio() {
  try {
    await sendAudioMessage("STOP");
    isPlaying = false;
    console.log("Audio stopped");
  } catch (error) {
    isPlaying = false;
    throw error;
  }
}

/**
 * offscreen.jsに音声制御メッセージを送信
 * @param {string} action - 実行するアクション ("PLAY", "STOP", "CLEANUP")
 * @param {Object} options - 追加オプション (soundFile, volume, loop等)
 */
async function sendAudioMessage(action, options = {}) {
  const message = {
    type: "AUDIO_CONTROL",
    action,
    ...options,
  };

  try {
    await ensureOffscreen();
    
    const res = await chrome.runtime.sendMessage(message);
    if (!res?.success) throw new Error(res?.error || "Offscreen error");
    return res;
  } catch (e) {
    throw new Error("Failed to send audio message: " + e.message);
  }
}

/**
 * Offscreen documentが存在することを確認し、なければ作成
 */
async function ensureOffscreen() {
  if(initPromise) return initPromise;

  initPromise = (async () => {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ["OFFSCREEN_DOCUMENT"],
    });
    
    if (contexts.length === 0) {
      await chrome.offscreen.createDocument({
        url: "src/offscreen/offscreen.html",
        reasons: ["AUDIO_PLAYBACK"],
        justification: "Playing background audio for pomodoro timer",
      });
    }
  })();

  try {
    await initPromise;
  } finally {
    initPromise = null;
  }
}

export async function setupSound() {
  try {
    await ensureOffscreen();
  } catch (error) {
    console.warn("Failed to setup sound:", error.message);
  }
}
