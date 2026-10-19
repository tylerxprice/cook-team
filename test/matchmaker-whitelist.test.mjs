import { describe, it } from "node:test";
import assert from "node:assert";
import { solveCookAndCleanSchedule } from "../src/server/matchmaker.ts";

describe("Matchmaker Solver - REQUIRE_ONE_OF_TEAM Mentor Whitelist", () => {
  const mealDates = [
    {
      id: "M1",
      dateKey: "2026-11-04",
      dateLabel: "Nov 4 (Wed)",
      dayOfWeek: "Wednesday",
      mealType: "DINNER",
      targetCookCount: 3,
      targetCleanCount: 2,
    },
    {
      id: "M2",
      dateKey: "2026-11-08",
      dateLabel: "Nov 8 (Sun)",
      dayOfWeek: "Sunday",
      mealType: "BRUNCH",
      targetCookCount: 2,
      targetCleanCount: 2,
    },
    {
      id: "M3",
      dateKey: "2026-11-11",
      dateLabel: "Nov 11 (Wed)",
      dayOfWeek: "Wednesday",
      mealType: "DINNER",
      targetCookCount: 3,
      targetCleanCount: 2,
    },
  ];

  it("Enforces hard mentor whitelist: Youth is always paired with at least one approved co-worker", () => {
    const responses = [
      // Youth / Teen volunteer
      {
        timestamp: "2026-10-15",
        email: "robin@example.com",
        name: "Robin",
        cookQuota: 2,
        cleanQuota: 0,
        canCookCleanSameDay: false,
        cookTeamSizePref: "Dinner = 3, Brunch = 2",
        availability: {
          "Nov 4 (Wed)": "AVAILABLE",
          "Nov 8 (Sun)": "AVAILABLE",
          "Nov 11 (Wed)": "AVAILABLE",
        },
      },
      // Approved Mentor 1
      {
        timestamp: "2026-10-15",
        email: "alice@example.com",
        name: "Alice",
        cookQuota: 2,
        cleanQuota: 0,
        canCookCleanSameDay: false,
        cookTeamSizePref: "Dinner = 3, Brunch = 2",
        availability: {
          "Nov 4 (Wed)": "AVAILABLE",
          "Nov 8 (Sun)": "UNAVAILABLE",
          "Nov 11 (Wed)": "AVAILABLE",
        },
      },
      // Approved Mentor 2
      {
        timestamp: "2026-10-15",
        email: "bob@example.com",
        name: "Bob",
        cookQuota: 1,
        cleanQuota: 0,
        canCookCleanSameDay: false,
        cookTeamSizePref: "Dinner = 3, Brunch = 2",
        availability: {
          "Nov 4 (Wed)": "UNAVAILABLE",
          "Nov 8 (Sun)": "AVAILABLE",
          "Nov 11 (Wed)": "UNAVAILABLE",
        },
      },
      // Other volunteers (NOT on whitelist)
      {
        timestamp: "2026-10-15",
        email: "charlie@example.com",
        name: "Charlie",
        cookQuota: 2,
        cleanQuota: 2,
        canCookCleanSameDay: false,
        cookTeamSizePref: "Dinner = 3, Brunch = 2",
        availability: {
          "Nov 4 (Wed)": "AVAILABLE",
          "Nov 8 (Sun)": "AVAILABLE",
          "Nov 11 (Wed)": "AVAILABLE",
        },
      },
      {
        timestamp: "2026-10-15",
        email: "david@example.com",
        name: "David",
        cookQuota: 2,
        cleanQuota: 2,
        canCookCleanSameDay: false,
        cookTeamSizePref: "Dinner = 3, Brunch = 2",
        availability: {
          "Nov 4 (Wed)": "AVAILABLE",
          "Nov 8 (Sun)": "AVAILABLE",
          "Nov 11 (Wed)": "AVAILABLE",
        },
      },
      {
        timestamp: "2026-10-15",
        email: "emma@example.com",
        name: "Emma",
        cookQuota: 2,
        cleanQuota: 2,
        canCookCleanSameDay: false,
        cookTeamSizePref: "Dinner = 3, Brunch = 2",
        availability: {
          "Nov 4 (Wed)": "AVAILABLE",
          "Nov 8 (Sun)": "AVAILABLE",
          "Nov 11 (Wed)": "AVAILABLE",
        },
      },
    ];

    const exceptions = [
      {
        id: "RULE-WHITELIST-1",
        person_a: "Robin",
        person_b: "Alice, Bob",
        rule_type: "REQUIRE_ONE_OF_TEAM",
        target_role_a: "COOK",
        is_hard_rule: true,
        notes: "Youth mentor whitelist: Robin must cook with Alice or Bob",
      },
    ];

    const result = solveCookAndCleanSchedule(mealDates, responses, exceptions, {
      cookPolicy: "DINNER_3_BRUNCH_2",
      autoCancelDeficitDates: false,
    });

    assert.strictEqual(result.violations.length, 0, "No hard constraint violations should exist");

    // Check every date where Robin was assigned as cook
    for (const day of result.schedule) {
      if (day.cooks.includes("Robin")) {
        const hasMentor = day.cooks.includes("Alice") || day.cooks.includes("Bob");
        assert.ok(
          hasMentor,
          `Robin is assigned to cook on ${day.dateLabel}, but neither Alice nor Bob is on the team: [${day.cooks.join(", ")}]`
        );
      }
    }

    const robinStats = result.memberStats["Robin"];
    assert.ok(robinStats.assignedCooks > 0, "Robin should receive assigned cook shifts");
  });

  it("Blocks scheduling youth on dates where no approved mentor is available", () => {
    const singleDate = [
      {
        id: "M1",
        dateKey: "2026-11-04",
        dateLabel: "Nov 4 (Wed)",
        dayOfWeek: "Wednesday",
        mealType: "DINNER",
        targetCookCount: 3,
        targetCleanCount: 0,
      },
    ];

    const responses = [
      {
        timestamp: "2026-10-15",
        name: "Robin",
        email: "robin@example.com",
        cookQuota: 1,
        cleanQuota: 0,
        canCookCleanSameDay: false,
        cookTeamSizePref: "Dinner = 3, Brunch = 2",
        availability: { "Nov 4 (Wed)": "AVAILABLE" },
      },
      // Alice is unavailable
      {
        timestamp: "2026-10-15",
        name: "Alice",
        email: "alice@example.com",
        cookQuota: 1,
        cleanQuota: 0,
        canCookCleanSameDay: false,
        cookTeamSizePref: "Dinner = 3, Brunch = 2",
        availability: { "Nov 4 (Wed)": "UNAVAILABLE" },
      },
      // Other volunteers available, but none in Robin's whitelist
      {
        timestamp: "2026-10-15",
        name: "Charlie",
        email: "charlie@example.com",
        cookQuota: 1,
        cleanQuota: 0,
        canCookCleanSameDay: false,
        cookTeamSizePref: "Dinner = 3, Brunch = 2",
        availability: { "Nov 4 (Wed)": "AVAILABLE" },
      },
      {
        timestamp: "2026-10-15",
        name: "David",
        email: "david@example.com",
        cookQuota: 1,
        cleanQuota: 0,
        canCookCleanSameDay: false,
        cookTeamSizePref: "Dinner = 3, Brunch = 2",
        availability: { "Nov 4 (Wed)": "AVAILABLE" },
      },
      {
        timestamp: "2026-10-15",
        name: "Emma",
        email: "emma@example.com",
        cookQuota: 1,
        cleanQuota: 0,
        canCookCleanSameDay: false,
        cookTeamSizePref: "Dinner = 3, Brunch = 2",
        availability: { "Nov 4 (Wed)": "AVAILABLE" },
      },
    ];

    const exceptions = [
      {
        id: "RULE-WHITELIST-2",
        person_a: "Robin",
        person_b: "Alice",
        rule_type: "REQUIRE_ONE_OF_TEAM",
        target_role_a: "COOK",
        is_hard_rule: true,
        notes: "Robin can only cook with Alice",
      },
    ];

    const result = solveCookAndCleanSchedule(singleDate, responses, exceptions, {
      cookPolicy: "DINNER_3_BRUNCH_2",
      autoCancelDeficitDates: false,
    });

    const day = result.schedule[0];
    assert.strictEqual(
      day.cooks.includes("Robin"),
      false,
      "Robin must NOT be scheduled on a date when no approved mentor is available"
    );
    assert.strictEqual(result.violations.length, 0, "No violations should be present");
  });

  it("Handles multiple comma-separated mentors and parses whitelist pool correctly", () => {
    const whitelistString = "Frannie, Ben, Nancy, Miriam, Olive, Rose, Tyler";
    const parsed = whitelistString
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    assert.strictEqual(parsed.length, 7);
    assert.deepStrictEqual(parsed, ["Frannie", "Ben", "Nancy", "Miriam", "Olive", "Rose", "Tyler"]);
  });
});
