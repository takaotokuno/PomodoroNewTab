module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "subject-case": [2, "never", ["sentence-case"]], // 先頭大文字禁止
    "header-max-length": [2, "always", 72],          // 72文字制限
    "type-enum": [2, "always", [
      "feat", "fix", "docs", "style", "refactor", "test", "chore",
      "wip",     // 独自追加：作業途中
      "release"  // 独自追加：リリース用
    ]],
  }
};
//test:2