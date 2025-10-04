import Constants from "../constants.js";
const { DURATIONS, SESSION_TYPES } = Constants;

export class TimerTicker {
  constructor(uiController) {
    this.uiController = uiController;

    this.interval = null;

    this.sessionType = null; // 'work' or 'break'
    this.timeTotalMs = 0;
    this.timeSessionMs = 0;

    this.timeTotalView = document.getElementById("time-total");
    this.timeSessionLabel = document.getElementById("time-session-label");
    this.timeSessionView = document.getElementById("time-session");
  }

  start(minutes) {
    if (!minutes || minutes < 0) throw new Error("Invalid minutes");
    this.timeTotalMs = minutes * 60 * 1000;
    this.timeSessionMs = Math.min(this.timeTotalMs, DURATIONS.WORK_SESSION);
    this.resume();
  }

  resume() {
    this.stop();
    this.interval = setInterval(() => this.tick(), 1000);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  applyBG(sessionType, timeTotalMs, timeSessionMs) {
    this.timeSessionLabel.textContent =
      sessionType === SESSION_TYPES.WORK ? "Working" : "Break time";
    this.sessionType = sessionType;
    this.timeTotalMs = timeTotalMs;
    this.timeSessionMs = timeSessionMs;
    this.render();
  }

  async informTimeOut() {
    await this.uiController.syncFromBG();
  }

  async tick() {
    this.timeTotalMs -= 1000;
    this.timeSessionMs -= 1000;

    if (this.timeTotalMs <= 0 || this.timeSessionMs <= 0) {
      await this.informTimeOut();
    }

    if (this.timeTotalMs < 0) this.timeTotalMs = 0;
    if (this.timeSessionMs < 0) this.timeSessionMs = 0;

    this.render();
  }

  render() {
    this.renderElm(this.timeTotalMs, this.timeTotalView);
    this.renderElm(this.timeSessionMs, this.timeSessionView);
  }

  renderElm(ms, elm) {
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);

    const m_str = String(m).padStart(2, "0");
    const s_str = String(s).padStart(2, "0");

    elm.textContent = `${m_str}:${s_str}`;
  }
}
