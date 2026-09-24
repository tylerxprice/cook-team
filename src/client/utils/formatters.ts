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

export function formatEmailHtmlBody(plainText: string): string {
  const escaped = String(plainText || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const lines = escaped.split("\n");
  let html = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1e293b;">`;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      html += `<div style="height: 10px;"></div>`;
    } else if (/^(\*|_)?(cleaners?|cleaning):/i.test(trimmed)) {
      const cleanLine = trimmed.replace(/^(\*|_)+|(\*|_)+$/g, "");
      html += `<div style="font-style: italic; color: #475569; margin: 3px 0;">${cleanLine}</div>`;
    } else if (trimmed === "NO COMMUNITY MEAL" || trimmed.startsWith("NO COMMUNITY MEAL")) {
      html += `<div style="font-weight: bold; color: #64748b; margin: 3px 0;">NO COMMUNITY MEAL</div>`;
    } else if (trimmed.startsWith("• ") || trimmed.startsWith("  • ")) {
      html += `<div style="padding-left: 18px; margin: 3px 0;">${trimmed}</div>`;
    } else if (
      line.includes("(") &&
      (line.includes("Dinner") ||
        line.includes("Brunch") ||
        line.includes("Mon") ||
        line.includes("Tue") ||
        line.includes("Wed") ||
        line.includes("Thu") ||
        line.includes("Fri") ||
        line.includes("Sat") ||
        line.includes("Sun") ||
        line.includes("Jan") ||
        line.includes("Feb") ||
        line.includes("Mar") ||
        line.includes("Apr") ||
        line.includes("May") ||
        line.includes("Jun") ||
        line.includes("Jul") ||
        line.includes("Aug") ||
        line.includes("Sep") ||
        line.includes("Oct") ||
        line.includes("Nov") ||
        line.includes("Dec"))
    ) {
      html += `<div style="font-weight: bold; margin-top: 14px; margin-bottom: 3px; color: #0f172a;">${line}</div>`;
    } else {
      html += `<div style="margin: 2px 0;">${line}</div>`;
    }
  }

  html += `</div>`;
  return html;
}

