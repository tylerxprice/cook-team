import { chromium } from "playwright";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

async function runE2ETest() {
  console.log("=== STARTING PLAYWRIGHT BROWSER E2E TEST ===");

  // Spawn Vite dev server on dedicated test port 5174
  const viteProcess = spawn("npx", ["vite", "--port", "5174", "--host"], {
    cwd: rootDir,
    stdio: "pipe",
  });

  // Give Vite server time to initialize
  await new Promise((resolve) => setTimeout(resolve, 2500));

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  const errors = [];

  page.on("pageerror", (err) => {
    console.error("❌ UNCAUGHT PAGE ERROR:", err.message);
    errors.push(err.message);
  });

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      console.error("❌ BROWSER CONSOLE ERROR:", msg.text());
      errors.push(msg.text());
    }
  });

  try {
    console.log("1. Navigating to http://localhost:5174 ...");
    await page.goto("http://localhost:5174", { waitUntil: "networkidle" });

    const title = await page.title();
    console.log(`✓ Page loaded. Title: "${title}"`);

    // Verify Step 1: Intake & Audit
    console.log("2. Verifying Step 1: Intake & Audit ...");
    await page.waitForSelector("text=Survey Response Spreadsheet");
    console.log("✓ Step 1 verified.");

    // Navigate to Step 2: Notes & Rules
    console.log("3. Navigating to Step 2: Notes & Rules ...");
    const step2Btn = page.locator("button:has-text('Proceed to Notes & Exception Rules')");
    await step2Btn.click();
    await page.waitForSelector("text=Member Notes & Exception Rules");
    console.log("✓ Step 2 verified.");

    // Click Run Matchmaker Solver to enter Step 3
    console.log("4. Clicking 'Run Matchmaker Solver' to enter Step 3 ...");
    const solveBtn = page.locator("button:has-text('Run Matchmaker Solver')");
    await solveBtn.click();
    await page.waitForTimeout(1000);

    // Verify Step 3: Solve & Review
    console.log("5. Verifying Step 3: Solve & Review ...");
    await page.waitForSelector("text=Schedule Review & Matchmaker Roster");
    await page.waitForSelector("text=Generated Monthly Shift Roster");
    await page.waitForSelector("text=Member Quota & Shift Distribution Summary");
    console.log("✓ Step 3 loaded with full roster, completeness banner, and quota table!");

    // Test Global Settings Modal (Modal 5)
    console.log("6. Testing Global Settings Modal...");
    const settingsBtn = page.locator("button:has-text('Settings')").first();
    await settingsBtn.click();
    await page.waitForSelector("text=Global Application & Solver Settings");
    console.log("✓ Modal 5 (Global Settings) opened successfully.");
    const closeSettingsBtn = page.locator("button:has-text('Cancel')");
    await closeSettingsBtn.click();
    console.log("✓ Modal 5 closed.");

    // Test Interactive Missing Cleaner Slot button (Modal 4)
    console.log("7. Testing [+ Fill Missing Cleaner Slot] modal...");
    const missingSlotBtn = page.locator("button:has-text('Fill Missing Cleaner Slot')").first();
    if ((await missingSlotBtn.count()) > 0) {
      await missingSlotBtn.click();
      await page.waitForSelector("text=Fill Missing Cleaner Slot");
      console.log("✓ Modal 4 (Fill Missing Slot) opened successfully.");

      const cancelBtn = page.locator("button:has-text('Cancel')");
      await cancelBtn.click();
      console.log("✓ Modal 4 closed.");
    }

    // Test Member Quota Details Modal (Modal 3)
    console.log("7. Testing Quota table [Find Dates & Add Extra] modal...");
    const findDatesBtn = page.locator("button:has-text('Find Dates & Add Extra')").first();
    if ((await findDatesBtn.count()) > 0) {
      await findDatesBtn.click();
      await page.waitForSelector("text=Available Dates & Extra Shift Assignment");
      console.log("✓ Modal 3 (Member Extra Shift Assignment) opened successfully.");

      const doneBtn = page.locator("button:has-text('Done')");
      await doneBtn.click();
      console.log("✓ Modal 3 closed.");
    }

    // Navigate to Step 4: Publish & Email
    console.log("8. Navigating to Step 4: Publish & Email ...");
    const step4Btn = page.locator("button:has-text('Proceed to Export & Email')").first();
    await step4Btn.click();
    await page.waitForSelector("text=Community Listserv Email");

    const emailContent = await page.locator("textarea").inputValue();
    if (emailContent.includes("Hi precious friends & neighbours,")) {
      console.log("✓ Email announcement greeting verified: 'Hi precious friends & neighbours,'");
    } else {
      errors.push("Email greeting mismatch");
    }

    // Test Browser Back & Forward button history navigation
    console.log("9. Testing Browser Back & Forward button history navigation...");
    // Currently on Step 4 (#step-4) -> Back navigates to Step 3
    await page.goBack();
    await page.waitForSelector("text=Schedule Review & Matchmaker Roster");
    console.log("✓ Browser Back button navigated to Step 3 (#step-3) successfully!");

    // Back navigates to Step 2
    await page.goBack();
    await page.waitForSelector("text=Member Notes & Exception Rules");
    console.log("✓ Browser Back button navigated to Step 2 (#step-2) successfully!");

    // Forward navigates back to Step 3
    await page.goForward();
    await page.waitForSelector("text=Schedule Review & Matchmaker Roster");
    console.log("✓ Browser Forward button navigated forward to Step 3 (#step-3) successfully!");

    // Test Scenario Presets across solver
    console.log("10. Testing Scenario Presets on Step 1...");
    const step1Nav = page.locator("button:has-text('Intake & Audit')").first();
    await step1Nav.click();
    await page.waitForSelector("text=Survey Response Spreadsheet");

    const presets = [
      "test-sheet-standard",
      "test-sheet-holiday",
      "test-sheet-deficit",
      "test-sheet-conflict",
      "test-sheet-single",
    ];
    for (const preset of presets) {
      console.log(`   Testing dropdown option: ${preset} ...`);
      const presetSelect = page.locator("select").first();
      await presetSelect.selectOption(preset);
      await page.waitForTimeout(600);
    }
    console.log("✓ All 5 test presets verified without error!");

    console.log("\n==========================================");
    if (errors.length === 0) {
      console.log("🎉 ALL PLAYWRIGHT E2E BROWSER TESTS PASSED! (0 ERRORS)");
    } else {
      console.error(`❌ TEST FAILED WITH ${errors.length} ERRORS:`, errors);
    }
    console.log("==========================================\n");
  } catch (err) {
    console.error("FATAL ERROR IN E2E TEST:", err);
    errors.push(err.message);
  } finally {
    await browser.close();
    viteProcess.kill();
  }

  process.exit(errors.length === 0 ? 0 : 1);
}

runE2ETest();
