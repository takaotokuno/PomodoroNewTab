import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { buildConfig } from "../config/build-config.js";
import path from "path";

const mockCleanDirectory = vi.fn();
const mockCopyFile = vi.fn();
const mockCopyDirectory = vi.fn();
const mockBuild = vi.fn();

vi.mock("../utils/file-utils.js", () => ({
  cleanDirectory: mockCleanDirectory,
  copyFile: mockCopyFile,
  copyDirectory: mockCopyDirectory,
}));

vi.mock("esbuild", () => ({
  build: mockBuild,
}));

describe("build.js", () => {
  let mockExit;
  let mockConsoleError;

  beforeEach(() => {
    vi.clearAllMocks();
    mockBuild.mockResolvedValue({});
    mockExit = vi.spyOn(process, "exit").mockImplementation(() => {});
    mockConsoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    mockExit.mockRestore();
    mockConsoleError.mockRestore();
    vi.resetModules();
  });

  it("should call esbuild and file operations in correct order when build script runs", async () => {
    // buildExtension関数を動的にインポート
    await import("../build.js");

    expect(mockCleanDirectory).toHaveBeenCalledWith(buildConfig.baseDir);

    expect(mockBuild).toHaveBeenCalledWith({
      entryPoints: ["src/background/index.js"],
      bundle: true,
      format: "esm",
      outfile: path.join(buildConfig.baseDir, "src/background/index.js"),
      platform: "browser",
      target: "chrome88",
      external: ["chrome"],
    });

    expect(mockCopyDirectory).toHaveBeenCalledWith(
      buildConfig.sourceDir,
      path.join(buildConfig.baseDir, buildConfig.sourceDir),
      [...buildConfig.excludePatterns, "**/background/**"]
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

  it("should handle esbuild errors and exit process", async () => {
    const buildError = new Error("esbuild failed");
    mockBuild.mockRejectedValue(buildError);

    await import("../build.js");

    expect(mockConsoleError).toHaveBeenCalledWith("Build Failed:", buildError);
    expect(mockExit).toHaveBeenCalledWith(1);
  });
});
