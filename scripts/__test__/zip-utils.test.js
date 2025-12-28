import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreateWriteStream = vi.fn();
const mockArchiver = vi.fn();
const mockArchive = {
  pipe: vi.fn(),
  directory: vi.fn(),
  finalize: vi.fn().mockResolvedValue(),
};

vi.mock("fs", () => ({
  createWriteStream: mockCreateWriteStream,
}));

vi.mock("archiver", () => ({
  default: mockArchiver,
}));

describe("zip-utils", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockArchiver.mockReturnValue(mockArchive);
  });

  describe("createZip", () => {
    it("should create zip file with correct configuration", async () => {
      const { createZip } = await import("../utils/zip-utils.js");

      const mockStream = {};
      mockCreateWriteStream.mockReturnValue(mockStream);

      await createZip("source-dir", "output.zip");

      expect(mockCreateWriteStream).toHaveBeenCalledWith("output.zip");
      expect(mockArchiver).toHaveBeenCalledWith("zip", {
        zlib: { level: 9 },
      });
      expect(mockArchive.directory).toHaveBeenCalledWith("source-dir", false);
    });

    it("should handle archiver errors", async () => {
      const { createZip } = await import("../utils/zip-utils.js");

      mockArchive.finalize.mockRejectedValue(new Error("Archive error"));

      await expect(createZip("source-dir", "output.zip")).rejects.toThrow(
        "Archive error"
      );
    });
  });
});
