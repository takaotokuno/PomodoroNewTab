import { createWriteStream } from "fs";
import archiver from "archiver";

export async function createZip(sourceDir, outputPath) {
  const output = createWriteStream(outputPath);
  const archive = archiver("zip", {
    zlib: { level: 9 },
  });

  archive.pipe(output);
  archive.directory(sourceDir, false);
  await archive.finalize();
}
