import { useState, useEffect } from 'react';
import { Building2, Users, Scan, ShieldAlert, Loader2, Plus, Trash2, ToggleLeft, ToggleRight, Copy, Check, ChevronDown, ChevronUp, UserPlus, Mail, MessageSquare, Settings } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../lib/utils';

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="stat-card glow-card">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</p>
          <p className="text-3xl font-bold mt-1 text-gray-900 dark:text-white">{value}</p>
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}

export default function SuperAdminPage() {
  const { authFetch } = useAuth();
  const [tab, setTab] = useState('orgs');
  const [stats, setStats] = useState(null);
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [contactRequests, setContactRequests] = useState([]);
  const [slackWebhook, setSlackWebhook] = useState('');
  const [savingWebhook, setSavingWebhook] = useState(false);
  const [expandedRequest, setExpandedRequest] = useState(null);
  const [confirmDeleteReq, setConfirmDeleteReq] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ orgName: '', adminEmail: '', adminName: '' });
  const [creating, setCreating] = useState(false);
  const [createResult, setCreateResult] = useState(null);
  const [createError, setCreateError] = useState('');
  const [copied, setCopied] = useState(false);
  const [expandedOrg, setExpandedOrg] = useState(null);
  const [orgUsers, setOrgUsers] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [showAddUser, setShowAddUser] = useState(null); // orgId or null
  const [addUserForm, setAddUserForm] = useState({ email: '', name: '', role: 'member' });
  const [addingUser, setAddingUser] = useState(false);
  const [addUserResult, setAddUserResult] = useState(null);
  const [addUserError, setAddUserError] = useState('');
  const [editingLimits, setEditingLimits] = useState(null); // orgId
  const [limitsForm, setLimitsForm] = useState({ maxUsers: -1, maxRepos: -1, maxScansPerMonth: -1 });
  const [savingLimits, setSavingLimits] = useState(false);
  const [confirmDeleteUser, setConfirmDeleteUser] = useState(null);

  const loadData = async () => {
    try {
      const [statsR, orgsR] = await Promise.all([
        authFetch('/api/admin/stats'),
        authFetch('/api/admin/orgs'),
      ]);
      if (statsR.ok) setStats(await statsR.json());
      else console.error('Stats error:', statsR.status, await statsR.text());
      if (orgsR.ok) {
        const data = await orgsR.json();
        setOrgs(Array.isArray(data) ? data : []);
      } else console.error('Orgs error:', orgsR.status, await orgsR.text());
      // Load contact requests
      const contactR = await authFetch('/api/contact');
      if (contactR.ok) setContactRequests(await contactR.json());
      // Load slack webhook setting
      const slackR = await authFetch('/api/contact/settings/slack');
      if (slackR.ok) { const d = await slackR.json(); setSlackWebhook(d.url || ''); }
    } catch (err) { console.error('Admin panel error:', err); }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [authFetch]);

  const handleCreate = async (e) => {
    e.preventDefault(); setCreating(true); setCreateError(''); setCreateResult(null);
    try {
      const res = await authFetch('/api/admin/orgs', {
        method: 'POST', body: JSON.stringify(createForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCreateResult(data);
      setCreateForm({ orgName: '', adminEmail: '', adminName: '' });
      loadData();
    } catch (err) { setCreateError(err.message); } finally { setCreating(false); }
  };

  const handleToggle = async (orgId, isActive) => {
    await authFetch(`/api/admin/orgs/${orgId}`, { method: 'PATCH', body: JSON.stringify({ isActive: !isActive }) });
    loadData();
  };

  const handleDelete = async (orgId) => {
    await authFetch(`/api/admin/orgs/${orgId}`, { method: 'DELETE' });
    setConfirmDelete(null);
    loadData();
  };

  const loadOrgUsers = async (orgId, force = false) => {
    if (expandedOrg === orgId && !force) { setExpandedOrg(null); return; }
    setExpandedOrg(orgId);
    if (!orgUsers[orgId] || force) {
      const data = await authFetch(`/api/admin/orgs/${orgId}/users`).then(r => r.json());
      setOrgUsers(prev => ({ ...prev, [orgId]: data }));
    }
  };

  const handleAddUser = async (e, orgId) => {
    e.preventDefault(); setAddingUser(true); setAddUserError(''); setAddUserResult(null);
    try {
      const res = await authFetch(`/api/admin/orgs/${orgId}/users`, { method: 'POST', body: JSON.stringify(addUserForm) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAddUserResult(data);
      setAddUserForm({ email: '', name: '', role: 'member' });
      loadOrgUsers(orgId, true);
      loadData();
    } catch (err) { setAddUserError(err.message); } finally { setAddingUser(false); }
  };

  const handleDeleteUser = async (orgId, userId) => {
    try {
      await authFetch(`/api/admin/orgs/${orgId}/users/${userId}`, { method: 'DELETE' });
      setConfirmDeleteUser(null);
      loadOrgUsers(orgId, true);
      loadData();
    } catch {}
  };

  const handleSaveLimits = async (orgId) => {
    setSavingLimits(true);
    try {
      await authFetch(`/api/admin/orgs/${orgId}`, { method: 'PATCH', body: JSON.stringify({ limits: limitsForm }) });
      setEditingLimits(null);
      loadData();
    } catch {}
    setSavingLimits(false);
  };

  const startEditLimits = (org) => {
    const l = org.limits || {};
    setLimitsForm({ maxUsers: l.maxUsers ?? -1, maxRepos: l.maxRepos ?? -1, maxScansPerMonth: l.maxScansPerMonth ?? -1 });
    setEditingLimits(org.id);
  };

  const updateContactStatus = async (id, status) => {
    await authFetch(`/api/contact/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
    setContactRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r));
  };

  const deleteContactRequest = async (id) => {
    await authFetch(`/api/contact/${id}`, { method: 'DELETE' });
    setContactRequests(prev => prev.filter(r => r.id !== id));
    setConfirmDeleteReq(null);
  };

  const saveSlackWebhook = async () => {
    setSavingWebhook(true);
    await authFetch('/api/contact/settings/slack', { method: 'PUT', body: JSON.stringify({ url: slackWebhook }) });
    setSavingWebhook(false);
  };

  const copyInviteLink = (url) => {
    navigator.clipboard.writeText(`${window.location.origin}${url}`);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-brand-500" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Panel</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Manage customer organizations</p>
        </div>
        <button onClick={() => { setShowCreate(!showCreate); setCreateResult(null); setCreateError(''); }}
          className="btn-primary btn-glow flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Organization
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard icon={Building2} label="Organizations" value={stats?.active_orgs || 0} color="bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400" />
        <StatCard icon={Users} label="Total Users" value={stats?.total_users || 0} color="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" />
        <StatCard icon={Scan} label="Total Scans" value={stats?.total_scans || 0} color="bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400" />
        <StatCard icon={ShieldAlert} label="Total Findings" value={stats?.total_findings || 0} color="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400" />
        <StatCard icon={Building2} label="Total Orgs" value={stats?.total_orgs || 0} color="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 w-fit">
        {[
          { id: 'orgs', label: 'Organizations', icon: Building2 },
          { id: 'requests', label: `Requests (${contactRequests.filter(r => r.status === 'new').length})`, icon: Mail },
          { id: 'settings', label: 'Settings', icon: Settings },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.id ? 'bg-white dark:bg-gray-700 text-brand-600 dark:text-brand-400 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {/* ── Orgs Tab ── */}
      {tab === 'orgs' && (
      <div className="space-y-6">
      {/* Create Org Form */}
      {showCreate && (
        <div className="glass-card glow-card p-6">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">Create Organization</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Organization Name</label>
                <input value={createForm.orgName} onChange={(e) => setCreateForm({ ...createForm, orgName: e.target.value })}
                  placeholder="Acme Corp" className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Admin Email</label>
                <input type="email" value={createForm.adminEmail} onChange={(e) => setCreateForm({ ...createForm, adminEmail: e.target.value })}
                  placeholder="admin@acme.com" className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Admin Name</label>
                <input value={createForm.adminName} onChange={(e) => setCreateForm({ ...createForm, adminName: e.target.value })}
                  placeholder="Jane Smith" className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" required />
              </div>
            </div>
            {createError && <p className="text-sm text-red-600 dark:text-red-400">{createError}</p>}
            <button type="submit" disabled={creating} className="btn-primary flex items-center gap-2 text-sm">
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Building2 className="w-4 h-4" />}
              Create Organization
            </button>
          </form>

          {createResult && (
            <div className="mt-4 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50">
              <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300 mb-2">Organization created!</p>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 w-20">Invite Link:</span>
                  <code className="flex-1 text-xs bg-white dark:bg-gray-800 px-3 py-1.5 rounded-lg font-mono text-gray-700 dark:text-gray-300 truncate">
                    {window.location.origin}{createResult.inviteUrl}
                  </code>
                  <button onClick={() => copyInviteLink(createResult.inviteUrl)} className="btn-secondary text-xs px-2 py-1 flex items-center gap-1">
                    {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
                {createResult.password && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-20">Temp Password:</span>
                    <code className="text-xs bg-white dark:bg-gray-800 px-3 py-1.5 rounded-lg font-mono text-amber-600">{createResult.password}</code>
                  </div>
                )}
              </div>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2">Share the invite link with the customer admin.</p>
            </div>
          )}
        </div>
      )}

      {/* Organizations List */}
      <div className="glass-card glow-card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Organizations ({orgs.length})</h2>
        </div>

        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {orgs.map(org => (
            <div key={org.id}>
              <div className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                <div className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer" onClick={() => loadOrgUsers(org.id)}>
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm font-bold ${org.is_active ? 'bg-gradient-to-br from-brand-400 to-brand-600' : 'bg-gray-400'}`}>
                    {org.name[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                      {org.name}
                      {!org.is_active && <span className="ml-2 text-xs text-red-500 font-normal">Disabled</span>}
                    </p>
                    <p className="text-xs text-gray-400">{org.admin_email || org.slug} &middot; {formatDate(org.created_at)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span>{org.user_count} users</span>
                  <span>{org.scan_count} scans</span>
                  <span>{org.finding_count} findings</span>
                  <button onClick={() => handleToggle(org.id, org.is_active)} title={org.is_active ? 'Disable' : 'Enable'}
                    className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700">
                    {org.is_active ? <ToggleRight className="w-5 h-5 text-emerald-500" /> : <ToggleLeft className="w-5 h-5 text-gray-400" />}
                  </button>
                  {confirmDelete === org.id ? (
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleDelete(org.id)} className="px-2 py-1 bg-red-600 text-white rounded text-xs">Confirm</button>
                      <button onClick={() => setConfirmDelete(null)} className="px-2 py-1 text-gray-400 text-xs">Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDelete(org.id)} className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/20">
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  )}
                  <button onClick={() => loadOrgUsers(org.id)} className="p-1">
                    {expandedOrg === org.id ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </button>
                </div>
              </div>

              {/* Expanded user list */}
              {expandedOrg === org.id && (
                <div className="px-6 pb-4 pl-16">
                  {!orgUsers[org.id] ? (
                    <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                  ) : (
                    <div className="space-y-2">
                      {orgUsers[org.id].length === 0 && <p className="text-xs text-gray-400">No users</p>}
                      {orgUsers[org.id].map(u => (
                        <div key={u.id} className="flex items-center justify-between text-xs py-1">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[10px] font-bold text-gray-600 dark:text-gray-400">
                              {(u.name || u.email)[0].toUpperCase()}
                            </div>
                            <span className="text-gray-700 dark:text-gray-300">{u.name || u.email}</span>
                            <span className="text-gray-400">{u.email}</span>
                          </div>
                          <div className="flex items-center gap-3 text-gray-400">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${u.role === 'admin' ? 'bg-brand-100 dark:bg-brand-900/30 text-brand-600' : 'bg-gray-100 dark:bg-gray-800'}`}>
                              {u.role}
                            </span>
                            <span>{u.last_login_at ? formatDate(u.last_login_at) : 'Never'}</span>
                            {confirmDeleteUser === u.id ? (
                              <div className="flex items-center gap-1">
                                <button onClick={() => handleDeleteUser(org.id, u.id)} className="px-2 py-0.5 bg-red-600 text-white rounded text-[10px]">Delete</button>
                                <button onClick={() => setConfirmDeleteUser(null)} className="text-[10px] text-gray-400">Cancel</button>
                              </div>
                            ) : (
                              <button onClick={() => setConfirmDeleteUser(u.id)} className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/20">
                                <Trash2 className="w-3 h-3 text-red-400" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}

                      {/* Add User Button / Form */}
                      {showAddUser === org.id ? (
                        <form onSubmit={(e) => handleAddUser(e, org.id)} className="mt-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl space-y-2">
                          <div className="grid grid-cols-3 gap-2">
                            <input value={addUserForm.email} onChange={(e) => setAddUserForm(f => ({ ...f, email: e.target.value }))}
                              placeholder="Email" type="email" required
                              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500" />
                            <input value={addUserForm.name} onChange={(e) => setAddUserForm(f => ({ ...f, name: e.target.value }))}
                              placeholder="Name" required
                              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500" />
                            <select value={addUserForm.role} onChange={(e) => setAddUserForm(f => ({ ...f, role: e.target.value }))}
                              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 text-xs focus:outline-none">
                              <option value="member">Member</option>
                              <option value="admin">Admin</option>
                            </select>
                          </div>
                          {addUserError && <p className="text-[10px] text-red-500">{addUserError}</p>}
                          {addUserResult?.tempPassword && (
                            <p className="text-[10px] text-amber-600">Temp password: <code className="bg-white dark:bg-gray-800 px-1 rounded">{addUserResult.tempPassword}</code></p>
                          )}
                          <div className="flex gap-2">
                            <button type="submit" disabled={addingUser} className="px-3 py-1 bg-brand-600 text-white text-xs rounded-lg hover:bg-brand-700 disabled:opacity-50 flex items-center gap-1">
                              {addingUser ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserPlus className="w-3 h-3" />} Add User
                            </button>
                            <button type="button" onClick={() => { setShowAddUser(null); setAddUserError(''); setAddUserResult(null); }}
                              className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                          </div>
                        </form>
                      ) : (
                        <button onClick={() => { setShowAddUser(org.id); setAddUserForm({ email: '', name: '', role: 'member' }); setAddUserError(''); setAddUserResult(null); }}
                          className="mt-2 flex items-center gap-1 text-xs text-brand-600 dark:text-brand-400 hover:underline">
                          <UserPlus className="w-3 h-3" /> Add User
                        </button>
                      )}

                      {/* Limits */}
                      <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
                        {editingLimits === org.id ? (
                          <div className="space-y-2">
                            <p className="text-[10px] font-bold text-gray-400 uppercase">Organization Limits</p>
                            <div className="grid grid-cols-3 gap-3">
                              {[
                                { key: 'maxUsers', label: 'Max Users' },
                                { key: 'maxRepos', label: 'Max Repos' },
                                { key: 'maxScansPerMonth', label: 'Scans/Month' },
                              ].map(({ key, label }) => (
                                <div key={key}>
                                  <label className="text-[10px] text-gray-500 mb-0.5 block">{label}</label>
                                  <div className="flex items-center gap-1">
                                    <input type="number" value={limitsForm[key] === -1 ? '' : limitsForm[key]}
                                      onChange={(e) => setLimitsForm(f => ({ ...f, [key]: e.target.value === '' ? -1 : parseInt(e.target.value) || 0 }))}
                                      placeholder="Unlimited"
                                      className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500" />
                                    <button onClick={() => setLimitsForm(f => ({ ...f, [key]: -1 }))}
                                      className={`text-[9px] px-1.5 py-1 rounded whitespace-nowrap ${limitsForm[key] === -1 ? 'bg-brand-100 dark:bg-brand-900/30 text-brand-600' : 'text-gray-400 hover:text-brand-500'}`}>
                                      {limitsForm[key] === -1 ? '∞' : '∞'}
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div className="flex gap-2 mt-2">
                              <button onClick={() => handleSaveLimits(org.id)} disabled={savingLimits}
                                className="px-3 py-1 bg-brand-600 text-white text-xs rounded-lg hover:bg-brand-700 disabled:opacity-50">
                                {savingLimits ? 'Saving...' : 'Save Limits'}
                              </button>
                              <button onClick={() => setEditingLimits(null)} className="text-xs text-gray-400">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-4">
                            <p className="text-[10px] font-bold text-gray-400 uppercase">Limits:</p>
                            {[
                              { key: 'maxUsers', label: 'Users' },
                              { key: 'maxRepos', label: 'Repos' },
                              { key: 'maxScansPerMonth', label: 'Scans/mo' },
                            ].map(({ key, label }) => {
                              const v = org.limits?.[key] ?? -1;
                              return (
                                <span key={key} className="text-[10px] text-gray-500">
                                  {label}: <span className="font-semibold text-gray-700 dark:text-gray-300">{v === -1 ? '∞' : v}</span>
                                </span>
                              );
                            })}
                            <button onClick={() => startEditLimits(org)} className="text-[10px] text-brand-600 dark:text-brand-400 hover:underline">Edit</button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          {orgs.length === 0 && (
            <div className="px-6 py-12 text-center text-gray-400">No organizations yet. Create one above.</div>
          )}
        </div>
      </div>
      </div>
      )}

      {/* ── Requests Tab ── */}
      {tab === 'requests' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Demo Requests ({contactRequests.length})</h2>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> New</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Contacted</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-400" /> Closed</span>
            </div>
          </div>

          {contactRequests.length === 0 ? (
            <div className="glass-card glow-card px-6 py-12 text-center text-gray-400">No demo requests yet.</div>
          ) : (
            contactRequests.map(r => (
              <div key={r.id} className={`glass-card glow-card overflow-hidden transition-all duration-300 ${
                r.status === 'new' ? 'border-l-4 border-l-blue-500' : r.status === 'contacted' ? 'border-l-4 border-l-amber-500' : 'border-l-4 border-l-gray-300 dark:border-l-gray-600 opacity-70'
              }`}>
                {/* Header row — always visible */}
                <div className="px-5 py-4 flex items-center gap-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
                  onClick={() => setExpandedRequest(expandedRequest === r.id ? null : r.id)}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{r.name}</p>
                      {r.company && <span className="text-xs px-2 py-0.5 rounded-full bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400">{r.company}</span>}
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                        r.status === 'new' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' :
                        r.status === 'contacted' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' :
                        'bg-gray-100 dark:bg-gray-800 text-gray-500'
                      }`}>{r.status}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{r.email} &middot; {formatDate(r.created_at)}</p>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${expandedRequest === r.id ? 'rotate-180' : ''}`} />
                </div>

                {/* Expanded details */}
                {expandedRequest === r.id && (
                  <div className="px-5 pb-4 pt-0 border-t border-gray-100 dark:border-gray-800">
                    <div className="grid grid-cols-2 gap-4 mt-3">
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase font-semibold mb-1">Name</p>
                        <p className="text-sm text-gray-700 dark:text-gray-300">{r.name}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase font-semibold mb-1">Email</p>
                        <a href={`mailto:${r.email}`} className="text-sm text-brand-600 dark:text-brand-400 hover:underline">{r.email}</a>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase font-semibold mb-1">Company</p>
                        <p className="text-sm text-gray-700 dark:text-gray-300">{r.company || '—'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase font-semibold mb-1">Submitted</p>
                        <p className="text-sm text-gray-700 dark:text-gray-300">{new Date(r.created_at).toLocaleString()}</p>
                      </div>
                    </div>
                    {r.message && (
                      <div className="mt-3">
                        <p className="text-[10px] text-gray-400 uppercase font-semibold mb-1">Message</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3">{r.message}</p>
                      </div>
                    )}
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">Status:</span>
                        <select value={r.status} onChange={(e) => updateContactStatus(r.id, e.target.value)}
                          className="text-xs bg-transparent border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-500">
                          <option value="new">New</option>
                          <option value="contacted">Contacted</option>
                          <option value="closed">Closed</option>
                        </select>
                      </div>
                      {confirmDeleteReq === r.id ? (
                        <div className="flex items-center gap-2">
                          <button onClick={() => deleteContactRequest(r.id)} className="px-3 py-1 bg-red-600 text-white text-xs rounded-lg">Delete</button>
                          <button onClick={() => setConfirmDeleteReq(null)} className="text-xs text-gray-400">Cancel</button>
                        </div>
                      ) : (
                        <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteReq(r.id); }}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Settings Tab ── */}
      {tab === 'settings' && (
        <div className="glass-card glow-card p-6 max-w-xl">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">Notifications</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <MessageSquare className="w-4 h-4 inline mr-1 text-[#E01E5A]" />
                Slack Webhook for Demo Requests
              </label>
              <p className="text-xs text-gray-400 mb-2">Get notified in Slack when someone submits a demo request.</p>
              <div className="flex gap-2">
                <input value={slackWebhook} onChange={(e) => setSlackWebhook(e.target.value)}
                  placeholder="https://hooks.slack.com/services/..."
                  className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500" />
                <button onClick={saveSlackWebhook} disabled={savingWebhook}
                  className="btn-primary text-sm px-4">
                  {savingWebhook ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
