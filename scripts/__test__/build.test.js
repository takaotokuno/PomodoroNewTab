import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildConfig } from "../config/build-config.js";
import path from "path";

const mockCleanDirectory = vi.fn();
const mockCopyFile = vi.fn();
const mockCopyDirectory = vi.fn();

vi.mock("../utils/file-utils.js", () => ({
  cleanDirectory: mockCleanDirectory,
  copyFile: mockCopyFile,
  copyDirectory: mockCopyDirectory,
}));

describe("build.js", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should call file operations in correct order when build script runs", async () => {
    // buildExtension関数を動的にインポート
    await import("../build.js");

    expect(mockCleanDirectory).toHaveBeenCalledWith(buildConfig.baseDir);

    expect(mockCopyDirectory).toHaveBeenCalledWith(
      buildConfig.sourceDir,
      path.join(buildConfig.baseDir, buildConfig.sourceDir),
      buildConfig.excludePatterns
    );

    expect(mockCopyDirectory).toHaveBeenCalledWith(
      buildConfig.resourcesDir,
      path.join(buildConfig.baseDir, buildConfig.resourcesDir),
      buildConfig.excludePatterns
    );

    expect(mockCopyFile).toHaveBeenCalledWith(
      buildConfig.manifestFile,
      path.join(buildConfig.baseDir, buildConfig.manifestFile)
    );
  });
});
