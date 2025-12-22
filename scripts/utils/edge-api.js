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
    
    // ファイルの存在とサイズを確認
    try {
      const stats = await fs.promises.stat(zipFilePath);
      console.log(`File exists: ${zipFilePath}`);
      console.log(`File size: ${stats.size} bytes`);
    } catch (error) {
      throw new Error(`File not found or inaccessible: ${zipFilePath}`);
    }
    
    const fileData = await fs.promises.readFile(zipFilePath);

    console.log(`Uploading package to Edge Add-ons: ${zipFilePath}`);
    console.log(`Upload URL: ${uploadUrl}`);
    console.log(`File data length: ${fileData.length} bytes`);
    
    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        Authorization: `ApiKey ${this.apiKey}`,
        "X-ClientId": this.clientId,
        "Content-Type": "application/zip",
      },
      body: fileData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`Upload failed with status ${response.status}`);
      console.log(`Error response: ${errorText}`);
      throw new Error(`Upload failed (${response.status}): ${errorText}`);
    }

    console.log(`Upload successful with status ${response.status}`);
    
    // デバッグ用：すべてのレスポンスヘッダーを出力
    console.log("Response headers:");
    for (const [key, value] of response.headers.entries()) {
      console.log(`  ${key}: ${value}`);
    }

    // 複数の可能性のあるヘッダー名を試す
    let operationId = response.headers.get("operationID") || 
                     response.headers.get("operation-id") ||
                     response.headers.get("Location") ||
                     response.headers.get("Operation-Location");
    
    // LocationヘッダーからOperation IDを抽出する場合
    if (operationId && operationId.includes('/operations/')) {
      const match = operationId.match(/operations\/([^\/]+)/);
      if (match) {
        operationId = match[1];
      }
    }

    if (!operationId) {
      throw new Error("No operation ID returned from upload");
    }

    console.log(`OPERATION_ID=${operationId}`);
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
