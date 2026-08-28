/**
 * Core Data Types for CookTeamTool (Community Meal Team Scheduler)
 */

export type Role = "COOK" | "CLEAN";
export type TargetRole = "COOK" | "CLEAN" | "ANY";
export type MealType = "DINNER" | "BRUNCH";

export type AvailabilityStatus = "AVAILABLE" | "COOK_ONLY" | "CLEAN_ONLY" | "UNAVAILABLE";

export type RuleType =
  | "NOT_SAME_TEAM"
  | "NOT_SAME_DAY"
  | "SAME_DAY_DIFF_TEAM"
  | "PAIR_WITH_ROLE"
  | "PREF_SAME_DAY";

export type CookTeamPolicy = "DINNER_3_BRUNCH_2" | "TWO_REGARDLESS";

export interface Member {
  name: string;
  google_email: string;
  active: boolean;
  last_active_survey?: string; // e.g. "2026-10"
}

export interface ExceptionRule {
  id: string;
  person_a: string;
  person_b?: string;
  rule_type: RuleType;
  target_role_a?: TargetRole;
  target_role_b?: TargetRole;
  is_hard_rule: boolean;
  notes?: string;
}

export interface MealDate {
  id: string;
  dateKey: string;       // e.g. "2026-10-01"
  dateLabel: string;     // e.g. "Oct 1 (Thur)"
  dayOfWeek: string;     // e.g. "Thursday"
  mealType: MealType;    // "DINNER" | "BRUNCH"
  specialNote?: string;  // e.g. "Thanksgiving", "Community Meeting"
  targetCookCount: number;
  targetCleanCount: number;
}

export interface SurveyResponse {
  timestamp: string;
  email: string;
  name: string;
  availability: Record<string, AvailabilityStatus>; // dateLabel -> AvailabilityStatus
  cookTeamSizePref: string;
  canCookCleanSameDay: boolean;
  cookQuota: number;
  specialInstructions: string;
}

export interface CompletenessAudit {
  missingMembers: Member[];
  reactivatedMembers: Member[];
  unrecognizedRespondents: string[];
  totalActiveMembers: number;
  respondentCount: number;
}

export interface ShiftAssignment {
  dateKey: string;
  memberName: string;
  role: Role;
}

export interface DaySchedule {
  dateKey: string;
  dateLabel: string;
  mealType: MealType;
  specialNote?: string;
  cooks: string[];
  cleaners: string[];
  unfilledCooks: number;
  unfilledCleaners: number;
}

export interface MemberQuotaStat {
  name: string;
  requestedCookQuota: number;
  assignedCooks: number;
  assignedCleans: number;
  totalAssigned: number;
}

export interface ConstraintViolation {
  ruleId?: string;
  severity: "hard" | "soft";
  description: string;
  dateKey?: string;
  members: string[];
}

export interface SolverOptions {
  cookPolicy: CookTeamPolicy;
  enforceHardRulesOnly?: boolean;
  maxCleanPerMember?: number; // default: 1
}

export interface ScheduleOutput {
  success: boolean;
  schedule: DaySchedule[];
  memberStats: Record<string, MemberQuotaStat>;
  violations: ConstraintViolation[];
  unfilledSlotsCount: number;
  solveTimeMs: number;
  cookPolicy: CookTeamPolicy;
}

export interface IntakePayload {
  sheetId?: string;
  mealDates: MealDate[];
  responses: SurveyResponse[];
  audit: CompletenessAudit;
  exceptions: ExceptionRule[];
  members: Member[];
}
