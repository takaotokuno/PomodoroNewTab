import Constants from "../constants.js";

export function createErrObject(err, isFatal) {
  const sev = isFatal
    ? Constants.SEVERITY_LEVELS.FATAL
    : Constants.SEVERITY_LEVELS.WARNING;
  return {
    success: false,
    severity: sev,
    error: String(err?.message || err),
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
