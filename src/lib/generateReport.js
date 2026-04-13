import { formatDate } from './utils';

const SEV = {
  critical: { bg: '#fef2f2', text: '#991b1b', border: '#fecaca', bar: '#ef4444', label: 'Critical' },
  high: { bg: '#fff7ed', text: '#9a3412', border: '#fed7aa', bar: '#f97316', label: 'High' },
  medium: { bg: '#fefce8', text: '#854d0e', border: '#fef08a', bar: '#eab308', label: 'Medium' },
  low: { bg: '#eff6ff', text: '#1e40af', border: '#bfdbfe', bar: '#3b82f6', label: 'Low' },
};
const ST = { open: { color: '#dc2626', bg: '#fef2f2', label: 'Open' }, acknowledged: { color: '#2563eb', bg: '#eff6ff', label: 'Acknowledged' }, resolved: { color: '#059669', bg: '#f0fdf4', label: 'Remediated' }, false_positive: { color: '#6b7280', bg: '#f9fafb', label: 'False Positive' } };

export function generatePDFReport(findings, scanInfo = {}, orgName = 'Organization', logoDataUrl = null) {
  const now = new Date();
  const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const all = findings;
  const open = all.filter(f => !f.status || f.status === 'open' || f.status === 'acknowledged');
  const remediated = all.filter(f => f.status === 'resolved' || f.status === 'false_positive');
  const bySev = {}; open.forEach(f => { bySev[f.severity] = (bySev[f.severity] || 0) + 1; });
  const byStatus = {}; all.forEach(f => { const s = f.status || 'open'; byStatus[s] = (byStatus[s] || 0) + 1; });
  const byRepo = {}; open.forEach(f => { byRepo[f.repo] = (byRepo[f.repo] || 0) + 1; });
  const topRepos = Object.entries(byRepo).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const repoColors = ['#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#10b981', '#f59e0b', '#ef4444'];
  const target = scanInfo?.github_org?.replace('__user__:', '') || '';

  const logoHtml = logoDataUrl
    ? `<img src="${logoDataUrl}" style="width:56px;height:56px;object-fit:contain;filter:drop-shadow(0 0 8px rgba(6,182,212,0.5))" />`
    : '';

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>SecretSweep Report — ${esc(orgName)}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1e293b;background:#fff;font-size:12px;line-height:1.5;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{max-width:1100px;margin:0 auto;padding:32px}

.header{background:#0f172a;color:#fff;padding:28px 32px;border-radius:12px;margin-bottom:24px;display:flex;justify-content:space-between;align-items:center}
.header-left{display:flex;align-items:center;gap:14px}
.header h1{font-size:22px;font-weight:800;color:#22d3ee}
.header .sub{color:#94a3b8;font-size:11px;margin-top:2px}
.header-right{text-align:right;color:#94a3b8;font-size:11px;line-height:1.7}
.header-right strong{color:#fff;font-size:13px}

.cards{display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin-bottom:20px}
.card{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:14px 10px;text-align:center;border-top:3px solid #e2e8f0}
.card .v{font-size:24px;font-weight:800}
.card .l{font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin-top:2px}

.bar-section{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px}
.bar-card{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:16px}
.bar-card h3{font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px;font-weight:700}
.br{display:flex;align-items:center;gap:6px;margin-bottom:6px}
.br .bl{width:110px;font-size:10px;color:#475569;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.br .bt{flex:1;height:14px;background:#f1f5f9;border-radius:99px;overflow:hidden}
.br .bf{height:100%;border-radius:99px;min-width:1px}
.br .bc{width:24px;text-align:right;font-size:10px;font-weight:700;color:#1e293b}

.status-row{display:flex;align-items:center;gap:10px;margin-bottom:20px;padding:10px 16px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0}
.status-bar{flex:1;height:8px;border-radius:99px;overflow:hidden;display:flex}
.status-legend{display:flex;gap:12px;font-size:10px;color:#64748b}
.status-legend .d{width:7px;height:7px;border-radius:50%;display:inline-block;margin-right:3px}

.stitle{font-size:13px;font-weight:700;margin-bottom:10px;padding-bottom:6px;border-bottom:2px solid #e2e8f0;color:#0f172a}

table{width:100%;border-collapse:collapse;margin-bottom:24px;font-size:10px}
thead th{background:#f1f5f9;padding:6px 8px;text-align:left;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.03em;font-size:8px;border-bottom:2px solid #e2e8f0}
tbody td{padding:5px 8px;border-bottom:1px solid #f1f5f9;vertical-align:top}
tbody tr:nth-child(even){background:#fafbfc}
.badge{display:inline-block;padding:1px 7px;border-radius:99px;font-size:8px;font-weight:700;text-transform:uppercase}
.mono{font-family:'SF Mono','Fira Code',monospace;font-size:9px}
td.desc{max-width:180px;word-wrap:break-word;white-space:normal}

.footer{text-align:center;color:#94a3b8;font-size:10px;padding:16px 0;border-top:1px solid #e2e8f0;margin-top:24px}
.footer strong{color:#475569}

@page{margin:10mm;size:A4 landscape}
@media print{
  body{background:#fff !important}
  .page{padding:8px}
  .header{background:#0f172a !important;color:#fff !important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .header h1{color:#22d3ee !important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .card,.bar-card,.status-row{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .badge{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  thead th{background:#f1f5f9 !important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  tbody tr:nth-child(even){background:#fafbfc !important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .bf{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .status-bar>div{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .d{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  table{page-break-inside:auto}
  tr{page-break-inside:avoid}
  .cards,.bar-section,.status-row{page-break-inside:avoid}
}
</style>
</head>
<body>
<div class="page">

<div class="header">
  <div class="header-left">
    ${logoHtml}
    <div>
      <h1>SecretSweep</h1>
      <div class="sub">Secret Scanning Report</div>
    </div>
  </div>
  <div class="header-right">
    <strong>${esc(orgName)}</strong><br>
    ${target ? `Target: ${esc(target)}<br>` : ''}
    ${scanInfo?.scan_mode ? `Mode: ${esc(scanInfo.scan_mode)}<br>` : ''}
    ${now.toLocaleDateString()} ${now.toLocaleTimeString()}
  </div>
</div>

<div class="cards">
  <div class="card" style="border-top-color:#2563eb"><div class="v" style="color:#2563eb">${open.length}</div><div class="l">Open</div></div>
  <div class="card" style="border-top-color:#ef4444"><div class="v" style="color:#dc2626">${bySev.critical || 0}</div><div class="l">Critical</div></div>
  <div class="card" style="border-top-color:#f97316"><div class="v" style="color:#ea580c">${bySev.high || 0}</div><div class="l">High</div></div>
  <div class="card" style="border-top-color:#eab308"><div class="v" style="color:#ca8a04">${(bySev.medium || 0) + (bySev.low || 0)}</div><div class="l">Med/Low</div></div>
  <div class="card" style="border-top-color:#10b981"><div class="v" style="color:#059669">${remediated.length}</div><div class="l">Remediated</div></div>
  <div class="card" style="border-top-color:#6366f1"><div class="v" style="color:#4f46e5">${all.length}</div><div class="l">Total</div></div>
</div>

<div class="status-row">
  <div class="status-bar">${Object.entries(byStatus).map(([s, c]) => `<div style="width:${(c / Math.max(all.length, 1)) * 100}%;background:${ST[s]?.color || '#999'}"></div>`).join('')}</div>
  <div class="status-legend">${Object.entries(byStatus).map(([s, c]) => `<span><span class="d" style="background:${ST[s]?.color || '#999'}"></span>${ST[s]?.label || s}: ${c}</span>`).join('')}</div>
</div>

<div class="bar-section">
  <div class="bar-card">
    <h3>By Severity</h3>
    ${['critical', 'high', 'medium', 'low'].filter(s => bySev[s]).map(s => {
      const max = Math.max(...Object.values(bySev), 1);
      return `<div class="br"><div class="bl">${SEV[s].label}</div><div class="bt"><div class="bf" style="width:${(bySev[s] / max) * 100}%;background:${SEV[s].bar}"></div></div><div class="bc">${bySev[s]}</div></div>`;
    }).join('')}
  </div>
  <div class="bar-card">
    <h3>Top Repositories</h3>
    ${topRepos.length === 0 ? '<div style="color:#94a3b8">No findings</div>' : topRepos.map(([repo, count], i) => {
      const max = topRepos[0][1] || 1;
      return `<div class="br"><div class="bl">${esc(repo.includes('/') ? repo.split('/')[1] : repo)}</div><div class="bt"><div class="bf" style="width:${(count / max) * 100}%;background:${repoColors[i % repoColors.length]}"></div></div><div class="bc">${count}</div></div>`;
    }).join('')}
  </div>
</div>

<h2 class="stitle">Findings Detail (${all.length})</h2>
<table>
<thead><tr>
  <th>Severity</th><th>Status</th><th>Type</th><th>Repository</th><th>File</th>
  <th>Author</th><th>Committed</th><th>Found</th><th>Remediated</th><th>Description</th>
</tr></thead>
<tbody>
${all.map(f => {
  const sev = f.severity || 'low'; const s = SEV[sev] || SEV.low;
  const st = f.status || 'open'; const stc = ST[st] || ST.open;
  return `<tr>
    <td><span class="badge" style="background:${s.bg};color:${s.text};border:1px solid ${s.border}">${s.label}</span></td>
    <td><span class="badge" style="background:${stc.bg};color:${stc.color}">${stc.label}</span></td>
    <td>${esc(f.secretType || f.secret_type || '')}</td>
    <td>${esc(f.repo || '')}</td>
    <td class="mono">${esc(f.file || '')}${f.line ? ':' + f.line : ''}</td>
    <td>${esc(f.commit_author_login || f.commit_author || f.commit?.author || '—')}</td>
    <td>${formatDate(f.commit_date || f.commit?.date) || '—'}</td>
    <td>${formatDate(f.created_at) || '—'}</td>
    <td>${f.resolved_at ? formatDate(f.resolved_at) : '—'}</td>
    <td class="desc">${esc(f.description || '—')}</td>
  </tr>`;
}).join('')}
</tbody>
</table>

<div class="footer">
  <strong>SecretSweep</strong> — Secret Scanning Report<br>
  ${esc(orgName)} &bull; ${now.toLocaleDateString()} ${now.toLocaleTimeString()} &bull; ${all.length} finding(s)
</div>

</div>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (win) { win.onload = () => URL.revokeObjectURL(url); }
}
