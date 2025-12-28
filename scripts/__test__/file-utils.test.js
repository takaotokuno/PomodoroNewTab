import { describe, it, expect, vi, beforeEach } from "vitest";
import path from "path";

const mockRm = vi.fn();
const mockMkdir = vi.fn();
const mockCopyFile = vi.fn();
const mockReaddir = vi.fn();

vi.mock("fs/promises", () => ({
  default: {
    rm: mockRm,
    mkdir: mockMkdir,
    copyFile: mockCopyFile,
    readdir: mockReaddir,
  },
}));

vi.mock("picomatch", () => ({
  default: vi.fn((patterns) => (filePath) => patterns.includes(filePath)),
}));

describe("file-utils", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe("cleanDirectory", () => {
    it("should remove and recreate directory", async () => {
      const { cleanDirectory } = await import("../utils/file-utils.js");

      await cleanDirectory("test-dir");

      expect(mockRm).toHaveBeenCalledWith("test-dir", {
        recursive: true,
        force: true,
      });
      expect(mockMkdir).toHaveBeenCalledWith("test-dir", { recursive: true });
    });
  });

  describe("copyFile", () => {
    it("should create destination directory and copy file", async () => {
      const { copyFile } = await import("../utils/file-utils.js");

      await copyFile("src/file.txt", "dest/file.txt");

      expect(mockMkdir).toHaveBeenCalledWith("dest", { recursive: true });
      expect(mockCopyFile).toHaveBeenCalledWith(
        "src/file.txt",
        "dest/file.txt"
      );
    });
  });

  describe("copyDirectory", () => {
    it("should copy directory without exclusions", async () => {
      const { copyDirectory } = await import("../utils/file-utils.js");

      mockReaddir.mockResolvedValue([
        { name: "file1.txt", isDirectory: () => false, isFile: () => true },
      ]);

      await copyDirectory("src", "dest");

      expect(mockCopyFile).toHaveBeenCalledWith(
        path.join("src", "file1.txt"),
        path.join("dest", "file1.txt")
      );
    });

    it("should exclude files matching patterns", async () => {
      const { copyDirectory } = await import("../utils/file-utils.js");

      mockReaddir.mockResolvedValue([
        { name: "file1.txt", isDirectory: () => false, isFile: () => true },
        { name: "excluded.log", isDirectory: () => false, isFile: () => true },
      ]);

      await copyDirectory("src", "dest", ["excluded.log"]);

      expect(mockCopyFile).toHaveBeenCalledTimes(1);
      expect(mockCopyFile).toHaveBeenCalledWith(
        path.join("src", "file1.txt"),
        path.join("dest", "file1.txt")
      );
    });
  });
});
