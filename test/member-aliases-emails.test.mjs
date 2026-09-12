import test from "node:test";
import assert from "node:assert/strict";
import {
  extractEmails,
  extractAliases,
  findMatchingMember,
  parseSurveySheetData,
  parseSheetBoolean,
} from "../src/server/parser.ts";

test("parseSheetBoolean - Accurately parses boolean values from sheet cells without false || '' bug", () => {
  // Boolean primitives
  assert.equal(parseSheetBoolean(false), false);
  assert.equal(parseSheetBoolean(true), true);

  // String boolean representations from Google Sheets
  assert.equal(parseSheetBoolean("FALSE"), false);
  assert.equal(parseSheetBoolean("false"), false);
  assert.equal(parseSheetBoolean("False"), false);
  assert.equal(parseSheetBoolean("TRUE"), true);
  assert.equal(parseSheetBoolean("true"), true);

  // Text status keywords
  assert.equal(parseSheetBoolean("inactive"), false);
  assert.equal(parseSheetBoolean("dormant"), false);
  assert.equal(parseSheetBoolean("no"), false);
  assert.equal(parseSheetBoolean("active"), true);
  assert.equal(parseSheetBoolean("yes"), true);

  // Numbers
  assert.equal(parseSheetBoolean(0), false);
  assert.equal(parseSheetBoolean(1), true);
  assert.equal(parseSheetBoolean("0"), false);
  assert.equal(parseSheetBoolean("1"), true);

  // Default value on empty or missing
  assert.equal(parseSheetBoolean(""), true);
  assert.equal(parseSheetBoolean(null), true);
  assert.equal(parseSheetBoolean(undefined), true);
  assert.equal(parseSheetBoolean("", false), false);
});

test("Member Normalization - extractEmails and extractAliases", () => {
  const emails = extractEmails("alexandra@example.com, alex.personal@gmail.com;  WORK@CORP.COM ");
  assert.deepEqual(emails, ["alexandra@example.com", "alex.personal@gmail.com", "work@corp.com"]);

  const emptyEmails = extractEmails("");
  assert.deepEqual(emptyEmails, []);

  const aliases = extractAliases("Alex, Sasha; Sandy");
  assert.deepEqual(aliases, ["Alex", "Sasha", "Sandy"]);

  const arrayAliases = extractAliases(["Alex, Sasha", "Sandy"]);
  assert.deepEqual(arrayAliases, ["Alex", "Sasha", "Sandy"]);

  // Comma separated duplicate nicknames like "Mark B, Mark B."
  const markAliases = extractAliases("Mark B, Mark B.");
  assert.deepEqual(markAliases, ["Mark B", "Mark B."]);

  // Case-insensitive deduplication
  const dedupedAliases = extractAliases("Alex, alex, ALEX, Sasha");
  assert.deepEqual(dedupedAliases, ["Alex", "Sasha"]);
});

test("Member Normalization - Email match prioritized over name (Disambiguating Mark L vs Mark B)", () => {
  const members = [
    {
      name: "Mark L",
      google_email: "mark.l@community.org",
      active: true,
      aliases: ["Mark"],
    },
    {
      name: "Mark B",
      google_email: "mark.b@community.org, mark.personal@gmail.com",
      active: true,
      aliases: ["Mark", "Marko"],
    },
  ];

  // Both respondents type rawName = "Mark"
  // 1. Respondent with mark.l@community.org matches Mark L
  const matchL = findMatchingMember("Mark", "mark.l@community.org", members);
  assert.equal(matchL?.name, "Mark L");

  // 2. Respondent with mark.personal@gmail.com matches Mark B
  const matchB = findMatchingMember("Mark", "mark.personal@gmail.com", members);
  assert.equal(matchB?.name, "Mark B");
});

test("Member Normalization - findMatchingMember resolution precedence", () => {
  const members = [
    {
      name: "Alexandra",
      google_email: "alexandra@community.org, alex.personal@gmail.com",
      active: true,
      aliases: ["Alex", "Sasha"],
    },
    {
      name: "Ash",
      google_email: "ashley.white@example.com",
      active: true,
      aliases: ["Becca"],
      alternate_emails: ["ash.alt@gmail.com"],
    },
    {
      name: "Marcus",
      google_email: "marcus@example.com",
      active: true,
      aliases: ["Marko", "Mark B"],
    },
  ];

  // 1. Match by email first (even if name is completely different)
  const matchEmail = findMatchingMember("Different Name", "alex.personal@gmail.com", members);
  assert.equal(matchEmail?.name, "Alexandra");

  // 2. Match by exact canonical name
  const match1 = findMatchingMember("Alexandra", undefined, members);
  assert.equal(match1?.name, "Alexandra");

  // 3. Match by case-insensitive alias
  const match2 = findMatchingMember("alex", undefined, members);
  assert.equal(match2?.name, "Alexandra");

  const match3 = findMatchingMember("sasha", undefined, members);
  assert.equal(match3?.name, "Alexandra");

  // 4. Match by alternate_emails array
  const match5 = findMatchingMember("Becca", "ash.alt@gmail.com", members);
  assert.equal(match5?.name, "Ash");

  // 5. Match by built-in common community alias (e.g. Marko / Mark B)
  const match6 = findMatchingMember("Mark B", undefined, members);
  assert.equal(match6?.name, "Marcus");

  // 6. Unknown person returns null
  const matchUnknown = findMatchingMember("Carlos", "carlos@unknown.org", members);
  assert.equal(matchUnknown, null);
});

test("Survey Parser - Auto-canonicalizes respondent names and maintains accurate audit", () => {
  const masterMembers = [
    {
      name: "Alexandra",
      google_email: "alexandra@community.org, alex.personal@gmail.com",
      active: true,
      aliases: ["Alex"],
    },
    {
      name: "Mark L",
      google_email: "mark.l@community.org",
      active: true,
    },
    {
      name: "Mark B",
      google_email: "mark.b@community.org",
      active: true,
    },
    {
      name: "Jordan",
      google_email: "jordan@community.org",
      active: false, // Dormant
      aliases: ["Jordy"],
    },
  ];

  const grid = [
    [
      "Timestamp",
      "Email Address",
      "Your Name",
      "How many meals can you cook?",
      "How many meals can you clean?",
      "Can you cook and clean on the same day?",
      "Special instructions",
      "Select your available dates [Oct 1 (Thur)]",
      "Select your available dates [Oct 4 (Sun, Brunch)]",
    ],
    // Row 1: Alexandra responds with name "Alex" and personal email
    [
      "2026-09-01T10:00:00Z",
      "alex.personal@gmail.com",
      "Alex",
      "2",
      "1",
      "No",
      "",
      "Available",
      "Available",
    ],
    // Row 2: Mark L types "Mark" but submits with mark.l@community.org
    [
      "2026-09-01T10:30:00Z",
      "mark.l@community.org",
      "Mark",
      "1",
      "1",
      "No",
      "",
      "Available",
      "Unavailable",
    ],
    // Row 3: Mark B types "Mark" but submits with mark.b@community.org
    [
      "2026-09-01T10:45:00Z",
      "mark.b@community.org",
      "Mark",
      "1",
      "1",
      "No",
      "",
      "Unavailable",
      "Available",
    ],
    // Row 4: Dormant member Jordan responds with alias "Jordy"
    [
      "2026-09-01T11:00:00Z",
      "jordan@community.org",
      "Jordy",
      "1",
      "1",
      "No",
      "",
      "Cook only",
      "Unavailable",
    ],
    // Row 5: Truly unrecognized new resident "Carlos"
    [
      "2026-09-01T12:00:00Z",
      "carlos@newneighbor.org",
      "Carlos",
      "1",
      "1",
      "No",
      "",
      "Available",
      "Available",
    ],
  ];

  const parsed = parseSurveySheetData(grid, masterMembers, "2026-10 Cook Team Survey");

  // 1. Alexandra's response was canonicalized to "Alexandra"
  const alexResp = parsed.responses.find((r) => r.name === "Alexandra");
  assert.ok(alexResp, "Alexandra should be canonicalized from 'Alex'");
  assert.equal(alexResp?.email, "alex.personal@gmail.com");

  // 2. Mark L and Mark B were both disambiguated by email!
  const markLResp = parsed.responses.find((r) => r.name === "Mark L");
  assert.ok(markLResp, "Mark L should be disambiguated by mark.l@community.org");

  const markBResp = parsed.responses.find((r) => r.name === "Mark B");
  assert.ok(markBResp, "Mark B should be disambiguated by mark.b@community.org");

  // 3. Jordan's response was canonicalized to "Jordan"
  const jordanResp = parsed.responses.find((r) => r.name === "Jordan");
  assert.ok(jordanResp, "Jordan should be canonicalized from 'Jordy'");

  // 4. Carlos is in responses with name "Carlos" and in unrecognizedRespondents
  const carlosResp = parsed.responses.find((r) => r.name === "Carlos");
  assert.ok(carlosResp, "Carlos is in responses");
  assert.deepEqual(parsed.audit.unrecognizedRespondents, ["Carlos"]);

  // 5. Alexandra, Mark L, Mark B are NOT missing from active members
  const missingNames = parsed.audit.missingMembers.map((m) => m.name);
  assert.ok(!missingNames.includes("Alexandra"));
  assert.ok(!missingNames.includes("Mark L"));
  assert.ok(!missingNames.includes("Mark B"));

  // 6. Jordan was auto-reactivated!
  const reactivatedNames = parsed.audit.reactivatedMembers.map((m) => m.name);
  assert.ok(reactivatedNames.includes("Jordan"), "Jordan should be auto-reactivated");
});

test("Member Directory - Update member profile (emails, aliases, active status) in registry", () => {
  let members = [
    {
      name: "Alexandra",
      google_email: "alexandra@community.org",
      active: true,
      aliases: ["Sasha"],
    },
    {
      name: "Jordan",
      google_email: "jordan@community.org",
      active: true,
      aliases: [],
    },
  ];

  // Helper simulating the directory update operation
  function applyMemberUpdate(originalName, updatedMember, registry) {
    const emailVal = extractEmails(updatedMember.google_email).join(", ");
    const aliasVal = extractAliases(updatedMember.aliases);
    const target = originalName.trim().toLowerCase();

    const idx = registry.findIndex((m) => m.name.trim().toLowerCase() === target);
    const updated = {
      name: updatedMember.name.trim(),
      google_email: emailVal,
      active: Boolean(updatedMember.active),
      aliases: aliasVal,
      last_active_survey: updatedMember.last_active_survey || "2026-10",
    };

    if (idx >= 0) {
      registry[idx] = updated;
    } else {
      registry.push(updated);
    }
    return registry;
  }

  // 1. Update Alexandra: add nickname "Alex", add alternate email, set active to false
  members = applyMemberUpdate(
    "Alexandra",
    {
      name: "Alexandra",
      google_email: "alexandra@community.org, alex.personal@gmail.com; alex.work@corp.com",
      active: false,
      aliases: "Sasha, Alex, Sandy",
    },
    [...members]
  );

  const alex = members.find((m) => m.name === "Alexandra");
  assert.ok(alex);
  assert.equal(alex.active, false);
  assert.equal(
    alex.google_email,
    "alexandra@community.org, alex.personal@gmail.com, alex.work@corp.com"
  );
  assert.deepEqual(alex.aliases, ["Sasha", "Alex", "Sandy"]);

  // 2. Lookup by new nickname "Alex" resolves to Alexandra
  const matchAlex = findMatchingMember("Alex", undefined, members);
  assert.equal(matchAlex?.name, "Alexandra");

  // 3. Lookup by new alternate email resolves to Alexandra
  const matchEmail = findMatchingMember("Unknown", "alex.work@corp.com", members);
  assert.equal(matchEmail?.name, "Alexandra");

  // 4. Add a new member through the directory
  members = applyMemberUpdate(
    "Taylor",
    {
      name: "Taylor",
      google_email: "taylor@community.org",
      active: true,
      aliases: "Tay",
    },
    [...members]
  );

  const taylor = members.find((m) => m.name === "Taylor");
  assert.ok(taylor);
  assert.equal(taylor.active, true);
  assert.deepEqual(taylor.aliases, ["Tay"]);
});

test("Member Directory - Link unrecognized respondent alias to existing member", () => {
  let members = [
    {
      name: "Eleanor",
      google_email: "eleanor@community.org",
      active: true,
      aliases: [],
    },
  ];

  // Helper simulating the linkMemberAlias operation
  function applyLinkAlias(canonicalName, newAlias, registry) {
    const target = canonicalName.trim().toLowerCase();
    const idx = registry.findIndex((m) => m.name.trim().toLowerCase() === target);
    if (idx >= 0) {
      const existingAliases = extractAliases(registry[idx].aliases || []);
      const toAdd = extractAliases(newAlias);
      const merged = Array.from(new Set([...existingAliases, ...toAdd]));
      registry[idx] = {
        ...registry[idx],
        aliases: merged,
      };
    }
    return registry;
  }

  // Before linking: "Ellie" does not match Eleanor
  assert.equal(findMatchingMember("Ellie", undefined, members), null);

  // Link alias "Ellie" to Eleanor
  members = applyLinkAlias("Eleanor", "Ellie", [...members]);

  // After linking: "Ellie" resolves to Eleanor
  const match = findMatchingMember("Ellie", undefined, members);
  assert.ok(match);
  assert.equal(match.name, "Eleanor");
  assert.deepEqual(match.aliases, ["Ellie"]);

  // Linking additional aliases preserves existing ones
  members = applyLinkAlias("Eleanor", "Nora, Ellie", [...members]);
  const eleanor = members.find((m) => m.name === "Eleanor");
  assert.deepEqual(eleanor.aliases, ["Ellie", "Nora"]);
});
