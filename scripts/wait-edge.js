import { EdgeApi } from "./utils/edge-api.js";

async function waitForUploadCompletion(api, operationId, maxWaitTime = 600000) {
  // 10分
  const startTime = Date.now();
  const pollInterval = 10000; // 10秒

  console.log("Waiting for upload processing to complete...");

  while (Date.now() - startTime < maxWaitTime) {
    const status = await api.checkUploadStatus(operationId);

    console.log(`Upload status: ${status.status}`);

    if (status.status === "Succeeded") {
      console.log("Upload processing completed successfully");
      return status;
    }

    if (status.status === "Failed") {
      console.log("Upload Failed");
      console.log("status message: " + status.message);
      console.log("error code" + status.errorCode);

      console.log(
        "errors: " + status.errors.map((e) => JSON.stringify(e)).join(",")
      );

      throw new Error(
        `Upload processing failed: ${status.message || "Unknown error"}`
      );
    }

    if (status.status === "InProgress") {
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
      continue;
    }

    // 予期しないステータス
    throw new Error(`Unexpected upload status: ${status.status}`);
  }

  throw new Error("Upload processing timed out");
}

async function main() {
  const operationId = process.argv[2];

  if (!operationId) {
    console.error("Usage: node wait-edge.js <operation-id>");
    process.exit(1);
  }

  try {
    const api = new EdgeApi();
    await waitForUploadCompletion(api, operationId);
  } catch (error) {
    console.error("Error waiting for Edge Add-ons upload:", error.message);
    process.exit(1);
  }
}

main();
