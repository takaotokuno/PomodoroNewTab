import { readFileSync } from "fs";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const isBeta = process.argv.includes("--beta");
const packageJsonPath = join(__dirname, "../package.json");

const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
const version = packageJson.version;

const tagName = isBeta ? `v${version}-beta` : `v${version}`;

let exists = false;
try {
  execSync(`git rev-parse ${tagName}`, { stdio: "ignore" });
  exists = true;
} catch {
  // empty
}

if (exists) {
  console.error(`タグ '${tagName}' は既に存在します。`);
  process.exit(1);
}

execSync(`git tag -a ${tagName} -m "Release ${tagName}"`);

console.log(`タグ '${tagName}' を作成しました。`);
