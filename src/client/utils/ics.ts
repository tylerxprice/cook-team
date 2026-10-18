/**
 * RFC 5545 iCalendar (.ics) Generator for Community Meal Shifts
 * Generates all-day calendar events with dual alarms (1 day before + morning of shift)
 * and detailed descriptions including teammates.
 */

import type { DaySchedule } from "../../server/types.ts";

export interface CalendarEventPayload {
  dateKey: string; // "YYYY-MM-DD"
  dateLabel: string;
  mealType: "DINNER" | "BRUNCH";
  role: "Cook" | "Cleaner";
  teammatesCooks: string[];
  teammatesCleaners: string[];
  specialNote?: string;
  communityName?: string;
}

/**
 * Formats a Date object or "YYYY-MM-DD" string into RFC 5545 DATE format (YYYYMMDD)
 */
export function formatDateToIcsDate(dateKey: string): { start: string; end: string } {
  const parts = dateKey.split("-");
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);

    const startDate = new Date(year, month, day);
    const endDate = new Date(year, month, day + 1); // RFC 5545 all-day end date is exclusive (day + 1)

    const format = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const dt = String(d.getDate()).padStart(2, "0");
      return `${y}${m}${dt}`;
    };

    return {
      start: format(startDate),
      end: format(endDate),
    };
  }

  // Fallback
  const clean = dateKey.replace(/\D/g, "").slice(0, 8);
  return { start: clean, end: clean };
}

/**
 * Escapes characters for RFC 5545 text fields
 */
function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

/**
 * Generates an RFC 5545 .ics file string for a member's shifts
 */
export function generateMemberIcs(
  memberName: string,
  events: CalendarEventPayload[],
  communityName = "Vancouver Cohousing"
): string {
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CookTeamTool//Community Meal Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${memberName}'s Meal Shifts - ${communityName}`,
  ];

  events.forEach((ev, idx) => {
    const { start, end } = formatDateToIcsDate(ev.dateKey);
    const roleIcon = ev.role === "Cook" ? "🍳" : "🧼";
    const mealLabel = ev.mealType === "BRUNCH" ? "Brunch" : "Dinner";
    const summary = `${roleIcon} ${ev.role} Shift: ${mealLabel} (${communityName})`;
    const uid = `shift-${ev.dateKey}-${ev.role.toLowerCase()}-${idx}-${timestamp}@cookteamtool`;

    const descriptionParts: string[] = [
      `Role: ${ev.role}`,
      `Meal: ${mealLabel}`,
      `Date: ${ev.dateLabel || ev.dateKey}`,
      `Cook Team: ${ev.teammatesCooks.join(", ") || "None"}`,
      `Clean Team: ${ev.teammatesCleaners.join(", ") || "None"}`,
    ];

    if (ev.specialNote) {
      descriptionParts.push(`Note: ${ev.specialNote}`);
    }

    descriptionParts.push(`Community: ${communityName}`);

    const description = escapeIcsText(descriptionParts.join("\n"));

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${timestamp}`);
    lines.push(`DTSTART;VALUE=DATE:${start}`);
    lines.push(`DTEND;VALUE=DATE:${end}`);
    lines.push(`SUMMARY:${escapeIcsText(summary)}`);
    lines.push(`DESCRIPTION:${description}`);
    lines.push("STATUS:CONFIRMED");
    lines.push("TRANSP:OPAQUE");

    // Alarm 1: 1 day before at 9:00 AM (15 hours before start of meal day)
    lines.push("BEGIN:VALARM");
    lines.push("ACTION:DISPLAY");
    lines.push(`DESCRIPTION:${escapeIcsText(`Reminder: Tomorrow is your ${ev.role} shift for ${mealLabel}!`)}`);
    lines.push("TRIGGER:-P1DT15H"); // 1 day before, 9am
    lines.push("END:VALARM");

    // Alarm 2: Morning of shift at 8:00 AM
    lines.push("BEGIN:VALARM");
    lines.push("ACTION:DISPLAY");
    lines.push(`DESCRIPTION:${escapeIcsText(`Reminder: Today is your ${ev.role} shift for ${mealLabel}!`)}`);
    lines.push("TRIGGER:PT8H"); // 8:00 AM on the day of the event
    lines.push("END:VALARM");

    lines.push("END:VEVENT");
  });

  lines.push("END:VCALENDAR");

  return lines.join("\r\n");
}

/**
 * Extracts a member's shifts from a full DaySchedule[]
 */
export function extractMemberShifts(
  memberName: string,
  schedule: DaySchedule[],
  communityName = "Vancouver Cohousing"
): CalendarEventPayload[] {
  if (!memberName || !schedule) return [];
  const cleanName = memberName.trim().toLowerCase();
  const shifts: CalendarEventPayload[] = [];

  for (const day of schedule) {
    const isCook = (day.cooks || []).some((c) => c.trim().toLowerCase() === cleanName);
    const isCleaner = (day.cleaners || []).some((c) => c.trim().toLowerCase() === cleanName);

    if (isCook) {
      shifts.push({
        dateKey: day.dateKey,
        dateLabel: day.dateLabel,
        mealType: day.mealType,
        role: "Cook",
        teammatesCooks: day.cooks || [],
        teammatesCleaners: day.cleaners || [],
        specialNote: day.specialNote,
        communityName,
      });
    }

    if (isCleaner) {
      shifts.push({
        dateKey: day.dateKey,
        dateLabel: day.dateLabel,
        mealType: day.mealType,
        role: "Cleaner",
        teammatesCooks: day.cooks || [],
        teammatesCleaners: day.cleaners || [],
        specialNote: day.specialNote,
        communityName,
      });
    }
  }

  return shifts;
}

/**
 * Triggers a file download of the .ics file in browser
 */
export function downloadIcsFile(filename: string, icsContent: string): void {
  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".ics") ? filename : `${filename}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
