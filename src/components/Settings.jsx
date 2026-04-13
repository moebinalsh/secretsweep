import { useState } from 'react';
import { X, RefreshCw, ExternalLink, Check, Sun, Moon } from 'lucide-react';
import UserAvatar from './UserAvatar';

export default function Settings({ user, darkMode, setDarkMode, onRefetchOrgs, onClose, githubClientId }) {
  const [refreshing, setRefreshing] = useState(false);
  const [refreshed, setRefreshed] = useState(false);

  const handleRefetchOrgs = async () => {
    setRefreshing(true);
    setRefreshed(false);
    try {
      await onRefetchOrgs();
      setRefreshed(true);
      setTimeout(() => setRefreshed(false), 3000);
    } catch (err) {
      console.error('Failed to re-fetch orgs:', err);
    } finally {
      setRefreshing(false);
    }
  };

  const grantAccessUrl = githubClientId
    ? `https://github.com/settings/connections/applications/${githubClientId}`
    : null;

  return (
    <div
      className="fixed inset-0 z-[60] settings-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 dark:bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-md settings-panel bg-white dark:bg-gray-900 shadow-2xl dark:shadow-brand-900/20 border-l border-gray-200/50 dark:border-gray-700/50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Settings</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Account Section */}
          <section>
            <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4">
              Account
            </h3>
            <div className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/50">
              <UserAvatar user={user} size="lg" />
              <div className="min-w-0">
                <p className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                  {user.name || user.login}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                  @{user.login}
                </p>
                {user.email && (
                  <p className="text-sm text-gray-400 dark:text-gray-500 truncate mt-0.5">
                    {user.email}
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* Organizations Section */}
          <section>
            <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4">
              Organizations
            </h3>
            <div className="space-y-3">
              <button
                onClick={handleRefetchOrgs}
                disabled={refreshing}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left group"
              >
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                    Re-fetch Organizations
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    Refresh your list of accessible orgs
                  </p>
                </div>
                {refreshing ? (
                  <RefreshCw className="w-4 h-4 text-brand-500 animate-spin flex-shrink-0" />
                ) : refreshed ? (
                  <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                ) : (
                  <RefreshCw className="w-4 h-4 text-gray-400 group-hover:text-brand-500 transition-colors flex-shrink-0" />
                )}
              </button>

              {grantAccessUrl && (
                <a
                  href={grantAccessUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                      Grant Access to New Orgs
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      Manage organization permissions on GitHub
                    </p>
                  </div>
                  <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-brand-500 transition-colors flex-shrink-0" />
                </a>
              )}
            </div>
          </section>

          {/* Appearance Section */}
          <section>
            <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4">
              Appearance
            </h3>
            <div className="flex gap-3">
              <button
                onClick={() => setDarkMode(false)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 transition-all ${
                  !darkMode
                    ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400'
                    : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <Sun className="w-4 h-4" />
                <span className="text-sm font-medium">Light</span>
              </button>
              <button
                onClick={() => setDarkMode(true)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 transition-all ${
                  darkMode
                    ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400'
                    : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <Moon className="w-4 h-4" />
                <span className="text-sm font-medium">Dark</span>
              </button>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800">
          <p className="text-xs text-gray-400 dark:text-gray-600 text-center">
            SecretSweep v1.0.0
          </p>
        </div>
      </div>
    </div>
  );
}
