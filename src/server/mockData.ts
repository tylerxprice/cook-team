import {
  Member,
  ExceptionRule,
  MealDate,
  SurveyResponse,
  CompletenessAudit,
  IntakePayload,
} from "./types";

export const MOCK_MEAL_DATES: MealDate[] = [
  { id: "MEAL-1", dateKey: "2026-10-01", dateLabel: "Oct 1 (Thur)", dayOfWeek: "Thursday", mealType: "DINNER", targetCookCount: 3, targetCleanCount: 3 },
  { id: "MEAL-2", dateKey: "2026-10-04", dateLabel: "Oct 4 (Sun, Brunch)", dayOfWeek: "Sunday", mealType: "BRUNCH", targetCookCount: 2, targetCleanCount: 2 },
  { id: "MEAL-3", dateKey: "2026-10-05", dateLabel: "Oct 5 (Mon)", dayOfWeek: "Monday", mealType: "DINNER", targetCookCount: 3, targetCleanCount: 3 },
  { id: "MEAL-4", dateKey: "2026-10-08", dateLabel: "Oct 8 (Thur)", dayOfWeek: "Thursday", mealType: "DINNER", targetCookCount: 3, targetCleanCount: 3 },
  { id: "MEAL-5", dateKey: "2026-10-11", dateLabel: "Oct 11 (Sun, Dinner)", dayOfWeek: "Sunday", mealType: "DINNER", targetCookCount: 3, targetCleanCount: 3 },
  { id: "MEAL-6", dateKey: "2026-10-12", dateLabel: "Oct 12 (Mon) - Thanksgiving", dayOfWeek: "Monday", mealType: "DINNER", specialNote: "Thanksgiving", targetCookCount: 3, targetCleanCount: 3 },
  { id: "MEAL-7", dateKey: "2026-10-15", dateLabel: "Oct 15 (Thurs)", dayOfWeek: "Thursday", mealType: "DINNER", targetCookCount: 3, targetCleanCount: 3 },
  { id: "MEAL-8", dateKey: "2026-10-18", dateLabel: "Oct 18 (Sun, Brunch)", dayOfWeek: "Sunday", mealType: "BRUNCH", targetCookCount: 2, targetCleanCount: 2 },
  { id: "MEAL-9", dateKey: "2026-10-19", dateLabel: "Oct 19 (Mon)", dayOfWeek: "Monday", mealType: "DINNER", targetCookCount: 3, targetCleanCount: 3 },
  { id: "MEAL-10", dateKey: "2026-10-22", dateLabel: "Oct 22 (Thur)", dayOfWeek: "Thursday", mealType: "DINNER", targetCookCount: 3, targetCleanCount: 3 },
  { id: "MEAL-11", dateKey: "2026-10-25", dateLabel: "Oct 25 (Sun, Dinner) - Community Meeting", dayOfWeek: "Sunday", mealType: "DINNER", specialNote: "Community Meeting", targetCookCount: 3, targetCleanCount: 3 },
  { id: "MEAL-12", dateKey: "2026-10-26", dateLabel: "Oct 26 (Mon)", dayOfWeek: "Monday", mealType: "DINNER", targetCookCount: 3, targetCleanCount: 3 },
  { id: "MEAL-13", dateKey: "2026-10-29", dateLabel: "Oct 29 (Thur)", dayOfWeek: "Thursday", mealType: "DINNER", targetCookCount: 3, targetCleanCount: 3 },
];

export const MOCK_MEMBERS: Member[] = [
  { name: "Tyler", google_email: "tylerxprice@gmail.com", active: true, last_active_survey: "2026-09" },
  { name: "Brenda", google_email: "brenda.meals@example.com", active: true, last_active_survey: "2026-09" },
  { name: "Cyrena", google_email: "cyrena.art@example.com", active: true, last_active_survey: "2026-09" },
  { name: "Rose", google_email: "rose.gardens@example.com", active: true, last_active_survey: "2026-09" },
  { name: "Sam", google_email: "sam.smith@example.com", active: true, last_active_survey: "2026-09" },
  { name: "Alex", google_email: "alex.tech@example.com", active: true, last_active_survey: "2026-09" },
  { name: "David", google_email: "david.miller@example.com", active: true, last_active_survey: "2026-09" },
  { name: "Sarah", google_email: "sarah.baker@example.com", active: true, last_active_survey: "2026-09" },
  { name: "Michael", google_email: "michael.clark@example.com", active: true, last_active_survey: "2026-09" },
  { name: "Emily", google_email: "emily.davis@example.com", active: true, last_active_survey: "2026-09" },
  { name: "James", google_email: "james.wilson@example.com", active: true, last_active_survey: "2026-09" },
  { name: "Lisa", google_email: "lisa.anderson@example.com", active: true, last_active_survey: "2026-09" },
  { name: "Robert", google_email: "robert.taylor@example.com", active: true, last_active_survey: "2026-09" },
  { name: "Jessica", google_email: "jessica.thomas@example.com", active: true, last_active_survey: "2026-09" },
  { name: "William", google_email: "william.jackson@example.com", active: true, last_active_survey: "2026-09" },
  { name: "Ashley", google_email: "ashley.white@example.com", active: true, last_active_survey: "2026-09" },
  { name: "Brian", google_email: "brian.harris@example.com", active: true, last_active_survey: "2026-09" },
  { name: "Megan", google_email: "megan.martin@example.com", active: true, last_active_survey: "2026-09" },
  { name: "Kevin", google_email: "kevin.thompson@example.com", active: true, last_active_survey: "2026-09" },
  { name: "Rachel", google_email: "rachel.garcia@example.com", active: true, last_active_survey: "2026-09" },
  { name: "Jason", google_email: "jason.martinez@example.com", active: true, last_active_survey: "2026-09" },
  { name: "Hannah", google_email: "hannah.robinson@example.com", active: true, last_active_survey: "2026-09" },
  { name: "Daniel", google_email: "daniel.clark@example.com", active: true, last_active_survey: "2026-09" },
  { name: "Olivia", google_email: "olivia.rodriguez@example.com", active: true, last_active_survey: "2026-09" },
  { name: "Matthew", google_email: "matthew.lewis@example.com", active: true, last_active_survey: "2026-09" },
  { name: "Sophia", google_email: "sophia.lee@example.com", active: true, last_active_survey: "2026-09" },
  { name: "Andrew", google_email: "andrew.walker@example.com", active: true, last_active_survey: "2026-09" },
  { name: "Grace", google_email: "grace.hall@example.com", active: true, last_active_survey: "2026-09" },
  { name: "Marcus", google_email: "marcus.allen@example.com", active: true, last_active_survey: "2026-08" },
  { name: "Chloe", google_email: "chloe.young@example.com", active: true, last_active_survey: "2026-08" },
  { name: "Jordan", google_email: "jordan.away@example.com", active: false, last_active_survey: "2026-01" },
  { name: "Elena", google_email: "elena.returned@example.com", active: false, last_active_survey: "2025-12" },
];

export const MOCK_EXCEPTIONS: ExceptionRule[] = [
  {
    id: "RULE-01",
    person_a: "Tyler",
    person_b: "Rose",
    rule_type: "NOT_SAME_DAY",
    is_hard_rule: true,
    notes: "Childcare coverage needed at home",
  },
  {
    id: "RULE-02",
    person_a: "Sam",
    person_b: "Alex",
    rule_type: "NOT_SAME_TEAM",
    is_hard_rule: true,
    notes: "Roommates - share household duties separately",
  },
  {
    id: "RULE-03",
    person_a: "Cyrena",
    rule_type: "PREF_SAME_DAY",
    target_role_a: "ANY",
    is_hard_rule: false,
    notes: "Prefers doing cook and clean on the same day",
  },
  {
    id: "RULE-04",
    person_a: "Emily",
    person_b: "David",
    rule_type: "PAIR_WITH_ROLE",
    target_role_a: "COOK",
    target_role_b: "COOK",
    is_hard_rule: false,
    notes: "Enjoy cooking together",
  },
];

// 1. STANDARD HEALTHY RESPONSES
export const MOCK_SURVEY_RESPONSES: SurveyResponse[] = [
  {
    timestamp: "8/26/2026 23:30:20",
    email: "tylerxprice@gmail.com",
    name: "Tyler",
    availability: {
      "Oct 1 (Thur)": "AVAILABLE", "Oct 4 (Sun, Brunch)": "AVAILABLE", "Oct 5 (Mon)": "UNAVAILABLE",
      "Oct 8 (Thur)": "UNAVAILABLE", "Oct 11 (Sun, Dinner)": "UNAVAILABLE", "Oct 12 (Mon) - Thanksgiving": "CLEAN_ONLY",
      "Oct 15 (Thurs)": "UNAVAILABLE", "Oct 18 (Sun, Brunch)": "UNAVAILABLE", "Oct 19 (Mon)": "UNAVAILABLE",
      "Oct 22 (Thur)": "UNAVAILABLE", "Oct 25 (Sun, Dinner) - Community Meeting": "COOK_ONLY", "Oct 26 (Mon)": "UNAVAILABLE", "Oct 29 (Thur)": "UNAVAILABLE",
    },
    cookTeamSizePref: "Dinner = 3, Brunch = 2", canCookCleanSameDay: false, cookQuota: 1, cleanQuota: 1, specialInstructions: "Nope",
  },
  {
    timestamp: "8/27/2026 09:12:00", email: "brenda.meals@example.com", name: "Brenda",
    availability: { "Oct 1 (Thur)": "AVAILABLE", "Oct 4 (Sun, Brunch)": "COOK_ONLY", "Oct 5 (Mon)": "AVAILABLE", "Oct 8 (Thur)": "AVAILABLE", "Oct 11 (Sun, Dinner)": "CLEAN_ONLY", "Oct 12 (Mon) - Thanksgiving": "AVAILABLE", "Oct 15 (Thurs)": "AVAILABLE", "Oct 18 (Sun, Brunch)": "COOK_ONLY", "Oct 19 (Mon)": "AVAILABLE", "Oct 22 (Thur)": "AVAILABLE", "Oct 25 (Sun, Dinner) - Community Meeting": "AVAILABLE", "Oct 26 (Mon)": "AVAILABLE", "Oct 29 (Thur)": "AVAILABLE" },
    cookTeamSizePref: "Dinner = 3, Brunch = 2", canCookCleanSameDay: false, cookQuota: 2, cleanQuota: 2, specialInstructions: "Love cooking brunch!",
  },
  {
    timestamp: "8/27/2026 10:05:00", email: "cyrena.art@example.com", name: "Cyrena",
    availability: { "Oct 1 (Thur)": "AVAILABLE", "Oct 4 (Sun, Brunch)": "AVAILABLE", "Oct 5 (Mon)": "AVAILABLE", "Oct 8 (Thur)": "AVAILABLE", "Oct 11 (Sun, Dinner)": "AVAILABLE", "Oct 12 (Mon) - Thanksgiving": "UNAVAILABLE", "Oct 15 (Thurs)": "AVAILABLE", "Oct 18 (Sun, Brunch)": "AVAILABLE", "Oct 19 (Mon)": "AVAILABLE", "Oct 22 (Thur)": "AVAILABLE", "Oct 25 (Sun, Dinner) - Community Meeting": "AVAILABLE", "Oct 26 (Mon)": "AVAILABLE", "Oct 29 (Thur)": "AVAILABLE" },
    cookTeamSizePref: "Dinner = 3, Brunch = 2", canCookCleanSameDay: true, cookQuota: 2, cleanQuota: 2, specialInstructions: "Happy to cook & clean same day to get it all done at once!",
  },
  {
    timestamp: "8/27/2026 10:30:00", email: "rose.gardens@example.com", name: "Rose",
    availability: { "Oct 1 (Thur)": "CLEAN_ONLY", "Oct 4 (Sun, Brunch)": "AVAILABLE", "Oct 5 (Mon)": "AVAILABLE", "Oct 8 (Thur)": "AVAILABLE", "Oct 11 (Sun, Dinner)": "COOK_ONLY", "Oct 12 (Mon) - Thanksgiving": "UNAVAILABLE", "Oct 15 (Thurs)": "AVAILABLE", "Oct 18 (Sun, Brunch)": "AVAILABLE", "Oct 19 (Mon)": "CLEAN_ONLY", "Oct 22 (Thur)": "AVAILABLE", "Oct 25 (Sun, Dinner) - Community Meeting": "AVAILABLE", "Oct 26 (Mon)": "AVAILABLE", "Oct 29 (Thur)": "AVAILABLE" },
    cookTeamSizePref: "Dinner = 3, Brunch = 2", canCookCleanSameDay: false, cookQuota: 1, cleanQuota: 2, specialInstructions: "Please no shifts on same day as Tyler (childcare)",
  },
  {
    timestamp: "8/27/2026 11:15:00", email: "sam.smith@example.com", name: "Sam",
    availability: { "Oct 1 (Thur)": "AVAILABLE", "Oct 4 (Sun, Brunch)": "AVAILABLE", "Oct 5 (Mon)": "COOK_ONLY", "Oct 8 (Thur)": "AVAILABLE", "Oct 11 (Sun, Dinner)": "AVAILABLE", "Oct 12 (Mon) - Thanksgiving": "AVAILABLE", "Oct 15 (Thurs)": "AVAILABLE", "Oct 18 (Sun, Brunch)": "AVAILABLE", "Oct 19 (Mon)": "COOK_ONLY", "Oct 22 (Thur)": "AVAILABLE", "Oct 25 (Sun, Dinner) - Community Meeting": "AVAILABLE", "Oct 26 (Mon)": "AVAILABLE", "Oct 29 (Thur)": "AVAILABLE" },
    cookTeamSizePref: "Dinner = 3, Brunch = 2", canCookCleanSameDay: false, cookQuota: 2, cleanQuota: 2, specialInstructions: "Roommates with Alex - different team please",
  },
  {
    timestamp: "8/27/2026 11:45:00", email: "alex.tech@example.com", name: "Alex",
    availability: { "Oct 1 (Thur)": "COOK_ONLY", "Oct 4 (Sun, Brunch)": "CLEAN_ONLY", "Oct 5 (Mon)": "UNAVAILABLE", "Oct 8 (Thur)": "COOK_ONLY", "Oct 11 (Sun, Dinner)": "AVAILABLE", "Oct 12 (Mon) - Thanksgiving": "AVAILABLE", "Oct 15 (Thurs)": "COOK_ONLY", "Oct 18 (Sun, Brunch)": "AVAILABLE", "Oct 19 (Mon)": "UNAVAILABLE", "Oct 22 (Thur)": "COOK_ONLY", "Oct 25 (Sun, Dinner) - Community Meeting": "AVAILABLE", "Oct 26 (Mon)": "AVAILABLE", "Oct 29 (Thur)": "AVAILABLE" },
    cookTeamSizePref: "Dinner = 3, Brunch = 2", canCookCleanSameDay: false, cookQuota: 1, cleanQuota: 1, specialInstructions: "Prefer Thursday dinners",
  },
  {
    timestamp: "8/27/2026 12:10:00", email: "david.miller@example.com", name: "David",
    availability: { "Oct 1 (Thur)": "AVAILABLE", "Oct 4 (Sun, Brunch)": "AVAILABLE", "Oct 5 (Mon)": "AVAILABLE", "Oct 8 (Thur)": "AVAILABLE", "Oct 11 (Sun, Dinner)": "COOK_ONLY", "Oct 12 (Mon) - Thanksgiving": "AVAILABLE", "Oct 15 (Thurs)": "AVAILABLE", "Oct 18 (Sun, Brunch)": "AVAILABLE", "Oct 19 (Mon)": "AVAILABLE", "Oct 22 (Thur)": "AVAILABLE", "Oct 25 (Sun, Dinner) - Community Meeting": "COOK_ONLY", "Oct 26 (Mon)": "AVAILABLE", "Oct 29 (Thur)": "AVAILABLE" },
    cookTeamSizePref: "Dinner = 3, Brunch = 2", canCookCleanSameDay: false, cookQuota: 1, cleanQuota: 1, specialInstructions: "",
  },
  {
    timestamp: "8/27/2026 12:45:00", email: "sarah.baker@example.com", name: "Sarah",
    availability: { "Oct 1 (Thur)": "COOK_ONLY", "Oct 4 (Sun, Brunch)": "AVAILABLE", "Oct 5 (Mon)": "CLEAN_ONLY", "Oct 8 (Thur)": "COOK_ONLY", "Oct 11 (Sun, Dinner)": "AVAILABLE", "Oct 12 (Mon) - Thanksgiving": "CLEAN_ONLY", "Oct 15 (Thurs)": "COOK_ONLY", "Oct 18 (Sun, Brunch)": "AVAILABLE", "Oct 19 (Mon)": "CLEAN_ONLY", "Oct 22 (Thur)": "COOK_ONLY", "Oct 25 (Sun, Dinner) - Community Meeting": "AVAILABLE", "Oct 26 (Mon)": "CLEAN_ONLY", "Oct 29 (Thur)": "COOK_ONLY" },
    cookTeamSizePref: "Dinner = 3, Brunch = 2", canCookCleanSameDay: false, cookQuota: 2, cleanQuota: 1, specialInstructions: "Can only clean on Mondays",
  },
  {
    timestamp: "8/27/2026 13:00:00", email: "michael.clark@example.com", name: "Michael",
    availability: { "Oct 1 (Thur)": "AVAILABLE", "Oct 4 (Sun, Brunch)": "AVAILABLE", "Oct 5 (Mon)": "AVAILABLE", "Oct 8 (Thur)": "AVAILABLE", "Oct 11 (Sun, Dinner)": "AVAILABLE", "Oct 12 (Mon) - Thanksgiving": "AVAILABLE", "Oct 15 (Thurs)": "AVAILABLE", "Oct 18 (Sun, Brunch)": "AVAILABLE", "Oct 19 (Mon)": "AVAILABLE", "Oct 22 (Thur)": "AVAILABLE", "Oct 25 (Sun, Dinner) - Community Meeting": "AVAILABLE", "Oct 26 (Mon)": "AVAILABLE", "Oct 29 (Thur)": "AVAILABLE" },
    cookTeamSizePref: "Dinner = 3, Brunch = 2", canCookCleanSameDay: false, cookQuota: 1, cleanQuota: 1, specialInstructions: "",
  },
  {
    timestamp: "8/27/2026 13:20:00", email: "emily.davis@example.com", name: "Emily",
    availability: { "Oct 1 (Thur)": "AVAILABLE", "Oct 4 (Sun, Brunch)": "AVAILABLE", "Oct 5 (Mon)": "AVAILABLE", "Oct 8 (Thur)": "AVAILABLE", "Oct 11 (Sun, Dinner)": "COOK_ONLY", "Oct 12 (Mon) - Thanksgiving": "AVAILABLE", "Oct 15 (Thurs)": "AVAILABLE", "Oct 18 (Sun, Brunch)": "AVAILABLE", "Oct 19 (Mon)": "AVAILABLE", "Oct 22 (Thur)": "AVAILABLE", "Oct 25 (Sun, Dinner) - Community Meeting": "COOK_ONLY", "Oct 26 (Mon)": "AVAILABLE", "Oct 29 (Thur)": "AVAILABLE" },
    cookTeamSizePref: "Dinner = 3, Brunch = 2", canCookCleanSameDay: false, cookQuota: 2, cleanQuota: 1, specialInstructions: "Would love to cook with David!",
  },
  { timestamp: "8/27/2026 14:00:00", email: "james.wilson@example.com", name: "James", availability: { "Oct 1 (Thur)": "AVAILABLE", "Oct 4 (Sun, Brunch)": "AVAILABLE", "Oct 5 (Mon)": "AVAILABLE", "Oct 8 (Thur)": "AVAILABLE", "Oct 11 (Sun, Dinner)": "AVAILABLE", "Oct 12 (Mon) - Thanksgiving": "AVAILABLE", "Oct 15 (Thurs)": "AVAILABLE", "Oct 18 (Sun, Brunch)": "AVAILABLE", "Oct 19 (Mon)": "AVAILABLE", "Oct 22 (Thur)": "AVAILABLE", "Oct 25 (Sun, Dinner) - Community Meeting": "AVAILABLE", "Oct 26 (Mon)": "AVAILABLE", "Oct 29 (Thur)": "AVAILABLE" }, cookTeamSizePref: "Dinner = 3, Brunch = 2", canCookCleanSameDay: false, cookQuota: 1, cleanQuota: 1, specialInstructions: "" },
  { timestamp: "8/27/2026 14:30:00", email: "lisa.anderson@example.com", name: "Lisa", availability: { "Oct 1 (Thur)": "CLEAN_ONLY", "Oct 4 (Sun, Brunch)": "AVAILABLE", "Oct 5 (Mon)": "AVAILABLE", "Oct 8 (Thur)": "CLEAN_ONLY", "Oct 11 (Sun, Dinner)": "AVAILABLE", "Oct 12 (Mon) - Thanksgiving": "AVAILABLE", "Oct 15 (Thurs)": "CLEAN_ONLY", "Oct 18 (Sun, Brunch)": "AVAILABLE", "Oct 19 (Mon)": "AVAILABLE", "Oct 22 (Thur)": "CLEAN_ONLY", "Oct 25 (Sun, Dinner) - Community Meeting": "AVAILABLE", "Oct 26 (Mon)": "AVAILABLE", "Oct 29 (Thur)": "CLEAN_ONLY" }, cookTeamSizePref: "Dinner = 3, Brunch = 2", canCookCleanSameDay: false, cookQuota: 1, cleanQuota: 2, specialInstructions: "Prefer cleaning shifts" },
  { timestamp: "8/27/2026 15:00:00", email: "robert.taylor@example.com", name: "Robert", availability: { "Oct 1 (Thur)": "AVAILABLE", "Oct 4 (Sun, Brunch)": "COOK_ONLY", "Oct 5 (Mon)": "AVAILABLE", "Oct 8 (Thur)": "AVAILABLE", "Oct 11 (Sun, Dinner)": "AVAILABLE", "Oct 12 (Mon) - Thanksgiving": "COOK_ONLY", "Oct 15 (Thurs)": "AVAILABLE", "Oct 18 (Sun, Brunch)": "COOK_ONLY", "Oct 19 (Mon)": "AVAILABLE", "Oct 22 (Thur)": "AVAILABLE", "Oct 25 (Sun, Dinner) - Community Meeting": "AVAILABLE", "Oct 26 (Mon)": "AVAILABLE", "Oct 29 (Thur)": "AVAILABLE" }, cookTeamSizePref: "Dinner = 3, Brunch = 2", canCookCleanSameDay: false, cookQuota: 2, cleanQuota: 2, specialInstructions: "" },
  { timestamp: "8/27/2026 15:15:00", email: "jessica.thomas@example.com", name: "Jessica", availability: { "Oct 1 (Thur)": "CLEAN_ONLY", "Oct 4 (Sun, Brunch)": "CLEAN_ONLY", "Oct 5 (Mon)": "CLEAN_ONLY", "Oct 8 (Thur)": "CLEAN_ONLY", "Oct 11 (Sun, Dinner)": "CLEAN_ONLY", "Oct 12 (Mon) - Thanksgiving": "CLEAN_ONLY", "Oct 15 (Thurs)": "CLEAN_ONLY", "Oct 18 (Sun, Brunch)": "CLEAN_ONLY", "Oct 19 (Mon)": "CLEAN_ONLY", "Oct 22 (Thur)": "CLEAN_ONLY", "Oct 25 (Sun, Dinner) - Community Meeting": "CLEAN_ONLY", "Oct 26 (Mon)": "CLEAN_ONLY", "Oct 29 (Thur)": "CLEAN_ONLY" }, cookTeamSizePref: "2 regardless of meal type", canCookCleanSameDay: false, cookQuota: 0, cleanQuota: 2, specialInstructions: "Clean only please!" },
  { timestamp: "8/27/2026 15:45:00", email: "william.jackson@example.com", name: "William", availability: { "Oct 1 (Thur)": "AVAILABLE", "Oct 4 (Sun, Brunch)": "AVAILABLE", "Oct 5 (Mon)": "AVAILABLE", "Oct 8 (Thur)": "AVAILABLE", "Oct 11 (Sun, Dinner)": "AVAILABLE", "Oct 12 (Mon) - Thanksgiving": "AVAILABLE", "Oct 15 (Thurs)": "AVAILABLE", "Oct 18 (Sun, Brunch)": "AVAILABLE", "Oct 19 (Mon)": "AVAILABLE", "Oct 22 (Thur)": "AVAILABLE", "Oct 25 (Sun, Dinner) - Community Meeting": "AVAILABLE", "Oct 26 (Mon)": "AVAILABLE", "Oct 29 (Thur)": "AVAILABLE" }, cookTeamSizePref: "Dinner = 3, Brunch = 2", canCookCleanSameDay: false, cookQuota: 1, cleanQuota: 1, specialInstructions: "" },
  { timestamp: "8/27/2026 16:00:00", email: "ashley.white@example.com", name: "Ashley", availability: { "Oct 1 (Thur)": "AVAILABLE", "Oct 4 (Sun, Brunch)": "AVAILABLE", "Oct 5 (Mon)": "AVAILABLE", "Oct 8 (Thur)": "AVAILABLE", "Oct 11 (Sun, Dinner)": "AVAILABLE", "Oct 12 (Mon) - Thanksgiving": "AVAILABLE", "Oct 15 (Thurs)": "AVAILABLE", "Oct 18 (Sun, Brunch)": "AVAILABLE", "Oct 19 (Mon)": "AVAILABLE", "Oct 22 (Thur)": "AVAILABLE", "Oct 25 (Sun, Dinner) - Community Meeting": "AVAILABLE", "Oct 26 (Mon)": "AVAILABLE", "Oct 29 (Thur)": "AVAILABLE" }, cookTeamSizePref: "Dinner = 3, Brunch = 2", canCookCleanSameDay: false, cookQuota: 1, cleanQuota: 1, specialInstructions: "" },
  { timestamp: "8/27/2026 16:20:00", email: "brian.harris@example.com", name: "Brian", availability: { "Oct 1 (Thur)": "AVAILABLE", "Oct 4 (Sun, Brunch)": "AVAILABLE", "Oct 5 (Mon)": "AVAILABLE", "Oct 8 (Thur)": "AVAILABLE", "Oct 11 (Sun, Dinner)": "AVAILABLE", "Oct 12 (Mon) - Thanksgiving": "AVAILABLE", "Oct 15 (Thurs)": "AVAILABLE", "Oct 18 (Sun, Brunch)": "AVAILABLE", "Oct 19 (Mon)": "AVAILABLE", "Oct 22 (Thur)": "AVAILABLE", "Oct 25 (Sun, Dinner) - Community Meeting": "AVAILABLE", "Oct 26 (Mon)": "AVAILABLE", "Oct 29 (Thur)": "AVAILABLE" }, cookTeamSizePref: "Dinner = 3, Brunch = 2", canCookCleanSameDay: false, cookQuota: 2, cleanQuota: 2, specialInstructions: "" },
  { timestamp: "8/27/2026 16:40:00", email: "megan.martin@example.com", name: "Megan", availability: { "Oct 1 (Thur)": "AVAILABLE", "Oct 4 (Sun, Brunch)": "AVAILABLE", "Oct 5 (Mon)": "AVAILABLE", "Oct 8 (Thur)": "AVAILABLE", "Oct 11 (Sun, Dinner)": "AVAILABLE", "Oct 12 (Mon) - Thanksgiving": "AVAILABLE", "Oct 15 (Thurs)": "AVAILABLE", "Oct 18 (Sun, Brunch)": "AVAILABLE", "Oct 19 (Mon)": "AVAILABLE", "Oct 22 (Thur)": "AVAILABLE", "Oct 25 (Sun, Dinner) - Community Meeting": "AVAILABLE", "Oct 26 (Mon)": "AVAILABLE", "Oct 29 (Thur)": "AVAILABLE" }, cookTeamSizePref: "Dinner = 3, Brunch = 2", canCookCleanSameDay: false, cookQuota: 1, cleanQuota: 1, specialInstructions: "" },
  { timestamp: "8/27/2026 17:00:00", email: "kevin.thompson@example.com", name: "Kevin", availability: { "Oct 1 (Thur)": "AVAILABLE", "Oct 4 (Sun, Brunch)": "AVAILABLE", "Oct 5 (Mon)": "AVAILABLE", "Oct 8 (Thur)": "AVAILABLE", "Oct 11 (Sun, Dinner)": "AVAILABLE", "Oct 12 (Mon) - Thanksgiving": "AVAILABLE", "Oct 15 (Thurs)": "AVAILABLE", "Oct 18 (Sun, Brunch)": "AVAILABLE", "Oct 19 (Mon)": "AVAILABLE", "Oct 22 (Thur)": "AVAILABLE", "Oct 25 (Sun, Dinner) - Community Meeting": "AVAILABLE", "Oct 26 (Mon)": "AVAILABLE", "Oct 29 (Thur)": "AVAILABLE" }, cookTeamSizePref: "Dinner = 3, Brunch = 2", canCookCleanSameDay: false, cookQuota: 1, cleanQuota: 1, specialInstructions: "" },
  { timestamp: "8/27/2026 17:15:00", email: "rachel.garcia@example.com", name: "Rachel", availability: { "Oct 1 (Thur)": "AVAILABLE", "Oct 4 (Sun, Brunch)": "AVAILABLE", "Oct 5 (Mon)": "AVAILABLE", "Oct 8 (Thur)": "AVAILABLE", "Oct 11 (Sun, Dinner)": "AVAILABLE", "Oct 12 (Mon) - Thanksgiving": "AVAILABLE", "Oct 15 (Thurs)": "AVAILABLE", "Oct 18 (Sun, Brunch)": "AVAILABLE", "Oct 19 (Mon)": "AVAILABLE", "Oct 22 (Thur)": "AVAILABLE", "Oct 25 (Sun, Dinner) - Community Meeting": "AVAILABLE", "Oct 26 (Mon)": "AVAILABLE", "Oct 29 (Thur)": "AVAILABLE" }, cookTeamSizePref: "Dinner = 3, Brunch = 2", canCookCleanSameDay: false, cookQuota: 2, cleanQuota: 2, specialInstructions: "" },
  { timestamp: "8/27/2026 17:30:00", email: "jason.martinez@example.com", name: "Jason", availability: { "Oct 1 (Thur)": "AVAILABLE", "Oct 4 (Sun, Brunch)": "AVAILABLE", "Oct 5 (Mon)": "AVAILABLE", "Oct 8 (Thur)": "AVAILABLE", "Oct 11 (Sun, Dinner)": "AVAILABLE", "Oct 12 (Mon) - Thanksgiving": "AVAILABLE", "Oct 15 (Thurs)": "AVAILABLE", "Oct 18 (Sun, Brunch)": "AVAILABLE", "Oct 19 (Mon)": "AVAILABLE", "Oct 22 (Thur)": "AVAILABLE", "Oct 25 (Sun, Dinner) - Community Meeting": "AVAILABLE", "Oct 26 (Mon)": "AVAILABLE", "Oct 29 (Thur)": "AVAILABLE" }, cookTeamSizePref: "Dinner = 3, Brunch = 2", canCookCleanSameDay: false, cookQuota: 1, cleanQuota: 1, specialInstructions: "" },
  { timestamp: "8/27/2026 17:45:00", email: "hannah.robinson@example.com", name: "Hannah", availability: { "Oct 1 (Thur)": "AVAILABLE", "Oct 4 (Sun, Brunch)": "AVAILABLE", "Oct 5 (Mon)": "AVAILABLE", "Oct 8 (Thur)": "AVAILABLE", "Oct 11 (Sun, Dinner)": "AVAILABLE", "Oct 12 (Mon) - Thanksgiving": "AVAILABLE", "Oct 15 (Thurs)": "AVAILABLE", "Oct 18 (Sun, Brunch)": "AVAILABLE", "Oct 19 (Mon)": "AVAILABLE", "Oct 22 (Thur)": "AVAILABLE", "Oct 25 (Sun, Dinner) - Community Meeting": "AVAILABLE", "Oct 26 (Mon)": "AVAILABLE", "Oct 29 (Thur)": "AVAILABLE" }, cookTeamSizePref: "Dinner = 3, Brunch = 2", canCookCleanSameDay: false, cookQuota: 1, cleanQuota: 1, specialInstructions: "" },
  { timestamp: "8/27/2026 18:00:00", email: "daniel.clark@example.com", name: "Daniel", availability: { "Oct 1 (Thur)": "AVAILABLE", "Oct 4 (Sun, Brunch)": "AVAILABLE", "Oct 5 (Mon)": "AVAILABLE", "Oct 8 (Thur)": "AVAILABLE", "Oct 11 (Sun, Dinner)": "AVAILABLE", "Oct 12 (Mon) - Thanksgiving": "AVAILABLE", "Oct 15 (Thurs)": "AVAILABLE", "Oct 18 (Sun, Brunch)": "AVAILABLE", "Oct 19 (Mon)": "AVAILABLE", "Oct 22 (Thur)": "AVAILABLE", "Oct 25 (Sun, Dinner) - Community Meeting": "AVAILABLE", "Oct 26 (Mon)": "AVAILABLE", "Oct 29 (Thur)": "AVAILABLE" }, cookTeamSizePref: "Dinner = 3, Brunch = 2", canCookCleanSameDay: false, cookQuota: 1, cleanQuota: 1, specialInstructions: "" },
  { timestamp: "8/27/2026 18:15:00", email: "olivia.rodriguez@example.com", name: "Olivia", availability: { "Oct 1 (Thur)": "AVAILABLE", "Oct 4 (Sun, Brunch)": "AVAILABLE", "Oct 5 (Mon)": "AVAILABLE", "Oct 8 (Thur)": "AVAILABLE", "Oct 11 (Sun, Dinner)": "AVAILABLE", "Oct 12 (Mon) - Thanksgiving": "AVAILABLE", "Oct 15 (Thurs)": "AVAILABLE", "Oct 18 (Sun, Brunch)": "AVAILABLE", "Oct 19 (Mon)": "AVAILABLE", "Oct 22 (Thur)": "AVAILABLE", "Oct 25 (Sun, Dinner) - Community Meeting": "AVAILABLE", "Oct 26 (Mon)": "AVAILABLE", "Oct 29 (Thur)": "AVAILABLE" }, cookTeamSizePref: "Dinner = 3, Brunch = 2", canCookCleanSameDay: false, cookQuota: 2, cleanQuota: 1, specialInstructions: "" },
  { timestamp: "8/27/2026 18:30:00", email: "matthew.lewis@example.com", name: "Matthew", availability: { "Oct 1 (Thur)": "AVAILABLE", "Oct 4 (Sun, Brunch)": "AVAILABLE", "Oct 5 (Mon)": "AVAILABLE", "Oct 8 (Thur)": "AVAILABLE", "Oct 11 (Sun, Dinner)": "AVAILABLE", "Oct 12 (Mon) - Thanksgiving": "AVAILABLE", "Oct 15 (Thurs)": "AVAILABLE", "Oct 18 (Sun, Brunch)": "AVAILABLE", "Oct 19 (Mon)": "AVAILABLE", "Oct 22 (Thur)": "AVAILABLE", "Oct 25 (Sun, Dinner) - Community Meeting": "AVAILABLE", "Oct 26 (Mon)": "AVAILABLE", "Oct 29 (Thur)": "AVAILABLE" }, cookTeamSizePref: "Dinner = 3, Brunch = 2", canCookCleanSameDay: false, cookQuota: 1, cleanQuota: 1, specialInstructions: "" },
  { timestamp: "8/27/2026 18:45:00", email: "sophia.lee@example.com", name: "Sophia", availability: { "Oct 1 (Thur)": "AVAILABLE", "Oct 4 (Sun, Brunch)": "AVAILABLE", "Oct 5 (Mon)": "AVAILABLE", "Oct 8 (Thur)": "AVAILABLE", "Oct 11 (Sun, Dinner)": "AVAILABLE", "Oct 12 (Mon) - Thanksgiving": "AVAILABLE", "Oct 15 (Thurs)": "AVAILABLE", "Oct 18 (Sun, Brunch)": "AVAILABLE", "Oct 19 (Mon)": "AVAILABLE", "Oct 22 (Thur)": "AVAILABLE", "Oct 25 (Sun, Dinner) - Community Meeting": "AVAILABLE", "Oct 26 (Mon)": "AVAILABLE", "Oct 29 (Thur)": "AVAILABLE" }, cookTeamSizePref: "Dinner = 3, Brunch = 2", canCookCleanSameDay: false, cookQuota: 1, cleanQuota: 1, specialInstructions: "" },
  { timestamp: "8/27/2026 19:00:00", email: "andrew.walker@example.com", name: "Andrew", availability: { "Oct 1 (Thur)": "AVAILABLE", "Oct 4 (Sun, Brunch)": "AVAILABLE", "Oct 5 (Mon)": "AVAILABLE", "Oct 8 (Thur)": "AVAILABLE", "Oct 11 (Sun, Dinner)": "AVAILABLE", "Oct 12 (Mon) - Thanksgiving": "AVAILABLE", "Oct 15 (Thurs)": "AVAILABLE", "Oct 18 (Sun, Brunch)": "AVAILABLE", "Oct 19 (Mon)": "AVAILABLE", "Oct 22 (Thur)": "AVAILABLE", "Oct 25 (Sun, Dinner) - Community Meeting": "AVAILABLE", "Oct 26 (Mon)": "AVAILABLE", "Oct 29 (Thur)": "AVAILABLE" }, cookTeamSizePref: "Dinner = 3, Brunch = 2", canCookCleanSameDay: false, cookQuota: 1, cleanQuota: 1, specialInstructions: "" },
  { timestamp: "8/27/2026 19:15:00", email: "grace.hall@example.com", name: "Grace", availability: { "Oct 1 (Thur)": "AVAILABLE", "Oct 4 (Sun, Brunch)": "AVAILABLE", "Oct 5 (Mon)": "AVAILABLE", "Oct 8 (Thur)": "AVAILABLE", "Oct 11 (Sun, Dinner)": "AVAILABLE", "Oct 12 (Mon) - Thanksgiving": "AVAILABLE", "Oct 15 (Thurs)": "AVAILABLE", "Oct 18 (Sun, Brunch)": "AVAILABLE", "Oct 19 (Mon)": "AVAILABLE", "Oct 22 (Thur)": "AVAILABLE", "Oct 25 (Sun, Dinner) - Community Meeting": "AVAILABLE", "Oct 26 (Mon)": "AVAILABLE", "Oct 29 (Thur)": "AVAILABLE" }, cookTeamSizePref: "Dinner = 3, Brunch = 2", canCookCleanSameDay: false, cookQuota: 1, cleanQuota: 2, specialInstructions: "" },
  { timestamp: "8/27/2026 19:30:00", email: "elena.returned@example.com", name: "Elena", availability: { "Oct 1 (Thur)": "AVAILABLE", "Oct 4 (Sun, Brunch)": "AVAILABLE", "Oct 5 (Mon)": "AVAILABLE", "Oct 8 (Thur)": "AVAILABLE", "Oct 11 (Sun, Dinner)": "AVAILABLE", "Oct 12 (Mon) - Thanksgiving": "AVAILABLE", "Oct 15 (Thurs)": "AVAILABLE", "Oct 18 (Sun, Brunch)": "AVAILABLE", "Oct 19 (Mon)": "AVAILABLE", "Oct 22 (Thur)": "AVAILABLE", "Oct 25 (Sun, Dinner) - Community Meeting": "AVAILABLE", "Oct 26 (Mon)": "AVAILABLE", "Oct 29 (Thur)": "AVAILABLE" }, cookTeamSizePref: "Dinner = 3, Brunch = 2", canCookCleanSameDay: false, cookQuota: 1, cleanQuota: 1, specialInstructions: "Back from sabbatical! Excited to cook again." },
  { timestamp: "8/27/2026 20:00:00", email: "carlos.newbie@example.com", name: "Carlos", availability: { "Oct 1 (Thur)": "AVAILABLE", "Oct 4 (Sun, Brunch)": "AVAILABLE", "Oct 5 (Mon)": "AVAILABLE", "Oct 8 (Thur)": "AVAILABLE", "Oct 11 (Sun, Dinner)": "AVAILABLE", "Oct 12 (Mon) - Thanksgiving": "AVAILABLE", "Oct 15 (Thurs)": "AVAILABLE", "Oct 18 (Sun, Brunch)": "AVAILABLE", "Oct 19 (Mon)": "AVAILABLE", "Oct 22 (Thur)": "AVAILABLE", "Oct 25 (Sun, Dinner) - Community Meeting": "AVAILABLE", "Oct 26 (Mon)": "AVAILABLE", "Oct 29 (Thur)": "AVAILABLE" }, cookTeamSizePref: "Dinner = 3, Brunch = 2", canCookCleanSameDay: false, cookQuota: 1, cleanQuota: 1, specialInstructions: "New sublet in Unit 14." },
];

export const MOCK_AUDIT: CompletenessAudit = {
  missingMembers: [
    { name: "Marcus", google_email: "marcus.allen@example.com", active: true, last_active_survey: "2026-08" },
    { name: "Chloe", google_email: "chloe.young@example.com", active: true, last_active_survey: "2026-08" },
  ],
  reactivatedMembers: [
    { name: "Elena", google_email: "elena.returned@example.com", active: true, last_active_survey: "2026-10" },
  ],
  unrecognizedRespondents: ["Carlos"],
  totalActiveMembers: 28,
  respondentCount: 30,
};

export const MOCK_INTAKE_PAYLOAD: IntakePayload = {
  sheetId: "1GHPTpg1Mk8gIUxij1eB-_P4RDmPhfEIMwoVYMMTo5A4",
  mealDates: MOCK_MEAL_DATES,
  responses: MOCK_SURVEY_RESPONSES,
  audit: MOCK_AUDIT,
  exceptions: MOCK_EXCEPTIONS,
  members: MOCK_MEMBERS,
};

// -------------------------------------------------------------
// PRESET 2: HOLIDAY SHORTAGE (Severe under-availability on Thanksgiving Oct 12 & Oct 11)
// -------------------------------------------------------------
export const MOCK_SHORTAGE_RESPONSES: SurveyResponse[] = MOCK_SURVEY_RESPONSES.map((r) => {
  const newAvail = { ...r.availability };
  // 95% of community unavailable on Oct 11 & Oct 12
  if (r.name !== "Tyler" && r.name !== "Brenda") {
    newAvail["Oct 11 (Sun, Dinner)"] = "UNAVAILABLE";
    newAvail["Oct 12 (Mon) - Thanksgiving"] = "UNAVAILABLE";
  }
  return {
    ...r,
    availability: newAvail,
  };
});

export const MOCK_SHORTAGE_PAYLOAD: IntakePayload = {
  sheetId: "PRESET_SHORTAGE_OCTOBER",
  mealDates: MOCK_MEAL_DATES,
  responses: MOCK_SHORTAGE_RESPONSES,
  audit: MOCK_AUDIT,
  exceptions: MOCK_EXCEPTIONS,
  members: MOCK_MEMBERS,
};

// -------------------------------------------------------------
// PRESET 3: QUOTA DEFICIT (Low Cook Quotas -> community under-offered)
// -------------------------------------------------------------
export const MOCK_DEFICIT_RESPONSES: SurveyResponse[] = MOCK_SURVEY_RESPONSES.map((r) => ({
  ...r,
  cookQuota: r.name === "Brenda" ? 1 : 0, // almost everyone gave 0 cook quota
}));

export const MOCK_DEFICIT_PAYLOAD: IntakePayload = {
  sheetId: "PRESET_DEFICIT_OCTOBER",
  mealDates: MOCK_MEAL_DATES,
  responses: MOCK_DEFICIT_RESPONSES,
  audit: MOCK_AUDIT,
  exceptions: MOCK_EXCEPTIONS,
  members: MOCK_MEMBERS,
};

// -------------------------------------------------------------
// PRESET 4: HIGH CONFLICT EXCEPTIONS (Multiple entangled hard rules)
// -------------------------------------------------------------
export const MOCK_HIGH_CONFLICT_EXCEPTIONS: ExceptionRule[] = [
  ...MOCK_EXCEPTIONS,
  { id: "RULE-05", person_a: "David", person_b: "Emily", rule_type: "NOT_SAME_DAY", is_hard_rule: true, notes: "Childcare schedule" },
  { id: "RULE-06", person_a: "Michael", person_b: "Sarah", rule_type: "NOT_SAME_TEAM", is_hard_rule: true, notes: "Kitchen conflict" },
  { id: "RULE-07", person_a: "Brian", person_b: "Megan", rule_type: "NOT_SAME_DAY", is_hard_rule: true, notes: "Car pool" },
  { id: "RULE-08", person_a: "Kevin", person_b: "Rachel", rule_type: "NOT_SAME_TEAM", is_hard_rule: true, notes: "Roommates" },
];

export const MOCK_HIGH_CONFLICT_PAYLOAD: IntakePayload = {
  sheetId: "PRESET_HIGH_CONFLICT_OCTOBER",
  mealDates: MOCK_MEAL_DATES,
  responses: MOCK_SURVEY_RESPONSES,
  audit: MOCK_AUDIT,
  exceptions: MOCK_HIGH_CONFLICT_EXCEPTIONS,
  members: MOCK_MEMBERS,
};

// -------------------------------------------------------------
// PRESET 5: SINGLE RESPONDENT (Just Tyler's live sheet response)
// -------------------------------------------------------------
export const MOCK_SINGLE_PAYLOAD: IntakePayload = {
  sheetId: "1GHPTpg1Mk8gIUxij1eB-_P4RDmPhfEIMwoVYMMTo5A4",
  mealDates: MOCK_MEAL_DATES,
  responses: [MOCK_SURVEY_RESPONSES[0]], // Just Tyler
  audit: {
    missingMembers: MOCK_MEMBERS.filter((m) => m.name !== "Tyler" && m.active),
    reactivatedMembers: [],
    unrecognizedRespondents: [],
    totalActiveMembers: 28,
    respondentCount: 1,
  },
  exceptions: MOCK_EXCEPTIONS,
  members: MOCK_MEMBERS,
};

// Dataset Dictionary Map
export const MOCK_PRESETS: Record<
  string,
  { name: string; description: string; payload: IntakePayload }
> = {
  standard: {
    name: "🌟 Standard Healthy Community (30 responses)",
    description: "Fully populated availability with balanced quotas and zero unfilled slots.",
    payload: MOCK_INTAKE_PAYLOAD,
  },
  holiday_shortage: {
    name: "🦃 Holiday Desertion (Thanksgiving Oct 11-12 shortage)",
    description: "95% of community is away for Thanksgiving. Tests unfilled slot warnings.",
    payload: MOCK_SHORTAGE_PAYLOAD,
  },
  quota_deficit: {
    name: "⚠️ Quota Shortfall (Severe cook quota deficit)",
    description: "Members submitted low cook quotas (only 1 total cook offered across community).",
    payload: MOCK_DEFICIT_PAYLOAD,
  },
  high_conflict: {
    name: "🔒 High Conflict Exception Network (8 entangled rules)",
    description: "Multiple household roommate & childcare hard constraints on the same days.",
    payload: MOCK_HIGH_CONFLICT_PAYLOAD,
  },
  single_respondent: {
    name: "👤 Single Response (Tyler only — Live Google Sheet)",
    description: "Live intake simulation with only 1 submitted response and 27 missing active members.",
    payload: MOCK_SINGLE_PAYLOAD,
  },
};
