import { describe, test, expect } from "vitest";
import {
  alertError,
  fatalError,
  normalizeResponse,
  isFatal,
} from "@/background/result.js";
import Constants from "@/constants.js";
const { SEVERITY_LEVELS } = Constants;

describe("Result Module", () => {
  test("normalizeResponse should return success true for undefined", () => {
    const res = normalizeResponse(undefined);
    expect(res).toEqual({ success: true });
  });

  test("normalizeResponse should return success true for empty object", () => {
    const res = normalizeResponse({});
    expect(res).toEqual({ success: true });
  });

  test("fatalError should return fatal error object", () => {
    const error = new Error("Test fatal error");
    const res = fatalError(error, { step: "testStep" });
    expect(res).toEqual({
      success: false,
      severity: SEVERITY_LEVELS.FATAL,
      error: "Test fatal error",
      step: "testStep",
    });
  });

  test("alertError should return alert error object", () => {
    const error = new Error("Test alert error");
    const res = alertError(error, { step: "testStep" });
    expect(res).toEqual({
      success: false,
      severity: SEVERITY_LEVELS.WARNING,
      error: "Test alert error",
      step: "testStep",
    });
  });

  test("isFatal should identify fatal errors", () => {
    const fatalRes = {
      success: false,
      severity: SEVERITY_LEVELS.FATAL,
      error: "Fatal error",
    };
    const alertRes = {
      success: false,
      severity: SEVERITY_LEVELS.ALERT,
      error: "Alert error",
    };
    const successRes = { success: true };
    expect(isFatal(fatalRes)).toBe(true);
    expect(isFatal(alertRes)).toBe(false);
    expect(isFatal(successRes)).toBe(false);
  });
});
