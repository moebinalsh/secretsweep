import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AlertCircle, Link2Off, Play, Loader2, GitBranch, Lock, Globe, CalendarClock, Trash2, ToggleLeft, ToggleRight, Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import OrgSelector from '../components/OrgSelector';

export default function NewScanPage() {
  const { authFetch, user, accessToken } = useAuth();
  const navigate = useNavigate();

  const [ghStatus, setGhStatus] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [orgs, setOrgs] = useState([]);
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [repos, setRepos] = useState([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [scanMode, setScanMode] = useState('full');
  const [selectedRepoNames, setSelectedRepoNames] = useState([]);
  const [activeTab, setActiveTab] = useState('scan');
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  // Scheduled scans
  const [schedules, setSchedules] = useState([]);
  const [showAddSchedule, setShowAddSchedule] = useState(false);
  const [schedFrequency, setSchedFrequency] = useState('weekly');
  const [addingSchedule, setAddingSchedule] = useState(false);
  const isAdmin = user?.role === 'admin';

  // Check GitHub connection
  useEffect(() => {
    authFetch('/api/github/status')
      .then((r) => r.json())
      .then((data) => {
        setGhStatus(data);
        if (data.connected) {
          authFetch('/api/github/orgs').then((r) => r.json()).then(setOrgs).catch(() => {});
        }
      })
      .catch(() => setGhStatus({ connected: false }))
      .finally(() => setLoadingStatus(false));
  }, [authFetch]);

  // Load schedules
  useEffect(() => {
    if (isAdmin) {
      authFetch('/api/schedules').then(r => r.json()).then(data => setSchedules(Array.isArray(data) ? data : [])).catch(() => {});
    }
  }, [authFetch, isAdmin]);

  const handleAddSchedule = async () => {
    if (!selectedOrg) return;
    setAddingSchedule(true);
    try {
      const body = { githubOrg: selectedOrg, scanMode, frequency: schedFrequency };
      if (scanMode === 'selective' && selectedRepoNames.length > 0) body.repos = selectedRepoNames;
      const res = await authFetch('/api/schedules', { method: 'POST', body: JSON.stringify(body) });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      const all = await authFetch('/api/schedules').then(r => r.json());
      setSchedules(Array.isArray(all) ? all : []);
      setShowAddSchedule(false);
    } catch (err) { setError(err.message); }
    setAddingSchedule(false);
  };

  const handleToggleSchedule = async (id, active) => {
    await authFetch(`/api/schedules/${id}`, { method: 'PATCH', body: JSON.stringify({ isActive: !active }) });
    const all = await authFetch('/api/schedules').then(r => r.json());
    setSchedules(Array.isArray(all) ? all : []);
  };

  const handleDeleteSchedule = async (id) => {
    await authFetch(`/api/schedules/${id}`, { method: 'DELETE' });
    setSchedules(prev => prev.filter(s => s.id !== id));
  };

  // Fetch repos when org changes
  useEffect(() => {
    if (selectedOrg) {
      setLoadingRepos(true);
      setScanMode('full');
      setSelectedRepoNames([]);
      authFetch(`/api/github/repos/${encodeURIComponent(selectedOrg)}`)
        .then((r) => r.json())
        .then((data) => {
          setRepos(data.map((r) => ({
            name: r.name, full_name: r.full_name, html_url: r.html_url, private: r.private,
          })));
        })
        .catch(() => setRepos([]))
        .finally(() => setLoadingRepos(false));
    }
  }, [selectedOrg, authFetch]);

  const handleStartScan = useCallback(async () => {
    if (!selectedOrg) return;
    setStarting(true);
    setError('');

    try {
      const body = {
        githubOrg: selectedOrg,
        scanMode,
        ...(scanMode === 'selective' && selectedRepoNames.length > 0 ? { repos: selectedRepoNames } : {}),
      };
      const res = await authFetch('/api/scans', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start scan');
      navigate(`/scans/${data.scanId}`);
    } catch (err) {
      setError(err.message);
      setStarting(false);
    }
  }, [selectedOrg, scanMode, selectedRepoNames, authFetch, navigate]);

  if (loadingStatus) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-brand-500" /></div>;
  }

  if (!ghStatus?.connected) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center animate-fade-in">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 mb-4">
          <Link2Off className="w-8 h-8 text-amber-600 dark:text-amber-400" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Connect GitHub First</h2>
        <p className="text-gray-500 dark:text-gray-400 mb-6">You need to connect your GitHub account to scan repositories.</p>
        <Link to="/settings" className="btn-primary btn-glow inline-flex items-center gap-2">Go to Settings</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">New Scan</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Select an organization and repos to scan</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm">
          <AlertCircle className="w-4 h-4" />{error}
        </div>
      )}

      <OrgSelector
        orgs={orgs}
        selectedOrg={selectedOrg}
        onSelectOrg={setSelectedOrg}
        onStartScan={handleStartScan}
        onStopScan={() => {}}
        scanning={starting}
        scanComplete={false}
        repoCount={repos.length}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        loadingRepos={loadingRepos}
        user={{ login: ghStatus.username }}
        scanMode={scanMode}
        onScanModeChange={setScanMode}
        selectedRepos={selectedRepoNames}
        onSelectedReposChange={setSelectedRepoNames}
        allRepos={repos}
      />

      {activeTab === 'repos' && selectedOrg && (
        <div className="glass-card glow-card p-6">
          {loadingRepos ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
            </div>
          ) : repos.length === 0 ? (
            <p className="text-center text-gray-500 dark:text-gray-400 py-10">No repositories found</p>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {repos.map((repo) => (
                <div key={repo.full_name} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <GitBranch className="w-4 h-4 text-gray-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <a href={repo.html_url} target="_blank" rel="noopener noreferrer"
                      className="text-sm font-medium text-gray-900 dark:text-white hover:text-brand-600 dark:hover:text-brand-400 truncate block">
                      {repo.name}
                    </a>
                    <p className="text-xs text-gray-400 truncate">{repo.full_name}</p>
                  </div>
                  {repo.private ? (
                    <Lock className="w-3.5 h-3.5 text-amber-500" title="Private" />
                  ) : (
                    <Globe className="w-3.5 h-3.5 text-gray-400" title="Public" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Scheduled Scans — Admin Only */}
      {isAdmin && ghStatus?.connected && (
        <div className="glass-card glow-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-brand-600" />
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Scheduled Scans</h2>
            </div>
            {!showAddSchedule && selectedOrg && (
              <button onClick={() => setShowAddSchedule(true)} className="text-sm text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" /> Schedule
              </button>
            )}
          </div>

          {schedules.length === 0 && !showAddSchedule ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No scheduled scans. Select an org above and click Schedule to automate.</p>
          ) : (
            <div className="space-y-2 mb-4">
              {schedules.map((s) => (
                <div key={s.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                  s.is_active ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800/50' : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 opacity-60'
                }`}>
                  <CalendarClock className={`w-4 h-4 shrink-0 ${s.is_active ? 'text-blue-600' : 'text-gray-400'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {s.github_org?.replace('__user__:', '')}
                      <span className="text-xs text-gray-400 ml-2">{s.cron_label || s.cron_expression}</span>
                    </p>
                    <p className="text-xs text-gray-400">
                      {s.next_run_at ? `Next: ${new Date(s.next_run_at).toLocaleString()}` : 'Paused'}
                      {s.last_run_at && ` · Last: ${new Date(s.last_run_at).toLocaleString()}`}
                    </p>
                  </div>
                  <button onClick={() => handleToggleSchedule(s.id, s.is_active)} className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700">
                    {s.is_active ? <ToggleRight className="w-5 h-5 text-blue-500" /> : <ToggleLeft className="w-5 h-5 text-gray-400" />}
                  </button>
                  <button onClick={() => handleDeleteSchedule(s.id)} className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/20">
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {showAddSchedule && selectedOrg && (
            <div className="border-t border-gray-100 dark:border-gray-800 pt-4 mt-4 space-y-3">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Schedule <span className="font-medium">{scanMode === 'full' ? 'full' : `${selectedRepoNames.length} repo`}</span> scan for <span className="font-medium">{selectedOrg.replace('__user__:', '')}</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {['daily', 'weekly', 'biweekly', 'monthly'].map((freq) => (
                  <button key={freq} onClick={() => setSchedFrequency(freq)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                      schedFrequency === freq
                        ? 'bg-brand-100 dark:bg-brand-900/30 text-brand-600 border-brand-300 dark:border-brand-700'
                        : 'bg-gray-50 dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700'
                    }`}>
                    {freq.charAt(0).toUpperCase() + freq.slice(1)}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={handleAddSchedule} disabled={addingSchedule} className="btn-primary btn-glow flex items-center gap-2 text-sm">
                  {addingSchedule ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarClock className="w-4 h-4" />}
                  Create Schedule
                </button>
                <button onClick={() => setShowAddSchedule(false)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
