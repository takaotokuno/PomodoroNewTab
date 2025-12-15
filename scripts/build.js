import path from "path";
import { buildConfig } from "./config/build-config.js";
import { cleanDirectory, copyFile, copyDirectory } from "./config/file-utils.js";

async function buildChrome() {
    const arg = process.argv.find(arg => arg.startsWith("--browser="));
    const browser = arg ? arg.split("=")[1] : "chrome";

    const browserConfig = buildConfig[browser];
    const commonConfig = buildConfig.common;
    const outputDir = browserConfig.outputDir;

    try{
        await cleanDirectory(outputDir);

        await copyDirectory(commonConfig.sourceDir, path.join(outputDir, "src"), commonConfig.excludePatterns);

        await copyDirectory(commonConfig.resourcesDir, path.join(outputDir, "resources"), commonConfig.excludePatterns);

        await copyFile(commonConfig.manifestFile, path.join(outputDir, commonConfig.manifestFile));

    }catch(e){
        console.error("Build Failed:", e);
        process.exit(1);
    }
}

buildChrome();