import { useState, useEffect } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { AlertCircle, Shield, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from '../components/ThemeToggle';

export default function InvitePage({ darkMode, setDarkMode }) {
  const { token } = useParams();
  const { acceptInvite, isAuthenticated } = useAuth();
  const [invite, setInvite] = useState(null);
  const [loadingInvite, setLoadingInvite] = useState(true);
  const [inviteError, setInviteError] = useState('');
  const [form, setForm] = useState({ name: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  useEffect(() => {
    fetch(`/auth/invite/${token}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) setInviteError(data.error);
        else setInvite(data);
      })
      .catch(() => setInviteError('Failed to load invitation'))
      .finally(() => setLoadingInvite(false));
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await acceptInvite(token, form.password, form.name);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex flex-col relative overflow-hidden transition-colors duration-500 ${darkMode ? 'aurora-bg' : 'aurora-bg-light'}`}>
      <div className="particle" /><div className="particle" /><div className="particle" /><div className="particle" />
      <div className="particle" /><div className="particle" /><div className="particle" /><div className="particle" />

      <div className="absolute top-6 right-6 z-20">
        <ThemeToggle darkMode={darkMode} setDarkMode={setDarkMode} />
      </div>

      <div className="flex-1 flex items-center justify-center px-4 relative z-10">
        <div className="glass-card glow-card p-10 max-w-md w-full text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-lg shadow-brand-500/25 mb-6">
            <Shield className="w-8 h-8 text-white" />
          </div>

          {loadingInvite ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
            </div>
          ) : inviteError ? (
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Invalid Invitation</h1>
              <p className="text-red-500">{inviteError}</p>
            </div>
          ) : (
            <div className="stagger-in">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Join {invite.orgName}</h1>
              <p className="text-gray-500 dark:text-gray-400 mb-6">You've been invited as <strong>{invite.email}</strong></p>

              <form onSubmit={handleSubmit} className="text-left space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Your Name</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700/50 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    required autoFocus />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Set Password</label>
                  <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="Min 8 chars, 1 letter, 1 number"
                    className="w-full bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700/50 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    required minLength={8} />
                </div>

                {error && (
                  <div className="flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400">
                    <AlertCircle className="w-4 h-4" />{error}
                  </div>
                )}

                <button type="submit" disabled={loading} className="btn-primary btn-glow w-full">
                  {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" /> : 'Accept & Join'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
