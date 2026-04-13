import { ShieldAlert, ShieldCheck, GitBranch, AlertTriangle, AlertOctagon, Info, CheckCircle } from 'lucide-react';
import { SeverityPieChart, SecretTypeBarChart, RepoBarChart } from './Charts';
import { groupBy } from '../lib/utils';

function StatCard({ icon: Icon, label, value, color, subtext, onClick, active }) {
  return (
    <div
      onClick={onClick}
      className={`stat-card glow-card transition-all ${onClick ? 'cursor-pointer hover:scale-[1.02]' : ''} ${active ? 'ring-2 ring-brand-500 ring-offset-2 dark:ring-offset-gray-900' : ''}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</p>
          <p className="text-3xl font-bold mt-1 text-gray-900 dark:text-white">{value}</p>
          {subtext && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{subtext}</p>
          )}
        </div>
        <div className={`flex items-center justify-center w-12 h-12 rounded-xl ${color}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}

export default function Dashboard({ findings, allFindings, repos, scanSummary, activeFilter, onFilterChange }) {
  const openFindings = allFindings.filter(f => {
    const s = f.status || 'open';
    return s === 'open' || s === 'acknowledged';
  });
  const resolvedFindings = allFindings.filter(f => f.status === 'resolved' || f.status === 'false_positive');

  const bySeverity = groupBy(openFindings, (f) => f.severity);
  const criticalCount = bySeverity.critical?.length || 0;
  const highCount = bySeverity.high?.length || 0;
  const mediumCount = bySeverity.medium?.length || 0;
  const lowCount = bySeverity.low?.length || 0;
  const uniqueRepos = new Set(openFindings.map((f) => f.repo)).size;
  const totalScannedRepos = repos.length || scanSummary?.totalRepos || 0;

  const handleFilter = (filter) => {
    if (!onFilterChange) return;
    onFilterChange(activeFilter === filter ? null : filter);
  };

  return (
    <div className="animate-fade-in">
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
        <StatCard
          icon={ShieldAlert}
          label="Open Findings"
          value={openFindings.length}
          color="bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400"
          subtext={`${allFindings.length} total`}
          onClick={() => handleFilter('open')}
          active={activeFilter === 'open'}
        />
        <StatCard
          icon={AlertOctagon}
          label="Critical"
          value={criticalCount}
          color="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
          onClick={() => handleFilter('critical')}
          active={activeFilter === 'critical'}
        />
        <StatCard
          icon={AlertTriangle}
          label="High"
          value={highCount}
          color="bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400"
          onClick={() => handleFilter('high')}
          active={activeFilter === 'high'}
        />
        <StatCard
          icon={Info}
          label="Medium / Low"
          value={mediumCount + lowCount}
          color="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400"
          onClick={() => handleFilter('medlow')}
          active={activeFilter === 'medlow'}
        />
        <StatCard
          icon={CheckCircle}
          label="Remediated"
          value={resolvedFindings.length}
          color="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
          onClick={() => handleFilter('remediated')}
          active={activeFilter === 'remediated'}
        />
        <StatCard
          icon={GitBranch}
          label="Repos Scanned"
          value={totalScannedRepos}
          color="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
          subtext={uniqueRepos > 0 ? `${uniqueRepos} with findings` : undefined}
        />
      </div>

      {openFindings.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SeverityPieChart findings={openFindings} />
          <SecretTypeBarChart findings={openFindings} />
          <RepoBarChart findings={openFindings} />
        </div>
      )}

      {allFindings.length === 0 && (
        <div className="glass-card p-12 text-center">
          <ShieldCheck className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">No Secrets Found</h3>
          <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">The scan didn't find any exposed secrets.</p>
        </div>
      )}

      {allFindings.length > 0 && openFindings.length === 0 && (
        <div className="glass-card p-12 text-center">
          <ShieldCheck className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">All Findings Remediated</h3>
          <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">All {resolvedFindings.length} finding(s) resolved.</p>
        </div>
      )}
    </div>
  );
}
