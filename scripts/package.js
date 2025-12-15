import fs from "fs/promises";
import { createZip } from "./config/zip-utils";

async function pachageExtension() {
    const arg = process.argv.find(arg => arg.startsWith("--browser="));
    const browser = arg ? arg.split("=")[1] : "chrome";
    const outputDir = "dist/packages";
    try{
        await fs.mkdir(outputDir, { recursive: true });
        const packageJson = JSON.parse(await fs.readFile("package.json", "utf-8"));
        const name = packageJson.name;
        const version = packageJson.version;

        const zipFileName = `${name}-${browser}-v${version}.zip`;
        const zipFilePath = `${outputDir}/${zipFileName}`;
        await createZip("dist/extension", zipFilePath);
    } catch(e){
        console.error("Packaging Failed:", e);
        process.exit(1);
    }
}

pachageExtension();