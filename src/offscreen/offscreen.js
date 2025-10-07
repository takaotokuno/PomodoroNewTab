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
  try {
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
    audio.volume = volume;

    // 音声ファイルの読み込み完了を待つ
    return new Promise((resolve, reject) => {
      audio.addEventListener(
        "canplaythrough",
        () => {
          isLoaded = true;
          console.log("Audio loaded successfully:", soundFile);
          resolve();
        },
        { once: true }
      );

      audio.addEventListener(
        "error",
        (error) => {
          console.error("Failed to load audio:", error);
          isLoaded = false;
          reject(error);
        },
        { once: true }
      );

      // 音声ファイルの読み込みを開始
      audio.load();
    });
  } catch (error) {
    console.error("Error in loadAudio:", error);
    isLoaded = false;
    throw error;
  }
}

/**
 * 音声を再生する
 */
async function playAudio() {
  if (!audio || !isLoaded) {
    console.warn("Audio not loaded, cannot play");
    return;
  }

  try {
    await audio.play();
    console.log("Audio playback started");
  } catch (error) {
    console.warn("Failed to play audio (autoplay policy?):", error);
    // エラーをスローせず、静かに失敗させる
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
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.type !== "AUDIO_CONTROL") {
    return;
  }

  try {
    switch (message.action) {
      case "PLAY":
        // 音声ファイルを読み込んで再生
        await loadAudio(
          message.soundFile || "resources/nature-sound.mp3",
          message.volume || 0.3,
          message.loop !== false
        );
        await playAudio();
        sendResponse({ success: true });
        break;

      case "STOP":
        stopAudio();
        sendResponse({ success: true });
        break;

      case "CLEANUP":
        cleanupAudio();
        sendResponse({ success: true });
        break;

      default:
        console.warn("Unknown audio action:", message.action);
        sendResponse({ success: false, error: "Unknown action" });
    }
  } catch (error) {
    console.error("Error handling audio message:", error);
    sendResponse({ success: false, error: error.message });
  }

  return true; // 非同期レスポンスを示す
});

// ページがアンロードされる時のクリーンアップ
window.addEventListener("beforeunload", () => {
  cleanupAudio();
});

console.log("Offscreen audio controller initialized");
