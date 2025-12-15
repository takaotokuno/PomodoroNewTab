import path from "path";
import { buildConfig } from "./config/build-config.js";
import {
  cleanDirectory,
  copyFile,
  copyDirectory,
} from "./config/file-utils.js";

async function build() {
  const outputDir = buildConfig.baseDir;

  try {
    await cleanDirectory(outputDir);

    await copyDirectory(
      buildConfig.sourceDir,
      path.join(outputDir, buildConfig.sourceDir),
      buildConfig.excludePatterns
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

build();
