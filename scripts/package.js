import fs from "fs/promises";
import { createZip } from "./utils/zip-utils.js";

async function packageExtension() {
  const inputDir = "dist/latest";
  const outputDir = "dist/packages";
  try {
    await fs.access(inputDir);
    await fs.mkdir(outputDir, { recursive: true });

    const packageJson = JSON.parse(await fs.readFile("package.json", "utf-8"));
    const name = packageJson.name;
    const version = packageJson.version;

    const zipFilePath = `${outputDir}/${name}-v${version}.zip`;

    await createZip(inputDir, zipFilePath);
  } catch (e) {
    console.error("Packaging Failed:", e);
    process.exit(1);
  }
}

packageExtension();
