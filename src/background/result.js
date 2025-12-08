import Constants from "../constants.js";

export function alertError(err, extra = {}) {
  return {
    success: false,
    severity: Constants.SEVERITY_LEVELS.WARNING,
    error: String(err?.message || err),
    ...extra,
  };
}

export function fatalError(err, extra = {}) {
  return {
    success: false,
    severity: Constants.SEVERITY_LEVELS.FATAL,
    error: String(err?.message || err),
    ...extra,
  };
}

export function isFatal(res) {
  return (
    res?.success === false && res?.severity === Constants.SEVERITY_LEVELS.FATAL
  );
}

export function normalizeResponse(res) {
  if (!res) return { success: true };
  if ("success" in res === false) res.success = true;
  return res;
}
