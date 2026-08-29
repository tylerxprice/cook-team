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

// Append top-level GAS entrypoints so Apps Script exposes them to google.script.run
const codeDest = path.resolve(distDir, "Code.js");
if (fs.existsSync(codeDest)) {
  const gasStubs = `
// Top-level function declarations for Google Apps Script AST scanner & google.script.run
function doGet(e) { return globalThis.doGet ? globalThis.doGet(e) : null; }
function onOpen(e) { return globalThis.onOpen ? globalThis.onOpen(e) : null; }
function openSidebar() { return globalThis.openSidebar ? globalThis.openSidebar() : null; }
function openModal() { return globalThis.openModal ? globalThis.openModal() : null; }
function getUserInfo() { return globalThis.getUserInfo(); }
function setupDriveWorkspace(parentFolderId) { return globalThis.setupDriveWorkspace(parentFolderId); }
function listAvailableDriveSheets(parentFolderId) { return globalThis.listAvailableDriveSheets ? globalThis.listAvailableDriveSheets(parentFolderId) : []; }
function getIntakeData(spreadsheetUrlOrId, masterRegistryUrlOrId) { return globalThis.getIntakeData(spreadsheetUrlOrId, masterRegistryUrlOrId); }
function solveSchedule(mealDates, responses, exceptions, options) { return globalThis.solveSchedule(mealDates, responses, exceptions, options); }
function setMemberActiveStatus(name, active, masterSheetId) { return globalThis.setMemberActiveStatus(name, active, masterSheetId); }
function addCommunityMember(member, masterSheetId) { return globalThis.addCommunityMember(member, masterSheetId); }
function saveExceptionRule(rule, masterSheetId) { return globalThis.saveExceptionRule(rule, masterSheetId); }
function exportScheduleToSheet(spreadsheetId, scheduleOutput) { return globalThis.exportScheduleToSheet(spreadsheetId, scheduleOutput); }
`;
  fs.appendFileSync(codeDest, gasStubs, "utf8");
  console.log("✓ Appended top-level GAS entrypoint functions to dist/Code.js");
}
