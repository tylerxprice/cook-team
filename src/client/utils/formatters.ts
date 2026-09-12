export function getOrdinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function formatDisplayDateLabel(dateLabel?: string): string {
  if (!dateLabel) return "";
  let cleaned = dateLabel.trim();
  // Replace verbose "(Sun, Brunch)" or "(Sun, Dinner)" with "(Sun)"
  cleaned = cleaned.replace(
    /\s*\((?:Sun|Sunday|Mon|Monday|Tue|Tuesday|Wed|Wednesday|Thu|Thur|Thurs|Thursday|Fri|Friday|Sat|Saturday),\s*(?:Brunch|Dinner)\)/i,
    (match) => {
      const dayMatch = match.match(
        /\b(Sun|Sunday|Mon|Monday|Tue|Tuesday|Wed|Wednesday|Thu|Thur|Thurs|Thursday|Fri|Friday|Sat|Saturday)\b/i
      );
      return dayMatch ? ` (${dayMatch[1]})` : "";
    }
  );
  return cleaned;
}
