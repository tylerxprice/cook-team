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
  | "PREF_SAME_DAY"
  | "REQUIRE_ONE_OF_TEAM"
  | "EXTRA_HELPER";

export type CookTeamPolicy = "ADAPTIVE_3_OR_2" | "DINNER_3_BRUNCH_2" | "TWO_REGARDLESS";

export interface Member {
  name: string;
  google_email: string;
  active: boolean;
  last_active_survey?: string; // e.g. "2026-10"
  aliases?: string[]; // e.g. ["Alex", "Sasha"]
  alternate_emails?: string[]; // e.g. ["alex.work@company.com"]
  is_beta_tester?: boolean;
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
  dateKey: string; // e.g. "2026-10-01"
  dateLabel: string; // e.g. "Oct 1 (Thur)"
  dayOfWeek: string; // e.g. "Thursday"
  mealType: MealType; // "DINNER" | "BRUNCH"
  specialNote?: string; // e.g. "Thanksgiving", "Community Meeting"
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
  sameDayPref?: "NO" | "YES" | "PREFERRED"; // "NO" (default), "YES", "PREFERRED"
  cookQuota: number;
  cleanQuota: number;
  maxTotalShifts?: number; // Optional cap across both cook and clean shifts combined
  specialInstructions: string;
  source?: "form" | "web";
}

export interface ManualSurveyResponsePayload {
  memberName: string;
  email?: string;
  cookQuota: number;
  cleanQuota: number;
  maxTotalShifts?: number;
  cookTeamSizePref: string;
  sameDayPref: "NO" | "YES" | "PREFERRED";
  availability: Record<string, AvailabilityStatus>; // dateLabel -> AvailabilityStatus
  specialInstructions?: string;
}

export interface ManualSurveyResponseResult {
  success: boolean;
  message: string;
  response: SurveyResponse;
  updatedIntake?: IntakePayload;
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
  targetCookCount: number;
  targetCleanCount: number;
  isTwoPersonDinnerWilling?: boolean;
  unfilledCooks: number;
  unfilledCleaners: number;
  isNoMeal?: boolean;
  extraCookHelpers?: string[];
  extraCleanHelpers?: string[];
}

export interface MemberQuotaStat {
  name: string;
  requestedCookQuota: number;
  requestedCleanQuota: number;
  requestedMaxTotalShifts?: number;
  availableCookDays: number;
  availableCleanDays: number;
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
  autoCancelDeficitDates?: boolean; // default: true (Maximize Complete Meals by dropping unviable deficit dates)
}

export interface CandidateVolunteer {
  name: string;
  availableRoles: ("COOK" | "CLEAN")[];
  currentAssignedShifts: number;
  requestedQuota: number;
  assignedCooks?: number;
  requestedCookQuota?: number;
  assignedCleans?: number;
  requestedCleanQuota?: number;
  maxTotalShifts?: number;
  requestedMaxTotalShifts?: number;
  canCookCleanSameDay?: boolean;
  cookTeamSizePref?: string;
  specialInstructions?: string;
}

export interface NearCompleteMealOpportunity {
  dateKey: string;
  dateLabel: string;
  dayOfWeek: string;
  mealType: MealType;
  targetCookCount?: number;
  targetCleanCount?: number;
  availableCooks: string[];
  availableCleaners: string[];
  missingCooksCount: number;
  missingCleanersCount: number;
  totalMissingCount: number;
  candidateVolunteersToAsk: CandidateVolunteer[];
  suggestedOutreachText: string;
}

export interface ScheduleOutput {
  success: boolean;
  schedule: DaySchedule[];
  memberStats: Record<string, MemberQuotaStat>;
  violations: ConstraintViolation[];
  unfilledSlotsCount: number;
  solveTimeMs: number;
  cookPolicy: CookTeamPolicy;
  nearCompleteOpportunities?: NearCompleteMealOpportunity[];
}

export interface EmailDispatchInfo {
  alreadySent: boolean;
  sentAt?: string;
  to?: string;
  subject?: string;
  sentBy?: string;
  monthKey?: string;
}

export interface AppSettings {
  announcementTo?: string;
  announcementCc?: string;
  cookPolicy?: CookTeamPolicy;
  defaultCleanQuota?: number;
  autoCancelDeficitDates?: boolean;
  communityName?: string;
  signupWorkbookId?: string;
  betaWebSignupEnabled?: boolean;
  available_months?: string;
  availableMonths?: string;
  all_months?: string;
  open_months?: string;
  [key: string]: any;
}

export interface BetaTesterInvite {
  name: string;
  email: string;
  link: string;
  isBetaTester: boolean;
}

export interface SendBetaInvitesPayload {
  monthKey: string;
  subject: string;
  bodyTemplate: string;
  replyTo?: string;
  recipients: Array<{
    name: string;
    email: string;
    link: string;
  }>;
  spreadsheetId?: string;
}

export interface SendBetaInvitesResult {
  success: boolean;
  dispatchedCount: number;
  failedCount: number;
  message: string;
  details?: Array<{ name: string; email: string; success: boolean; error?: string }>;
  monthKey?: string;
}

export interface WebSurveyResponsePayload {
  monthKey: string;
  spreadsheetId?: string;
  memberName: string;
  email?: string;
  cookQuota: number;
  cleanQuota: number;
  maxTotalShifts?: number;
  cookTeamSizePref: string;
  sameDayPref: "NO" | "YES" | "PREFERRED";
  availability: Record<string, AvailabilityStatus>;
  specialInstructions?: string;
}

export interface MasterRegistryPayload {
  members: Member[];
  exceptions: ExceptionRule[];
  settings?: AppSettings;
}

export interface IntakePayload {
  sheetId?: string;
  mealDates: MealDate[];
  responses: SurveyResponse[];
  audit: CompletenessAudit;
  exceptions: ExceptionRule[];
  members: Member[];
  settings?: AppSettings;
  existingScheduleTab?: {
    name: string;
    url?: string;
    exists: boolean;
    dateMonth?: string;
  };
  emailDispatchInfo?: EmailDispatchInfo;
  monthStatus?: MonthStatus;
}

export interface MemberEquityStat {
  name: string;
  totalCooks: number;
  totalCleans: number;
  totalShifts: number;
  monthsActive: number;
  sameDayShifts: number;
  averageShiftsPerMonth: number;
  monthlyBreakdown: Record<string, { cooks: number; cleans: number; total: number }>;
  badges: string[];
}

export interface CommunityReportSummary {
  totalMonthsTracked: number;
  monthsList: string[];
  totalMealsServed: number;
  totalCookShifts: number;
  totalCleanShifts: number;
  totalVolunteerShifts: number;
  uniqueVolunteersCount: number;
  memberEquityStats: MemberEquityStat[];
}

export interface EmailPayload {
  to: string;
  subject: string;
  body: string;
  cc?: string;
  bcc?: string;
  mode: "send" | "draft";
  spreadsheetId?: string;
  monthKey?: string;
}

export interface EmailResult {
  success: boolean;
  mode: "send" | "draft";
  message: string;
  recipientCount: number;
  emailDispatchInfo?: EmailDispatchInfo;
}

export interface MealSignupColumnPreview {
  colIndex: number;
  dateKey: string;
  dateLabel: string;
  dayLabel: string;
  dateShort: string;
  mealType: MealType;
  isNoMeal: boolean;
  cooks: string;
  cleaners: string;
  deadline: string;
  mealName: string;
}

export interface MealSignupExportOptions {
  monthTabName?: string;
  backupExisting?: boolean;
  hideOlderMonths?: boolean;
  keepTemplateHidden?: boolean;
  customDeadlines?: Record<string, string>;
  customDayLabels?: Record<string, string>;
}

export interface MealSignupExportResult {
  success: boolean;
  spreadsheetId: string;
  spreadsheetUrl: string;
  tabName: string;
  tabUrl?: string;
  isBackupCreated: boolean;
  backupTabName?: string;
  totalMealColumns: number;
  message: string;
}

export interface MealSignupWorkbookInfo {
  spreadsheetId: string;
  spreadsheetName: string;
  spreadsheetUrl: string;
  hasTemplate: boolean;
  existingTabs: string[];
  suggestedMonthTab: string;
  isTargetTabExisting: boolean;
}

export interface SurveyFormDateConfig {
  dateKey: string; // e.g. "2026-11-01"
  dateLabel: string; // e.g. "Nov 1 (Sun, Brunch)"
  dayOfWeek: string; // e.g. "Sunday"
  mealType: MealType; // "BRUNCH" | "DINNER"
  specialNote?: string; // e.g. "Community Meeting"
  included: boolean;
}

export interface CreateSurveyFormPayload {
  monthKey: string; // e.g. "2026-11"
  title: string; // e.g. "26-11 Nov Meal Team Sign-Up"
  description?: string;
  folderId?: string;
  dates: SurveyFormDateConfig[];
  allowOverwrite?: boolean;
}

export interface CreateSurveyFormResult {
  success: boolean;
  monthKey?: string;
  formId: string;
  formTitle: string;
  formEditUrl: string;
  formPublishedUrl: string;
  formPrefilledUrl?: string;
  spreadsheetId: string;
  spreadsheetUrl: string;
  folderId?: string;
  folderUrl?: string;
  totalDates: number;
  message: string;
}

export interface PublicScheduleResult {
  success: boolean;
  schedule: DaySchedule[];
  monthKey: string;
  monthTitle: string;
  communityName: string;
  availableMonths?: string[];
  sourceSheetName?: string;
  spreadsheetUrl?: string;
  message?: string;
}

export type MonthStatus =
  | "STAGING_DATES"
  | "SIGN_UPS_OPEN"
  | "RESPONSES_RECEIVED"
  | "TEAMS_READY"
  | "EMAIL_SENT"
  | "NOT_OPEN"
  | "OPEN"
  | "CLOSED";

export interface ConfiguredMonthSummary {
  monthKey: string;
  status: MonthStatus;
  datesCount?: number;
  dates?: SurveyFormDateConfig[];
}

export interface MonthConfig {
  monthKey: string; // e.g. "2026-11"
  status: MonthStatus;
  dates: SurveyFormDateConfig[];
  defaultTitle?: string;
  openedAt?: string;
  closedAt?: string;
  teamsSavedAt?: string;
  broadcastSentAt?: string;
  formId?: string;
  formUrl?: string;
  isConfigured?: boolean;
}

export interface SaveMonthDatesPayload {
  monthKey: string;
  dates: SurveyFormDateConfig[];
  title?: string;
  status?: MonthStatus;
}

export interface SaveMonthDatesResult {
  success: boolean;
  message: string;
  monthKey: string;
  status: MonthStatus;
  dates: SurveyFormDateConfig[];
}

export interface SetMonthStatusResult {
  success: boolean;
  message: string;
  monthKey: string;
  status: MonthStatus;
}

export interface ExistingSurveyInfo {
  exists: boolean;
  spreadsheetId?: string;
  spreadsheetName?: string;
  spreadsheetUrl?: string;
  formId?: string;
  formUrl?: string;
  formEditUrl?: string;
  responseCount: number;
  canOverwrite: boolean; // false if responseCount > 1
  warningMessage?: string;
}

export interface SurveyFormDatesPreviewResult {
  monthKey: string;
  defaultTitle: string;
  dates: SurveyFormDateConfig[];
  status: MonthStatus;
  openedAt?: string;
  closedAt?: string;
  isConfigured: boolean;
  existingSurvey?: ExistingSurveyInfo;
}
