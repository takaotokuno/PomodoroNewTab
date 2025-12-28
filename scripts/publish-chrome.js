import fetch from "node-fetch";
import fs from "fs";

class ChromePublisher {
  constructor() {
    this.isBeta = process.env.IS_BETA === "true";
    this.cliendtId = process.env.CHROME_CLIENT_ID;
    this.clientSecret = process.env.CHROME_CLIENT_SECRET;
    this.refreshToken = process.env.CHROME_REFRESH_TOKEN;
    this.extensionId = process.env.CHROME_EXTENSION_ID;
    this.baseUrl = "https://www.googleapis.com/";
    this.accessToken = null;
  }

  async authenticate() {
    if (!this.cliendtId || !this.clientSecret || !this.refreshToken) {
      throw new Error("Missing authentication environment variables.");
    }

    const tokenUrl = "https://oauth2.googleapis.com/token";
    const tokenData = {
      client_id: this.cliendtId,
      client_secret: this.clientSecret,
      refresh_token: this.refreshToken,
      grant_type: "refresh_token",
    };

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tokenData),
    });
    const data = await response.json();
    this.accessToken = data.access_token;
  }

  async uploadPachage(zipFilePath) {
    if (!this.accessToken) {
      throw new Error("Not authenticated. Call authenticate() first.");
    }

    if (!this.extensionId) {
      throw new Error("Missing extension ID environment variable.");
    }

    const uploadUrl = `${this.baseUrl}upload/chromewebstore/v1.1/items/${this.extensionId}`;
    const fileData = await fs.promises.readFile(zipFilePath);

    const response = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "x-goog-api-version": "2",
        "Content-Type": "application/zip",
      },
      body: fileData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Upload failed: ${errorData.error.message}`);
    }

    const result = await response.json();
    if (result.uploadState !== "SUCCESS") {
      throw new Error(`Upload failed: ${result.uploadState}`);
    }

    return result;
  }

  async publishExtension() {
    if (!this.accessToken) {
      throw new Error("Not authenticated. Call authenticate() first.");
    }
    if (!this.extensionId) {
      throw new Error("Missing extension ID environment variable.");
    }

    const publishUrl = `${this.baseUrl}chromewebstore/v1.1/items/${this.extensionId}/publish`;
    const response = await fetch(publishUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "x-goog-api-version": "2",
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Publish failed: ${errorData.error.message}`);
    }

    const result = await response.json();
    if (result.status[0] !== "OK") {
      throw new Error(`Publish failed: ${result.status.join(", ")}`);
    }

    return result;
  }
}

async function publishToChromeStore() {
  const publisher = new ChromePublisher();
  try {
    await publisher.authenticate();
    await publisher.uploadPachage("path/to/your/extension.zip");
    await publisher.publishExtension();
  } catch (e) {
    console.error("Error during publishing:", e.message);
  }
}

publishToChromeStore();
