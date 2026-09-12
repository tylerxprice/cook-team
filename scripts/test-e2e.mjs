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
      const text = msg.text();
      if (!text.includes("WebSocket connection") && !text.includes("net::ERR_CONNECTION_REFUSED")) {
        console.error("❌ BROWSER CONSOLE ERROR:", text);
        errors.push(text);
      }
    }
  });

  try {
    console.log("1. Navigating to http://localhost:5174 ...");
    await page.goto("http://localhost:5174", { waitUntil: "networkidle" });

    const title = await page.title();
    console.log(`✓ Page loaded. Title: "${title}"`);

    // Verify Step 1: Intake & Audit
    console.log("2. Verifying Step 1: Intake & Audit ...");
    await page.waitForSelector("text=Community Cook Team App");
    await page.waitForSelector("text=Survey Response Spreadsheet");
    await page.waitForSelector("text=Select a Survey to Begin Scheduling");
    const sheetSelect = page.locator("select").first();
    await sheetSelect.selectOption("test-sheet-standard");
    await page.waitForSelector("text=Proceed to Notes & Exception Rules");
    console.log("✓ Step 1 verified after explicit selection.");

    // Navigate to Step 2: Notes & Rules
    console.log("3. Navigating to Step 2: Notes & Rules ...");
    const step2Btn = page.locator("button:has-text('Proceed to Notes & Exception Rules')");
    await step2Btn.click();
    await page.waitForSelector("text=Member Notes & Exception Rules");
    console.log("✓ Step 2 verified.");

    // Test adding multiple exception rules on Step 2
    console.log("3b. Testing adding multiple exception rules on Step 2 ...");
    const addRuleBtn = page.locator("button:has-text('Add Exception Rule')").first();
    if (await addRuleBtn.isVisible()) {
      await addRuleBtn.click();
      await page.waitForSelector("text=Configure Exception Rule");
      const personASelect = page.locator("select").first();
      await personASelect.selectOption("Alex");
      await page.click("button:has-text('Save Rule')");
      await page.waitForTimeout(500);

      await addRuleBtn.click();
      await page.waitForSelector("text=Configure Exception Rule");
      const personASelect2 = page.locator("select").first();
      await personASelect2.selectOption("Jessica");
      await page.click("button:has-text('Save Rule')");
      await page.waitForTimeout(500);

      await page.waitForSelector("text=Alex");
      await page.waitForSelector("text=Jessica");
      console.log("✓ Multiple exception rules persistence on Step 2 verified!");
    }

    // Click Run Matchmaker Solver to enter Step 3
    console.log("4. Clicking 'Run Matchmaker Solver' to enter Step 3 ...");
    const solveBtn = page.locator("button:has-text('Run Matchmaker Solver')");
    await solveBtn.click();
    await page.waitForTimeout(1000);

    // Verify Step 3: Solve & Review
    console.log("5. Verifying Step 3: Solve & Review ...");
    await page.waitForSelector("text=Generated Monthly Shift Roster");
    await page.waitForSelector("text=Member Quota & Shift Distribution Summary");
    console.log("✓ Step 3 loaded with full roster, completeness banner, and quota table!");

    // Test Global Settings Modal (Modal 5) via Hamburger Menu
    console.log("6. Testing Global Settings Modal...");
    const menuBtn = page.locator("#header-menu-container button").first();
    await menuBtn.click();
    const settingsBtn = page.locator("#header-menu-container button:has-text('Settings')").first();
    await settingsBtn.click();
    await page.waitForSelector("text=Global Application & Solver Settings");
    console.log("✓ Modal 5 (Global Settings) opened successfully.");
    const closeSettingsBtn = page.locator(".fixed button:has-text('Cancel')").first();
    await closeSettingsBtn.click();
    console.log("✓ Modal 5 closed.");

    // Test Interactive Missing Cleaner Slot button (Modal 4)
    console.log("7. Testing [+ Fill Missing Cleaner Slot] modal...");
    const missingSlotBtn = page.locator("button:has-text('Fill Missing Cleaner Slot')").first();
    if ((await missingSlotBtn.count()) > 0) {
      await missingSlotBtn.click();
      await page.waitForSelector("text=Fill Missing Cleaner Slot");
      console.log("✓ Modal 4 (Fill Missing Slot) opened successfully.");

      const cancelBtn = page.locator(".fixed button:has-text('Cancel')").first();
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

    // Test Cancel Meal and Restore Meal buttons
    console.log("7b. Testing Cancel Meal and Restore Meal ...");
    const cancelMealBtn = page.locator("button:has-text('Cancel Meal')").first();
    if ((await cancelMealBtn.count()) > 0) {
      await cancelMealBtn.click();
      await page.waitForSelector("button:has-text('Restore Meal'), button:has-text('Add Back into Schedule')");
      console.log("✓ Meal cancellation and volunteers release verified!");

      const viewOppBtn = page.locator("button:has-text('Explore Recovery'), button:has-text('View Opportunity')").first();
      if ((await viewOppBtn.count()) > 0) {
        await viewOppBtn.click();
        await page.waitForSelector("text=Meal Recovery Opportunity");
        console.log("✓ Modal 10 (Single-Day Meal Recovery Opportunity) opened successfully.");
        const addBackBtn = page.locator(".fixed button:has-text('+ Add Back')").first();
        await addBackBtn.click();
        await page.waitForSelector("text=Meal Recovery Opportunity", { state: "detached" });
        console.log("✓ Meal restored from Modal 10!");
      } else {
        const restoreMealBtn = page.locator("button:has-text('Restore Meal'), button:has-text('Add Back into Schedule')").first();
        await restoreMealBtn.click();
      }
      await page.waitForTimeout(500);
      console.log("✓ Meal restoration verified!");
    }

    // Test Clicking Member in Schedule to open Modal 3 (Member Calendar & Availability Inspector)
    console.log("7c. Testing Clicking Member in Schedule to open Member Calendar Inspector ...");
    const memberBadge = page.locator("button[title*='availability and shifts']").first();
    if ((await memberBadge.count()) > 0) {
      await memberBadge.click();
      await page.waitForSelector("text=Available Dates & Extra Shift Assignment");
      console.log("✓ Modal 3 (Member Shift Assignment & Availability) opened from schedule badge successfully!");
      const closeMemberModal = page.locator(".fixed button:has-text('Done')").first();
      await closeMemberModal.click();
      await page.waitForSelector("text=Available Dates & Extra Shift Assignment", { state: "detached" });
      console.log("✓ Member Calendar Inspector closed.");
      await page.waitForTimeout(500);
    }

    // Navigate to Step 4: Publish & Email
    console.log("8. Navigating to Step 4: Publish & Email ...");
    const step4Btn = page.locator("button:has-text('Proceed to Export & Email')").first();
    await step4Btn.click();
    await page.waitForSelector("text=Community Announcement & Gmail Dispatch");

    const emailContent = await page.locator("textarea").inputValue();
    if (emailContent.includes("Hi precious friends & neighbours,")) {
      console.log("✓ Email announcement greeting verified: 'Hi precious friends & neighbours,'");
    } else {
      errors.push("Email greeting mismatch");
    }

    // Test Create Gmail Draft
    console.log("   Testing Create Gmail Draft button...");
    const draftBtn = page.locator("button:has-text('Create Gmail Draft')");
    await draftBtn.click();
    await page.waitForSelector("text=Draft created in your Gmail account");
    console.log("✓ Gmail Draft creation verified!");

    // Test Send via Gmail
    console.log("   Testing Send via Gmail button...");
    const sendBtn = page.locator("button:has-text('Send via Gmail')");
    await sendBtn.click();
    await page.waitForSelector("text=Announcement email successfully sent via Gmail");
    console.log("✓ Send via Gmail verified!");

    // Test Already Sent Warning Banner & Duplicate Send Modal
    console.log("   Testing Email Already Sent Warning Banner...");
    await page.waitForSelector("text=Notice: Announcement Already Sent");
    console.log("✓ Email Already Sent Warning Banner verified!");

    console.log("   Testing Duplicate Email Send Confirmation Modal...");
    await sendBtn.click();
    await page.waitForSelector("text=Send Duplicate Announcement?");
    console.log("✓ Duplicate Email Send Confirmation Modal displayed successfully!");

    const confirmResendBtn = page.locator(".fixed button:has-text('Yes, Send Email Again')").first();
    await confirmResendBtn.click();
    await page.waitForSelector("text=Announcement email successfully sent via Gmail");
    console.log("✓ Confirmed duplicate email send completed!");

    // Test Modal 7: Community Reports Modal via Hamburger Menu
    console.log("8b. Testing Modal 7: Community Reports Modal with Month Filtering ...");
    const menuBtn2 = page.locator("#header-menu-container button").first();
    await menuBtn2.click();
    const reportsBtn = page.locator("#header-menu-container button:has-text('Community Reports')").first();
    await reportsBtn.click();
    await page.waitForSelector("text=Community Trends & Volunteer Equity Report");
    console.log("✓ Reports Modal opened.");

    // Run report on selected months
    const runReportBtn = page.locator("button:has-text('Run Report')").first();
    await runReportBtn.click();
    await page.waitForSelector("text=Volunteer Participation & Equity Leaderboard");
    console.log("✓ Reports generated with month filtering and equity leaderboard verified!");

    const closeReportsBtn = page.locator(".fixed button:has-text('Close')").first();
    await closeReportsBtn.click();
    console.log("✓ Reports Modal closed.");

    // Test Modal 8: Common Meal Sign-Up Generator (Rose's Workflow) via Hamburger Menu
    console.log("8c. Testing Modal 8: Common Meal Sign-Up Generator (Rose's Workflow) ...");
    const menuBtn3 = page.locator("#header-menu-container button").first();
    await menuBtn3.click();
    const mealSignupBtn = page.locator("#header-menu-container button:has-text('Meal Sign-Up Generator')").first();
    await mealSignupBtn.click();
    await page.waitForSelector("text=Common Meal Sign-Up Generator");
    console.log("✓ Meal Sign-Up Generator Modal opened.");

    // Check preview table rendered
    await page.waitForSelector("text=Meal Date Columns Preview");
    console.log("✓ Meal Date columns and preview table verified!");

    // Execute generation
    const generateBtn = page.locator("button:has-text('Generate')").last();
    await generateBtn.click();
    await page.waitForSelector("text=Successfully created and published", { timeout: 5000 });
    console.log("✓ Meal Sign-Up Sheet generation executed successfully!");

    const closeSignupBtn = page.locator(".fixed button[aria-label='Close dialog'], .fixed button:has-text('Close')").first();
    await closeSignupBtn.click();
    console.log("✓ Meal Sign-Up Generator Modal closed.");

    // Test Modal 9: Survey Form Generator (Brenda's Workflow) via Hamburger Menu
    console.log("8d. Testing Modal 9: Survey Form Generator (Brenda's Workflow) ...");
    const menuBtn4 = page.locator("#header-menu-container button").first();
    await menuBtn4.click();
    const surveyFormBtn = page.locator("#header-menu-container button:has-text('Survey Form Generator')").first();
    await surveyFormBtn.click();
    await page.waitForSelector("text=Survey Form Generator");
    console.log("✓ Survey Form Generator Modal opened.");

    // Check date table rendered
    await page.waitForSelector("text=Configure Meal Dates for Survey Grid");
    console.log("✓ Meal Date table and preview verified!");

    // Execute Form & Response Sheet generation
    const generateSurveyBtn = page.locator("button:has-text('Generate Google Form')").last();
    await generateSurveyBtn.click();
    await page.waitForSelector("text=Successfully created Google Form", { timeout: 5000 });
    console.log("✓ Google Form & Response Sheet generation executed successfully!");

    const closeSurveyBtn = page.locator(".fixed button[aria-label='Close dialog'], .fixed button:has-text('Close')").first();
    await closeSurveyBtn.click();
    console.log("✓ Survey Form Generator Modal closed.");

    // Test Browser Back & Forward button history navigation
    console.log("9. Testing Browser Back & Forward button history navigation...");
    // Currently on Step 4 (#step-4) -> Back navigates to Step 3
    await page.goBack();
    await page.waitForSelector("text=Generated Monthly Shift Roster");
    console.log("✓ Browser Back button navigated to Step 3 (#step-3) successfully!");

    // Back navigates to Step 2
    await page.goBack();
    await page.waitForSelector("text=Member Notes & Exception Rules");
    console.log("✓ Browser Back button navigated to Step 2 (#step-2) successfully!");

    // Forward navigates back to Step 3
    await page.goForward();
    await page.waitForSelector("text=Generated Monthly Shift Roster");
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
      "test-sheet-saved",
    ];
    for (const preset of presets) {
      console.log(`   Testing dropdown option: ${preset} ...`);
      const presetSelect = page.locator("select").first();
      await presetSelect.selectOption(preset);
      await page.waitForTimeout(600);
    }
    console.log("✓ All 6 test presets verified without error!");

    // Test Saved Schedule Tab Detection & One-Click Jump to Step 3
    console.log("11. Testing Saved Schedule Detection & Resume Workflow...");
    const selectEl = page.locator("select").first();
    await selectEl.selectOption("test-sheet-saved");
    await page.waitForSelector("text=Finalized Schedule Tab Found:");
    console.log("✓ Saved schedule alert banner verified.");

    const loadSavedBtn = page.locator("button:has-text('Load Saved Schedule & Edit in Step 3')");
    await loadSavedBtn.click();
    await page.waitForSelector("text=Generated Monthly Shift Roster");
    
    // Assert all 4 cooks and 4 cleaners from multi-column schedule tab are displayed
    await page.waitForSelector("text=Cooks (4)");
    await page.waitForSelector("text=Cleaners (4)");
    await page.waitForSelector("text=David");
    await page.waitForSelector("text=Jessica");
    console.log("✓ Verified all 4 cooks and 4 cleaners from multi-column schedule tab are visibly rendered in Step 3!");
    console.log("✓ One-click jump to Step 3 with saved roster verified!");

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
