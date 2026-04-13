import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, Search, Filter, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../lib/utils';

const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
const statusColors = {
  open: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  acknowledged: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
  resolved: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
  false_positive: 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400',
};

export default function FindingsPage() {
  const { authFetch } = useAuth();
  const [findings, setFindings] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const limit = 50;

  const loadFindings = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page, limit });
    if (search) params.set('search', search);
    if (severityFilter) params.set('severity', severityFilter);
    if (statusFilter) params.set('status', statusFilter);

    try {
      const res = await authFetch(`/api/findings?${params}`);
      const data = await res.json();
      setFindings(data.findings || []);
      setTotal(data.total || 0);
    } catch {} finally {
      setLoading(false);
    }
  }, [authFetch, page, search, severityFilter, statusFilter]);

  useEffect(() => { loadFindings(); }, [loadFindings]);

  const updateStatus = async (findingId, newStatus) => {
    try {
      await authFetch(`/api/findings/${findingId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      setFindings((prev) => prev.map((f) => f.id === findingId ? { ...f, status: newStatus } : f));
    } catch {}
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">All Findings</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{total} findings across all scans</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search repos, files, types..."
            className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
        <select value={severityFilter} onChange={(e) => { setSeverityFilter(e.target.value); setPage(1); }}
          className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
          <option value="">All Severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
          <option value="">All Statuses</option>
          <option value="open">Open</option>
          <option value="acknowledged">Acknowledged</option>
          <option value="resolved">Resolved</option>
          <option value="false_positive">False Positive</option>
        </select>
      </div>

      {/* Table */}
      <div className="glass-card glow-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-brand-500" /></div>
        ) : findings.length === 0 ? (
          <div className="text-center py-16 text-gray-400">No findings match your filters</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Severity</th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Repository</th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">File</th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Triage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                  {findings.map((f) => (
                    <React.Fragment key={f.id}>
                      <tr onClick={() => setExpandedId(expandedId === f.id ? null : f.id)}
                        className="hover:bg-gray-50 dark:hover:bg-gray-800/30 cursor-pointer">
                        <td className="px-6 py-3">
                          <span className={`badge-${f.severity}`}>{f.severity}</span>
                        </td>
                        <td className="px-6 py-3 text-sm text-gray-700 dark:text-gray-300">{f.secret_type}</td>
                        <td className="px-6 py-3 text-sm text-gray-600 dark:text-gray-400 truncate max-w-[200px]">{f.repo}</td>
                        <td className="px-6 py-3 text-sm text-gray-500 font-mono truncate max-w-[200px]">
                          {f.file}{f.line ? `:${f.line}` : ''}
                        </td>
                        <td className="px-6 py-3">
                          <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusColors[f.status]}`}>{f.status.replace('_', ' ')}</span>
                        </td>
                        <td className="px-6 py-3">
                          <select value={f.status} onChange={(e) => { e.stopPropagation(); updateStatus(f.id, e.target.value); }}
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs bg-transparent border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-500">
                            <option value="open">Open</option>
                            <option value="acknowledged">Acknowledged</option>
                            <option value="resolved">Resolved</option>
                            <option value="false_positive">False Positive</option>
                          </select>
                        </td>
                      </tr>
                      {expandedId === f.id && (
                        <tr>
                          <td colSpan={6} className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                              <div>
                                <p className="text-gray-400 font-semibold uppercase text-[10px] mb-1">Description</p>
                                <p className="text-gray-700 dark:text-gray-300">{f.description || '—'}</p>
                              </div>
                              <div>
                                <p className="text-gray-400 font-semibold uppercase text-[10px] mb-1">Author</p>
                                <p className="text-gray-700 dark:text-gray-300">{f.commit_author || f.commit_author_login || '—'}</p>
                              </div>
                              <div>
                                <p className="text-gray-400 font-semibold uppercase text-[10px] mb-1">Commit Date</p>
                                <p className="text-gray-700 dark:text-gray-300">{formatDate(f.commit_date) || '—'}</p>
                              </div>
                              <div>
                                <p className="text-gray-400 font-semibold uppercase text-[10px] mb-1">Found</p>
                                <p className="text-gray-700 dark:text-gray-300">{formatDate(f.created_at) || '—'}</p>
                              </div>
                              {f.resolved_at && (
                                <div>
                                  <p className="text-gray-400 font-semibold uppercase text-[10px] mb-1">Remediated</p>
                                  <p className="text-emerald-600">{formatDate(f.resolved_at)}</p>
                                </div>
                              )}
                              {f.commit_sha && (
                                <div>
                                  <p className="text-gray-400 font-semibold uppercase text-[10px] mb-1">Commit</p>
                                  <p className="text-gray-500 font-mono">{f.commit_sha?.slice(0, 8)}</p>
                                </div>
                              )}
                              {f.matching_lines?.[0] && (
                                <div className="col-span-2">
                                  <p className="text-gray-400 font-semibold uppercase text-[10px] mb-1">Matching Code (Masked)</p>
                                  <code className="text-xs bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded block text-gray-600 dark:text-gray-400 truncate">{f.matching_lines[0]}</code>
                                </div>
                              )}
                              {f.file_url && (
                                <div>
                                  <a href={f.file_url} target="_blank" rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-brand-600 dark:text-brand-400 hover:underline text-xs">
                                    <ExternalLink className="w-3 h-3" /> View on GitHub
                                  </a>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 px-6 py-4 border-t border-gray-100 dark:border-gray-800">
                <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}
                  className="btn-secondary text-sm px-3 py-1.5 disabled:opacity-50">Previous</button>
                <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
                <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}
                  className="btn-secondary text-sm px-3 py-1.5 disabled:opacity-50">Next</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
