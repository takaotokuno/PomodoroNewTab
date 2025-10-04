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

  async _send(type, payload = {}) {
    try {
      const res = await chrome.runtime.sendMessage({ type, ...payload });
      if (!res?.success) throw new Error(res?.error || "Background error");
      return res;
    } catch (e) {
      console.warn("Background message failed:", e);
    }
  }
}
