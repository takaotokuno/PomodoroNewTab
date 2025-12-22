import { EdgeApi } from "./utils/edge-api.js";

async function main() {
  try {
    const api = new EdgeApi();
    await api.publishExtension();
    
  } catch (error) {
    console.error("Error during Edge Add-ons publish:", error.message);
    process.exit(1);
  }
}

main();