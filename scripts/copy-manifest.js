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
function authorizeAppScopes() { return globalThis.authorizeAppScopes ? globalThis.authorizeAppScopes() : null; }
function doGet(e) { return globalThis.doGet ? globalThis.doGet(e) : null; }
function onOpen(e) { return globalThis.onOpen ? globalThis.onOpen(e) : null; }
function openSidebar() { return globalThis.openSidebar ? globalThis.openSidebar() : null; }
function openModal() { return globalThis.openModal ? globalThis.openModal() : null; }
function getUserInfo() { return globalThis.getUserInfo(); }
function setupDriveWorkspace(parentFolderId) { return globalThis.setupDriveWorkspace(parentFolderId); }
function createWebAppLinkLaunchers(parentFolderId) { return globalThis.createWebAppLinkLaunchers ? globalThis.createWebAppLinkLaunchers(parentFolderId) : null; }
function listAvailableDriveSheets(parentFolderId) { return globalThis.listAvailableDriveSheets ? globalThis.listAvailableDriveSheets(parentFolderId) : []; }
function getMasterRegistryData(isDevMode) { return globalThis.getMasterRegistryData ? globalThis.getMasterRegistryData(isDevMode) : { members: [], exceptions: [] }; }
function getIntakeData(spreadsheetUrlOrId, masterRegistryUrlOrId, providedMembers, providedExceptions) { return globalThis.getIntakeData(spreadsheetUrlOrId, masterRegistryUrlOrId, providedMembers, providedExceptions); }
function loadExistingScheduleFromSheet(spreadsheetId, tabName) { return globalThis.loadExistingScheduleFromSheet(spreadsheetId, tabName); }
function solveSchedule(mealDates, responses, exceptions, options) { return globalThis.solveSchedule(mealDates, responses, exceptions, options); }
function setMemberActiveStatus(name, active, masterSheetId, isDevMode) { return globalThis.setMemberActiveStatus(name, active, masterSheetId, isDevMode); }
function addCommunityMember(member, masterSheetId, isDevMode) { return globalThis.addCommunityMember(member, masterSheetId, isDevMode); }
function updateCommunityMember(originalName, updatedMember, masterSheetId, isDevMode) { return globalThis.updateCommunityMember ? globalThis.updateCommunityMember(originalName, updatedMember, masterSheetId, isDevMode) : null; }
function linkMemberAlias(canonicalName, aliasName, aliasEmail, masterSheetId, isDevMode) { return globalThis.linkMemberAlias ? globalThis.linkMemberAlias(canonicalName, aliasName, aliasEmail, masterSheetId, isDevMode) : null; }
function bulkSaveCommunityMembers(newMembers, masterSheetId, isDevMode) { return globalThis.bulkSaveCommunityMembers ? globalThis.bulkSaveCommunityMembers(newMembers, masterSheetId, isDevMode) : newMembers; }
function saveExceptionRule(rule, masterSheetId, isDevMode) { return globalThis.saveExceptionRule(rule, masterSheetId, isDevMode); }
function deleteExceptionRule(ruleIdOrIndex, masterSheetId, isDevMode) { return globalThis.deleteExceptionRule(ruleIdOrIndex, masterSheetId, isDevMode); }
function exportScheduleToSheet(spreadsheetId, scheduleOutput) { return globalThis.exportScheduleToSheet(spreadsheetId, scheduleOutput); }
function sendScheduleEmail(payload) { return globalThis.sendScheduleEmail(payload); }
function scanHistoricalFolder(folderId) { return globalThis.scanHistoricalFolder ? globalThis.scanHistoricalFolder(folderId) : null; }
function importHistoricalMonths(sourceHistoricalFolderId, targetEnv, targetRootFolderId) { return globalThis.importHistoricalMonths ? globalThis.importHistoricalMonths(sourceHistoricalFolderId, targetEnv, targetRootFolderId) : null; }
function getHistoricalCommunityReports(activeSpreadsheetId, selectedMonths) { return globalThis.getHistoricalCommunityReports ? globalThis.getHistoricalCommunityReports(activeSpreadsheetId, selectedMonths) : null; }
function getAvailableScheduleTabs(spreadsheetIdOrUrl) { return globalThis.getAvailableScheduleTabs ? globalThis.getAvailableScheduleTabs(spreadsheetIdOrUrl) : []; }
function getMealSignupWorkbookInfo(targetSpreadsheetId, defaultMonthTab) { return globalThis.getMealSignupWorkbookInfo ? globalThis.getMealSignupWorkbookInfo(targetSpreadsheetId, defaultMonthTab) : null; }
function exportToMealSignupWorkbook(targetSpreadsheetId, sourceScheduleOrSheetId, options) { return globalThis.exportToMealSignupWorkbook ? globalThis.exportToMealSignupWorkbook(targetSpreadsheetId, sourceScheduleOrSheetId, options) : null; }
function getSurveyFormDatesPreview(monthKey) { return globalThis.getSurveyFormDatesPreview ? globalThis.getSurveyFormDatesPreview(monthKey) : null; }
function createMonthlySurveyForm(payload) { return globalThis.createMonthlySurveyForm ? globalThis.createMonthlySurveyForm(payload) : null; }
function runHistoricalImportOnce() { return globalThis.runHistoricalImportOnce ? globalThis.runHistoricalImportOnce() : null; }
function dumpHistoricalRawDataOnly() { return globalThis.dumpHistoricalRawDataOnly ? globalThis.dumpHistoricalRawDataOnly() : null; }
function updateUserGuideDoc(docId) { return globalThis.updateUserGuideDoc ? globalThis.updateUserGuideDoc(docId) : null; }
`;
  fs.appendFileSync(codeDest, gasStubs, "utf8");
  console.log("✓ Appended top-level GAS entrypoint functions to dist/Code.js");
}
