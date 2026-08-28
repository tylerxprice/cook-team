import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, "..");
const distDir = path.resolve(rootDir, "dist");

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Copy appsscript.json into dist/
const manifestSrc = path.resolve(rootDir, "appsscript.json");
const manifestDest = path.resolve(distDir, "appsscript.json");

if (fs.existsSync(manifestSrc)) {
  fs.copyFileSync(manifestSrc, manifestDest);
  console.log("✓ Copied appsscript.json to dist/");
} else {
  console.warn("⚠️ appsscript.json not found in root!");
}
