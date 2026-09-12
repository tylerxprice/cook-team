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
import { extractMonthDay, isWillingTwoPersonDinner } from "./scheduleParser";

interface Candidate {
  name: string;
  cookQuota: number;
  cleanQuota: number;
  canSameDay: boolean;
  sameDayPref?: "NO" | "YES" | "PREFERRED";
  hasPrefSameDayRule?: boolean;
  minCooksPref: "DINNER_3_BRUNCH_2" | "TWO_REGARDLESS";
  rawAvailability: Record<string, string>;
  normalizedAvailability: Record<string, string>;
  totalCookAvail: number;
  totalCleanAvail: number;
  assignedCookDates: Set<string>;
  assignedCleanDates: Set<string>;
}

function getCandidateAvailability(cand: Candidate, md: MealDate): string {
  if (cand.rawAvailability[md.dateLabel]) return cand.rawAvailability[md.dateLabel];
  const mDay = extractMonthDay(md.dateLabel) || extractMonthDay(md.dateKey);
  if (mDay && cand.normalizedAvailability[mDay]) return cand.normalizedAvailability[mDay];
  return "UNAVAILABLE";
}

export function solveSinglePass(
  mealDates: MealDate[],
  responses: SurveyResponse[],
  exceptions: ExceptionRule[],
  options: SolverOptions
): ScheduleOutput {
  const maxClean = options.maxCleanPerMember ?? 1;
  const cookPolicy = options.cookPolicy || "ADAPTIVE_3_OR_2";

  // Build candidate map
  const candidates: Map<string, Candidate> = new Map();
  for (const resp of responses) {
    const isWilling2 = isWillingTwoPersonDinner(resp.cookTeamSizePref);
    const cleanQuota =
      typeof resp.cleanQuota === "number" ? resp.cleanQuota : resp.availability ? maxClean : 0;

    const normAvail: Record<string, string> = {};
    let totalCookAvail = 0;
    let totalCleanAvail = 0;
    for (const [k, v] of Object.entries(resp.availability || {})) {
      normAvail[k] = v;
      const mDay = extractMonthDay(k);
      if (mDay) normAvail[mDay] = v;
      if (v === "AVAILABLE" || v === "COOK_ONLY") totalCookAvail++;
      if (v === "AVAILABLE" || v === "CLEAN_ONLY") totalCleanAvail++;
    }

    const sameDayPref = resp.sameDayPref || (resp.canCookCleanSameDay ? "YES" : "NO");
    const canSameDay =
      resp.canCookCleanSameDay || sameDayPref === "YES" || sameDayPref === "PREFERRED";

    candidates.set(resp.name, {
      name: resp.name,
      cookQuota: resp.cookQuota,
      cleanQuota,
      canSameDay,
      sameDayPref,
      hasPrefSameDayRule: false,
      minCooksPref: isWilling2 ? "TWO_REGARDLESS" : "DINNER_3_BRUNCH_2",
      rawAvailability: resp.availability || {},
      normalizedAvailability: normAvail,
      totalCookAvail,
      totalCleanAvail,
      assignedCookDates: new Set(),
      assignedCleanDates: new Set(),
    });
  }

  // Check PREF_SAME_DAY exceptions to allow same day for those members
  for (const rule of exceptions) {
    if (rule.rule_type === "PREF_SAME_DAY") {
      const cand = candidates.get(rule.person_a);
      if (cand) {
        cand.canSameDay = true;
        cand.hasPrefSameDayRule = true;
        cand.sameDayPref = "PREFERRED";
      }
    }
  }

  // Adjust target cook count based on policy
  const adjustedMealDates: MealDate[] = mealDates.map((md) => {
    const isCancelled =
      (md.targetCookCount === 0 && md.targetCleanCount === 0) ||
      md.specialNote === "NO COMMUNITY MEAL";
    if (isCancelled) {
      return {
        ...md,
        targetCookCount: 0,
        targetCleanCount: 0,
        specialNote: md.specialNote || "NO COMMUNITY MEAL",
      };
    }
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
    _dateKey: string,
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

  const activeMealDates = adjustedMealDates.filter(
    (md) => md.targetCookCount > 0 || md.targetCleanCount > 0
  );

  // Step 1: Assign Cooks
  // In ADAPTIVE_3_OR_2 policy:
  // Pass 1: Establish base coverage (2 cooks on every meal date) to maximize total complete meals
  // Pass 2: Upgrade dinners to 3 cooks where additional volunteer quota is available
  const cookPassTargets = cookPolicy === "ADAPTIVE_3_OR_2" ? [2, 3] : [3];

  for (const passLimit of cookPassTargets) {
    const cookMealDates = [...activeMealDates].sort((a, b) => {
      // Prioritize Brunches and meals with fewer available candidates (MRV)
      const getAvailCount = (md: MealDate) =>
        Array.from(candidates.values()).filter((c) => {
          const av = getCandidateAvailability(c, md);
          return av === "AVAILABLE" || av === "COOK_ONLY";
        }).length;
      const countA = getAvailCount(a);
      const countB = getAvailCount(b);
      if (countA !== countB) return countA - countB;
      // Brunches need only 2 cooks so prioritize locking them in
      if (a.mealType === "BRUNCH" && b.mealType !== "BRUNCH") return -1;
      if (b.mealType === "BRUNCH" && a.mealType !== "BRUNCH") return 1;
      return Math.random() - 0.5;
    });

    for (const md of cookMealDates) {
      const entry = scheduleMap.get(md.dateKey)!;
      const maxSlotsForPass = Math.min(md.targetCookCount, passLimit);

      const eligible = Array.from(candidates.values()).filter((c) => {
        if (c.assignedCookDates.has(md.dateKey)) return false;
        if (c.assignedCookDates.size >= c.cookQuota) return false;
        const avail = getCandidateAvailability(c, md);
        if (avail !== "AVAILABLE" && avail !== "COOK_ONLY") return false;
        if (!c.canSameDay && c.assignedCleanDates.has(md.dateKey)) return false;
        if (violatesHardRule(c.name, "COOK", md.dateKey, entry.cooks, entry.cleaners)) return false;
        return true;
      });

      // Sort candidate cooks:
      // 1. Willing 2-person dinner team members in pass 1
      // 2. Candidates with fewer total available cook opportunities (MRV)
      // 3. Candidates with highest remaining cook quota
      eligible.sort((a, b) => {
        if (cookPolicy === "ADAPTIVE_3_OR_2" && passLimit === 2) {
          const aWilling = a.minCooksPref === "TWO_REGARDLESS" ? 1 : 0;
          const bWilling = b.minCooksPref === "TWO_REGARDLESS" ? 1 : 0;
          if (bWilling !== aWilling) return bWilling - aWilling;
        }
        const remA = a.cookQuota - a.assignedCookDates.size;
        const remB = b.cookQuota - b.assignedCookDates.size;
        if (remB !== remA) return remB - remA;

        // MRV: prioritize candidate with fewer available cook opportunities so they aren't squeezed out
        if (a.totalCookAvail !== b.totalCookAvail) {
          return a.totalCookAvail - b.totalCookAvail;
        }
        return Math.random() - 0.5;
      });

      for (const cand of eligible) {
        if (entry.cooks.length >= maxSlotsForPass) break;
        if (violatesHardRule(cand.name, "COOK", md.dateKey, entry.cooks, entry.cleaners)) continue;
        entry.cooks.push(cand.name);
        cand.assignedCookDates.add(md.dateKey);
      }
    }
  }

  // Step 2: Assign Cleaners
  // Sort meal dates by least available cleaners first (MRV heuristic with randomized tie-breaking)
  const cleanMealDates = [...activeMealDates].sort((a, b) => {
    const getCleanCount = (md: MealDate) =>
      Array.from(candidates.values()).filter((c) => {
        const av = getCandidateAvailability(c, md);
        return av === "AVAILABLE" || av === "CLEAN_ONLY";
      }).length;
    const countA = getCleanCount(a);
    const countB = getCleanCount(b);
    if (countA !== countB) return countA - countB;
    // Brunches need only 2 cleaners so prioritize locking them in
    if (a.mealType === "BRUNCH" && b.mealType !== "BRUNCH") return -1;
    if (b.mealType === "BRUNCH" && a.mealType !== "BRUNCH") return 1;
    return Math.random() - 0.5;
  });

  for (const md of cleanMealDates) {
    const entry = scheduleMap.get(md.dateKey)!;
    const target = md.targetCleanCount;

    const eligible = Array.from(candidates.values()).filter((c) => {
      if (c.assignedCleanDates.has(md.dateKey)) return false;
      if (c.assignedCleanDates.size >= c.cleanQuota) return false;
      const avail = getCandidateAvailability(c, md);
      if (avail !== "AVAILABLE" && avail !== "CLEAN_ONLY") return false;
      if (!c.canSameDay && entry.cooks.includes(c.name)) return false;
      if (violatesHardRule(c.name, "CLEAN", md.dateKey, entry.cooks, entry.cleaners)) return false;
      return true;
    });

    // Sort cleaners:
    // 1. Members who PREFER same-day cook & clean if they are cooking today
    // 2. Candidates with FEWEST available clean opportunities (MRV) so limited cleaners (Miriam, Olive, etc.) get scheduled
    // 3. Fewest assigned cleans, then fewest total assignments, then randomized tie-breaker
    eligible.sort((a, b) => {
      const aPrefSame =
        entry.cooks.includes(a.name) && (a.sameDayPref === "PREFERRED" || a.hasPrefSameDayRule);
      const bPrefSame =
        entry.cooks.includes(b.name) && (b.sameDayPref === "PREFERRED" || b.hasPrefSameDayRule);
      if (aPrefSame && !bPrefSame) return -1;
      if (!aPrefSame && bPrefSame) return 1;

      // MRV heuristic: candidates with few available clean dates get assigned first
      if (a.totalCleanAvail !== b.totalCleanAvail) {
        return a.totalCleanAvail - b.totalCleanAvail;
      }

      if (a.assignedCleanDates.size !== b.assignedCleanDates.size) {
        return a.assignedCleanDates.size - b.assignedCleanDates.size;
      }
      const totalA = a.assignedCookDates.size + a.assignedCleanDates.size;
      const totalB = b.assignedCookDates.size + b.assignedCleanDates.size;
      if (totalA !== totalB) return totalA - totalB;
      return Math.random() - 0.5;
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

    if (md.targetCookCount === 0 && md.targetCleanCount === 0) {
      unfilledCooks = 0;
    } else if (cookPolicy === "ADAPTIVE_3_OR_2" && md.mealType === "DINNER") {
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

    const unfilledCleaners =
      md.targetCleanCount === 0 ? 0 : Math.max(0, md.targetCleanCount - entry.cleaners.length);
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
    for (const status of Object.values(cand.rawAvailability)) {
      if (status === "AVAILABLE" || status === "COOK_ONLY") availableCookDays++;
      if (status === "AVAILABLE" || status === "CLEAN_ONLY") availableCleanDays++;
    }

    memberStats[name] = {
      name,
      requestedCookQuota: cand.cookQuota,
      requestedCleanQuota: cand.cleanQuota,
      availableCookDays,
      availableCleanDays,
      assignedCooks: cand.assignedCookDates.size,
      assignedCleans: cand.assignedCleanDates.size,
      totalAssigned: cand.assignedCookDates.size + cand.assignedCleanDates.size,
    };
  }

  return {
    success: totalUnfilled === 0,
    schedule,
    memberStats,
    violations,
    unfilledSlotsCount: totalUnfilled,
    solveTimeMs: 0,
    cookPolicy,
  };
}

function solveStochasticRestarts(
  mealDates: MealDate[],
  responses: SurveyResponse[],
  exceptions: ExceptionRule[],
  options: SolverOptions,
  numRestarts = 200
): ScheduleOutput {
  let bestResult: ScheduleOutput | null = null;
  let bestScore = -Infinity;

  for (let iter = 0; iter < numRestarts; iter++) {
    const res = solveSinglePass(mealDates, responses, exceptions, options);

    // Compute objective fitness score
    let fullyStaffedCount = 0;
    let incompleteCount = 0;
    let twoCookWillingCount = 0;
    for (const day of res.schedule) {
      if (day.targetCookCount === 0 && day.targetCleanCount === 0) continue;
      if (day.unfilledCooks === 0 && day.unfilledCleaners === 0) {
        fullyStaffedCount++;
      } else {
        incompleteCount++;
      }
      if (day.isTwoPersonDinnerWilling) {
        twoCookWillingCount++;
      }
    }

    // Objective function:
    // +1000 per fully staffed meal
    // -600 per incomplete meal (heavily penalize partial staffing over 100% complete teams)
    // -150 per unfilled slot
    // +25 per 2-person willing team (conserver of supply)
    // -30 per soft constraint violation
    const score =
      fullyStaffedCount * 1000 -
      incompleteCount * 600 -
      res.unfilledSlotsCount * 150 +
      twoCookWillingCount * 25 -
      res.violations.length * 30;

    if (score > bestScore || !bestResult) {
      bestScore = score;
      bestResult = res;
    }
  }

  return bestResult!;
}

/**
 * Solves cook and clean schedule with Multi-Restart Global Optimization & Complete Meal Maximizer.
 * Automatically identifies and aggressively prunes unviable deficit dates to concentrate volunteer supply
 * and maximize total 100% staffed complete meals with zero unfilled slots.
 */
export function solveCookAndCleanSchedule(
  mealDates: MealDate[],
  responses: SurveyResponse[],
  exceptions: ExceptionRule[],
  options: SolverOptions
): ScheduleOutput {
  const startTime = Date.now();
  const autoCancel = options.autoCancelDeficitDates !== false;

  // 1. Run baseline global stochastic solve (350 restarts)
  const initialResult = solveStochasticRestarts(mealDates, responses, exceptions, options, 350);

  if (!autoCancel || initialResult.unfilledSlotsCount === 0) {
    initialResult.solveTimeMs = Date.now() - startTime;
    return initialResult;
  }

  // 2. Multi-Branch Beam Search Pruning
  // Explores top deficit branches to avoid local minima and deterministically discover maximum complete meals
  let beam = [{ dates: mealDates, result: initialResult }];
  const candidateZeroDeficitResults: ScheduleOutput[] = [];
  const allPrunedResults: ScheduleOutput[] = [initialResult];

  const maxDepth = mealDates.filter((d) => d.targetCookCount > 0 || d.targetCleanCount > 0).length;

  for (let depth = 1; depth <= maxDepth; depth++) {
    const nextBeam: { dates: MealDate[]; result: ScheduleOutput }[] = [];

    for (const node of beam) {
      const incomplete = node.result.schedule.filter(
        (d) => d.targetCookCount > 0 && (d.unfilledCooks > 0 || d.unfilledCleaners > 0)
      );

      if (incomplete.length === 0) {
        candidateZeroDeficitResults.push(node.result);
        continue;
      }

      // Rank incomplete dates by critical deficit:
      // 1. Fewest assigned volunteers
      // 2. Most unfilled slots
      incomplete.sort((a, b) => {
        const totalA = a.cooks.length + a.cleaners.length;
        const totalB = b.cooks.length + b.cleaners.length;
        if (totalA !== totalB) return totalA - totalB;
        return b.unfilledCooks + b.unfilledCleaners - (a.unfilledCooks + a.unfilledCleaners);
      });

      // Branch on top 2 worst deficit candidates
      const branchesToTry = incomplete.slice(0, 2);

      for (const branchTarget of branchesToTry) {
        const nextDates = node.dates.map((md) => {
          if (md.dateKey === branchTarget.dateKey || md.dateLabel === branchTarget.dateLabel) {
            return {
              ...md,
              targetCookCount: 0,
              targetCleanCount: 0,
              specialNote: "NO COMMUNITY MEAL (Auto-Cancelled: Volunteer Deficit)",
            };
          }
          return md;
        });

        const prunedRes = solveStochasticRestarts(nextDates, responses, exceptions, options, 150);
        allPrunedResults.push(prunedRes);

        if (prunedRes.unfilledSlotsCount === 0) {
          candidateZeroDeficitResults.push(prunedRes);
        } else {
          nextBeam.push({ dates: nextDates, result: prunedRes });
        }
      }
    }

    if (nextBeam.length === 0) break;

    // Keep top 3 best candidate branches in beam
    nextBeam.sort((a, b) => {
      const compA = a.result.schedule.filter(
        (d) => d.targetCookCount > 0 && d.unfilledCooks === 0 && d.unfilledCleaners === 0
      ).length;
      const compB = b.result.schedule.filter(
        (d) => d.targetCookCount > 0 && d.unfilledCooks === 0 && d.unfilledCleaners === 0
      ).length;
      if (compB !== compA) return compB - compA;
      return a.result.unfilledSlotsCount - b.result.unfilledSlotsCount;
    });

    beam = nextBeam.slice(0, 3);
  }

  // Select the optimal result:
  // Priority 1: Zero unfilled slots (100% complete active meals) with maximum number of complete meals.
  // Priority 2: If none achieved 0 unfilled slots, select the result with fewest unfilled slots.
  let bestResult: ScheduleOutput;

  if (candidateZeroDeficitResults.length > 0) {
    candidateZeroDeficitResults.sort((a, b) => {
      const compA = a.schedule.filter(
        (d) => d.targetCookCount > 0 && d.unfilledCooks === 0 && d.unfilledCleaners === 0
      ).length;
      const compB = b.schedule.filter(
        (d) => d.targetCookCount > 0 && d.unfilledCooks === 0 && d.unfilledCleaners === 0
      ).length;
      if (compB !== compA) return compB - compA;
      return a.violations.length - b.violations.length;
    });
    bestResult = candidateZeroDeficitResults[0];
  } else {
    // If none reached 0 unfilled slots in beam search, pick minimum unfilled slots
    allPrunedResults.sort((a, b) => {
      if (a.unfilledSlotsCount !== b.unfilledSlotsCount)
        return a.unfilledSlotsCount - b.unfilledSlotsCount;
      const compA = a.schedule.filter(
        (d) => d.targetCookCount > 0 && d.unfilledCooks === 0 && d.unfilledCleaners === 0
      ).length;
      const compB = b.schedule.filter(
        (d) => d.targetCookCount > 0 && d.unfilledCooks === 0 && d.unfilledCleaners === 0
      ).length;
      return compB - compA;
    });
    bestResult = allPrunedResults[0];

    // Aggressive fallback: Auto-cancel any remaining incomplete dates in bestResult so no partial deficit meals remain
    if (autoCancel && bestResult.unfilledSlotsCount > 0) {
      const remainingIncomplete = bestResult.schedule.filter(
        (d) => d.targetCookCount > 0 && (d.unfilledCooks > 0 || d.unfilledCleaners > 0)
      );
      if (remainingIncomplete.length > 0) {
        const finalDates = mealDates.map((md) => {
          if (
            remainingIncomplete.some(
              (inc) => inc.dateKey === md.dateKey || inc.dateLabel === md.dateLabel
            )
          ) {
            return {
              ...md,
              targetCookCount: 0,
              targetCleanCount: 0,
              specialNote: "NO COMMUNITY MEAL (Auto-Cancelled: Volunteer Deficit)",
            };
          }
          return md;
        });
        bestResult = solveStochasticRestarts(finalDates, responses, exceptions, options, 250);
      }
    }
  }

  // 3. Compute Near-Complete Meal Opportunities for any cancelled / dropped deficit dates
  const opportunities: import("./types").NearCompleteMealOpportunity[] = [];

  for (const day of bestResult.schedule) {
    if (day.targetCookCount === 0 && day.targetCleanCount === 0) {
      const targetCooks = day.mealType === "BRUNCH" ? 2 : 3;
      const targetCleans = day.mealType === "BRUNCH" ? 2 : 3;

      const availCooks: string[] = [];
      const availCleans: string[] = [];
      const candidatesToAsk: import("./types").NearCompleteMealOpportunity["candidateVolunteersToAsk"] =
        [];

      for (const resp of responses) {
        const mDay = extractMonthDay(day.dateLabel) || extractMonthDay(day.dateKey);
        let status =
          resp.availability[day.dateLabel] || resp.availability[day.dateKey] || "UNAVAILABLE";
        if (status === "UNAVAILABLE" && mDay) {
          for (const [k, v] of Object.entries(resp.availability || {})) {
            if (extractMonthDay(k) === mDay) {
              status = v;
              break;
            }
          }
        }

        const roles: ("COOK" | "CLEAN")[] = [];
        if (status === "AVAILABLE" || status === "COOK_ONLY") {
          availCooks.push(resp.name);
          roles.push("COOK");
        }
        if (status === "AVAILABLE" || status === "CLEAN_ONLY") {
          availCleans.push(resp.name);
          roles.push("CLEAN");
        }

        if (roles.length > 0) {
          const stats = bestResult.memberStats[resp.name];
          candidatesToAsk.push({
            name: resp.name,
            availableRoles: roles,
            currentAssignedShifts: stats?.totalAssigned || 0,
            requestedQuota: (resp.cookQuota ?? 1) + (resp.cleanQuota ?? 1),
            assignedCooks: stats?.assignedCooks || 0,
            requestedCookQuota: resp.cookQuota ?? 1,
            assignedCleans: stats?.assignedCleans || 0,
            requestedCleanQuota: resp.cleanQuota ?? 1,
            specialInstructions: resp.specialInstructions,
          });
        }
      }

      // If there are volunteers available on this date, surface it as a near-complete candidate
      if (availCooks.length > 0 || availCleans.length > 0) {
        // Count available members who still have unused quota in the schedule
        const cooksWithRemainingQuota = availCooks.filter((name) => {
          const stats = bestResult.memberStats[name];
          const resp = responses.find((r) => r.name === name);
          const quota = resp ? resp.cookQuota : 1;
          return (stats?.assignedCooks || 0) < quota;
        });

        const cleansWithRemainingQuota = availCleans.filter((name) => {
          const stats = bestResult.memberStats[name];
          const resp = responses.find((r) => r.name === name);
          const quota = resp ? resp.cleanQuota : 1;
          return (stats?.assignedCleans || 0) < quota;
        });

        // Exact shortage needed to staff this meal (considering who has remaining quota vs at limit)
        const missingCooks = Math.max(
          cooksWithRemainingQuota.length < targetCooks
            ? targetCooks - cooksWithRemainingQuota.length
            : 0,
          availCooks.length < targetCooks ? targetCooks - availCooks.length : 1
        );
        const missingCleans = Math.max(
          cleansWithRemainingQuota.length < targetCleans
            ? targetCleans - cleansWithRemainingQuota.length
            : 0,
          availCleans.length < targetCleans ? targetCleans - availCleans.length : 1
        );
        const totalMissing = missingCooks + missingCleans;

        let outreach = "";
        const allAvail = Array.from(new Set([...availCooks, ...availCleans]))
          .slice(0, 5)
          .join(", ");
        if (missingCooks > 0 && missingCleans > 0) {
          outreach = `Need ${missingCooks} cook${missingCooks > 1 ? "s" : ""} & ${missingCleans} cleaner${missingCleans > 1 ? "s" : ""} for ${day.dateLabel}! Available folks: ${allAvail || "none listed"}. Would anyone be open to taking an extra shift so we can keep this meal on the schedule?`;
        } else if (missingCooks > 0) {
          const cookList = availCooks.slice(0, 5).join(", ");
          outreach = `Need ${missingCooks} cook${missingCooks > 1 ? "s" : ""} for ${day.dateLabel}! Available cooks: ${cookList || "none listed"}. Can anyone take an extra cook shift?`;
        } else if (missingCleans > 0) {
          const cleanList = availCleans.slice(0, 5).join(", ");
          outreach = `Need ${missingCleans} cleaner${missingCleans > 1 ? "s" : ""} for ${day.dateLabel}! Available cleaners: ${cleanList || "none listed"}. Can anyone do an extra clean shift?`;
        } else {
          outreach = `Meal on ${day.dateLabel} needs volunteers. Available folks: ${allAvail}. Anyone open to helping?`;
        }

        const mealDateMatch = mealDates.find(
          (md) => md.dateKey === day.dateKey || md.dateLabel === day.dateLabel
        );
        opportunities.push({
          dateKey: day.dateKey,
          dateLabel: day.dateLabel,
          dayOfWeek: mealDateMatch?.dayOfWeek || "Day",
          mealType: day.mealType,
          targetCookCount: targetCooks,
          targetCleanCount: targetCleans,
          availableCooks: availCooks,
          availableCleaners: availCleans,
          missingCooksCount: missingCooks,
          missingCleanersCount: missingCleans,
          totalMissingCount: totalMissing,
          candidateVolunteersToAsk: candidatesToAsk,
          suggestedOutreachText: outreach,
        });
      }
    }
  }

  // Sort opportunities by fewest missing volunteers first (closest to viable)
  opportunities.sort((a, b) => a.totalMissingCount - b.totalMissingCount);
  bestResult.nearCompleteOpportunities = opportunities;

  bestResult.solveTimeMs = Date.now() - startTime;
  return bestResult;
}
