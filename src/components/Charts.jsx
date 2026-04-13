import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
  AreaChart, Area, CartesianGrid,
} from 'recharts';
import { severityColors, groupBy } from '../lib/utils';

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low'];
const GRADIENT_COLORS = ['#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#10b981', '#f59e0b', '#ef4444'];

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 shadow-xl text-sm">
      <p className="font-semibold text-gray-800 dark:text-gray-200">{label || payload[0]?.name}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-gray-500 dark:text-gray-400 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color || p.fill }} />
          {p.value} {p.dataKey === 'count' ? 'findings' : p.name || 'findings'}
        </p>
      ))}
    </div>
  );
}

export function SeverityPieChart({ findings }) {
  const grouped = groupBy(findings, (f) => f.severity);
  const data = SEVERITY_ORDER
    .filter((s) => grouped[s])
    .map((s) => ({ name: s.charAt(0).toUpperCase() + s.slice(1), value: grouped[s].length, severity: s }));

  if (data.length === 0) return null;

  return (
    <div className="glass-card p-6">
      <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
        By Severity
      </h3>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={4} dataKey="value" strokeWidth={0}>
            {data.map((entry) => (
              <Cell key={entry.severity} fill={severityColors[entry.severity]?.bg || '#999'} className="drop-shadow-md" />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip />} />
          <Legend formatter={(value) => <span className="text-xs text-gray-600 dark:text-gray-400">{value}</span>} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SecretTypeBarChart({ findings }) {
  const grouped = groupBy(findings, (f) => f.secretType);
  const data = Object.entries(grouped)
    .map(([name, items]) => ({ name: name.length > 20 ? name.slice(0, 20) + '...' : name, fullName: name, count: items.length }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  if (data.length === 0) return null;

  return (
    <div className="glass-card p-6">
      <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
        Top Secret Types
      </h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20 }}>
          <defs>
            <linearGradient id="barGradBlue" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#06b6d4" />
              <stop offset="100%" stopColor="#3b82f6" />
            </linearGradient>
          </defs>
          <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} width={120} axisLine={false} tickLine={false} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(99, 102, 241, 0.08)', radius: 8 }} />
          <Bar dataKey="count" fill="url(#barGradBlue)" radius={[0, 8, 8, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RepoBarChart({ findings }) {
  const grouped = groupBy(findings, (f) => f.repo);
  const data = Object.entries(grouped)
    .map(([name, items]) => ({
      name: name.includes('/') ? name.split('/')[1] : name,
      fullName: name, count: items.length,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  if (data.length === 0) return null;

  return (
    <div className="glass-card p-6">
      <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
        Top Repositories
      </h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20 }}>
          <defs>
            <linearGradient id="barGradOrange" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#f97316" />
              <stop offset="100%" stopColor="#ef4444" />
            </linearGradient>
          </defs>
          <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} width={120} axisLine={false} tickLine={false} />
          <Tooltip
            cursor={{ fill: 'rgba(249, 115, 22, 0.08)', radius: 8 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              return (
                <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 shadow-xl text-sm">
                  <p className="font-semibold text-gray-800 dark:text-gray-200">{payload[0]?.payload?.fullName}</p>
                  <p className="text-gray-500">{payload[0]?.value} findings</p>
                </div>
              );
            }}
          />
          <Bar dataKey="count" fill="url(#barGradOrange)" radius={[0, 8, 8, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---- Dashboard Charts ----

export function SeverityBreakdownChart({ bySeverity }) {
  const data = SEVERITY_ORDER
    .map(s => ({ name: s.charAt(0).toUpperCase() + s.slice(1), value: bySeverity[s] || 0, severity: s }))
    .filter(d => d.value > 0);

  if (data.length === 0) return null;

  const total = data.reduce((a, b) => a + b.value, 0);

  return (
    <div className="glass-card glow-card p-6">
      <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">Severity Breakdown</h3>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value" strokeWidth={0}>
            {data.map(e => <Cell key={e.severity} fill={severityColors[e.severity]?.bg || '#999'} />)}
          </Pie>
          <Tooltip content={<ChartTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex justify-center gap-4 mt-2">
        {data.map(d => (
          <div key={d.severity} className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: severityColors[d.severity]?.bg }} />
            {d.name} ({Math.round(d.value / total * 100)}%)
          </div>
        ))}
      </div>
    </div>
  );
}

export function FindingsByRepoChart({ byRepo }) {
  if (!byRepo || byRepo.length === 0) return null;
  const data = byRepo.slice(0, 8).map((r, i) => ({
    name: (r.repo || '').includes('/') ? r.repo.split('/')[1] : r.repo,
    findings: parseInt(r.count),
    fill: GRADIENT_COLORS[i % GRADIENT_COLORS.length],
  }));

  return (
    <div className="glass-card glow-card p-6">
      <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">Findings by Repository</h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ left: 0, right: 10 }}>
          <defs>
            <linearGradient id="barGradCyan" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.9} />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.6} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(156,163,175,0.15)" />
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(6, 182, 212, 0.06)', radius: 4 }} />
          <Bar dataKey="findings" radius={[6, 6, 0, 0]} maxBarSize={40}>
            {data.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function StatusDistributionChart({ byStatus }) {
  if (!byStatus || byStatus.length === 0) return null;

  const statusColors = {
    open: '#ef4444', acknowledged: '#3b82f6', resolved: '#10b981', false_positive: '#9ca3af',
  };
  const statusLabels = { open: 'Open', acknowledged: 'Acknowledged', resolved: 'Remediated', false_positive: 'False Positive' };
  const data = byStatus.map(s => ({
    name: statusLabels[s.status] || s.status, value: parseInt(s.count), status: s.status,
  }));
  const total = data.reduce((a, b) => a + b.value, 0);

  return (
    <div className="glass-card glow-card p-6">
      <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">Finding Status</h3>
      {/* Stacked bar visual */}
      <div className="h-8 rounded-full overflow-hidden flex mb-4">
        {data.map(d => (
          <div key={d.status} style={{ width: `${(d.value / total) * 100}%`, background: statusColors[d.status] || '#999' }}
            title={`${d.name}: ${d.value}`} className="transition-all duration-500" />
        ))}
      </div>
      <div className="flex flex-wrap gap-4">
        {data.map(d => (
          <div key={d.status} className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: statusColors[d.status] || '#999' }} />
            {d.name}: <span className="font-semibold text-gray-700 dark:text-gray-300">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ScanActivityChart({ recentScans }) {
  if (!recentScans || recentScans.length === 0) return null;

  const data = [...recentScans].reverse().map(s => ({
    name: new Date(s.started_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    findings: s.total_findings || 0,
    repos: s.total_repos || 0,
  }));

  return (
    <div className="glass-card glow-card p-6">
      <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">Recent Scan Activity</h3>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ left: 0, right: 10 }}>
          <defs>
            <linearGradient id="areaGradFindings" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="areaGradRepos" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(156,163,175,0.15)" />
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
          <Tooltip content={<ChartTooltip />} />
          <Area type="monotone" dataKey="findings" stroke="#ef4444" fill="url(#areaGradFindings)" strokeWidth={2} name="Findings" />
          <Area type="monotone" dataKey="repos" stroke="#06b6d4" fill="url(#areaGradRepos)" strokeWidth={2} name="Repos" />
          <Legend formatter={(v) => <span className="text-xs text-gray-500">{v}</span>} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
