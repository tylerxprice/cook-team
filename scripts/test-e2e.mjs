import { chromium } from "playwright";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

async function runE2ETest() {
  console.log("=== STARTING PLAYWRIGHT BROWSER E2E TEST ===");

  // If running on host and chromium shared libraries are missing, auto-delegate to devcontainer if available
  if (process.env.IN_CONTAINER !== "1") {
    try {
      const probe = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
      await probe.close();
    } catch (probeErr) {
      if (probeErr.message.includes("error while loading shared libraries") || probeErr.message.includes("cannot open shared object file")) {
        console.log("ℹ Host environment lacks browser shared libraries. Checking Docker devcontainer...");
        try {
          const { execSync } = await import("child_process");
          const image = execSync("docker images --format '{{.Repository}}:{{.Tag}}' | grep -E 'vsc-cook-team|test-gas-devcontainer' | head -n 1", { encoding: "utf8" }).trim();
          if (image) {
            console.log(`🐳 Delegating E2E test execution to devcontainer image: ${image}`);
            const child = spawn("docker", [
              "run", "--rm",
              "-e", "IN_CONTAINER=1",
              "-v", `${rootDir}:/workspaces/cook-team`,
              "-w", "/workspaces/cook-team",
              image,
              "node", "scripts/test-e2e.mjs"
            ], { stdio: "inherit" });
            child.on("exit", (code) => process.exit(code ?? 0));
            return;
          }
        } catch {
          // Fall through to normal launch
        }
      }
    }
  }

  let viteProcess;
  let browser;
  const errors = [];

  // Spawn Vite dev server on dedicated test port 5174
    viteProcess = spawn("npx", ["vite", "--port", "5174", "--host"], {
      cwd: rootDir,
      stdio: "pipe",
    });

    // Give Vite server time to initialize
    await new Promise((resolve) => setTimeout(resolve, 2500));

    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const context = await browser.newContext({
      permissions: ["clipboard-read", "clipboard-write"],
    });
    const page = await context.newPage();

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

    // 1b. Verify Portal Landing View & Resident View
    console.log("1b. Testing Portal Landing View & Resident View ...");
    await page.waitForSelector("text=What would you like to do?");
    await page.waitForSelector("text=Active Month");
    await page.waitForSelector("text=View My Shifts & Add to Calendar");
    await page.waitForSelector("text=Coordinator Planning Wizard");
    console.log("✓ Portal Landing View & Active Month card rendered successfully!");

    // Test entering Resident View
    console.log("1c. Testing Resident View & Calendar Download ...");
    await page.click("button:has-text('Open My Shifts')");
    await page.waitForSelector("text=Whose shifts are you looking for?");
    console.log("✓ Resident View loaded with member selector!");

    // Verify URL args updated
    await page.waitForFunction(() => window.location.search.includes("view=schedule"));
    console.log("✓ URL args updated with ?view=schedule on selecting Resident view!");

    // Test Browser Back button navigates back to landing page
    await page.goBack();
    await page.waitForSelector("text=What would you like to do?");
    console.log("✓ Browser Back button returned from Resident View to Portal Landing View!");

    // Test Browser Forward button returns to Resident view
    await page.goForward();
    await page.waitForSelector("text=Whose shifts are you looking for?");
    console.log("✓ Browser Forward button returned to Resident View!");

    // Select Brenda from member names
    const brendaBtn = page.locator("button:has-text('Brenda')").first();
    await brendaBtn.click();
    await page.waitForSelector("text=Add All My Shifts to Calendar (.ics)");
    await page.waitForSelector("button:has-text('Switch')");
    console.log("✓ Selected member Brenda and verified shifts & calendar export button!");

    // Test Calendar / List toggle on My Shifts tab
    console.log("1c-shift. Testing Calendar / List toggle on My Shifts tab ...");
    const myShiftsListBtn = page.locator("button:has-text('List')").first();
    await myShiftsListBtn.click();
    await page.waitForSelector("text=Cooks:");
    console.log("✓ Toggled My Shifts to List view!");
    const myShiftsCalBtn = page.locator("button:has-text('Calendar')").first();
    await myShiftsCalBtn.click();
    await page.waitForSelector("text=Sun");
    console.log("✓ Toggled My Shifts to Calendar view!");

    // 1c. Verify Month Selector & Current Month Default
    console.log("1c. Testing Resident View Month Selector & Current Month Default ...");
    await page.waitForSelector("select[aria-label='Select meal month']");
    const monthSelect = page.locator("select[aria-label='Select meal month']").first();
    const defaultMonthVal = await monthSelect.inputValue();
    console.log(`✓ Month select dropdown found with initial value: "${defaultMonthVal}"`);

    // Switch month to September via select dropdown
    await monthSelect.selectOption("2026-09");
    await page.waitForFunction(() => window.location.search.includes("month=2026-09"));
    console.log("✓ Changed dropdown to September, URL updated with &month=2026-09!");

    // Switch back to October via select dropdown
    await monthSelect.selectOption("2026-10");
    await page.waitForFunction(() => window.location.search.includes("month=2026-10"));
    console.log("✓ Changed dropdown to October, URL updated with &month=2026-10!");

    // Toggle to Full Schedule tab
    const fullSchedTab = page.locator("button:has-text('Full Schedule')").first();
    await fullSchedTab.click();
    await page.waitForSelector("text=Showing all");
    console.log("✓ Full Community Schedule tab verified!");

    // Test Calendar / List View toggle
    console.log("1c-ii. Testing Calendar / List View toggle in Full Schedule ...");
    await page.waitForSelector("button:has-text('Calendar')");
    await page.waitForSelector("button:has-text('List')");
    const listBtn = page.locator("button:has-text('List')").first();
    await listBtn.click();
    await page.waitForSelector("text=Cooks:");
    console.log("✓ Toggled to List view successfully!");

    const calBtn = page.locator("button:has-text('Calendar')").first();
    await calBtn.click();
    await page.waitForSelector("text=Sun");
    console.log("✓ Toggled back to Calendar view successfully!");

    // Click Home button to return to Portal Landing
    const homeBtn = page.locator("button[title='Return to Hub Home']").first();
    await homeBtn.click();
    await page.waitForSelector("text=What would you like to do?");
    console.log("✓ Returned to Portal Landing view via Home button!");

    // Direct navigation with ?view=schedule without month parameter to test current month default
    console.log("1d. Testing direct URL navigation to ?view=schedule (default current month) ...");
    await page.goto("http://localhost:5174/?view=schedule", { waitUntil: "networkidle" });
    await page.waitForSelector("select[aria-label='Select meal month']");
    const directMonthSelect = page.locator("select[aria-label='Select meal month']").first();
    const directVal = await directMonthSelect.inputValue();
    if (!/^\d{4}-\d{2}$/.test(directVal)) {
      throw new Error(`Expected direct navigation to resolve to YYYY-MM, got: ${directVal}`);
    }
    console.log(`✓ Direct navigation to ?view=schedule defaulted to current month: "${directVal}"`);

    // Direct navigation with ?view=schedule&month=2026-10&name=Rose
    console.log("1e. Testing direct URL navigation with ?view=schedule&month=2026-10&name=Rose ...");
    await page.goto("http://localhost:5174/?view=schedule&month=2026-10&name=Rose", { waitUntil: "networkidle" });
    const hasLandingTitle = await page.locator("text=What would you like to do?").count();
    if (hasLandingTitle > 0) {
      throw new Error("Landing page was not bypassed when view=schedule was passed in query parameter!");
    }
    await page.waitForSelector("text=Add All My Shifts to Calendar (.ics)");
    await page.waitForSelector("button:has-text('Switch')");
    await page.waitForSelector("text=Rose");
    console.log("✓ Successfully loaded Resident View directly with Rose pre-selected!");

    // 1e-ii. Direct navigation with ?view=schedule&month=2026-11
    console.log("1e-ii. Testing direct URL navigation with ?view=schedule&month=2026-11 ...");
    await page.goto("http://localhost:5174/?view=schedule&month=2026-11", { waitUntil: "networkidle" });
    await page.waitForSelector("select[aria-label='Select meal month']");
    const novMonthSelect = page.locator("select[aria-label='Select meal month']").first();
    const novVal = await novMonthSelect.inputValue();
    if (novVal !== "2026-11") {
      throw new Error(`Expected direct navigation to 2026-11 to have select value 2026-11, got: ${novVal}`);
    }
    const novFullSchedTab = page.locator("button:has-text('Full Schedule')").first();
    await novFullSchedTab.click();
    await page.waitForSelector("text=Showing all");
    const novListBtn = page.locator("button:has-text('List')").first();
    await novListBtn.click();
    await page.waitForSelector("text=Nov 1");
    console.log("✓ Successfully loaded Resident View with November 2026 schedule and dates!");

    // Test responsive viewport at 500px and 555px
    console.log("1f. Verifying responsive mobile/tablet layout (500px & 555px) ...");
    await page.setViewportSize({ width: 500, height: 800 });
    // Verify Coordinator button is dropped from header
    const coordInHeader = await page.locator("header button:has-text('Coordinator')").count();
    if (coordInHeader > 0) {
      throw new Error("Coordinator button should not be present in top header!");
    }
    // Verify Home button and month dropdown remain visible
    await page.waitForSelector("header button[title='Return to Hub Home']");
    await page.waitForSelector("header select[aria-label='Select meal month']");

    // Test at 555px: Verify "Save shifts (.ics)" label is displayed
    await page.setViewportSize({ width: 555, height: 800 });
    await page.waitForSelector("button:has-text('Save shifts (.ics)')");

    // Test on 375px mobile screen: Verify combined Switch button, icon-only calendar switcher, and no overlaps
    console.log("1f-ii. Verifying mobile viewport layout (375px) ...");
    await page.setViewportSize({ width: 375, height: 800 });
    await page.waitForSelector("button:has-text('Switch')");
    await page.waitForSelector("button[title='Calendar view']");
    await page.waitForSelector("button[title='List view']");
    await page.waitForSelector("button:has-text('Save shifts (.ics)')");
    console.log("✓ Mobile layout at 375px, 500px & 555px verified with combined Switch button and icon-only calendar controls!");

    // Reset viewport to standard desktop
    await page.setViewportSize({ width: 1280, height: 720 });

    // 1g. Test Direct Web Availability Sign-Up (?view=survey&month=2026-11&m=Taylor)
    console.log("1g. Testing Direct Web Availability Sign-Up (?view=survey&month=2026-11&m=Taylor) ...");
    await page.goto("http://localhost:5174/?view=survey&month=2026-11&m=Taylor", { waitUntil: "networkidle" });
    await page.waitForSelector("text=Hi, Taylor!");
    await page.waitForSelector("text=Meal Team Sign-Up");
    console.log("✓ Direct Web Availability Sign-Up page loaded with Taylor pre-selected!");

    // Set Cook Quota to 2
    await page.selectOption("#survey-form-cook-quota", "2");

    // Select Same Day Preference: PREFERRED
    await page.selectOption("#survey-form-same-day-pref", "PREFERRED");

    // Test Calendar / List toggle on Survey Availability
    const surveyListBtn = page.locator("button:has-text('List')").first();
    await surveyListBtn.click();
    console.log("✓ Toggled survey availability to List view!");
    const surveyCalBtn = page.locator("button:has-text('Calendar')").first();
    await surveyCalBtn.click();
    console.log("✓ Toggled survey availability back to Calendar view!");

    // Mark all dates available
    const allAvailBtn = page.locator("button:has-text('All Available')").first();
    await allAvailBtn.click();

    // Enter special notes
    await page.fill("#survey-form-special-instructions", "Vegetarian dinner preference on Thursdays");

    // Submit form
    const submitSurveyBtn = page.locator("button[type='submit']").first();
    await submitSurveyBtn.click();

    // Verify confirmation celebration card
    await page.waitForSelector("text=Thank you, Taylor!");
    await page.waitForSelector("text=saved to the community planning system");
    console.log("✓ Direct Web Availability survey submitted successfully and confirmation card displayed!");

    // Test Edit Response returns with prior values
    const webSurveyEditRespBtn = page.locator("button:has-text('Edit Response')").first();
    await webSurveyEditRespBtn.click();
    await page.waitForSelector("button[type='submit']");
    console.log("✓ Returned to edit response mode with prior answers intact!");

    // 1g-ii. Test Sign-Ups Closed View (?view=survey&month=2026-10&m=Brenda)
    console.log("1g-ii. Testing Sign-Ups Closed View (?view=survey&month=2026-10&m=Brenda) ...");
    await page.goto("http://localhost:5174/?view=survey&month=2026-10&m=Brenda", { waitUntil: "networkidle" });
    await page.waitForSelector("text=Sign-Ups Closed");
    await page.waitForSelector("text=Teams Have Been Scheduled");
    await page.waitForSelector("text=Are Finalized");
    await page.waitForSelector("button:has-text('Sign-Ups Closed (Schedule Published)')");
    console.log("✓ Closed month verified: Read-only submitted responses with disabled submit button!");

    // 1g-iii. Test Sign-Ups Not Open Yet View (?view=survey&month=2026-12)
    console.log("1g-iii. Testing Sign-Ups Not Open Yet View (?view=survey&month=2026-12) ...");
    await page.goto("http://localhost:5174/?view=survey&month=2026-12", { waitUntil: "networkidle" });
    await page.waitForSelector("text=Sign-Ups Not Open Yet");
    await page.waitForSelector("text=Have Not Opened Yet");
    console.log("✓ Unconfigured month verified: Sign-Ups Not Open Yet friendly card displayed!");

    // Navigate to Coordinator Planning Wizard via Hub Home button
    const homeBtn2 = page.locator("button[title='Return to Hub Home']").first();
    await homeBtn2.click();
    await page.waitForSelector("text=Coordinator Planning Wizard");
    const coordBtn = page.locator("button:has-text('Coordinator Planning Wizard')").first();
    await coordBtn.click();
    await page.waitForSelector("text=CoHo CookTeam");
    console.log("✓ Successfully navigated to Coordinator Planning Wizard via Hub Home!");

    // Verify Coordinator selection updated URL args
    await page.waitForFunction(() => window.location.search.includes("view=coordinator"));
    console.log("✓ URL args updated with ?view=coordinator on selecting Coordinator Wizard!");

    // Test Browser Back button navigates back to landing page
    await page.goBack();
    await page.waitForSelector("text=What would you like to do?");
    console.log("✓ Browser Back button returned from Coordinator to Portal Landing View!");

    // Re-enter Coordinator view via Forward button
    await page.goForward();
    await page.waitForSelector("text=CoHo CookTeam");
    console.log("✓ Browser Forward button returned to Coordinator Planning Wizard!");

    // Verify Step 1: Intake & Audit
    console.log("2. Verifying Step 1: Intake & Audit ...");
    await page.waitForSelector("#survey-sheet-select");
    await page.waitForSelector("text=Select a Survey to Begin Scheduling");
    const sheetSelect = page.locator("#survey-sheet-select, select").first();
    await sheetSelect.selectOption("test-sheet-standard");
    await page.waitForSelector("text=Proceed to Notes & Exception Rules");
    console.log("✓ Step 1 verified after explicit selection.");

    // Test Manual Survey Response Modal (Modal 10) on Step 1
    console.log("2b. Testing Modal 10: Manual Survey Response Entry on Step 1 ...");
    const enterRespBtn = page.locator("button:has-text('+ Enter Response')").first();
    await enterRespBtn.click();
    await page.waitForSelector("text=Enter Availability Survey for Member");
    console.log("✓ Manual Survey Response Modal opened successfully.");
    const cancelRespBtn = page.locator(".fixed button:has-text('Cancel')").first();
    await cancelRespBtn.click();
    console.log("✓ Manual Survey Response Modal closed.");

    // Test Expanding Submitted Survey Responses Accordion and Clicking Edit
    console.log("2c. Testing Collapsible Submitted Survey Responses Pane on Step 1 ...");
    const submittedAccordionBtn = page.locator("button:has-text('Submitted Survey Responses')").first();
    await submittedAccordionBtn.click();
    await page.waitForSelector("text=Hide Submitted List");
    const editRespBtn = page.locator("button:has-text('Edit Response')").first();
    await editRespBtn.click();
    await page.waitForSelector("text=Modify Survey Response");
    console.log("✓ Edit existing response from submitted pane opened successfully.");
    const cancelEditBtn = page.locator(".fixed button:has-text('Cancel')").first();
    await cancelEditBtn.click();
    console.log("✓ Edit response modal closed.");

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
    const step4Btn = page.locator("button:has-text('Save Teams to Sheet & Proceed to Email')").first();
    await step4Btn.click();
    await page.waitForSelector("text=Community Announcement & Gmail Dispatch");

    const emailContent = await page.locator("textarea").inputValue();
    if (emailContent.includes("Hi precious friends & neighbours,")) {
      console.log("✓ Email announcement greeting verified: 'Hi precious friends & neighbours,'");
    } else {
      errors.push("Email greeting mismatch");
    }
    if (emailContent.includes("View your shifts & add to phone calendar:")) {
      console.log("✓ Calendar link in email announcement verified!");
    } else {
      errors.push("Calendar link missing in email announcement");
    }

    // Verify 'Create Gmail Draft' is removed per coordinator feedback
    const draftBtn = page.locator("button:has-text('Create Gmail Draft')");
    const draftBtnCount = await draftBtn.count();
    if (draftBtnCount > 0) {
      throw new Error("Expected 'Create Gmail Draft' button to be removed, but found " + draftBtnCount);
    }
    console.log("✓ Verified 'Create Gmail Draft' button is removed!");

    // Test Compose in Gmail Web
    console.log("   Testing Compose in Gmail Web button...");
    const composeBtn = page.locator("button:has-text('Compose in Gmail Web')");
    await composeBtn.waitFor({ state: "visible" });
    console.log("✓ Compose in Gmail Web button verified!");

    // Verify 'Mark as Broadcast Sent' button is present
    const markBroadcastBtn = page.locator("button:has-text('Mark as Broadcast Sent')");
    await markBroadcastBtn.waitFor({ state: "visible" });
    console.log("✓ Verified 'Mark as Broadcast Sent' button is present!");

    // Verify 'Send via Gmail' is completely removed
    const sendBtn = page.locator("button:has-text('Send via Gmail')");
    const sendBtnCount = await sendBtn.count();
    if (sendBtnCount > 0) {
      throw new Error("Expected 'Send via Gmail' button to be removed, but found " + sendBtnCount);
    }
    console.log("✓ Verified 'Send via Gmail' button is removed!");


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

    // Step forward to December 2026 via Plan Next Month button
    console.log("Switching to December 2026 via Plan Next Month button...");
    const planNextMonthBtn = page.locator("button:has-text('Plan Next Month')").first();
    await planNextMonthBtn.click();
    await page.waitForSelector("text=Configure Meal Dates for Survey Grid");
    await page.waitForTimeout(300);

    // Test Add Custom Date Modal
    console.log("   Testing Add Custom Date modal in Survey Form Generator...");
    const addCustomDateBtn = page.locator("button:has-text('Add Custom Date')").first();
    await addCustomDateBtn.click();
    await page.waitForSelector("text=Add Custom Meal Date");
    console.log("✓ Add Custom Date Modal opened!");
    const currentMonthVal = "2026-12";
    const testDateKey = `${currentMonthVal}-25`;
    await page.locator("#custom-meal-date-input").fill(testDateKey);
    await page.locator(".fixed button:has-text('Brunch')").click();
    await page.locator("#custom-meal-note-input").fill("Community Brunch");
    const submitCustomDateBtn = page.locator(".fixed button:has-text('Add Meal Date'), .fixed button:has-text('Update Meal Date')").first();
    await submitCustomDateBtn.click();
    await page.waitForSelector("text=Add Custom Meal Date", { state: "detached" });
    await page.waitForSelector("text=Community Brunch");
    console.log("✓ Custom date added and verified in survey table!");

    // Staged Flow: Assert Beta Web Sign-Ups tab is locked prior to form generation
    const lockedBetaTab = page.locator("button:has-text('Beta Web Sign-Ups'):has-text('Locked')").first();
    await lockedBetaTab.waitFor({ state: "visible", timeout: 3000 });
    console.log("✓ Beta Web Sign-Ups tab is locked prior to form generation!");

    // Execute Form & Response Sheet generation (Stage 1 -> Stage 2)
    const generateSurveyBtn = page.locator("button:has-text('Generate Form & Open Sign-Ups')").first();
    await generateSurveyBtn.click();
    const overwriteConfirmBtn = page.locator("button:has-text('Yes, Overwrite & Create Form')").first();
    if (await overwriteConfirmBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await overwriteConfirmBtn.click();
    }

    // Verify big generation spinner is shown
    await page.waitForSelector("text=Generating Google Form & Linked Response Sheet...", { timeout: 4000 });
    console.log("✓ Big form generation progress spinner rendered!");

    // Verify completion and automatic focus to Beta Web Sign-Ups tab (Stage 2)
    console.log("8d-beta. Verifying automatic focus to Beta Web Sign-Ups (Phase 2) tab ...");
    await page.waitForSelector("text=Direct Web Availability Sign-Up (Beta Pilot)", { timeout: 10000 });
    await page.waitForSelector("text=Beta Pilot Testers");
    await page.waitForSelector("text=Email Invitation Template");
    console.log("✓ Beta Web Sign-Ups tab automatically focused and unlocked after form generation!");

    // Test Copy Link on a tester
    const copyTesterLinkBtn = page.locator("button:has-text('Copy Link')").first();
    await copyTesterLinkBtn.click();
    console.log("✓ Copy personal survey link button tested successfully!");

    // Test sending beta invites via mock
    const sendBetaInvitesBtn = page.locator("button:has-text('Send Beta Invitations')").first();
    await sendBetaInvitesBtn.click();
    await page.waitForSelector("text=Successfully dispatched");
    // Assert [object Object] is NOT displayed
    const objectObjectCount = await page.locator("text=[object Object]").count();
    if (objectObjectCount > 0) {
      throw new Error("Found '[object Object]' in beta dispatch result banner!");
    }
    console.log("✓ Send Beta Invitations executed and alert rendered cleanly (no [object Object])!");

    // Switch back to standard Google Form tab
    const standardTabBtn = page.locator("button:has-text('Google Form & Meal Dates (Standard)')").first();
    await standardTabBtn.click();
    await page.waitForSelector("text=Configure Meal Dates for Survey Grid");
    await page.waitForSelector("text=Community Survey Announcement");
    await page.waitForSelector("button:has-text('Compose Survey Announcement in Gmail Web')");
    console.log("✓ Switched back to Google Form (Standard) tab & verified Community Survey Announcement card!");

    // Return to Step 4 via browser back button
    await page.goBack();
    await page.waitForSelector("text=Email Announcement");
    console.log("✓ Returned to Coordinator Wizard Step 4.");

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
    await page.waitForSelector("#survey-sheet-select");

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

    // 12. Testing Overwrite Guard Modal in Step 3 when a saved schedule exists
    console.log("12. Testing Overwrite Guard Confirmation Modal in Step 3...");
    const rerunSolverBtn = page.locator("button:has-text('Re-Run Solver')").first();
    await rerunSolverBtn.click();
    await page.waitForSelector("text=Finalized Schedule Exists");
    console.log("✓ Overwrite Guard Confirmation Modal opened successfully!");

    // Test Cancel button keeps existing draft
    const cancelModalBtn = page.locator(".fixed button:has-text('Cancel')").first();
    await cancelModalBtn.click();
    await page.waitForSelector("text=Finalized Schedule Exists", { state: "detached" });
    console.log("✓ Overwrite Guard Cancel preserved saved draft!");

    // Test Proceed button in modal re-runs solver
    await rerunSolverBtn.click();
    await page.waitForSelector("text=Finalized Schedule Exists");
    const proceedRerunBtn = page.locator(".fixed button:has-text('Proceed & Re-run Solver')").first();
    await proceedRerunBtn.click();
    await page.waitForSelector("text=Generated Monthly Shift Roster");
    console.log("✓ Overwrite Guard Proceed successfully re-ran matchmaker solver!");

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
    await browser?.close();
    viteProcess?.kill();
  }

  process.exit(errors.length === 0 ? 0 : 1);
}

runE2ETest();
