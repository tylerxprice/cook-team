/**
 * Synthetic Baseline Historical Schedules (Jan - Sep 2026)
 * Uses generic personas to test multi-month equity aggregation and historical fallback.
 */

import { parseScheduleGridData } from "./scheduleParser";
import { MonthScheduleRecord } from "./reports";

const SYNTHETIC_NAMES = [
  "Alice",
  "Bob",
  "Charlie",
  "David",
  "Emma",
  "Frank",
  "Grace",
  "Henry",
  "Ian",
  "Julia",
  "Kevin",
  "Laura",
  "Mike",
  "Nina",
  "Oscar",
  "Paula",
  "Quinn",
  "Rachel",
  "Sam",
  "Taylor",
  "Uma",
  "Victor",
  "Wendy",
  "Xander",
  "Yara",
  "Zack",
  "Arthur",
  "Beatrice",
  "Conrad",
  "Diana",
];

const HISTORICAL_MONTH_METADATA = [
  { key: "2026-01", count: 11, label: "Jan" },
  { key: "2026-02", count: 12, label: "Feb" },
  { key: "2026-03", count: 14, label: "Mar" },
  { key: "2026-04", count: 12, label: "Apr" },
  { key: "2026-05", count: 13, label: "May" },
  { key: "2026-06", count: 13, label: "Jun" },
  { key: "2026-07", count: 13, label: "Jul" },
  { key: "2026-08", count: 14, label: "Aug" },
  { key: "2026-09", count: 12, label: "Sep" },
];

export function generateSyntheticHistoricalGrids(): { monthKey: string; rows: any[][] }[] {
  const grids: { monthKey: string; rows: any[][] }[] = [];
  let nameIdx = 0;

  for (const m of HISTORICAL_MONTH_METADATA) {
    const rows: any[][] = [
      [
        "Date",
        "Meal Type",
        "Special Note",
        "Cook 1",
        "Cook 2",
        "Cook 3",
        "Clean 1",
        "Clean 2",
        "Clean 3",
        "Clean 4",
        "Clean 5",
        "Clean 6",
        "Clean 7",
        "Clean 8",
        "Clean 9",
        "Clean 10",
        "Clean 11",
        "Status / Notes",
      ],
    ];

    for (let d = 1; d <= m.count; d++) {
      const isBrunch = d % 3 === 0;
      const mealType = isBrunch ? "BRUNCH" : "DINNER";
      const dayNum = d * 2;
      const dateLabel = `${m.label} ${dayNum < 10 ? "0" + dayNum : dayNum} (${isBrunch ? "Sun, Brunch" : "Thur"})`;

      const cook1 = SYNTHETIC_NAMES[nameIdx++ % SYNTHETIC_NAMES.length];
      const cook2 = SYNTHETIC_NAMES[nameIdx++ % SYNTHETIC_NAMES.length];
      const cook3 = isBrunch ? "" : SYNTHETIC_NAMES[nameIdx++ % SYNTHETIC_NAMES.length];

      // Give same-day shifts to some volunteers
      const clean1 = d % 4 === 0 ? cook1 : SYNTHETIC_NAMES[nameIdx++ % SYNTHETIC_NAMES.length];
      const clean2 = SYNTHETIC_NAMES[nameIdx++ % SYNTHETIC_NAMES.length];
      const clean3 = isBrunch ? "" : SYNTHETIC_NAMES[nameIdx++ % SYNTHETIC_NAMES.length];

      rows.push([
        dateLabel,
        mealType,
        "",
        cook1,
        cook2,
        cook3,
        clean1,
        clean2,
        clean3,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "Synthetic Baseline Schedule",
      ]);
    }
    grids.push({ monthKey: m.key, rows });
  }

  return grids;
}

export function getBaselineHistoricalSchedules(): MonthScheduleRecord[] {
  const grids = generateSyntheticHistoricalGrids();
  const records: MonthScheduleRecord[] = [];
  for (const item of grids) {
    const parsed = parseScheduleGridData(item.rows);
    if (parsed.success && parsed.schedule.length > 0) {
      records.push({
        monthKey: item.monthKey,
        monthLabel: item.monthKey,
        schedule: parsed.schedule,
      });
    }
  }
  return records;
}
