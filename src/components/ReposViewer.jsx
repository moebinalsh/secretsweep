import { useState, useMemo } from 'react';
import { GitBranch, Lock, Unlock, ExternalLink, Search, ChevronDown, ChevronUp, Star, Eye } from 'lucide-react';

export default function ReposViewer({ repos, findings }) {
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [showPrivateOnly, setShowPrivateOnly] = useState(false);

  // Count findings per repo
  const findingsMap = useMemo(() => {
    const map = {};
    for (const f of findings) {
      map[f.repo] = (map[f.repo] || 0) + 1;
    }
    return map;
  }, [findings]);

  const filtered = useMemo(() => {
    let list = [...repos];
    if (search) {
      const s = search.toLowerCase();
      list = list.filter((r) => (r.full_name || r.name).toLowerCase().includes(s));
    }
    if (showPrivateOnly) {
      list = list.filter((r) => r.private);
    }
    const dir = sortDir === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      switch (sortField) {
        case 'name':
          return a.name.localeCompare(b.name) * dir;
        case 'findings': {
          const fa = findingsMap[a.full_name] || 0;
          const fb = findingsMap[b.full_name] || 0;
          return (fa - fb) * dir;
        }
        case 'visibility':
          return ((a.private ? 1 : 0) - (b.private ? 1 : 0)) * dir;
        default:
          return 0;
      }
    });
    return list;
  }, [repos, search, sortField, sortDir, showPrivateOnly, findingsMap]);

  const toggleSort = (field) => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('asc'); }
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <ChevronDown className="w-3 h-3 text-gray-300 dark:text-gray-600" />;
    return sortDir === 'asc' ? <ChevronUp className="w-3 h-3 text-brand-500" /> : <ChevronDown className="w-3 h-3 text-brand-500" />;
  };

  return (
    <div className="glass-card overflow-hidden animate-fade-in">
      <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
              Repositories
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {filtered.length} of {repos.length} repos
              {findings.length > 0 && ` | ${Object.keys(findingsMap).length} with findings`}
            </p>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search repos..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full sm:w-56 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <button
              onClick={() => setShowPrivateOnly(!showPrivateOnly)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                showPrivateOnly
                  ? 'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              <Lock className="w-3 h-3" />
              Private
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800/50">
              <th
                className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 select-none"
                onClick={() => toggleSort('name')}
              >
                <div className="flex items-center gap-1">Repository <SortIcon field="name" /></div>
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 select-none w-28"
                onClick={() => toggleSort('visibility')}
              >
                <div className="flex items-center gap-1">Visibility <SortIcon field="visibility" /></div>
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 select-none w-28"
                onClick={() => toggleSort('findings')}
              >
                <div className="flex items-center gap-1">Findings <SortIcon field="findings" /></div>
              </th>
              <th className="px-4 py-3 w-12" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {filtered.map((repo) => {
              const count = findingsMap[repo.full_name] || 0;
              return (
                <tr key={repo.full_name || repo.name} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <GitBranch className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <div>
                        <span className="font-medium text-gray-800 dark:text-gray-200">{repo.name}</span>
                        <span className="text-gray-400 text-xs ml-2">{repo.full_name}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {repo.private ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full">
                        <Lock className="w-3 h-3" />
                        Private
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full">
                        <Unlock className="w-3 h-3" />
                        Public
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {count > 0 ? (
                      <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-bold">
                        {count}
                      </span>
                    ) : (
                      <span className="text-gray-300 dark:text-gray-600 text-xs">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <a
                      href={repo.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-brand-500 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-gray-400">
                  No repositories match your search
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
