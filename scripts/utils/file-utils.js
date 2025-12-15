import fs from "fs/promises";
import path from "path";
import picomatch from "picomatch";

export async function cleanDirectory(dirPath) {
  await fs.rm(dirPath, { recursive: true, force: true });
  await fs.mkdir(dirPath, { recursive: true });
}

export async function copyFile(src, dest) {
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.copyFile(src, dest);
}

export async function copyDirectory(src, dest, excludePatterns = []) {
  await fs.mkdir(dest, { recursive: true });

  const isExcluded =
    excludePatterns.length > 0
      ? picomatch(excludePatterns, { dot: true })
      : () => false;

  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    const relPath = path.relative(src, srcPath).split(path.sep).join("/");
    if (isExcluded(relPath)) continue;

    if (entry.isDirectory()) {
      await copyDirectory(srcPath, destPath, excludePatterns);
    } else if (entry.isFile()) {
      await fs.copyFile(srcPath, destPath);
    }
  }
}
