export class BGClient {
  async update() {
    return this._send("timer/update");
  }
  async start(minutes) {
    if (
      typeof minutes !== "number" ||
      isNaN(minutes) ||
      minutes < 5 ||
      minutes > 300
    ) {
      throw new Error("Invalid minutes");
    }
    return this._send("timer/start", { minutes });
  }
  async pause() {
    return this._send("timer/pause");
  }
  async resume() {
    return this._send("timer/resume");
  }
  async reset() {
    return this._send("timer/reset");
  }

  async saveSoundSettings(payload) {
    return this._send("sound/save", payload);
  }

  async _send(type, payload = {}) {
    try {
      const res = await chrome.runtime.sendMessage({ type, ...payload });
      if (res === void 0) {
        throw new Error("No response from background");
      }
      if (!res?.success) {
        let errorMsg = "An unexpected error occurred in the background";
        if (res?.error) {
          errorMsg = res.error;
        }
        alert(errorMsg);
      }
      return res;
    } catch (error) {
      alert("Error communicating with background: " + error.message);
    }
  }
}
