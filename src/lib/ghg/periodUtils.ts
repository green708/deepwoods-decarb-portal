// periodUtils.ts — period-aware month / quarter / half-year lists
// Supports both FY (April–March) and CY (January–December) reporting periods.

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const MONTH_SHORT = [
  "Jan","Feb","Mar","Apr","May","Jun",
  "Jul","Aug","Sep","Oct","Nov","Dec",
];

export interface PeriodMonth {
  key: string;   // "2025-04"
  short: string; // "Apr-25"
  long: string;  // "April 2025"
}

export interface PeriodOptions {
  months: PeriodMonth[];
  quarters: { key: string; label: string }[];
  halfYears: { key: string; label: string }[];
  yearLabel: string; // e.g. "FY26" or "CY 2025"
  startYear: number;
  endYear: number;
}

/**
 * Returns period options (months, quarters, half-years) for a given
 * fiscal year string and reporting period convention.
 *
 * Examples:
 *   buildPeriodOptions("FY26", "FY") → Apr 2025 – Mar 2026
 *   buildPeriodOptions("CY2025", "CY") / buildPeriodOptions("2025", "CY") → Jan 2025 – Dec 2025
 */
export function buildPeriodOptions(
  fy: string,
  reportingPeriod: "FY" | "CY" = "FY",
): PeriodOptions {
  const num = parseInt(fy.replace(/\D/g, ""), 10);

  if (reportingPeriod === "CY") {
    const year = num < 100 ? 2000 + num : num;
    const yy = String(year).slice(-2);
    const months: PeriodMonth[] = Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      return {
        key:   `${year}-${String(m).padStart(2, "0")}`,
        short: `${MONTH_SHORT[i]}-${yy}`,
        long:  `${MONTH_NAMES[i]} ${year}`,
      };
    });
    return {
      months,
      quarters: [
        { key: "Q1", label: "Q1 — Jan · Feb · Mar" },
        { key: "Q2", label: "Q2 — Apr · May · Jun" },
        { key: "Q3", label: "Q3 — Jul · Aug · Sep" },
        { key: "Q4", label: "Q4 — Oct · Nov · Dec" },
      ],
      halfYears: [
        { key: "H1", label: "H1 — Jan to Jun" },
        { key: "H2", label: "H2 — Jul to Dec" },
      ],
      yearLabel: `CY ${year}`,
      startYear: year,
      endYear:   year,
    };
  }

  // FY: num is the short end-year (e.g. 26 for FY26 = Apr 2025 – Mar 2026)
  const endYear   = num < 100 ? 2000 + num : num;
  const startYear = endYear - 1;
  const startYY   = String(startYear).slice(-2);
  const endYY     = String(endYear).slice(-2);

  const months: PeriodMonth[] = [
    // Apr–Dec of startYear
    ...Array.from({ length: 9 }, (_, i) => {
      const m = 4 + i;
      return {
        key:   `${startYear}-${String(m).padStart(2, "0")}`,
        short: `${MONTH_SHORT[m - 1]}-${startYY}`,
        long:  `${MONTH_NAMES[m - 1]} ${startYear}`,
      };
    }),
    // Jan–Mar of endYear
    ...Array.from({ length: 3 }, (_, i) => {
      const m = i + 1;
      return {
        key:   `${endYear}-${String(m).padStart(2, "0")}`,
        short: `${MONTH_SHORT[m - 1]}-${endYY}`,
        long:  `${MONTH_NAMES[m - 1]} ${endYear}`,
      };
    }),
  ];

  return {
    months,
    quarters: [
      { key: "Q1", label: "Q1 — Apr · May · Jun" },
      { key: "Q2", label: "Q2 — Jul · Aug · Sep" },
      { key: "Q3", label: "Q3 — Oct · Nov · Dec" },
      { key: "Q4", label: "Q4 — Jan · Feb · Mar" },
    ],
    halfYears: [
      { key: "H1", label: "H1 — Apr to Sep" },
      { key: "H2", label: "H2 — Oct to Mar" },
    ],
    yearLabel: `FY${endYY}`,
    startYear,
    endYear,
  };
}
