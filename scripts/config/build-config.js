export const buildConfig = {
  chrome: {
    outputDir: "dist/chrome",
    storeMetadata: {
      category: "Productivity",
      language: "ja",
    },
  },
  edge: {
    outputDir: "dist/edge",
    storeMetadata: {
      category: "ProductivityTools",
      language: "ja",
    },
  },
  common: {
    sourceDir: "src",
    resourcesDir: "resources",
    manifestVersion: 3,
    manifestFile: "manifest.json",
    excludePatterns: ["**/__test__/**", "**/*.test.js", "coverage/**"],
  },
};

