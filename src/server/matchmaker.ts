import {
  MealDate,
  SurveyResponse,
  ExceptionRule,
  SolverOptions,
  ScheduleOutput,
  DaySchedule,
  MemberQuotaStat,
  ConstraintViolation,
  Role,
} from "./types";

interface Candidate {
  name: string;
  cookQuota: number;
  cleanQuota: number;
  canSameDay: boolean;
  minCooksPref: "DINNER_3_BRUNCH_2" | "TWO_REGARDLESS";
  availability: Record<string, string>; // dateLabel -> status
  assignedCookDates: Set<string>;
  assignedCleanDates: Set<string>;
}

export function solveCookAndCleanSchedule(
  mealDates: MealDate[],
  responses: SurveyResponse[],
  exceptions: ExceptionRule[],
  options: SolverOptions
): ScheduleOutput {
  const startTime = Date.now();

  const maxClean = options.maxCleanPerMember ?? 1;
  const cookPolicy = options.cookPolicy || "ADAPTIVE_3_OR_2";

  // Build candidate map
  const candidates: Map<string, Candidate> = new Map();
  for (const resp of responses) {
    const prefStr = (resp.cookTeamSizePref || "").toLowerCase();
    const isWilling2 = prefStr.includes("2") || prefStr.includes("regardless");
    candidates.set(resp.name, {
      name: resp.name,
      cookQuota: resp.cookQuota,
      cleanQuota: resp.availability ? maxClean : 0,
      canSameDay: resp.canCookCleanSameDay,
      minCooksPref: isWilling2 ? "TWO_REGARDLESS" : "DINNER_3_BRUNCH_2",
      availability: resp.availability || {},
      assignedCookDates: new Set(),
      assignedCleanDates: new Set(),
    });
  }

  // Check PREF_SAME_DAY exceptions to allow same day for those members
  for (const rule of exceptions) {
    if (rule.rule_type === "PREF_SAME_DAY") {
      const cand = candidates.get(rule.person_a);
      if (cand) cand.canSameDay = true;
    }
  }

  // Adjust target cook count based on policy
  const adjustedMealDates: MealDate[] = mealDates.map((md) => {
    let targetCooks = md.targetCookCount;
    if (cookPolicy === "TWO_REGARDLESS") {
      targetCooks = 2;
    } else {
      // ADAPTIVE_3_OR_2 and DINNER_3_BRUNCH_2 both target 3 for Dinner and 2 for Brunch
      targetCooks = md.mealType === "BRUNCH" ? 2 : 3;
    }
    return {
      ...md,
      targetCookCount: targetCooks,
      targetCleanCount: md.mealType === "BRUNCH" ? 2 : 3,
    };
  });

  // Track assignments per meal date
  const scheduleMap = new Map<
    string,
    { cooks: string[]; cleaners: string[]; mealDate: MealDate }
  >();

  for (const md of adjustedMealDates) {
    scheduleMap.set(md.dateKey, {
      cooks: [],
      cleaners: [],
      mealDate: md,
    });
  }

  // Helper: check hard rule violation for a prospective assignment
  function violatesHardRule(
    memberName: string,
    role: Role,
    dateKey: string,
    currentCooks: string[],
    currentCleaners: string[]
  ): boolean {
    for (const rule of exceptions) {
      if (!rule.is_hard_rule) continue;

      const pA = rule.person_a;
      const pB = rule.person_b;

      // NOT_SAME_DAY
      if (rule.rule_type === "NOT_SAME_DAY" && pB) {
        if (memberName === pA) {
          if (currentCooks.includes(pB) || currentCleaners.includes(pB)) return true;
        } else if (memberName === pB) {
          if (currentCooks.includes(pA) || currentCleaners.includes(pA)) return true;
        }
      }

      // NOT_SAME_TEAM
      if (rule.rule_type === "NOT_SAME_TEAM" && pB) {
        const team = role === "COOK" ? currentCooks : currentCleaners;
        if (memberName === pA && team.includes(pB)) return true;
        if (memberName === pB && team.includes(pA)) return true;
      }
    }
    return false;
  }

  // Step 1: Assign Cooks
  // Sort meal dates by least available candidates first (MRV heuristic)
  for (const md of adjustedMealDates) {
    const entry = scheduleMap.get(md.dateKey)!;
    const target = md.targetCookCount;

    // Filter available candidates for cooking on this date
    const eligible = Array.from(candidates.values()).filter((c) => {
      // Must not already be assigned to cook on this date
      if (c.assignedCookDates.has(md.dateKey)) return false;
      // Must have remaining cook quota
      if (c.assignedCookDates.size >= c.cookQuota) return false;
      // Check availability on date
      const avail = c.availability[md.dateLabel];
      if (avail !== "AVAILABLE" && avail !== "COOK_ONLY") return false;
      // Check same day constraint
      if (!c.canSameDay && c.assignedCleanDates.has(md.dateKey)) return false;
      // Check hard rules
      if (violatesHardRule(c.name, "COOK", md.dateKey, entry.cooks, entry.cleaners)) return false;

      return true;
    });

    // Sort candidates by remaining cook quota desc, then total quota
    eligible.sort((a, b) => {
      const remA = a.cookQuota - a.assignedCookDates.size;
      const remB = b.cookQuota - b.assignedCookDates.size;
      return remB - remA;
    });

    for (const cand of eligible) {
      if (entry.cooks.length >= target) break;
      if (violatesHardRule(cand.name, "COOK", md.dateKey, entry.cooks, entry.cleaners)) continue;
      entry.cooks.push(cand.name);
      cand.assignedCookDates.add(md.dateKey);
    }
  }

  // Step 2: Assign Cleaners
  for (const md of adjustedMealDates) {
    const entry = scheduleMap.get(md.dateKey)!;
    const target = md.targetCleanCount;

    const eligible = Array.from(candidates.values()).filter((c) => {
      // Must not already be assigned to clean on this date
      if (c.assignedCleanDates.has(md.dateKey)) return false;
      // Must have remaining clean quota
      if (c.assignedCleanDates.size >= c.cleanQuota) return false;
      // Check availability on date
      const avail = c.availability[md.dateLabel];
      if (avail !== "AVAILABLE" && avail !== "CLEAN_ONLY") return false;
      // Check same day constraint
      if (!c.canSameDay && entry.cooks.includes(c.name)) return false;
      // Check hard rules
      if (violatesHardRule(c.name, "CLEAN", md.dateKey, entry.cooks, entry.cleaners)) return false;

      return true;
    });

    // Sort cleaners by fewest assigned cleans, then total assignments
    eligible.sort((a, b) => {
      const totalA = a.assignedCookDates.size + a.assignedCleanDates.size;
      const totalB = b.assignedCookDates.size + b.assignedCleanDates.size;
      return totalA - totalB;
    });

    for (const cand of eligible) {
      if (entry.cleaners.length >= target) break;
      if (violatesHardRule(cand.name, "CLEAN", md.dateKey, entry.cooks, entry.cleaners)) continue;
      entry.cleaners.push(cand.name);
      cand.assignedCleanDates.add(md.dateKey);
    }
  }

  // Check Soft Exceptions & record any violations
  const violations: ConstraintViolation[] = [];
  for (const md of adjustedMealDates) {
    const entry = scheduleMap.get(md.dateKey)!;
    const allAssigned = [...entry.cooks, ...entry.cleaners];

    for (const rule of exceptions) {
      const pA = rule.person_a;
      const pB = rule.person_b;

      if (rule.rule_type === "PAIR_WITH_ROLE" && pB) {
        // e.g. Emily & David both on cook
        if (entry.cooks.includes(pA) && !entry.cooks.includes(pB)) {
          violations.push({
            ruleId: rule.id,
            severity: rule.is_hard_rule ? "hard" : "soft",
            description: `${pA} is cooking on ${md.dateLabel}, but paired cook ${pB} was not assigned.`,
            dateKey: md.dateKey,
            members: [pA, pB],
          });
        }
      } else if (rule.rule_type === "SAME_DAY_DIFF_TEAM" && pB) {
        const aAssigned = allAssigned.includes(pA);
        const bAssigned = allAssigned.includes(pB);
        if (aAssigned !== bAssigned) {
          violations.push({
            ruleId: rule.id,
            severity: rule.is_hard_rule ? "hard" : "soft",
            description: `${pA} and ${pB} are not scheduled on the same day on ${md.dateLabel}.`,
            dateKey: md.dateKey,
            members: [pA, pB],
          });
        }
      }
    }
  }

  // Compile DaySchedule array & stats
  let totalUnfilled = 0;
  const schedule: DaySchedule[] = adjustedMealDates.map((md) => {
    const entry = scheduleMap.get(md.dateKey)!;
    
    let unfilledCooks = 0;
    let isTwoPersonDinnerWilling = false;

    if (cookPolicy === "ADAPTIVE_3_OR_2" && md.mealType === "DINNER") {
      if (entry.cooks.length >= 3) {
        unfilledCooks = 0;
      } else if (entry.cooks.length === 2) {
        // Check if all assigned cooks on this team are willing to cook on a 2-person dinner team
        const allWilling = entry.cooks.every((cookName) => {
          const cand = candidates.get(cookName);
          return cand?.minCooksPref === "TWO_REGARDLESS";
        });
        if (allWilling) {
          unfilledCooks = 0;
          isTwoPersonDinnerWilling = true;
        } else {
          unfilledCooks = 1; // Needs 3rd cook because one or more cooks requested a 3-person team
        }
      } else {
        // Fewer than 2 cooks
        unfilledCooks = Math.max(0, 2 - entry.cooks.length);
      }
    } else {
      unfilledCooks = Math.max(0, md.targetCookCount - entry.cooks.length);
    }

    const unfilledCleaners = Math.max(0, md.targetCleanCount - entry.cleaners.length);
    totalUnfilled += unfilledCooks + unfilledCleaners;

    return {
      dateKey: md.dateKey,
      dateLabel: md.dateLabel,
      mealType: md.mealType,
      specialNote: md.specialNote,
      cooks: entry.cooks,
      cleaners: entry.cleaners,
      targetCookCount: md.targetCookCount,
      targetCleanCount: md.targetCleanCount,
      isTwoPersonDinnerWilling,
      unfilledCooks,
      unfilledCleaners,
    };
  });

  const memberStats: Record<string, MemberQuotaStat> = {};
  for (const [name, cand] of candidates.entries()) {
    let availableCookDays = 0;
    let availableCleanDays = 0;
    for (const status of Object.values(cand.availability)) {
      if (status === "AVAILABLE" || status === "COOK_ONLY") availableCookDays++;
      if (status === "AVAILABLE" || status === "CLEAN_ONLY") availableCleanDays++;
    }

    memberStats[name] = {
      name,
      requestedCookQuota: cand.cookQuota,
      availableCookDays,
      availableCleanDays,
      assignedCooks: cand.assignedCookDates.size,
      assignedCleans: cand.assignedCleanDates.size,
      totalAssigned: cand.assignedCookDates.size + cand.assignedCleanDates.size,
    };
  }

  const solveTimeMs = Date.now() - startTime;

  return {
    success: totalUnfilled === 0,
    schedule,
    memberStats,
    violations,
    unfilledSlotsCount: totalUnfilled,
    solveTimeMs,
    cookPolicy,
  };
}
