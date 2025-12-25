import { EdgeApi } from "./utils/edge-api.js";

async function main() {
  const zipPath = process.argv[2];

  if (!zipPath) {
    console.error("Usage: node upload-edge.js <zip-file-path>");
    process.exit(1);
  }

  try {
    const api = new EdgeApi();
    const result = await api.uploadPackage(zipPath);

    console.log(`OPERATION_ID=${result.operationId}`);
  } catch (error) {
    console.error("Error during Edge Add-ons upload:", error.message);
    process.exit(1);
  }
}

main();
