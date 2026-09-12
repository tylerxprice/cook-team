import React from "react";
import { BarChart3, X, RefreshCw, Search } from "lucide-react";
import { CommunityReportSummary } from "../../../server/types";
import { BADGE_DEFINITIONS } from "../common/BadgeDefinitions";

export interface CommunityReportsModalProps {
  show: boolean;
  onClose: () => void;
  availableReportMonths: string[];
  selectedReportMonths: string[];
  setSelectedReportMonths: (months: string[]) => void;
  loadingReport: boolean;
  communityReport: CommunityReportSummary | null;
  reportSearch: string;
  setReportSearch: (val: string) => void;
  reportSort: "shifts" | "cooks" | "cleans" | "months" | "name";
  setReportSort: (val: "shifts" | "cooks" | "cleans" | "months" | "name") => void;
  fetchCommunityReports: () => void;
}

export const CommunityReportsModal: React.FC<CommunityReportsModalProps> = ({
  show,
  onClose,
  availableReportMonths,
  selectedReportMonths,
  setSelectedReportMonths,
  loadingReport,
  communityReport,
  reportSearch,
  setReportSearch,
  reportSort,
  setReportSort,
  fetchCommunityReports,
}) => {
  if (!show) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title-reports"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[90vh] shadow-2xl flex flex-col overflow-hidden border border-slate-200">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center font-bold border border-orange-200">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h3
                id="modal-title-reports"
                className="text-base sm:text-lg font-bold text-slate-900"
              >
                Community Trends & Volunteer Equity Report
              </h3>
              <p className="text-xs text-slate-700 mt-0.5">
                Multi-month historical shift contributions, volunteer balance, and participation
                equity.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Month Range & Selection Controls */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-800">Filter Months to Include:</span>
              <div className="flex items-center gap-2 text-xs flex-wrap">
                <button
                  type="button"
                  onClick={() => setSelectedReportMonths([...availableReportMonths])}
                  className="min-h-[36px] px-3 py-1 rounded-xl bg-white hover:bg-slate-200 text-slate-800 border border-slate-300 font-bold cursor-pointer"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedReportMonths(availableReportMonths.slice(0, 3))}
                  className="min-h-[36px] px-3 py-1 rounded-xl bg-white hover:bg-slate-200 text-slate-800 border border-slate-300 font-bold cursor-pointer"
                >
                  Last 3 Months
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedReportMonths(availableReportMonths.slice(0, 6))}
                  className="min-h-[36px] px-3 py-1 rounded-xl bg-white hover:bg-slate-200 text-slate-800 border border-slate-300 font-bold cursor-pointer"
                >
                  Last 6 Months
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedReportMonths([])}
                  className="min-h-[36px] px-3 py-1 rounded-xl bg-white hover:bg-slate-200 text-slate-800 border border-slate-300 font-bold cursor-pointer"
                >
                  Clear
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => fetchCommunityReports()}
              disabled={loadingReport || selectedReportMonths.length === 0}
              className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-xs cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loadingReport ? "animate-spin" : ""}`} />
              <span>Run Report ({selectedReportMonths.length} Selected)</span>
            </button>
          </div>

          {/* Month Pills Checkboxes */}
          <div className="flex flex-wrap gap-2 pt-1">
            {availableReportMonths.map((mKey) => {
              const isSelected = selectedReportMonths.includes(mKey);
              return (
                <button
                  key={mKey}
                  type="button"
                  onClick={() => {
                    if (isSelected) {
                      setSelectedReportMonths(selectedReportMonths.filter((m) => m !== mKey));
                    } else {
                      setSelectedReportMonths([...selectedReportMonths, mKey]);
                    }
                  }}
                  className={`min-h-[40px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    isSelected
                      ? "bg-orange-100 text-orange-950 border-orange-400 shadow-2xs"
                      : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                  }`}
                >
                  <span>{isSelected ? "✓" : "○"}</span>
                  <span>{mKey}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Modal Body / Report Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-6">
          {loadingReport && (
            <div className="py-12 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-orange-600 animate-spin mx-auto" />
              <p className="text-sm font-bold text-slate-800">
                Scanning schedule tabs and calculating equity...
              </p>
            </div>
          )}

          {!loadingReport && !communityReport && (
            <div className="py-12 text-center space-y-2 text-slate-600">
              <p className="text-xs sm:text-sm">
                Select your desired month range above and click <strong>Run Report</strong>.
              </p>
            </div>
          )}

          {!loadingReport && communityReport && (
            <>
              {/* 4 Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-slate-50 rounded-xl border border-slate-300 p-4">
                  <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Total Meals
                  </div>
                  <div className="text-2xl font-black text-slate-900 mt-1">
                    {communityReport.totalMealsServed}
                  </div>
                  <div className="text-xs text-slate-600 mt-0.5">
                    Across {communityReport.totalMonthsTracked} month(s)
                  </div>
                </div>

                <div className="bg-orange-50 rounded-xl border border-orange-300 p-4">
                  <div className="text-xs font-bold text-orange-900 uppercase tracking-wider">
                    Total Cook Shifts
                  </div>
                  <div className="text-2xl font-black text-orange-700 mt-1">
                    {communityReport.totalCookShifts}
                  </div>
                  <div className="text-xs text-slate-700 mt-0.5">Dinner &amp; brunch cooks</div>
                </div>

                <div className="bg-sky-50 rounded-xl border border-sky-300 p-4">
                  <div className="text-xs font-bold text-sky-900 uppercase tracking-wider">
                    Total Clean Shifts
                  </div>
                  <div className="text-2xl font-black text-sky-700 mt-1">
                    {communityReport.totalCleanShifts}
                  </div>
                  <div className="text-xs text-slate-700 mt-0.5">Dining &amp; kitchen cleanup</div>
                </div>

                <div className="bg-emerald-50 rounded-xl border border-emerald-300 p-4">
                  <div className="text-xs font-bold text-emerald-900 uppercase tracking-wider">
                    Active Volunteers
                  </div>
                  <div className="text-2xl font-black text-emerald-700 mt-1">
                    {communityReport.uniqueVolunteersCount}
                  </div>
                  <div className="text-xs text-slate-700 mt-0.5">Participating residents</div>
                </div>
              </div>

              {/* Leaderboard Table */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm sm:text-base font-bold text-slate-900">
                      Volunteer Participation &amp; Equity Leaderboard
                    </h4>
                    <p className="text-xs text-slate-600">
                      Individual shift quota balance, cooking vs cleaning distribution, and badges.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <label htmlFor="report-resident-search-input" className="sr-only">
                        Search resident
                      </label>
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        id="report-resident-search-input"
                        type="text"
                        placeholder="Search resident..."
                        value={reportSearch}
                        onChange={(e) => setReportSearch(e.target.value)}
                        className="min-h-[44px] pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-slate-900 font-medium"
                      />
                    </div>

                    <div>
                      <label htmlFor="report-sort-selector" className="sr-only">
                        Sort leaderboard
                      </label>
                      <select
                        id="report-sort-selector"
                        value={reportSort}
                        onChange={(e: any) => setReportSort(e.target.value)}
                        className="min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-bold text-slate-800"
                      >
                        <option value="shifts">Sort by Total Shifts</option>
                        <option value="cooks">Sort by Cook Shifts</option>
                        <option value="cleans">Sort by Clean Shifts</option>
                        <option value="months">Sort by Months Active</option>
                        <option value="name">Sort by Name</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Badge Guide & Criteria Legend */}
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-bold text-slate-700 mr-1">Badge Legend:</span>
                  {Object.entries(BADGE_DEFINITIONS).map(([badgeName, meta]) => (
                    <div
                      key={badgeName}
                      title={meta.desc}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-bold cursor-help ${meta.color}`}
                    >
                      <span>{badgeName}</span>
                      <span className="text-slate-600 font-normal hidden lg:inline">
                        ({meta.desc})
                      </span>
                    </div>
                  ))}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700 uppercase font-bold border-b border-slate-300">
                      <tr>
                        <th scope="col" className="px-3.5 py-3">
                          #
                        </th>
                        <th scope="col" className="px-3.5 py-3">
                          Resident
                        </th>
                        <th scope="col" className="px-3.5 py-3">
                          Badges
                        </th>
                        <th scope="col" className="px-3.5 py-3">
                          Months Active
                        </th>
                        <th scope="col" className="px-3.5 py-3">
                          Cook Shifts
                        </th>
                        <th scope="col" className="px-3.5 py-3">
                          Clean Shifts
                        </th>
                        <th scope="col" className="px-3.5 py-3">
                          Same-Day
                        </th>
                        <th scope="col" className="px-3.5 py-3">
                          Total
                        </th>
                        <th scope="col" className="px-3.5 py-3">
                          Avg / Month
                        </th>
                        <th scope="col" className="px-3.5 py-3">
                          Monthly Breakdown
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(() => {
                        const filtered = communityReport.memberEquityStats.filter((m) =>
                          reportSearch
                            ? m.name.toLowerCase().includes(reportSearch.toLowerCase())
                            : true
                        );

                        filtered.sort((a, b) => {
                          if (reportSort === "shifts") return b.totalShifts - a.totalShifts;
                          if (reportSort === "cooks") return b.totalCooks - a.totalCooks;
                          if (reportSort === "cleans") return b.totalCleans - a.totalCleans;
                          if (reportSort === "months") return b.monthsActive - a.monthsActive;
                          return a.name.localeCompare(b.name);
                        });

                        return filtered.map((m, idx) => (
                          <tr key={m.name} className="hover:bg-slate-50 transition-colors">
                            <td className="px-3.5 py-3 font-bold text-slate-500">{idx + 1}</td>
                            <td className="px-3.5 py-3 font-bold text-slate-900 text-sm">
                              {m.name}
                            </td>
                            <td className="px-3.5 py-3">
                              <div className="flex flex-wrap gap-1">
                                {m.badges.map((b) => {
                                  const meta = BADGE_DEFINITIONS[b] || {
                                    desc: "Community volunteer badge",
                                    color: "bg-slate-100 text-slate-800 border-slate-300",
                                  };
                                  return (
                                    <span
                                      key={b}
                                      title={`${b}: ${meta.desc}`}
                                      className={`text-xs font-bold px-2 py-0.5 rounded-full border cursor-help shadow-2xs transition-transform hover:scale-105 ${meta.color}`}
                                    >
                                      {b}
                                    </span>
                                  );
                                })}
                              </div>
                            </td>
                            <td className="px-3.5 py-3 font-semibold text-slate-800">
                              {m.monthsActive}
                            </td>
                            <td className="px-3.5 py-3 font-bold text-orange-800">
                              {m.totalCooks}
                            </td>
                            <td className="px-3.5 py-3 font-bold text-sky-800">{m.totalCleans}</td>
                            <td className="px-3.5 py-3 font-bold text-purple-800">
                              {m.sameDayShifts}
                            </td>
                            <td className="px-3.5 py-3 font-black text-slate-900 text-sm">
                              {m.totalShifts}
                            </td>
                            <td className="px-3.5 py-3 font-semibold text-slate-700">
                              {m.averageShiftsPerMonth}
                            </td>
                            <td className="px-3.5 py-3">
                              <div className="flex flex-wrap gap-1 max-w-xs">
                                {Object.entries(m.monthlyBreakdown).map(([mKey, counts]) => (
                                  <span
                                    key={mKey}
                                    className="text-xs bg-slate-100 text-slate-800 px-2 py-0.5 rounded-lg border border-slate-200 font-mono font-bold"
                                    title={`${mKey}: ${counts.cooks} cooks, ${counts.cleans} cleans`}
                                  >
                                    {mKey}: {counts.total}
                                  </span>
                                ))}
                              </div>
                            </td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-6 py-2 text-xs sm:text-sm font-bold text-slate-700 hover:text-slate-950 bg-white border border-slate-300 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
