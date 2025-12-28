import fetch from "node-fetch";
import fs from "fs";

export class EdgeApi {
  constructor() {
    this.clientId = process.env.EDGE_CLIENT_ID;
    this.apiKey = process.env.EDGE_API_KEY;
    this.productId = process.env.EDGE_PRODUCT_ID;
    this.endPoint = "https://api.addons.microsoftedge.microsoft.com";

    if (!this.clientId || !this.apiKey || !this.productId) {
      throw new Error(
        "Missing required Edge Add-ons environment variables: EDGE_CLIENT_ID, EDGE_API_KEY, EDGE_PRODUCT_ID"
      );
    }
  }

  async uploadPackage(zipFilePath) {
    const uploadUrl = `${this.endPoint}/v1/products/${this.productId}/submissions/draft/package`;

    // ファイルの存在確認
    try {
      const stats = await fs.promises.stat(zipFilePath);
      console.log(`File exists: ${zipFilePath}`);
      console.log(`File size: ${stats.size} bytes`);
    } catch (error) {
      throw new Error(`File not found or inaccessible: ${zipFilePath}`);
    }

    const fileData = await fs.promises.readFile(zipFilePath);
    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        Authorization: `ApiKey ${this.apiKey}`,
        "X-ClientID": this.clientId,
        "Content-Type": "application/zip",
      },
      body: fileData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Upload failed (${response.status}): ${errorText}`);
    }

    let operationId = response.headers.get("Location");

    if (!operationId) {
      throw new Error("No operation ID returned from upload");
    }

    return { status: response.status, operationId: operationId };
  }

  async checkUploadStatus(operationId) {
    const statusUrl = `${this.endPoint}/v1/products/${this.productId}/submissions/draft/package/operations/${operationId}`;

    const response = await fetch(statusUrl, {
      method: "GET",
      headers: {
        Authorization: `ApiKey ${this.apiKey}`,
        "X-ClientId": this.clientId,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Status check failed (${response.status}): ${errorText}`);
    }

    return await response.json();
  }

  async publishExtension() {
    const publishUrl = `${this.endPoint}/v1/products/${this.productId}/submissions`;

    console.log("Publishing extension to Edge Add-ons...");
    const response = await fetch(publishUrl, {
      method: "POST",
      headers: {
        Authorization: `ApiKey ${this.apiKey}`,
        "X-ClientId": this.clientId,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Publish failed (${response.status}): ${errorText}`);
    }

    const result = await response.json();
    console.log("Extension published successfully");
    return result;
  }
}
