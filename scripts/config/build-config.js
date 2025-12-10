export const buildConfig = {
  chrome: {
    manifestVersion: 3,
    outputDir: "dist/chrome",
    excludeFiles: ["*.map", "test/**", "__test__/**", "**/*.test.js", "coverage/**"],
    storeMetadata: {
      category: "Productivity",
      language: "ja",
    },
  },
  edge: {
    manifestVersion: 3,
    outputDir: "dist/edge",
    excludeFiles: ["*.map", "test/**", "__test__/**", "**/*.test.js", "coverage/**"],
    storeMetadata: {
      category: "ProductivityTools",
      language: "ja",
    },
  },
  common: {
    sourceDir: "src",
    resourcesDir: "resources",
    manifestFile: "manifest.json",
  },
};

