import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShieldAlert, ShieldCheck, Clock, GitBranch, ArrowRight, AlertTriangle, Loader2, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../lib/utils';
import { SeverityBreakdownChart, FindingsByRepoChart, StatusDistributionChart, ScanActivityChart } from '../components/Charts';

function StatCard({ icon: Icon, label, value, color, textColor, onClick }) {
  return (
    <div onClick={onClick}
      className={`stat-card glow-card ${onClick ? 'cursor-pointer hover:scale-[1.02] active:scale-[0.98]' : ''}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</p>
          <p className={`text-3xl font-bold mt-1 ${textColor || 'text-gray-900 dark:text-white'}`}>{value}</p>
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { authFetch, org } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authFetch('/api/findings/stats')
      .then((res) => res.json())
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [authFetch]);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-brand-500" /></div>;
  }

  const bySev = {};
  (stats?.bySeverity || []).forEach((r) => { bySev[r.severity] = parseInt(r.count); });
  const total = Object.values(bySev).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-500 to-blue-500 bg-clip-text text-transparent">{org?.name || 'Dashboard'}</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">Security overview across all scans</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard icon={ShieldAlert} label="Open Findings" value={total}
          color="bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400"
          onClick={() => navigate('/findings?status=open')} />
        <StatCard icon={AlertTriangle} label="Critical" value={bySev.critical || 0}
          color="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
          textColor="text-red-600 dark:text-red-400"
          onClick={() => navigate('/findings?severity=critical')} />
        <StatCard icon={CheckCircle} label="Remediated" value={stats?.totals?.remediated_findings || 0}
          color="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
          textColor="text-emerald-600 dark:text-emerald-400"
          onClick={() => navigate('/findings?status=resolved')} />
        <StatCard icon={ShieldCheck} label="Total Scans" value={stats?.totals?.total_scans || 0}
          color="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
          onClick={() => navigate('/scans')} />
        <StatCard icon={GitBranch} label="Repos Scanned" value={stats?.scanTotals?.total_repos_scanned || 0}
          color="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400" />
      </div>

      {/* Charts */}
      {total > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SeverityBreakdownChart bySeverity={bySev} />
          <StatusDistributionChart byStatus={stats?.byStatus} />
          <FindingsByRepoChart byRepo={stats?.byRepo} />
          <ScanActivityChart recentScans={stats?.recentScans} />
        </div>
      )}

      {/* Recent Scans */}
      <div className="glass-card glow-card overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Recent Scans</h2>
          <Link to="/scans" className="text-sm text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1">
            View all <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {(!stats?.recentScans || stats.recentScans.length === 0) ? (
          <div className="px-6 py-12 text-center">
            <p className="text-gray-400 dark:text-gray-500 mb-4">No scans yet</p>
            <Link to="/scans/new" className="btn-primary btn-glow inline-flex items-center gap-2">Run Your First Scan</Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {stats.recentScans.map((scan) => (
              <Link key={scan.id} to={`/scans/${scan.id}`}
                className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                <div className="flex items-center gap-3">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{scan.github_org?.replace('__user__:', '')}</p>
                    <p className="text-xs text-gray-400">{formatDate(scan.started_at)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                    scan.status === 'completed' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' :
                    scan.status === 'running' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' :
                    'bg-gray-100 dark:bg-gray-800 text-gray-500'
                  }`}>{scan.status}</span>
                  <span className="text-sm font-mono text-gray-600 dark:text-gray-400">{scan.total_findings || 0} findings</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {stats?.byRepo && stats.byRepo.length > 0 && (
        <div className="glass-card glow-card p-6">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">Top Affected Repositories</h2>
          <div className="space-y-3">
            {stats.byRepo.slice(0, 5).map((r) => (
              <div key={r.repo} className="flex items-center justify-between">
                <span className="text-sm text-gray-700 dark:text-gray-300 truncate flex-1">{r.repo}</span>
                <span className="text-sm font-mono font-bold text-gray-900 dark:text-white ml-4">{r.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
