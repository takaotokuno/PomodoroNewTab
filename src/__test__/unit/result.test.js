import { describe, test, expect } from "vitest";
import {
  createErrObject,
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

  test("createErrObject should return fatal error object when isFatal is true", () => {
    const error = new Error("Test fatal error");
    const res = createErrObject(error, true);
    expect(res).toEqual({
      success: false,
      severity: SEVERITY_LEVELS.FATAL,
      error: "Test fatal error",
    });
  });

  test("createErrObject should return warning error object when isFatal is false", () => {
    const error = new Error("Test warning error");
    const res = createErrObject(error, false);
    expect(res).toEqual({
      success: false,
      severity: SEVERITY_LEVELS.WARNING,
      error: "Test warning error",
    });
  });

  test("isFatal should identify fatal errors", () => {
    const fatalRes = {
      success: false,
      severity: SEVERITY_LEVELS.FATAL,
      error: "Fatal error",
    };
    const warningRes = {
      success: false,
      severity: SEVERITY_LEVELS.WARNING,
      error: "Warning error",
    };
    const successRes = { success: true };
    expect(isFatal(fatalRes)).toBe(true);
    expect(isFatal(warningRes)).toBe(false);
    expect(isFatal(successRes)).toBe(false);
  });
});
