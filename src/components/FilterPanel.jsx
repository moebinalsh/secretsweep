import { useState } from 'react';
import { Filter, X, ChevronDown, ChevronUp } from 'lucide-react';
import { groupBy } from '../lib/utils';

function FilterSection({ title, options, selected, onToggle, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-gray-100 dark:border-gray-800 pb-3 mb-3 last:border-0 last:pb-0 last:mb-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
      >
        {title}
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {open && (
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {options.map(({ label, count }) => (
            <label
              key={label}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
            >
              <input
                type="checkbox"
                checked={selected.includes(label)}
                onChange={() => onToggle(label)}
                className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-brand-600 focus:ring-brand-500"
              />
              <span className="flex-1 text-sm text-gray-700 dark:text-gray-300 truncate">{label}</span>
              <span className="text-xs text-gray-400 font-mono">{count}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export default function FilterPanel({ findings, filters, setFilters }) {
  const bySeverity = groupBy(findings, (f) => f.severity);
  const byType = groupBy(findings, (f) => f.secretType);
  const byRepo = groupBy(findings, (f) => f.repo);

  const severityOptions = ['critical', 'high', 'medium', 'low']
    .filter((s) => bySeverity[s])
    .map((s) => ({ label: s, count: bySeverity[s].length }));

  const typeOptions = Object.entries(byType)
    .map(([label, items]) => ({ label, count: items.length }))
    .sort((a, b) => b.count - a.count);

  const repoOptions = Object.entries(byRepo)
    .map(([label, items]) => ({ label, count: items.length }))
    .sort((a, b) => b.count - a.count);

  const toggle = (key, value) => {
    setFilters((prev) => ({
      ...prev,
      [key]: prev[key].includes(value)
        ? prev[key].filter((v) => v !== value)
        : [...prev[key], value],
    }));
  };

  const activeCount = filters.severity.length + filters.secretType.length + filters.repo.length + (filters.search ? 1 : 0);

  const clearAll = () => {
    setFilters({ severity: [], secretType: [], repo: [], search: '' });
  };

  return (
    <div className="w-full lg:w-72 flex-shrink-0">
      <div className="glass-card p-4 sticky top-24">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Filters</h3>
            {activeCount > 0 && (
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-brand-600 text-white text-xs font-bold">
                {activeCount}
              </span>
            )}
          </div>
          {activeCount > 0 && (
            <button onClick={clearAll} className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1">
              <X className="w-3 h-3" />
              Clear
            </button>
          )}
        </div>

        {/* Search */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search findings..."
            value={filters.search}
            onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
            className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
        </div>

        <FilterSection
          title="Severity"
          options={severityOptions}
          selected={filters.severity}
          onToggle={(v) => toggle('severity', v)}
        />
        <FilterSection
          title="Secret Type"
          options={typeOptions}
          selected={filters.secretType}
          onToggle={(v) => toggle('secretType', v)}
        />
        <FilterSection
          title="Repository"
          options={repoOptions}
          selected={filters.repo}
          onToggle={(v) => toggle('repo', v)}
          defaultOpen={false}
        />
      </div>
    </div>
  );
}
