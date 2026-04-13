import { useState } from 'react';
import { Key, AlertCircle, Eye, EyeOff } from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import Logo from './Logo';

export default function Login({ darkMode, setDarkMode, onPatLogin }) {
  const [showPat, setShowPat] = useState(false);
  const [pat, setPat] = useState('');
  const [patError, setPatError] = useState('');
  const [patLoading, setPatLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handlePatSubmit = async (e) => {
    e.preventDefault();
    const trimmed = pat.trim();
    if (!trimmed) {
      setPatError('Please enter a token');
      return;
    }
    setPatError('');
    setPatLoading(true);
    try {
      await onPatLogin(trimmed);
    } catch (err) {
      setPatError(err.message || 'Invalid token. Make sure it has repo and read:org scopes.');
    } finally {
      setPatLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex flex-col relative overflow-hidden transition-colors duration-500 ${darkMode ? 'aurora-bg' : 'aurora-bg-light'}`}>
      {/* Floating particles */}
      <div className="particle" />
      <div className="particle" />
      <div className="particle" />
      <div className="particle" />
      <div className="particle" />
      <div className="particle" />
      <div className="particle" />
      <div className="particle" />

      <div className="absolute top-6 right-6 z-20">
        <ThemeToggle darkMode={darkMode} setDarkMode={setDarkMode} />
      </div>

      <div className="flex-1 flex items-center justify-center px-4 relative z-10">
        <div className="glass-card glow-card p-10 max-w-md w-full text-center">
          <div className="stagger-in">
            {/* Logo */}
            <div className="mb-8">
              <Logo size={72} className="mx-auto drop-shadow-lg" />
            </div>

            <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent mb-2">
              SecretSweep
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mb-8">
              Sign in to your account
            </p>

            {/* OAuth Button */}
            <div>
              <a
                href="/auth/github"
                className="btn-glow inline-flex items-center gap-3 bg-gray-900 dark:bg-white dark:text-gray-900 text-white font-semibold px-8 py-3.5 rounded-xl hover:bg-gray-800 dark:hover:bg-gray-100 transition-all duration-200 shadow-lg hover:shadow-xl active:scale-[0.98] text-lg w-full justify-center"
              >
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                Sign in with GitHub
              </a>
            </div>

            {/* Divider */}
            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200 dark:border-gray-700/50" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white/80 dark:bg-transparent px-4 text-sm text-gray-400 dark:text-gray-500 font-medium backdrop-blur-sm">
                  or continue with
                </span>
              </div>
            </div>

            {/* PAT Toggle */}
            <div>
              {!showPat ? (
                <button
                  onClick={() => setShowPat(true)}
                  className="inline-flex items-center gap-2 text-sm font-medium text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors"
                >
                  <Key className="w-4 h-4" />
                  Use a Personal Access Token
                </button>
              ) : (
                <form onSubmit={handlePatSubmit} className="text-left animate-fade-in">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Personal Access Token
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={pat}
                      onChange={(e) => { setPat(e.target.value); setPatError(''); }}
                      placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                      className="w-full bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700/50 rounded-xl px-4 py-3 pr-12 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent placeholder:text-gray-400 dark:placeholder:text-gray-600"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {patError && (
                    <div className="flex items-center gap-1.5 mt-2 text-sm text-red-600 dark:text-red-400">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      {patError}
                    </div>
                  )}

                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                    Requires <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-brand-600 dark:text-brand-400">repo</code> and <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-brand-600 dark:text-brand-400">read:org</code> scopes.
                    Your token is stored only in your browser session.
                  </p>

                  <button
                    type="submit"
                    disabled={patLoading || !pat.trim()}
                    className="btn-primary btn-glow w-full mt-4 flex items-center justify-center gap-2"
                  >
                    {patLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      <>
                        <Key className="w-4 h-4" />
                        Connect with Token
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>

            <div className="mt-10 pt-8 border-t border-gray-200 dark:border-gray-700/50">
              <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-4">What we scan for</h3>
              <div className="grid grid-cols-2 gap-3 text-sm text-gray-500 dark:text-gray-400">
                {[
                  'AWS Keys',
                  'GitHub Tokens',
                  'Private Keys',
                  'Database URIs',
                  'Slack Tokens',
                  'Stripe Keys',
                  'API Keys',
                  'JWT Secrets',
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-brand-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer className="text-center py-6 text-sm text-gray-400 dark:text-gray-600 relative z-10">
        SecretSweep &mdash; Secure your organization
      </footer>
    </div>
  );
}
