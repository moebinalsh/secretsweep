import { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, ChevronsUpDown, ExternalLink, ChevronLeft, ChevronRight, CheckCircle, AlertCircle } from 'lucide-react';
import ExportButton from './ExportButton';
import SecretDetail from './SecretDetail';
import { formatDate, sortBySeverity } from '../lib/utils';

function StatusBadge({ status }) {
  if (status === 'resolved') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"><CheckCircle className="w-3 h-3" />Remediated</span>;
  if (status === 'false_positive') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-500">False Positive</span>;
  if (status === 'acknowledged') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">Acknowledged</span>;
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"><AlertCircle className="w-3 h-3" />Open</span>;
}

const PAGE_SIZE = 20;

function SeverityBadge({ severity }) {
  const cls = {
    critical: 'badge-critical',
    high: 'badge-high',
    medium: 'badge-medium',
    low: 'badge-low',
  };
  return <span className={cls[severity] || cls.low}>{severity}</span>;
}

export default function ResultsTable({ findings, totalFindings, scanInfo, orgName, repos }) {
  const [expandedId, setExpandedId] = useState(null);
  const [sortField, setSortField] = useState('severity');
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(0);

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
    setPage(0);
  };

  const sorted = useMemo(() => {
    const arr = [...findings];
    const dir = sortDir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      switch (sortField) {
        case 'severity':
          return sortBySeverity(a, b) * dir;
        case 'status':
          return (a.status || 'open').localeCompare(b.status || 'open') * dir;
        case 'repo':
          return a.repo.localeCompare(b.repo) * dir;
        case 'file':
          return a.file.localeCompare(b.file) * dir;
        case 'type':
          return (a.secretType || '').localeCompare(b.secretType || '') * dir;
        case 'author':
          return ((a.commit_author || a.commit?.author || '').localeCompare(b.commit_author || b.commit?.author || '')) * dir;
        case 'committed':
          return ((a.commit_date || a.commit?.date || '') > (b.commit_date || b.commit?.date || '') ? 1 : -1) * dir;
        case 'created':
          return ((a.created_at || '') > (b.created_at || '') ? 1 : -1) * dir;
        case 'remediated':
          return ((a.resolved_at || '') > (b.resolved_at || '') ? 1 : -1) * dir;
        default:
          return 0;
      }
    });
    return arr;
  }, [findings, sortField, sortDir]);

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paginated = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function SortIcon({ field }) {
    if (sortField !== field) return <ChevronsUpDown className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600" />;
    return sortDir === 'asc'
      ? <ChevronUp className="w-3.5 h-3.5 text-brand-500" />
      : <ChevronDown className="w-3.5 h-3.5 text-brand-500" />;
  }

  return (
    <div className="glass-card glow-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
            Findings
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {findings.length} results{findings.length !== totalFindings ? ` (of ${totalFindings} total)` : ''}
          </p>
        </div>
        <ExportButton findings={findings} scanInfo={scanInfo} orgName={orgName} repos={repos} />
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800/50">
              {[
                { key: 'severity', label: 'Severity', width: 'w-24' },
                { key: 'status', label: 'Status', width: 'w-28' },
                { key: 'type', label: 'Type', width: 'w-36' },
                { key: 'repo', label: 'Repository', width: '' },
                { key: 'file', label: 'File', width: '' },
                { key: 'author', label: 'Author', width: 'w-32' },
                { key: 'committed', label: 'Committed', width: 'w-24' },
                { key: 'created', label: 'Found', width: 'w-24' },
                { key: 'remediated', label: 'Remediated', width: 'w-24' },
              ].map(({ key, label, width }) => (
                <th
                  key={key}
                  className={`px-4 py-3 text-left font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-xs cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 select-none ${width}`}
                  onClick={() => toggleSort(key)}
                >
                  <div className="flex items-center gap-1">
                    {label}
                    <SortIcon field={key} />
                  </div>
                </th>
              ))}
              <th className="px-4 py-3 w-12" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {paginated.map((f) => (
              <Fragment key={f.id} finding={f} expanded={expandedId === f.id} onToggle={() => setExpandedId(expandedId === f.id ? null : f.id)} />
            ))}
            {paginated.length === 0 && (
              <tr>
                <td colSpan={10} className="px-6 py-12 text-center text-gray-400">
                  No findings match your filters
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100 dark:border-gray-800">
          <p className="text-sm text-gray-500">
            Showing {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, sorted.length)} of {sorted.length}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let pageNum;
              if (totalPages <= 7) {
                pageNum = i;
              } else if (page < 3) {
                pageNum = i;
              } else if (page > totalPages - 4) {
                pageNum = totalPages - 7 + i;
              } else {
                pageNum = page - 3 + i;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                    page === pageNum
                      ? 'bg-brand-600 text-white'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {pageNum + 1}
                </button>
              );
            })}
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Fragment({ finding, expanded, onToggle }) {
  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
      >
        <td className="px-4 py-3">
          <SeverityBadge severity={finding.severity} />
        </td>
        <td className="px-4 py-3">
          <StatusBadge status={finding.status} />
        </td>
        <td className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300 truncate max-w-[200px]">
          {finding.secretType}
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1.5">
            <span className="text-gray-800 dark:text-gray-200 font-medium truncate max-w-[200px]">
              {finding.repo.includes('/') ? finding.repo.split('/')[1] : finding.repo}
            </span>
          </div>
        </td>
        <td className="px-4 py-3">
          <span className="text-gray-600 dark:text-gray-400 truncate max-w-[250px] block font-mono text-xs">
            {finding.file}
            {finding.line && <span className="text-brand-500">:{finding.line}</span>}
          </span>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1.5">
            {(finding.commit_author_avatar || finding.commit?.authorAvatar) && (
              <img src={finding.commit_author_avatar || finding.commit?.authorAvatar} alt="" className="w-4 h-4 rounded-full" />
            )}
            <span className="text-gray-600 dark:text-gray-400 text-xs truncate max-w-[100px]">
              {finding.commit_author_login || finding.commit_author || finding.commit?.author || '—'}
            </span>
          </div>
        </td>
        <td className="px-4 py-3 text-xs text-gray-400">
          {formatDate(finding.commit_date || finding.commit?.date)}
        </td>
        <td className="px-4 py-3 text-xs text-gray-400">
          {formatDate(finding.created_at)}
        </td>
        <td className="px-4 py-3 text-xs">
          {finding.resolved_at ? (
            <span className="text-emerald-600 dark:text-emerald-400">{formatDate(finding.resolved_at)}</span>
          ) : (
            <span className="text-gray-300 dark:text-gray-600">—</span>
          )}
        </td>
        <td className="px-4 py-3">
          <a
            href={finding.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-gray-400 hover:text-brand-500 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={10} className="px-4 py-3">
            <SecretDetail finding={finding} />
          </td>
        </tr>
      )}
    </>
  );
}
