import { getTimer } from "./timer-store.js";
import Constants from "../constants.js";
const { TIMER_MODES, SESSION_TYPES } = Constants

let isPlaying = false;

export async function handleSound() {
  let timer = getTimer();

  if (
    !timer.soundEnabled
    || timer.mode !== TIMER_MODES.RUNNING
    || timer.sessionType !== SESSION_TYPES.WORK
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
      volume: 0.2,
      loop: true
    });
    console.log("Audio playback started");
  } catch (error) {
    isPlaying = false;
    console.error("Failed to start audio playback:", error);
  }
}

export async function stopAudio() {
  try {
    await sendAudioMessage("STOP");
    isPlaying = false;
    console.log("Audio stopped");
  } catch (error) {
    console.error("Failed to stop audio:", error);
  }
}

/**
 * offscreen.jsに音声制御メッセージを送信
 * @param {string} action - 実行するアクション ("PLAY", "STOP", "CLEANUP")
 * @param {Object} options - 追加オプション (soundFile, volume, loop等)
 * @returns {Promise<Object>} レスポンス
 */
async function sendAudioMessage(action, options = {}) {
  try {
    const message = {
      type: "AUDIO_CONTROL",
      action,
      ...options
    };

    const response = await chrome.runtime.sendMessage(message);

    if (!response?.success) {
      throw new Error(response?.error || `Audio ${action} failed`);
    }

    return response;
  } catch (error) {
    console.error(`Audio message (${action}) failed:`, error);
    throw error;
  }
}

export async function setupSound() {
  // offscreen documentを作成
  await chrome.offscreen.createDocument({
    url: 'src/offscreen/offscreen.html',
    reasons: ['AUDIO_PLAYBACK'],
    justification: 'Playing background audio for pomodoro timer'
  });
}