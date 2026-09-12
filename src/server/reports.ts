import { CommunityReportSummary, DaySchedule, MemberEquityStat } from "./types";

export interface MonthScheduleRecord {
  monthKey: string; // e.g. "2026-08" or "AUG/26"
  monthLabel?: string; // e.g. "August 2026"
  schedule: DaySchedule[];
}

/**
 * Computes multi-month volunteer equity metrics and summary statistics
 * across all historical and current monthly schedules.
 */
export function computeCommunityReportSummary(
  monthRecords: MonthScheduleRecord[]
): CommunityReportSummary {
  const memberMap = new Map<
    string,
    {
      name: string;
      totalCooks: number;
      totalCleans: number;
      sameDayShifts: number;
      monthlyBreakdown: Record<string, { cooks: number; cleans: number; total: number }>;
    }
  >();

  let totalMeals = 0;
  let totalCookShifts = 0;
  let totalCleanShifts = 0;

  const monthsList: string[] = [];

  for (const record of monthRecords) {
    const mKey = record.monthKey || "Current";
    if (!monthsList.includes(mKey)) monthsList.push(mKey);

    for (const day of record.schedule) {
      // Ignore cancelled days
      if (day.targetCookCount === 0 && day.targetCleanCount === 0) continue;
      totalMeals++;

      const dayCooks = day.cooks || [];
      const dayCleaners = day.cleaners || [];

      totalCookShifts += dayCooks.length;
      totalCleanShifts += dayCleaners.length;

      // Track cooks
      for (const cook of dayCooks) {
        if (!cook) continue;
        if (!memberMap.has(cook)) {
          memberMap.set(cook, {
            name: cook,
            totalCooks: 0,
            totalCleans: 0,
            sameDayShifts: 0,
            monthlyBreakdown: {},
          });
        }
        const m = memberMap.get(cook)!;
        m.totalCooks++;
        if (!m.monthlyBreakdown[mKey]) {
          m.monthlyBreakdown[mKey] = { cooks: 0, cleans: 0, total: 0 };
        }
        m.monthlyBreakdown[mKey].cooks++;
        m.monthlyBreakdown[mKey].total++;
      }

      // Track cleaners
      for (const cleaner of dayCleaners) {
        if (!cleaner) continue;
        if (!memberMap.has(cleaner)) {
          memberMap.set(cleaner, {
            name: cleaner,
            totalCooks: 0,
            totalCleans: 0,
            sameDayShifts: 0,
            monthlyBreakdown: {},
          });
        }
        const m = memberMap.get(cleaner)!;
        m.totalCleans++;
        if (!m.monthlyBreakdown[mKey]) {
          m.monthlyBreakdown[mKey] = { cooks: 0, cleans: 0, total: 0 };
        }
        m.monthlyBreakdown[mKey].cleans++;
        m.monthlyBreakdown[mKey].total++;
      }

      // Track same-day shifts
      const sameDayMembers = dayCooks.filter((c) => dayCleaners.includes(c));
      for (const sm of sameDayMembers) {
        const m = memberMap.get(sm);
        if (m) m.sameDayShifts++;
      }
    }
  }

  const memberStats: MemberEquityStat[] = [];
  const totalMonths = Math.max(1, monthsList.length);

  for (const m of memberMap.values()) {
    const totalShifts = m.totalCooks + m.totalCleans;
    const monthsActive = Object.keys(m.monthlyBreakdown).length;
    const avgPerMonth = Number((totalShifts / totalMonths).toFixed(1));

    const badges: string[] = [];
    if (totalShifts >= 10) badges.push("🌟 Super Volunteer");
    if (m.totalCooks >= 6) badges.push("🍳 Cook Master");
    if (m.totalCleans >= 6) badges.push("🧼 Clean Master");
    if (m.sameDayShifts >= 3) badges.push("⚡ Same-Day Star");
    if (Math.abs(m.totalCooks - m.totalCleans) <= 1 && totalShifts >= 4) {
      badges.push("⚖️ Equity Leader");
    }

    memberStats.push({
      name: m.name,
      totalCooks: m.totalCooks,
      totalCleans: m.totalCleans,
      totalShifts,
      monthsActive,
      sameDayShifts: m.sameDayShifts,
      averageShiftsPerMonth: avgPerMonth,
      monthlyBreakdown: m.monthlyBreakdown,
      badges,
    });
  }

  // Sort member stats by total shifts descending, then cook count
  memberStats.sort((a, b) => {
    if (b.totalShifts !== a.totalShifts) return b.totalShifts - a.totalShifts;
    if (b.totalCooks !== a.totalCooks) return b.totalCooks - a.totalCooks;
    return a.name.localeCompare(b.name);
  });

  return {
    totalMonthsTracked: monthsList.length,
    monthsList,
    totalMealsServed: totalMeals,
    totalCookShifts,
    totalCleanShifts,
    totalVolunteerShifts: totalCookShifts + totalCleanShifts,
    uniqueVolunteersCount: memberStats.length,
    memberEquityStats: memberStats,
  };
}
