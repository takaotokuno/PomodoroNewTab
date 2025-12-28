import { describe, it, expect, vi, beforeEach } from "vitest";

const mockReadFileSync = vi.fn();
const mockExecSync = vi.fn();

vi.mock("fs", () => ({
  readFileSync: mockReadFileSync,
}));

vi.mock("child_process", () => ({
  execSync: mockExecSync,
}));

describe("tag.js", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("should call file and git operations with correct arguments for normal release", async () => {
    process.argv = ["node", "tag.js"];

    const mockPackageJson = {
      version: "1.2.3",
    };
    mockReadFileSync.mockReturnValue(JSON.stringify(mockPackageJson));

    // 1回目のコマンド実行（git rev-parse）でエラーを発生させる（タグが存在しない場合）
    mockExecSync.mockImplementationOnce(() => {
      throw new Error("Tag not found");
    });

    // tag.jsを動的にインポートして実行
    await import("../tag.js");

    // git rev-parseが正しいタグ名で呼ばれることを確認
    expect(mockExecSync).toHaveBeenCalledWith("git rev-parse v1.2.3", {
      stdio: "ignore",
    });

    // git tagが正しい引数で呼ばれることを確認
    expect(mockExecSync).toHaveBeenCalledWith(
      'git tag -a v1.2.3 -m "Release v1.2.3"'
    );
  });

  it("should handle existing tag and exit", async () => {
    vi.spyOn(process, "exit").mockImplementationOnce(() => {
      throw new Error("EXIT");
    });

    await expect(import("../tag.js")).rejects.toThrow("EXIT");

    // git rev-parseが1回だけ呼ばれることを確認（タグ存在チェック）
    expect(mockExecSync).toHaveBeenCalledTimes(1);
  });

  it("creates a beta release tag when --beta flag is provided", async () => {
    process.argv = ["node", "tag.js", "--beta"];

    const mockPackageJson = {
      version: "1.2.3",
    };
    mockReadFileSync.mockReturnValue(JSON.stringify(mockPackageJson));

    mockExecSync.mockImplementationOnce(() => {
      throw new Error("Tag not found");
    });

    await import("../tag.js");

    expect(mockExecSync).toHaveBeenCalledWith(
      'git tag -a v1.2.3-beta -m "Release v1.2.3-beta"'
    );
  });
});
