import path from "path";
import { build } from "esbuild";
import { buildConfig } from "./config/build-config.js";
import { cleanDirectory, copyFile, copyDirectory } from "./utils/file-utils.js";

async function buildExtension() {
  const outputDir = buildConfig.baseDir;

  try {
    await cleanDirectory(outputDir);

    // Bundle background script with dependencies
    await build({
      entryPoints: ["src/background/index.js"],
      bundle: true,
      format: "esm",
      outfile: path.join(outputDir, "src/background/index.js"),
      platform: "browser",
      target: "chrome88",
      external: ["chrome"],
    });

    // Copy other files (excluding bundled background files)
    await copyDirectory(
      buildConfig.sourceDir,
      path.join(outputDir, buildConfig.sourceDir),
      [...buildConfig.excludePatterns, "**/background/**"]
    );

    await copyDirectory(
      buildConfig.resourcesDir,
      path.join(outputDir, buildConfig.resourcesDir),
      buildConfig.excludePatterns
    );

    await copyFile(
      buildConfig.manifestFile,
      path.join(outputDir, buildConfig.manifestFile)
    );
  } catch (e) {
    console.error("Build Failed:", e);
    process.exit(1);
  }
}

buildExtension();
