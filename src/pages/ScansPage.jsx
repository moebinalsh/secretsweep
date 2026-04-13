import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Clock, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../lib/utils';

const statusColors = {
  running: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  completed: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
  failed: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  cancelled: 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400',
};

export default function ScansPage() {
  const { authFetch } = useAuth();
  const [scans, setScans] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const limit = 20;

  useEffect(() => {
    setLoading(true);
    authFetch(`/api/scans?page=${page}&limit=${limit}`)
      .then((res) => res.json())
      .then((data) => { setScans(data.scans || []); setTotal(data.total || 0); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [authFetch, page]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Scan History</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{total} total scans</p>
        </div>
        <Link to="/scans/new" className="btn-primary btn-glow flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Scan
        </Link>
      </div>

      <div className="glass-card glow-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
          </div>
        ) : scans.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-400 mb-4">No scans yet</p>
            <Link to="/scans/new" className="btn-primary btn-glow inline-flex items-center gap-2">
              <Plus className="w-4 h-4" /> Run Your First Scan
            </Link>
          </div>
        ) : (
          <>
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Target</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Findings</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Started By</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                {scans.map((scan) => (
                  <tr key={scan.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <Link to={`/scans/${scan.id}`} className="text-sm font-medium text-brand-600 dark:text-brand-400 hover:underline">
                        {scan.github_org}
                      </Link>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {scan.scan_mode === 'selective' ? 'Selective' : 'Full org'} &middot; {scan.total_repos || '?'} repos
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusColors[scan.status] || statusColors.cancelled}`}>
                        {scan.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-sm font-mono font-bold ${scan.total_findings > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-400'}`}>
                        {scan.total_findings ?? '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{scan.started_by_name || scan.started_by_email}</td>
                    <td className="px-6 py-4 text-sm text-gray-400">{formatDate(scan.started_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 px-6 py-4 border-t border-gray-100 dark:border-gray-800">
                <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}
                  className="btn-secondary text-sm px-3 py-1.5 disabled:opacity-50">Previous</button>
                <span className="text-sm text-gray-500 dark:text-gray-400">Page {page} of {totalPages}</span>
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
