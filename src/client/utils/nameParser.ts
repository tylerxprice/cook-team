/**
 * Parses raw text from Google Groups / email rosters and disambiguates duplicate first names.
 * Uses "First Name" by default, and "First Name L." if there are multiple members with the same first name.
 */

export interface ParsedRosterMember {
  name: string;
  google_email: string;
  active: boolean;
  rawInput: string;
}

export function parseAndDisambiguateGoogleGroupRoster(
  rawText: string
): ParsedRosterMember[] {
  if (!rawText || rawText.trim() === "") return [];

  const rawLines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const intermediate: {
    raw: string;
    rawName: string;
    email: string;
    firstName: string;
    lastName: string;
    lastInitial: string;
  }[] = [];

  for (const line of rawLines) {
    let rawName = "";
    let email = "";

    // 1. Check for tab-separated (e.g. copied directly from Google Groups web table)
    if (line.includes("\t")) {
      const parts = line.split("\t").map((s) => s.trim()).filter(Boolean);
      const emailPart = parts.find((p) => p.includes("@") && p.includes("."));
      const namePart = parts.find(
        (p) =>
          p !== emailPart &&
          !p.includes("Joined") &&
          !p.includes("Owner") &&
          !p.includes("Member") &&
          !p.includes("Manager")
      );
      rawName = namePart || (emailPart ? emailPart.split("@")[0] : "Member");
      email = emailPart || "";
    }
    // 2. RFC format: Full Name <email@example.com>
    else if (line.includes("<") && line.includes(">")) {
      const match = line.match(/^([^<]+)<([^>]+)>/);
      if (match) {
        rawName = match[1].trim();
        email = match[2].trim();
      }
    }
    // 3. Email found anywhere in line
    else {
      const emailMatch = line.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      if (emailMatch) {
        email = emailMatch[1];
        rawName = line.replace(email, "").replace(/[<>(),]/g, "").trim();
      } else {
        rawName = line.replace(/[<>(),]/g, "").trim();
      }
    }

    // If name is still empty but email is present, synthesize from email handle (e.g. "sarah.chen@...")
    if (!rawName && email) {
      const handle = email.split("@")[0].replace(/[._-]/g, " ");
      rawName = handle;
    }

    if (!rawName && !email) continue;

    // Handle "Last, First"
    let cleanName = rawName;
    if (cleanName.includes(",")) {
      const p = cleanName.split(",").map((s) => s.trim());
      cleanName = `${p[1] || ""} ${p[0] || ""}`.trim();
    }

    // Split name into first, middle, last
    const tokens = cleanName.split(/\s+/).filter(Boolean);
    const firstName = tokens[0]
      ? tokens[0].charAt(0).toUpperCase() + tokens[0].slice(1).toLowerCase()
      : "Member";
    const lastName = tokens.length > 1 ? tokens[tokens.length - 1] : "";
    const lastInitial = lastName
      ? lastName.charAt(0).toUpperCase()
      : "";

    intermediate.push({
      raw: line,
      rawName: cleanName || firstName,
      email,
      firstName,
      lastName: lastName ? lastName.charAt(0).toUpperCase() + lastName.slice(1).toLowerCase() : "",
      lastInitial,
    });
  }

  // Count occurrences of each first name to find duplicates
  const firstNameCounts: Record<string, number> = {};
  for (const m of intermediate) {
    firstNameCounts[m.firstName] = (firstNameCounts[m.firstName] || 0) + 1;
  }

  // Check for duplicates with same first name AND same last initial
  const firstAndInitialCounts: Record<string, number> = {};
  for (const m of intermediate) {
    if (firstNameCounts[m.firstName] > 1) {
      const key = `${m.firstName}_${m.lastInitial}`;
      firstAndInitialCounts[key] = (firstAndInitialCounts[key] || 0) + 1;
    }
  }

  const results: ParsedRosterMember[] = [];
  const seenNames = new Set<string>();

  for (const m of intermediate) {
    let finalName = m.firstName;

    if (firstNameCounts[m.firstName] > 1) {
      const key = `${m.firstName}_${m.lastInitial}`;
      if (firstAndInitialCounts[key] > 1 && m.lastName) {
        // If both First name AND Last initial are identical (e.g. Sarah Chen & Sarah Clark)
        finalName = `${m.firstName} ${m.lastName}`;
      } else if (m.lastInitial) {
        finalName = `${m.firstName} ${m.lastInitial}.`;
      } else {
        finalName = m.rawName;
      }
    }

    // Deduplicate identical final names if any
    let uniqueFinalName = finalName;
    let dupIndex = 2;
    while (seenNames.has(uniqueFinalName)) {
      uniqueFinalName = `${finalName} (${dupIndex})`;
      dupIndex++;
    }
    seenNames.add(uniqueFinalName);

    results.push({
      name: uniqueFinalName,
      google_email: m.email,
      active: true,
      rawInput: m.raw,
    });
  }

  return results.sort((a, b) => a.name.localeCompare(b.name));
}
