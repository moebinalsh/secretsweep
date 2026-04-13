import { useState, useEffect } from 'react';
import { Loader2, Download, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../lib/utils';

const ACTION_COLORS = {
  'user.login': 'text-blue-600 bg-blue-50 dark:bg-blue-900/20',
  'user.registered': 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20',
  'user.invited': 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20',
  'user.role_changed': 'text-amber-600 bg-amber-50 dark:bg-amber-900/20',
  'user.deactivated': 'text-red-600 bg-red-50 dark:bg-red-900/20',
  'user.password_reset': 'text-orange-600 bg-orange-50 dark:bg-orange-900/20',
  'user.created_by_admin': 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20',
  'user.deleted_by_admin': 'text-red-600 bg-red-50 dark:bg-red-900/20',
  'scan.started': 'text-cyan-600 bg-cyan-50 dark:bg-cyan-900/20',
  'scan.completed': 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20',
  'github.connected': 'text-gray-600 bg-gray-50 dark:bg-gray-800',
  'github.disconnected': 'text-gray-600 bg-gray-50 dark:bg-gray-800',
  'gitlab.connected': 'text-orange-600 bg-orange-50 dark:bg-orange-900/20',
  'gitlab.disconnected': 'text-orange-600 bg-orange-50 dark:bg-orange-900/20',
  'finding.status_changed': 'text-purple-600 bg-purple-50 dark:bg-purple-900/20',
  'findings.validation': 'text-teal-600 bg-teal-50 dark:bg-teal-900/20',
  'integration.created': 'text-pink-600 bg-pink-50 dark:bg-pink-900/20',
  'integration.updated': 'text-pink-600 bg-pink-50 dark:bg-pink-900/20',
  'integration.deleted': 'text-red-600 bg-red-50 dark:bg-red-900/20',
  'schedule.created': 'text-cyan-600 bg-cyan-50 dark:bg-cyan-900/20',
  'org.created': 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20',
  'org.deleted': 'text-red-600 bg-red-50 dark:bg-red-900/20',
  'org.enabled': 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20',
  'org.disabled': 'text-red-600 bg-red-50 dark:bg-red-900/20',
};

function describeAction(action, meta) {
  const m = meta || {};
  switch (action) {
    case 'user.login': return 'Logged in';
    case 'user.registered': return m.via === 'invite' ? 'Joined via invite' : 'Registered new account';
    case 'user.invited': return `Invited ${m.email || 'user'} as ${m.role || 'member'}`;
    case 'user.role_changed': return `Changed ${m.targetName || m.targetEmail || 'user'} role from ${m.previousRole || '?'} to ${m.newRole || 'unknown'}`;
    case 'user.deactivated': return `Deactivated ${m.deactivatedName || m.deactivatedEmail || 'user'}${m.deactivatedRole ? ' (' + m.deactivatedRole + ')' : ''}`;
    case 'user.password_reset': return 'Password was reset by admin';
    case 'user.created_by_admin': return `Added ${m.name || m.email || 'user'} (${m.role || 'member'}) to ${m.orgName || 'organization'}`;
    case 'user.deleted_by_admin': return `Deleted ${m.deletedName || m.deletedEmail || 'user'} (${m.deletedRole || ''}) from ${m.orgName || 'organization'}`;
    case 'scan.started': return `Started ${m.scanMode || 'full'} scan on ${m.githubOrg || 'unknown'}`;
    case 'scan.completed': return `Scan completed: ${m.totalFindings || 0} findings in ${m.totalRepos || 0} repos`;
    case 'github.connected': return `Connected GitHub as @${m.username || 'unknown'}`;
    case 'github.disconnected': return 'Disconnected GitHub';
    case 'gitlab.connected': return `Connected GitLab as @${m.username || 'unknown'} (${m.baseUrl || 'gitlab.com'})`;
    case 'gitlab.disconnected': return 'Disconnected GitLab';
    case 'finding.status_changed': return `Finding marked as ${m.status || 'unknown'}`;
    case 'findings.validation': return `Validated ${m.total || 0} findings: ${m.remediated || 0} remediated, ${m.stillPresent || 0} still present`;
    case 'integration.created': return `Created ${m.type || 'Slack'} integration: ${m.name || ''}`;
    case 'integration.updated': return `Updated integration${m.name ? ': ' + m.name : ''}`;
    case 'integration.deleted': return 'Deleted integration';
    case 'schedule.created': return `Scheduled ${m.frequency || ''} scan for ${m.githubOrg || 'unknown'}`;
    case 'org.created': return `Created organization "${m.orgName || ''}" with admin ${m.adminEmail || ''}`;
    case 'org.deleted': return 'Deleted organization and all data';
    case 'org.enabled': return 'Re-enabled organization';
    case 'org.disabled': return 'Disabled organization';
    default: return Object.entries(m).map(([k, v]) => `${k}: ${v}`).join(', ') || '—';
  }
}

export default function AuditLogPage() {
  const { authFetch } = useAuth();
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const limit = 30;

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page, limit });
    if (search) params.set('search', search);
    authFetch(`/api/audit-logs?${params}`)
      .then(r => r.json())
      .then(data => { setLogs(data.logs || []); setTotal(data.total || 0); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [authFetch, page, search]);

  const handleExport = () => {
    authFetch('/api/audit-logs/export')
      .then(r => r.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url;
        a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click(); URL.revokeObjectURL(url);
      });
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Activity Log</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Audit trail of all actions in your organization</p>
        </div>
        <button onClick={handleExport} className="btn-secondary flex items-center gap-2 text-sm">
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search actions, users, IPs..."
          className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl pl-11 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
      </div>

      {/* Log Table */}
      <div className="glass-card glow-card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-brand-500" /></div>
        ) : logs.length === 0 ? (
          <div className="text-center py-16 text-gray-400">No audit logs found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Timestamp</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">User</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Action</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Details</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {logs.map(log => {
                  const colorCls = ACTION_COLORS[log.action] || 'text-gray-600 bg-gray-50 dark:bg-gray-800';
                  const description = describeAction(log.action, log.metadata);
                  return (
                    <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{new Date(log.created_at).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <p className="text-xs font-medium text-gray-800 dark:text-gray-200">{log.user_name || '—'}</p>
                        <p className="text-[10px] text-gray-400">{log.user_email || ''}</p>
                        {log.org_name && <p className="text-[10px] text-brand-500">{log.org_name}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${colorCls}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700 dark:text-gray-300 max-w-[400px]" title={description}>
                        {description}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400 font-mono">{log.ip_address || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination — always show */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100 dark:border-gray-800">
          <p className="text-sm text-gray-500">
            {total > 0 ? `Showing ${(page - 1) * limit + 1}–${Math.min(page * limit, total)} of ${total}` : `${total} entries`}
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30">
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                let n;
                if (totalPages <= 7) n = i + 1;
                else if (page <= 4) n = i + 1;
                else if (page > totalPages - 4) n = totalPages - 6 + i;
                else n = page - 3 + i;
                return (
                  <button key={n} onClick={() => setPage(n)}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                      page === n ? 'bg-brand-600 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'
                    }`}>{n}</button>
                );
              })}
              <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
