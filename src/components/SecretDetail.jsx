import { ExternalLink, GitCommit, User, Calendar, FileCode } from 'lucide-react';
import { maskSecret, formatDate } from '../lib/utils';

export default function SecretDetail({ finding }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-5 animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Code snippet */}
        <div>
          <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <FileCode className="w-3.5 h-3.5" />
            Code Match (Masked)
          </h4>
          <div className="bg-gray-900 dark:bg-gray-950 rounded-lg p-4 overflow-x-auto">
            {finding.matchingLines.map((line, i) => (
              <pre key={i} className="text-sm font-mono text-gray-300 whitespace-pre-wrap break-all">
                <span className="text-gray-600 select-none mr-3">
                  {finding.line ? finding.line + i : i + 1}
                </span>
                <span className="text-amber-300">{maskSecret(line)}</span>
              </pre>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2 italic">{finding.description}</p>
        </div>

        {/* Commit info */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <GitCommit className="w-3.5 h-3.5" />
            Commit Info
          </h4>

          {finding.commit ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                {finding.commit.authorAvatar && (
                  <img
                    src={finding.commit.authorAvatar}
                    alt={finding.commit.author}
                    className="w-10 h-10 rounded-full ring-2 ring-gray-200 dark:ring-gray-700"
                  />
                )}
                <div>
                  <div className="flex items-center gap-1.5 text-sm font-medium text-gray-800 dark:text-gray-200">
                    <User className="w-3.5 h-3.5 text-gray-400" />
                    {finding.commit.author}
                    {finding.commit.authorLogin && (
                      <span className="text-gray-400 font-normal">@{finding.commit.authorLogin}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <Calendar className="w-3 h-3" />
                    {formatDate(finding.commit.date)}
                  </div>
                </div>
              </div>

              <div className="text-sm text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-100 dark:border-gray-700">
                <span className="font-mono text-xs text-gray-400">{finding.commit.sha?.slice(0, 7)}</span>
                <span className="mx-2 text-gray-300">|</span>
                {finding.commit.message}
              </div>

              <a
                href={finding.commit.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 font-medium"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                View Commit on GitHub
              </a>
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic">Commit information not available</p>
          )}

          {/* Direct link to file */}
          <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
            <a
              href={finding.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 font-medium"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              View File on GitHub
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
