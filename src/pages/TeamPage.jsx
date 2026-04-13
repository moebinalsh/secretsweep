import { useState, useEffect } from 'react';
import { UserPlus, Shield, ShieldAlert, Loader2, Copy, Check, Trash2, KeyRound, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../lib/utils';

export default function TeamPage() {
  const { authFetch, user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState(null);
  const [inviteError, setInviteError] = useState('');
  const [copied, setCopied] = useState(false);
  const [resetUserId, setResetUserId] = useState(null);
  const [resetPwd, setResetPwd] = useState('');
  const [resetting, setResetting] = useState(false);
  const [resetMsg, setResetMsg] = useState('');

  useEffect(() => {
    authFetch('/api/users').then(r => r.json()).then(setUsers).catch(console.error).finally(() => setLoading(false));
  }, [authFetch]);

  const handleInvite = async (e) => {
    e.preventDefault(); setInviting(true); setInviteError(''); setInviteResult(null);
    try {
      const res = await authFetch('/auth/invite', { method: 'POST', body: JSON.stringify({ email: inviteEmail, role: inviteRole }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setInviteResult(data); setInviteEmail('');
    } catch (err) { setInviteError(err.message); } finally { setInviting(false); }
  };

  const copyInviteLink = () => {
    if (!inviteResult) return;
    navigator.clipboard.writeText(`${window.location.origin}${inviteResult.inviteUrl}`);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const changeRole = async (userId, newRole) => {
    try {
      await authFetch(`/api/users/${userId}`, { method: 'PATCH', body: JSON.stringify({ role: newRole }) });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch {}
  };

  const removeUser = async (userId) => {
    try {
      await authFetch(`/api/users/${userId}`, { method: 'DELETE' });
      setUsers(prev => prev.filter(u => u.id !== userId));
    } catch {}
  };

  const handleResetPassword = async (e) => {
    e.preventDefault(); setResetting(true); setResetMsg('');
    try {
      const res = await authFetch(`/api/users/${resetUserId}/reset-password`, {
        method: 'POST', body: JSON.stringify({ newPassword: resetPwd }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResetMsg('Password reset successfully. User will need to log in again.');
      setResetPwd('');
      setTimeout(() => { setResetUserId(null); setResetMsg(''); }, 3000);
    } catch (err) { setResetMsg(err.message); } finally { setResetting(false); }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Team Management</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Invite teammates and manage access</p>
      </div>

      {/* Invite Form */}
      <section className="glass-card glow-card p-6">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Invite Member</h2>
        <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3">
          <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="colleague@company.com"
            className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            required />
          <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}
            className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
          <button type="submit" disabled={inviting} className="btn-primary btn-glow flex items-center gap-2 whitespace-nowrap">
            {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            Send Invite
          </button>
        </form>

        {inviteError && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{inviteError}</p>}

        {inviteResult && (
          <div className="mt-4 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50">
            <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300 mb-2">Invitation created!</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-white dark:bg-gray-800 px-3 py-2 rounded-lg font-mono text-gray-700 dark:text-gray-300 truncate">
                {window.location.origin}{inviteResult.inviteUrl}
              </code>
              <button onClick={copyInviteLink} className="btn-secondary text-sm px-3 py-2 flex items-center gap-1">
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2">Share this link. Expires in 72 hours.</p>
          </div>
        )}
      </section>

      {/* Members List */}
      <section className="glass-card glow-card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Members ({users.length})</h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-brand-500" /></div>
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-gray-800/50">
            {users.map((u) => (
              <div key={u.id}>
                <div className="flex items-center justify-between px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white text-sm font-bold">
                      {(u.name || u.email)[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                        {u.name || u.email}
                        {u.id === currentUser?.id && <span className="ml-2 text-xs text-gray-400">(you)</span>}
                      </p>
                      <p className="text-xs text-gray-400">{u.email}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3 text-gray-300" />
                        <span className="text-[10px] text-gray-400">
                          {u.last_login_at ? `Last active ${formatDate(u.last_login_at)}` : 'Never logged in'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      {u.role === 'admin' ? <ShieldAlert className="w-4 h-4 text-brand-500" /> : <Shield className="w-4 h-4 text-gray-400" />}
                      {u.id !== currentUser?.id ? (
                        <select value={u.role} onChange={(e) => changeRole(u.id, e.target.value)}
                          className="text-xs bg-transparent border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 focus:outline-none">
                          <option value="member">Member</option>
                          <option value="admin">Admin</option>
                        </select>
                      ) : (
                        <span className="text-xs font-medium text-gray-500 capitalize">{u.role}</span>
                      )}
                    </div>
                    {u.id !== currentUser?.id && (
                      <>
                        <button onClick={() => { setResetUserId(resetUserId === u.id ? null : u.id); setResetPwd(''); setResetMsg(''); }}
                          title="Reset password"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors">
                          <KeyRound className="w-4 h-4" />
                        </button>
                        <button onClick={() => removeUser(u.id)} title="Remove user"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Password Reset Form (inline) */}
                {resetUserId === u.id && (
                  <div className="px-6 pb-4">
                    <form onSubmit={handleResetPassword} className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50 rounded-xl p-3">
                      <KeyRound className="w-4 h-4 text-amber-500 shrink-0" />
                      <input type="password" value={resetPwd} onChange={(e) => setResetPwd(e.target.value)}
                        placeholder="New password (min 8 chars)"
                        className="flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                        required minLength={8} />
                      <button type="submit" disabled={resetting || !resetPwd.trim()}
                        className="px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
                        {resetting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Reset'}
                      </button>
                      <button type="button" onClick={() => setResetUserId(null)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                    </form>
                    {resetMsg && <p className={`text-xs mt-2 px-3 ${resetMsg.includes('success') ? 'text-emerald-600' : 'text-red-500'}`}>{resetMsg}</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
