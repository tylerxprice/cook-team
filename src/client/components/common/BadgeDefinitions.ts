export const BADGE_DEFINITIONS: Record<string, { label: string; desc: string; color: string }> = {
  "🌟 Super Volunteer": {
    label: "Super Volunteer",
    desc: "10+ total shifts completed across tracked months.",
    color: "bg-amber-50 text-amber-900 border-amber-300",
  },
  "🍳 Cook Master": {
    label: "Cook Master",
    desc: "6+ cook shifts completed across tracked months.",
    color: "bg-orange-50 text-orange-900 border-orange-300",
  },
  "🧼 Clean Master": {
    label: "Clean Master",
    desc: "6+ clean shifts completed across tracked months.",
    color: "bg-sky-50 text-sky-900 border-sky-300",
  },
  "⚡ Same-Day Star": {
    label: "Same-Day Star",
    desc: "3+ same-day double shifts (cooking and cleaning on the same meal date).",
    color: "bg-purple-50 text-purple-900 border-purple-300",
  },
  "⚖️ Equity Leader": {
    label: "Equity Leader",
    desc: "Balanced participation: perfectly equal or near-equal split between cooking and cleaning (diff ≤ 1, 4+ shifts).",
    color: "bg-emerald-50 text-emerald-900 border-emerald-300",
  },
};
