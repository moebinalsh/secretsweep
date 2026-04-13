import { Loader2, AlertTriangle, Search, Zap } from 'lucide-react';

export default function ScanProgress({ progress, log, findingsCount }) {
  const percentage = progress
    ? Math.round((progress.patternIndex / progress.totalPatterns) * 100)
    : 0;

  const phase = progress?.phase || 'search';
  const phaseLabel = phase === 'search' ? 'Code Search' : phase === 'content' ? 'Deep Scan' : 'Enriching';

  return (
    <div className="glass-card glow-card scan-active-glow p-6 mb-6 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="scan-active">
            <Loader2 className="w-5 h-5 text-brand-600 animate-spin" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-800 dark:text-gray-200">
              Scanning in Progress
              <span className="ml-2 text-xs font-normal text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
                {phaseLabel}
              </span>
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {progress?.message || 'Initializing...'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm">
          {/* Live findings counter - prominent */}
          <div className={`flex items-center gap-1.5 font-bold px-3 py-1.5 rounded-lg transition-all ${
            findingsCount > 0
              ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
          }`}>
            <Zap className="w-4 h-4" />
            <span className="tabular-nums">{findingsCount}</span>
            <span className="font-normal text-xs">found</span>
          </div>
          <span className="font-mono font-bold text-gray-700 dark:text-gray-300 tabular-nums">{percentage}%</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mb-4 scan-bar-sweep">
        <div
          className="bg-gradient-to-r from-brand-500 to-brand-600 h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Log */}
      <div className="max-h-40 overflow-y-auto bg-gray-900 dark:bg-gray-950 rounded-xl p-4 font-mono text-xs">
        {log.slice(-20).map((entry, i) => (
          <div
            key={i}
            className={`flex items-start gap-2 py-0.5 ${
              entry.type === 'error'
                ? 'text-red-400'
                : entry.type === 'rate_limit'
                ? 'text-yellow-400'
                : 'text-green-400'
            }`}
          >
            <span className="text-gray-600 flex-shrink-0">
              {entry.time?.toLocaleTimeString?.() || ''}
            </span>
            {entry.type === 'error' && <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />}
            <span className="text-gray-300">{entry.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
