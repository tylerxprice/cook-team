import test from "node:test";
import assert from "node:assert/strict";
import { mergeSurveyResponses } from "../src/server/parser.ts";

test("Web Survey - mergeSurveyResponses deduplicates by member name with latest timestamp winning", () => {
  // Scenario 1: Older Google Form response, newer Web response
  const formResponses = [
    {
      timestamp: "10/15/2026 10:00:00",
      email: "brenda@example.com",
      name: "Brenda",
      cookTeamSizePref: "Dinner = 3, Brunch = 2",
      canCookCleanSameDay: false,
      cookQuota: 1,
      cleanQuota: 1,
      maxTotalShifts: 2,
      availability: { "2026-11-05": "AVAILABLE" },
      specialInstructions: "Original form note",
      source: "form",
    },
    {
      timestamp: "10/15/2026 11:00:00",
      email: "sam@example.com",
      name: "Sam",
      cookTeamSizePref: "Dinner = 3, Brunch = 2",
      canCookCleanSameDay: false,
      cookQuota: 1,
      cleanQuota: 1,
      availability: { "2026-11-05": "AVAILABLE" },
      source: "form",
    },
  ];

  const webResponses = [
    {
      // Newer than Form response for Brenda
      timestamp: "2026-10-18T14:30:00.000Z",
      email: "brenda@example.com",
      name: "Brenda",
      cookTeamSizePref: "2 for either",
      canCookCleanSameDay: true,
      sameDayPref: "PREFERRED",
      cookQuota: 2,
      cleanQuota: 2,
      maxTotalShifts: 3,
      availability: { "2026-11-05": "COOK_ONLY", "2026-11-08": "AVAILABLE" },
      specialInstructions: "Updated via Web app",
      source: "web",
    },
    {
      // Taylor submitted only via Web
      timestamp: "2026-10-17T12:00:00.000Z",
      email: "taylor@example.com",
      name: "Taylor",
      cookTeamSizePref: "Dinner = 3, Brunch = 2",
      canCookCleanSameDay: false,
      cookQuota: 1,
      cleanQuota: 1,
      availability: { "2026-11-08": "AVAILABLE" },
      source: "web",
    },
  ];

  const { responses: merged } = mergeSurveyResponses(formResponses, webResponses);

  // Total unique members: Brenda, Sam, Taylor = 3
  assert.equal(merged.length, 3);

  // Brenda should have the Web response data because 2026-10-18 > 10/15/2026
  const brenda = merged.find((r) => r.name === "Brenda");
  assert.ok(brenda);
  assert.equal(brenda.cookQuota, 2);
  assert.equal(brenda.cleanQuota, 2);
  assert.equal(brenda.maxTotalShifts, 3);
  assert.equal(brenda.source, "web");
  assert.equal(brenda.specialInstructions, "Updated via Web app");
  assert.equal(brenda.availability["2026-11-05"], "COOK_ONLY");

  // Sam should remain from Form
  const sam = merged.find((r) => r.name === "Sam");
  assert.ok(sam);
  assert.equal(sam.source, "form");
  assert.equal(sam.cookQuota, 1);

  // Taylor should be present from Web
  const taylor = merged.find((r) => r.name === "Taylor");
  assert.ok(taylor);
  assert.equal(taylor.source, "web");
});

test("Web Survey - Form response wins if resident later edits or re-submits Form with newer timestamp", () => {
  const formResponses = [
    {
      // Newer Form submission after Web submission
      timestamp: "10/19/2026 16:00:00",
      email: "robin@example.com",
      name: "Robin Banks",
      cookTeamSizePref: "Dinner = 3, Brunch = 2",
      canCookCleanSameDay: false,
      cookQuota: 2,
      cleanQuota: 0,
      availability: { "2026-11-05": "AVAILABLE" },
      specialInstructions: "Form edit overrides prior web entry",
      source: "form",
    },
  ];

  const webResponses = [
    {
      // Older Web submission
      timestamp: "2026-10-17T10:00:00.000Z",
      email: "robin@example.com",
      name: "Robin Banks",
      cookTeamSizePref: "Dinner = 3, Brunch = 2",
      canCookCleanSameDay: false,
      cookQuota: 1,
      cleanQuota: 1,
      availability: { "2026-11-05": "AVAILABLE" },
      source: "web",
    },
  ];

  const { responses: merged } = mergeSurveyResponses(formResponses, webResponses);
  assert.equal(merged.length, 1);

  const robin = merged[0];
  assert.equal(robin.name, "Robin Banks");
  assert.equal(robin.source, "form");
  assert.equal(robin.cookQuota, 2);
  assert.equal(robin.cleanQuota, 0);
  assert.equal(robin.specialInstructions, "Form edit overrides prior web entry");
});

test("Web Survey - Handles ISO timestamps and localized slash timestamps cleanly", () => {
  const listA = [
    {
      timestamp: "9/1/2026 08:30:00",
      name: "Alex",
      cookQuota: 1,
      cleanQuota: 1,
      availability: {},
      source: "form",
    },
  ];
  const listB = [
    {
      timestamp: "2026-09-02T10:00:00.000Z",
      name: "Alex",
      cookQuota: 3,
      cleanQuota: 1,
      availability: {},
      source: "web",
    },
  ];

  const { responses: merged } = mergeSurveyResponses(listA, listB);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].cookQuota, 3);
  assert.equal(merged[0].source, "web");
});
