import test from "node:test";
import assert from "node:assert/strict";
import {
  SYSTEM_QUERY_PARAMS,
  filterCleanUrlParams,
  toGasParamsObject,
  parseStepFromHash,
  getAppViewFromUrl,
} from "../src/client/App.tsx";

test("URL Sanitization - SYSTEM_QUERY_PARAMS identifies internal Google and tracking parameters", () => {
  assert.ok(SYSTEM_QUERY_PARAMS.has("createoauthdialog"));
  assert.ok(SYSTEM_QUERY_PARAMS.has("authuser"));
  assert.ok(SYSTEM_QUERY_PARAMS.has("usp"));
  assert.ok(SYSTEM_QUERY_PARAMS.has("gclid"));
  assert.ok(SYSTEM_QUERY_PARAMS.has("gad_source"));
});

test("URL Sanitization - filterCleanUrlParams strips internal Google OAuth parameters", () => {
  const dirty = new URLSearchParams(
    "createOAuthDialog=true&month=2026-10&name=Tyler&view=schedule&authuser=0&usp=sharing"
  );
  const clean = filterCleanUrlParams(dirty);

  assert.equal(clean.get("createOAuthDialog"), null);
  assert.equal(clean.get("createoauthdialog"), null);
  assert.equal(clean.get("authuser"), null);
  assert.equal(clean.get("usp"), null);

  assert.equal(clean.get("month"), "2026-10");
  assert.equal(clean.get("name"), "Tyler");
  assert.equal(clean.get("view"), "schedule");
});

test("URL Sanitization - toGasParamsObject converts URLSearchParams to plain object without system params", () => {
  const params = new URLSearchParams(
    "view=schedule&month=2026-12&name=Tyler&createOAuthDialog=true"
  );
  const obj = toGasParamsObject(params);

  assert.deepEqual(obj, {
    view: "schedule",
    month: "2026-12",
    name: "Tyler",
  });
  assert.equal(obj.createOAuthDialog, undefined);
  assert.equal(obj.createoauthdialog, undefined);
});

test("URL Sanitization - parseStepFromHash parses valid wizard hashes and ignores corrupted query hashes", () => {
  assert.equal(parseStepFromHash("#step-1"), 1);
  assert.equal(parseStepFromHash("#step-2"), 2);
  assert.equal(parseStepFromHash("#step-3"), 3);
  assert.equal(parseStepFromHash("#step-4"), 4);

  // Without leading hash
  assert.equal(parseStepFromHash("step-2"), 2);

  // Corrupted hash with query string parameters should default safely to 1
  assert.equal(
    parseStepFromHash("#createOAuthDialog=true&month=2026-10&name=Tyler&view=schedule"),
    1
  );
  assert.equal(parseStepFromHash(""), 1);
});

test("URL Sanitization - getAppViewFromUrl resolves views and protects against corrupted hash", () => {
  const scheduleParams = new URLSearchParams("view=schedule&month=2026-10");
  assert.equal(getAppViewFromUrl(scheduleParams, ""), "resident");

  const coordParams = new URLSearchParams("view=coordinator");
  assert.equal(getAppViewFromUrl(coordParams, "#step-2"), "coordinator");

  const surveyParams = new URLSearchParams("view=survey&month=2026-11");
  assert.equal(getAppViewFromUrl(surveyParams, ""), "survey");

  const emptyParams = new URLSearchParams("");
  assert.equal(getAppViewFromUrl(emptyParams, "#step-3"), "coordinator");

  // Corrupted hash does not mistakenly trigger coordinator view
  assert.equal(
    getAppViewFromUrl(
      emptyParams,
      "#createOAuthDialog=true&month=2026-10&name=Tyler&view=schedule"
    ),
    "portal"
  );
});
