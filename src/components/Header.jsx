import { useState, useEffect, useRef } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { LogOut, ChevronDown, Settings, LayoutDashboard, Search, AlertTriangle, Plus, Users, ScrollText, ShieldCheck, Bell } from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import UserAvatar from './UserAvatar';
import logoImg from '../assets/logo.png';
import { useAuth } from '../context/AuthContext';

export default function Header({ darkMode, setDarkMode }) {
  const { user, org, logout, authFetch } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const [requests, setRequests] = useState([]);
  const navigate = useNavigate();
  const notifsRef = useRef(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e) => {
      if (notifsRef.current && !notifsRef.current.contains(e.target)) setShowNotifs(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const newRequests = requests.filter(r => r.status === 'new');

  // Poll for new contact requests (super admin only) — every 15s
  useEffect(() => {
    if (!user?.isSuperAdmin) return;
    const load = () => authFetch('/api/contact').then(r => r.ok ? r.json() : []).then(data => {
      if (Array.isArray(data)) setRequests(data);
    }).catch(() => {});
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [user?.isSuperAdmin, authFetch]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navLinkClass = ({ isActive }) =>
    `flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
      isActive
        ? 'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400'
        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
    }`;

  return (
    <header className="sticky top-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-200/50 dark:border-gray-700/50 header-animated">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/dashboard" className="flex items-center gap-2.5">
            <img src={logoImg} alt="SecretSweep" className="w-9 h-9 object-contain logo-glow" />
            <div>
              <h1 className="text-lg font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent leading-tight">SecretSweep</h1>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 -mt-0.5 font-medium">{org?.name || 'Secret Detection'}</p>
            </div>
          </Link>

          {/* Center nav */}
          <nav className="hidden md:flex items-center gap-1">
            <NavLink to="/dashboard" className={navLinkClass}>
              <LayoutDashboard className="w-4 h-4" /> Dashboard
            </NavLink>
            <NavLink to="/scans" className={navLinkClass}>
              <Search className="w-4 h-4" /> Scans
            </NavLink>
            <NavLink to="/findings" className={navLinkClass}>
              <AlertTriangle className="w-4 h-4" /> Findings
            </NavLink>
            <Link to="/scans/new" className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors">
              <Plus className="w-4 h-4" /> New Scan
            </Link>
            {user?.isSuperAdmin && (
              <NavLink to="/admin" className={navLinkClass}>
                <ShieldCheck className="w-4 h-4" /> Admin
              </NavLink>
            )}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-2">
            <ThemeToggle darkMode={darkMode} setDarkMode={setDarkMode} />

            {/* Notification bell (super admin) */}
            {user?.isSuperAdmin && (
              <div className="relative" ref={notifsRef}>
                <button onClick={() => { setShowNotifs(!showNotifs); setShowUserMenu(false); }}
                  className="relative p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                  <Bell className={`w-5 h-5 ${newRequests.length > 0 ? 'text-brand-600 dark:text-brand-400' : 'text-gray-500 dark:text-gray-400'}`} />
                  {newRequests.length > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                      {newRequests.length > 9 ? '9+' : newRequests.length}
                    </span>
                  )}
                </button>

                {showNotifs && (
                  <div className="absolute right-0 mt-2 w-80 glass-card p-0 z-50 overflow-hidden animate-fade-in">
                    <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">Notifications</span>
                      {newRequests.length > 0 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-semibold">{newRequests.length} new</span>}
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {requests.length === 0 ? (
                        <div className="px-4 py-8 text-center text-sm text-gray-400">No notifications</div>
                      ) : (
                        requests.slice(0, 10).map(r => (
                          <Link key={r.id} to="/admin" onClick={() => setShowNotifs(false)}
                            className={`block px-4 py-3 border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors cursor-pointer ${r.status === 'new' ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}>
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full shrink-0 ${r.status === 'new' ? 'bg-blue-500' : r.status === 'contacted' ? 'bg-amber-500' : 'bg-gray-300'}`} />
                              <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{r.name}</span>
                              {r.company && <span className="text-[10px] text-brand-500 truncate">{r.company}</span>}
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5 pl-4">{r.email} &middot; {new Date(r.created_at).toLocaleDateString()}</p>
                            {r.message && <p className="text-xs text-gray-500 mt-1 pl-4 truncate">{r.message}</p>}
                          </Link>
                        ))
                      )}
                    </div>
                    <Link to="/admin" onClick={() => { setShowNotifs(false); }}
                      className="block px-4 py-2.5 text-center text-xs font-medium text-brand-600 dark:text-brand-400 hover:bg-gray-50 dark:hover:bg-gray-800 border-t border-gray-100 dark:border-gray-800 transition-colors">
                      View all in Admin Panel
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* User menu */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <UserAvatar user={{ name: user?.name, login: user?.email }} size="sm" />
                <span className="hidden sm:block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {user?.name || user?.email}
                </span>
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </button>

              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-56 glass-card p-2 animate-slide-in z-50">
                  <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800 mb-1">
                    <div className="font-medium text-sm text-gray-800 dark:text-gray-200">{user?.name}</div>
                    <div className="text-xs text-gray-400">{user?.email}</div>
                    <div className="text-xs text-brand-500 mt-0.5 capitalize">{user?.role}</div>
                  </div>
                  <Link
                    to="/settings"
                    onClick={() => setShowUserMenu(false)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <Settings className="w-4 h-4" /> Settings
                  </Link>
                  {user?.role === 'admin' && (
                    <>
                      <Link
                        to="/settings/team"
                        onClick={() => setShowUserMenu(false)}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      >
                        <Users className="w-4 h-4" /> Team
                      </Link>
                      <Link
                        to="/audit-log"
                        onClick={() => setShowUserMenu(false)}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      >
                        <ScrollText className="w-4 h-4" /> Activity Log
                      </Link>
                    </>
                  )}
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <LogOut className="w-4 h-4" /> Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
