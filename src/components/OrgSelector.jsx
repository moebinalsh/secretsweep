import { Building2, Play, Square, GitBranch, Search, List, Loader2, User, Globe, Target } from 'lucide-react';
import RepoSelector from './RepoSelector';

export default function OrgSelector({
  orgs, selectedOrg, onSelectOrg, onStartScan, onStopScan,
  scanning, scanComplete, repoCount, activeTab, onTabChange, loadingRepos, user,
  scanMode, onScanModeChange, selectedRepos, onSelectedReposChange, allRepos,
}) {
  const canStartScan = selectedOrg && (scanMode === 'full' || selectedRepos.length > 0);

  const getScanButtonLabel = () => {
    if (scanComplete) return 'Rescan';
    if (scanMode === 'selective' && selectedRepos.length > 0) {
      return `Scan ${selectedRepos.length} Repo${selectedRepos.length > 1 ? 's' : ''}`;
    }
    return 'Start Scan';
  };

  return (
    <div className="glass-card glow-card mb-6 animate-fade-in">
      <div className="p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-brand-100 dark:bg-brand-900/30">
              <Building2 className="w-5 h-5 text-brand-600 dark:text-brand-400" />
            </div>
            <div className="flex-1 min-w-0">
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Organization
              </label>
              <select
                value={selectedOrg || ''}
                onChange={(e) => onSelectOrg(e.target.value || null)}
                disabled={scanning}
                className="w-full sm:w-72 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm font-medium text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent disabled:opacity-50 transition-all"
              >
                <option value="">Select an organization...</option>
                {user && (
                  <option value={`__user__:${user.login}`}>
                    {user.login} (Personal)
                  </option>
                )}
                {orgs.map((org) => (
                  <option key={org.id} value={org.login}>
                    {org.login}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {repoCount > 0 && (
              <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg">
                {loadingRepos ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <GitBranch className="w-4 h-4" />
                )}
                {repoCount} repos
              </div>
            )}

            {scanning ? (
              <button onClick={onStopScan} className="btn-danger flex items-center gap-2">
                <Square className="w-4 h-4" />
                Stop Scan
              </button>
            ) : (
              <button
                onClick={onStartScan}
                disabled={!canStartScan}
                className="btn-primary btn-glow flex items-center gap-2"
              >
                <Play className="w-4 h-4" />
                {getScanButtonLabel()}
              </button>
            )}
          </div>
        </div>

        {/* Scan Mode Toggle */}
        {selectedOrg && !scanning && (
          <div className="mt-4">
            <div className="inline-flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
              <button
                onClick={() => onScanModeChange('full')}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  scanMode === 'full'
                    ? 'bg-white dark:bg-gray-700 text-brand-600 dark:text-brand-400 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <Globe className="w-4 h-4" />
                Full Org Scan
              </button>
              <button
                onClick={() => onScanModeChange('selective')}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  scanMode === 'selective'
                    ? 'bg-white dark:bg-gray-700 text-brand-600 dark:text-brand-400 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <Target className="w-4 h-4" />
                Select Repos
              </button>
            </div>

            {scanMode === 'selective' && (
              <RepoSelector
                repos={allRepos}
                selectedRepos={selectedRepos}
                onChange={onSelectedReposChange}
                loading={loadingRepos}
              />
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      {selectedOrg && (
        <div className="flex border-t border-gray-100 dark:border-gray-800">
          <button
            onClick={() => onTabChange('scan')}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'scan'
                ? 'border-brand-600 text-brand-600 dark:text-brand-400 dark:border-brand-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <Search className="w-4 h-4" />
            Secret Scan
          </button>
          <button
            onClick={() => onTabChange('repos')}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'repos'
                ? 'border-brand-600 text-brand-600 dark:text-brand-400 dark:border-brand-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <List className="w-4 h-4" />
            All Repos
            {repoCount > 0 && (
              <span className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
                {repoCount}
              </span>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
