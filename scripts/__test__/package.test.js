import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAccess = vi.fn().mockResolvedValue();
const mockMkdir = vi.fn().mockResolvedValue();
const mockReadFile = vi.fn();
const mockCreateZip = vi.fn().mockResolvedValue();

vi.mock("fs/promises", () => ({
  default: {
    access: mockAccess,
    mkdir: mockMkdir,
    readFile: mockReadFile,
  },
}));

vi.mock("../utils/zip-utils.js", () => ({
  createZip: mockCreateZip,
}));

describe("package.js", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should call file operations with correct arguments", async () => {
    const mockPackageJson = {
      name: "test-extension",
      version: "1.2.3",
    };

    mockReadFile.mockResolvedValue(JSON.stringify(mockPackageJson));

    // packageExtension関数を動的にインポート
    await import("../package.js");

    const expectedZipPath = "dist/packages/test-extension-v1.2.3.zip";
    expect(mockCreateZip).toHaveBeenCalledWith("dist/latest", expectedZipPath);
  });
});
