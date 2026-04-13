import { useState, useEffect, useCallback } from 'react';
import { Key, Check, Loader2, Link2, Link2Off, Sun, Moon, Bell, BellOff, Trash2, Send, Plus, ToggleLeft, ToggleRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import UserAvatar from '../components/UserAvatar';

const GitHubIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
  </svg>
);

const GitLabIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="m23.6 9.593-.033-.086L20.3.98a.851.851 0 0 0-.336-.405.867.867 0 0 0-.996.054.858.858 0 0 0-.29.44l-2.209 6.776H7.53L5.322 1.07a.857.857 0 0 0-.29-.441.867.867 0 0 0-.996-.054.852.852 0 0 0-.336.405L.433 9.502l-.032.09a6.013 6.013 0 0 0 1.996 6.954l.012.009.031.023 4.942 3.701 2.444 1.852 1.49 1.126a1.014 1.014 0 0 0 1.22 0l1.49-1.126 2.444-1.852 4.974-3.724.013-.01a6.017 6.017 0 0 0 1.994-6.952z"/>
  </svg>
);

const SlackIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.271 0a2.528 2.528 0 0 1-2.521 2.521 2.528 2.528 0 0 1-2.521-2.521V2.522A2.528 2.528 0 0 1 15.164 0a2.528 2.528 0 0 1 2.521 2.522v6.312zM15.164 18.956a2.528 2.528 0 0 1 2.521 2.522A2.528 2.528 0 0 1 15.164 24a2.528 2.528 0 0 1-2.521-2.522v-2.522h2.521zm0-1.271a2.528 2.528 0 0 1-2.521-2.521 2.528 2.528 0 0 1 2.521-2.521h6.314A2.528 2.528 0 0 1 24 15.164a2.528 2.528 0 0 1-2.522 2.521h-6.314z"/>
  </svg>
);

const SEVERITY_OPTIONS = ['critical', 'high', 'medium', 'low'];
const SEVERITY_COLORS = {
  critical: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800',
  high: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800',
  medium: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800',
  low: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700',
};

export default function SettingsPage({ darkMode, setDarkMode }) {
  const { authFetch, user, org } = useAuth();
  const [ghStatus, setGhStatus] = useState(null);
  const [pat, setPat] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState('');
  const [connectSuccess, setConnectSuccess] = useState(false);

  // Integrations state
  const [integrations, setIntegrations] = useState([]);
  const [loadingIntegrations, setLoadingIntegrations] = useState(false);
  const [showAddSlack, setShowAddSlack] = useState(false);
  const [slackName, setSlackName] = useState('');
  const [slackWebhook, setSlackWebhook] = useState('');
  const [slackConfig, setSlackConfig] = useState({
    onScanComplete: true, onScanFailed: true, onFinding: true,
    severities: ['critical', 'high'],
  });
  const [addingSlack, setAddingSlack] = useState(false);
  const [slackError, setSlackError] = useState('');
  const [testingId, setTestingId] = useState(null);

  // GitLab state
  const [glStatus, setGlStatus] = useState(null);
  const [glToken, setGlToken] = useState('');
  const [glUrl, setGlUrl] = useState('https://gitlab.com');
  const [connectingGl, setConnectingGl] = useState(false);
  const [glError, setGlError] = useState('');
  const [glSuccess, setGlSuccess] = useState(false);

  // Profile edit state
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profileTitle, setProfileTitle] = useState('');
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    authFetch('/api/github/status').then(r => r.json()).then(setGhStatus).catch(() => setGhStatus({ connected: false }));
    authFetch('/api/gitlab/status').then(r => r.json()).then(setGlStatus).catch(() => setGlStatus({ connected: false }));
  }, [authFetch]);

  const handleSaveProfile = async (e) => {
    e.preventDefault(); setProfileSaving(true); setProfileMsg('');
    try {
      const body = {};
      if (profileName.trim() && profileName !== user?.name) body.name = profileName;
      if (profileTitle !== (user?.job_title || '')) body.jobTitle = profileTitle;
      if (newPwd) { body.currentPassword = currentPwd; body.newPassword = newPwd; }
      if (Object.keys(body).length === 0) { setProfileMsg('No changes'); setProfileSaving(false); return; }
      const res = await authFetch('/api/users/me', { method: 'PATCH', body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setProfileMsg('Profile updated'); setCurrentPwd(''); setNewPwd('');
      setEditingProfile(false);
      // Refresh user data
      window.location.reload();
    } catch (err) { setProfileMsg(err.message); } finally { setProfileSaving(false); }
  };

  const loadIntegrations = useCallback(async () => {
    if (!isAdmin) return;
    setLoadingIntegrations(true);
    try {
      const res = await authFetch('/api/integrations');
      const data = await res.json();
      setIntegrations(Array.isArray(data) ? data : []);
    } catch {}
    setLoadingIntegrations(false);
  }, [authFetch, isAdmin]);

  useEffect(() => { loadIntegrations(); }, [loadIntegrations]);

  const handleConnect = async (e) => {
    e.preventDefault();
    setConnecting(true);
    setConnectError('');
    setConnectSuccess(false);
    try {
      const res = await authFetch('/api/github/connect', {
        method: 'POST',
        body: JSON.stringify({ token: pat }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setGhStatus({ connected: true, username: data.username });
      setPat('');
      setConnectSuccess(true);
      setTimeout(() => setConnectSuccess(false), 3000);
    } catch (err) {
      setConnectError(err.message);
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await authFetch('/api/github/disconnect', { method: 'DELETE' });
      setGhStatus({ connected: false });
    } catch {}
  };

  const handleConnectGitLab = async (e) => {
    e.preventDefault(); setConnectingGl(true); setGlError(''); setGlSuccess(false);
    try {
      const res = await authFetch('/api/gitlab/connect', {
        method: 'POST', body: JSON.stringify({ token: glToken, gitlabUrl: glUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setGlStatus({ connected: true, username: data.username, baseUrl: glUrl });
      setGlToken(''); setGlSuccess(true);
      setTimeout(() => setGlSuccess(false), 3000);
    } catch (err) { setGlError(err.message); } finally { setConnectingGl(false); }
  };

  const handleDisconnectGitLab = async () => {
    try { await authFetch('/api/gitlab/disconnect', { method: 'DELETE' }); setGlStatus({ connected: false }); } catch {}
  };

  const handleAddSlack = async (e) => {
    e.preventDefault();
    setAddingSlack(true);
    setSlackError('');
    try {
      const res = await authFetch('/api/integrations', {
        method: 'POST',
        body: JSON.stringify({ name: slackName, webhookUrl: slackWebhook, config: slackConfig }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setShowAddSlack(false);
      setSlackName('');
      setSlackWebhook('');
      setSlackConfig({ onScanComplete: true, onScanFailed: true, onFinding: true, severities: ['critical', 'high'] });
      loadIntegrations();
    } catch (err) {
      setSlackError(err.message);
    } finally {
      setAddingSlack(false);
    }
  };

  const handleToggleIntegration = async (id, currentActive) => {
    try {
      await authFetch(`/api/integrations/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !currentActive }),
      });
      loadIntegrations();
    } catch {}
  };

  const handleDeleteIntegration = async (id) => {
    try {
      await authFetch(`/api/integrations/${id}`, { method: 'DELETE' });
      loadIntegrations();
    } catch {}
  };

  const handleTestIntegration = async (id) => {
    setTestingId(id);
    try {
      const res = await authFetch(`/api/integrations/${id}/test`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
    } catch {}
    setTimeout(() => setTestingId(null), 2000);
  };

  const toggleSeverity = (sev) => {
    setSlackConfig((prev) => ({
      ...prev,
      severities: prev.severities.includes(sev)
        ? prev.severities.filter((s) => s !== sev)
        : [...prev.severities, sev],
    }));
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Manage your account and integrations</p>
      </div>

      {/* Account */}
      <section className="glass-card glow-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Account</h2>
          {!editingProfile && (
            <button onClick={() => { setEditingProfile(true); setProfileName(user?.name || ''); setProfileTitle(user?.job_title || ''); setProfileMsg(''); }}
              className="text-sm text-brand-600 dark:text-brand-400 hover:underline">Edit Profile</button>
          )}
        </div>

        {!editingProfile ? (
          <div className="flex items-center gap-4">
            <UserAvatar user={{ name: user?.name, login: user?.email }} size="lg" />
            <div>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">{user?.name}</p>
              {user?.job_title && <p className="text-sm text-brand-600 dark:text-brand-400">{user.job_title}</p>}
              <p className="text-sm text-gray-500 dark:text-gray-400">{user?.email}</p>
              <p className="text-xs text-gray-400 mt-1">{org?.name} &middot; {isAdmin ? 'Admin' : 'Member'}</p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="flex items-center gap-4 mb-4">
              <UserAvatar user={{ name: user?.name, login: user?.email }} size="lg" />
              <div className="flex-1">
                <p className="text-sm text-gray-500 dark:text-gray-400">{user?.email}</p>
                <p className="text-xs text-gray-400">{org?.name} &middot; {isAdmin ? 'Admin' : 'Member'}</p>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Display Name</label>
              <input value={profileName} onChange={(e) => setProfileName(e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Job Title</label>
              <input value={profileTitle} onChange={(e) => setProfileTitle(e.target.value)}
                placeholder="e.g. Security Engineer, CTO, DevOps Lead"
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
              <p className="text-xs font-semibold text-gray-400 uppercase mb-3">Change Password (optional)</p>
              <div className="space-y-3">
                <input type="password" value={currentPwd} onChange={(e) => setCurrentPwd(e.target.value)}
                  placeholder="Current password" className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                <input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)}
                  placeholder="New password (min 8 chars, 1 letter, 1 number)" className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
            </div>
            {profileMsg && <p className={`text-sm ${profileMsg.includes('updated') ? 'text-emerald-600' : 'text-red-600'}`}>{profileMsg}</p>}
            <div className="flex gap-2">
              <button type="submit" disabled={profileSaving} className="btn-primary flex items-center gap-2 text-sm">
                {profileSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Save Changes
              </button>
              <button type="button" onClick={() => { setEditingProfile(false); setProfileMsg(''); }}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">Cancel</button>
            </div>
          </form>
        )}
      </section>

      {/* GitHub Connection */}
      <section className="glass-card glow-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <GitHubIcon className="w-4 h-4 text-gray-800 dark:text-white" />
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">GitHub Connection</h2>
        </div>

        {!isAdmin ? (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <Link2 className="w-5 h-5 text-gray-400" />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">GitHub integration is managed by admins</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {ghStatus?.connected ? `Connected as @${ghStatus.username}` : 'Not connected. Contact an admin to set up GitHub.'}
              </p>
            </div>
          </div>
        ) : ghStatus?.connected ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50">
              <Link2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <div className="flex-1">
                <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">Connected as @{ghStatus.username}</p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400">Your token is encrypted at rest</p>
              </div>
            </div>
            <button onClick={handleDisconnect} className="btn-danger text-sm px-4 py-2">Disconnect GitHub</button>
          </div>
        ) : (
          <form onSubmit={handleConnect} className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50">
              <Link2Off className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              <p className="text-sm text-amber-800 dark:text-amber-300">Not connected. Add a Personal Access Token to start scanning.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Personal Access Token</label>
              <input type="password" value={pat} onChange={(e) => setPat(e.target.value)}
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500" />
              <p className="text-xs text-gray-400 mt-1">
                Requires <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-brand-600 dark:text-brand-400">repo</code> and <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-brand-600 dark:text-brand-400">read:org</code> scopes.
              </p>
            </div>
            {connectError && <p className="text-sm text-red-600 dark:text-red-400">{connectError}</p>}
            {connectSuccess && <p className="text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><Check className="w-4 h-4" /> Connected successfully</p>}
            <button type="submit" disabled={connecting || !pat.trim()} className="btn-primary btn-glow flex items-center gap-2">
              {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
              Connect GitHub
            </button>
          </form>
        )}
      </section>

      {/* GitLab Connection */}
      <section className="glass-card glow-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <GitLabIcon className="w-4 h-4 text-[#FC6D26]" />
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">GitLab Connection</h2>
        </div>

        {!isAdmin ? (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <GitLabIcon className="w-5 h-5 text-gray-400" />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">GitLab integration is managed by admins</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {glStatus?.connected ? `Connected as @${glStatus.username}` : 'Not connected.'}
              </p>
            </div>
          </div>
        ) : glStatus?.connected ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50">
              <GitLabIcon className="w-5 h-5 text-[#FC6D26]" />
              <div className="flex-1">
                <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">Connected as @{glStatus.username}</p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400">{glStatus.baseUrl} &middot; Token encrypted at rest</p>
              </div>
            </div>
            <button onClick={handleDisconnectGitLab} className="btn-danger text-sm px-4 py-2">Disconnect GitLab</button>
          </div>
        ) : (
          <form onSubmit={handleConnectGitLab} className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50">
              <Link2Off className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              <p className="text-sm text-amber-800 dark:text-amber-300">Not connected. Add a GitLab Personal Access Token.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">GitLab URL</label>
              <input type="url" value={glUrl} onChange={(e) => setGlUrl(e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              <p className="text-xs text-gray-400 mt-1">Use <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-brand-600 dark:text-brand-400">https://gitlab.com</code> for cloud or your self-hosted URL.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Personal Access Token</label>
              <input type="password" value={glToken} onChange={(e) => setGlToken(e.target.value)}
                placeholder="glpat-xxxxxxxxxxxxxxxxxxxx"
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500" />
              <p className="text-xs text-gray-400 mt-1">
                Requires <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-brand-600 dark:text-brand-400">read_api</code> scope.
              </p>
            </div>
            {glError && <p className="text-sm text-red-600 dark:text-red-400">{glError}</p>}
            {glSuccess && <p className="text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><Check className="w-4 h-4" /> Connected successfully</p>}
            <button type="submit" disabled={connectingGl || !glToken.trim()} className="btn-primary btn-glow flex items-center gap-2">
              {connectingGl ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
              Connect GitLab
            </button>
          </form>
        )}
      </section>

      {/* Slack Integrations — Admin Only */}
      {isAdmin && (
        <section className="glass-card glow-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <SlackIcon className="w-4 h-4 text-[#E01E5A]" />
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Slack Alerts</h2>
            </div>
            {!showAddSlack && (
              <button onClick={() => setShowAddSlack(true)} className="text-sm text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" /> Add Slack
              </button>
            )}
          </div>

          {/* Existing integrations */}
          {loadingIntegrations ? (
            <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
          ) : integrations.length === 0 && !showAddSlack ? (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
              <SlackIcon className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-300">No Slack integrations configured</p>
                <p className="text-xs text-gray-400">Add a Slack webhook to receive scan alerts</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3 mb-4">
              {integrations.map((integ) => (
                <div key={integ.id} className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${
                  integ.is_active
                    ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800/50'
                    : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 opacity-60'
                }`}>
                  <SlackIcon className={`w-5 h-5 shrink-0 ${integ.is_active ? 'text-[#E01E5A]' : 'text-gray-400'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{integ.name}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {integ.config?.onScanComplete && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">Scan Complete</span>}
                      {integ.config?.onScanFailed && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">Scan Failed</span>}
                      {integ.config?.onFinding && integ.config?.severities?.map((s) => (
                        <span key={s} className={`text-[10px] px-1.5 py-0.5 rounded border ${SEVERITY_COLORS[s]}`}>{s}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => handleTestIntegration(integ.id)} title="Send test" className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                      {testingId === integ.id ? <Check className="w-4 h-4 text-emerald-500" /> : <Send className="w-4 h-4 text-gray-400" />}
                    </button>
                    <button onClick={() => handleToggleIntegration(integ.id, integ.is_active)} title={integ.is_active ? 'Disable' : 'Enable'} className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                      {integ.is_active ? <ToggleRight className="w-5 h-5 text-emerald-500" /> : <ToggleLeft className="w-5 h-5 text-gray-400" />}
                    </button>
                    <button onClick={() => handleDeleteIntegration(integ.id)} title="Remove" className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors">
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add Slack Form */}
          {showAddSlack && (
            <form onSubmit={handleAddSlack} className="space-y-4 border-t border-gray-100 dark:border-gray-800 pt-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Channel Name</label>
                <input type="text" value={slackName} onChange={(e) => setSlackName(e.target.value)}
                  placeholder="#security-alerts"
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Webhook URL</label>
                <input type="url" value={slackWebhook} onChange={(e) => setSlackWebhook(e.target.value)}
                  placeholder="https://hooks.slack.com/services/T00/B00/xxxx"
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500" />
                <p className="text-xs text-gray-400 mt-1">Create one at <span className="text-brand-500">api.slack.com/apps</span> &rarr; Incoming Webhooks</p>
              </div>

              {/* Alert Preferences */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Alert on</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                    <input type="checkbox" checked={slackConfig.onScanComplete} onChange={() => setSlackConfig((p) => ({ ...p, onScanComplete: !p.onScanComplete }))}
                      className="rounded border-gray-300 dark:border-gray-600 text-brand-600 focus:ring-brand-500" />
                    Scan completed
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                    <input type="checkbox" checked={slackConfig.onScanFailed} onChange={() => setSlackConfig((p) => ({ ...p, onScanFailed: !p.onScanFailed }))}
                      className="rounded border-gray-300 dark:border-gray-600 text-brand-600 focus:ring-brand-500" />
                    Scan failed
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                    <input type="checkbox" checked={slackConfig.onFinding} onChange={() => setSlackConfig((p) => ({ ...p, onFinding: !p.onFinding }))}
                      className="rounded border-gray-300 dark:border-gray-600 text-brand-600 focus:ring-brand-500" />
                    New finding discovered
                  </label>
                </div>
              </div>

              {slackConfig.onFinding && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Finding severities</label>
                  <div className="flex flex-wrap gap-2">
                    {SEVERITY_OPTIONS.map((sev) => (
                      <button key={sev} type="button" onClick={() => toggleSeverity(sev)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                          slackConfig.severities.includes(sev)
                            ? SEVERITY_COLORS[sev]
                            : 'bg-gray-50 dark:bg-gray-800 text-gray-400 border-gray-200 dark:border-gray-700'
                        }`}>
                        {sev}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {slackError && <p className="text-sm text-red-600 dark:text-red-400">{slackError}</p>}

              <div className="flex gap-2">
                <button type="submit" disabled={addingSlack || !slackName.trim() || !slackWebhook.trim()}
                  className="btn-primary btn-glow flex items-center gap-2 text-sm">
                  {addingSlack ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
                  {addingSlack ? 'Validating...' : 'Add Slack Integration'}
                </button>
                <button type="button" onClick={() => { setShowAddSlack(false); setSlackError(''); }}
                  className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                  Cancel
                </button>
              </div>
            </form>
          )}
        </section>
      )}

      {/* Appearance */}
      <section className="glass-card glow-card p-6">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Appearance</h2>
        <div className="flex gap-3">
          <button onClick={() => setDarkMode(false)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 transition-all ${!darkMode ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-600' : 'border-gray-200 dark:border-gray-700 text-gray-500'}`}>
            <Sun className="w-4 h-4" /><span className="text-sm font-medium">Light</span>
          </button>
          <button onClick={() => setDarkMode(true)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 transition-all ${darkMode ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-600' : 'border-gray-200 dark:border-gray-700 text-gray-500'}`}>
            <Moon className="w-4 h-4" /><span className="text-sm font-medium">Dark</span>
          </button>
        </div>
      </section>
    </div>
  );
}
