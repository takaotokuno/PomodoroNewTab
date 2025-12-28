/**
 * Offscreen document for audio playback
 * Background serviceから音声制御メッセージを受信して実際の音声再生を行う
 */

let audio = null;
let isLoaded = false;

/**
 * 音声ファイルを読み込む
 */
async function loadAudio(soundFile, volume = 0.2, loop = true) {
  // 既存のaudioオブジェクトがある場合はクリーンアップ
  if (audio) {
    audio.pause();
    audio.src = "";
    audio = null;
  }

  // 新しいAudioオブジェクトを作成
  const audioUrl = chrome.runtime.getURL(soundFile);
  audio = new Audio(audioUrl);

  // 設定を適用
  audio.loop = loop;
  audio.volume = volume * 0.5 * 0.01;

  // 音声ファイルの読み込み完了を待つ
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Audio load timeout"));
    }, 5000);

    audio.addEventListener(
      "canplaythrough",
      () => {
        clearTimeout(timeout);
        isLoaded = true;
        console.log("Audio loaded successfully:", soundFile);
        resolve();
      },
      { once: true }
    );

    audio.addEventListener(
      "error",
      (error) => {
        clearTimeout(timeout);
        isLoaded = false;
        console.error("Failed to load audio:", error);
        reject(new Error("Audio file load failed"));
      },
      { once: true }
    );

    audio.load();
  });
}

/**
 * 音声を再生する
 */
async function playAudio() {
  if (!audio || !isLoaded) {
    throw new Error("Audio not loaded");
  }

  try {
    await audio.play();
    console.log("Audio playback started");
  } catch (error) {
    if (error.name === "NotAllowedError") {
      throw new Error("Autoplay blocked");
    }
    throw error;
  }
}

/**
 * 音声を停止する（再生位置をリセット）
 */
function stopAudio() {
  if (audio) {
    audio.pause();
    audio.currentTime = 0;
    console.log("Audio stopped");
  }
}

/**
 * リソースをクリーンアップする
 */
function cleanupAudio() {
  if (audio) {
    audio.pause();
    audio.src = "";
    audio = null;
  }
  isLoaded = false;
  console.log("Audio cleanup completed");
}

/**
 * Background serviceからのメッセージを処理
 */
chrome.runtime.onMessage.addListener((message, _, sendResponse) => {
  if (message.type !== "AUDIO_CONTROL") return;

  (async () => {
    try {
      switch (message.action) {
        case "PLAY":
          await loadAudio(
            message.soundFile || "resources/nature-sound.mp3",
            message.volume || 0.2,
            message.loop !== false
          );
          await playAudio();
          sendResponse({ success: true });
          break;

        case "STOP":
          stopAudio();
          sendResponse({ success: true });
          break;

        case "UPDATE_VOLUME":
          if (audio && isLoaded) {
            audio.volume = (message.volume || 0.2) * 0.5 * 0.01;
            console.log("Volume updated to:", audio.volume);
          }
          sendResponse({ success: true });
          break;

        case "CLEANUP":
          cleanupAudio();
          sendResponse({ success: true });
          break;

        default:
          return;
      }
    } catch (error) {
      sendResponse({ success: false, error: error.message });
      return;
    }
  })();
  return true;
});

// ページがアンロードされる時のクリーンアップ
window.addEventListener("beforeunload", () => {
  cleanupAudio();
});

console.log("Offscreen audio controller initialized");
