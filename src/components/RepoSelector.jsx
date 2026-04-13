import { useState, useMemo } from 'react';
import { Search, Lock, Unlock, CheckSquare, Square, Loader2 } from 'lucide-react';

export default function RepoSelector({ repos, selectedRepos, onChange, loading }) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return repos;
    const q = search.toLowerCase();
    return repos.filter((r) => r.name.toLowerCase().includes(q));
  }, [repos, search]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((r) => selectedRepos.includes(r.name));

  const handleToggle = (name) => {
    onChange(
      selectedRepos.includes(name)
        ? selectedRepos.filter((n) => n !== name)
        : [...selectedRepos, name]
    );
  };

  const handleSelectAll = () => {
    if (allFilteredSelected) {
      // Deselect all filtered
      const filterSet = new Set(filtered.map((r) => r.name));
      onChange(selectedRepos.filter((n) => !filterSet.has(n)));
    } else {
      // Select all filtered
      const existing = new Set(selectedRepos);
      const merged = [...selectedRepos];
      for (const r of filtered) {
        if (!existing.has(r.name)) merged.push(r.name);
      }
      onChange(merged);
    }
  };

  const handleClearAll = () => {
    onChange([]);
    setSearch('');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Loading repositories...
      </div>
    );
  }

  return (
    <div className="mt-4 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search repos..."
            className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent placeholder:text-gray-400 dark:placeholder:text-gray-600"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSelectAll}
            className="text-xs font-medium text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 whitespace-nowrap"
          >
            {allFilteredSelected ? 'Deselect All' : 'Select All'}
          </button>
          {selectedRepos.length > 0 && (
            <button
              onClick={handleClearAll}
              className="text-xs font-medium text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 whitespace-nowrap"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Selected count */}
      <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800/50 text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800">
        {selectedRepos.length} of {repos.length} repos selected
      </div>

      {/* Repo list */}
      <div className="max-h-72 overflow-y-auto divide-y divide-gray-50 dark:divide-gray-800/50">
        {filtered.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-gray-400">
            No repos match "{search}"
          </div>
        ) : (
          filtered.map((repo) => {
            const isSelected = selectedRepos.includes(repo.name);
            return (
              <label
                key={repo.name}
                className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50 ${
                  isSelected ? 'bg-brand-50/50 dark:bg-brand-900/10' : ''
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => handleToggle(repo.name)}
                  className="sr-only"
                />
                <div className={`flex items-center justify-center w-5 h-5 rounded border-2 transition-colors ${
                  isSelected
                    ? 'bg-brand-600 border-brand-600 text-white'
                    : 'border-gray-300 dark:border-gray-600'
                }`}>
                  {isSelected && (
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                  {repo.name}
                </span>
                {repo.private ? (
                  <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full">
                    <Lock className="w-3 h-3" />
                    Private
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full">
                    <Unlock className="w-3 h-3" />
                    Public
                  </span>
                )}
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}
