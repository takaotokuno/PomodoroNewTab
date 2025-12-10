import path from "path";
import { buildConfig } from "../config/build-config.js";

async function buildChrome() {
    const config = buildConfig.chrome;
    const outputDir = config.outputDir;

    try{
        // Clean output directory

        // Copy source files to src subdirectory

        // copy resources

        // Process manifest for chrome
    }catch(e){
        console.error("Chrome Build Failed:", e);
        process.exit(1);
    }
}

buildChrome();