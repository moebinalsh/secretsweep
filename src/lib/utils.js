// Mask a secret value for display
export function maskSecret(line) {
  // Replace potential secret values with masked versions
  return line
    .replace(/(AKIA[0-9A-Z]{16})/g, (m) => m.slice(0, 8) + '*'.repeat(m.length - 8))
    .replace(/(ghp_|gho_|ghu_|ghs_|ghr_)([a-zA-Z0-9]{36,})/g, (m, prefix) => prefix + '*'.repeat(12) + '...')
    .replace(/(sk_live_|pk_live_)([a-zA-Z0-9]{24,})/g, (m, prefix) => prefix + '*'.repeat(12) + '...')
    .replace(/(sk-[a-zA-Z0-9]{8})[a-zA-Z0-9]+/g, '$1' + '*'.repeat(12) + '...')
    .replace(/(SG\.[a-zA-Z0-9_-]{6})[a-zA-Z0-9_-]+/g, '$1' + '*'.repeat(12) + '...')
    .replace(/(xox[bporas]-[0-9]{4})[0-9a-zA-Z-]+/g, '$1' + '*'.repeat(12) + '...')
    .replace(/(mongodb\+?s?rv?:\/\/[^:]+:)[^@]+(@)/g, '$1****$2')
    .replace(/(postgres(?:ql)?:\/\/[^:]+:)[^@]+(@)/g, '$1****$2')
    .replace(/(mysql:\/\/[^:]+:)[^@]+(@)/g, '$1****$2')
    .replace(/(redis:\/\/[^:]*:)[^@]+(@)/g, '$1****$2')
    .replace(/(password|passwd|secret|secret_key|api_key|apikey|token)\s*[=:]\s*['"]?([^\s'"]{4})[^\s'"]+/gi,
      (m, key, start) => `${key}=${start}${'*'.repeat(12)}...`);
}

// Severity sort order
const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };

export function sortBySeverity(a, b) {
  return (severityOrder[a.severity] || 99) - (severityOrder[b.severity] || 99);
}

// Format date
export function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// Generate CSV from findings
export function generateCSV(findings) {
  const headers = [
    'Severity', 'Status', 'Secret Type', 'Repository', 'File', 'Line',
    'Description', 'Author', 'Author Login', 'Commit Date', 'Commit SHA',
    'Commit URL', 'File URL', 'Found Date', 'Remediated Date',
    'Matching Code (Masked)',
  ];

  const rows = findings.map((f) => [
    f.severity,
    f.status || 'open',
    f.secretType || f.secret_type || '',
    f.repo,
    f.file,
    f.line || '',
    f.description || '',
    f.commit_author || f.commit?.author || '',
    f.commit_author_login || f.commit?.authorLogin || '',
    f.commit_date || f.commit?.date || '',
    f.commit_sha || f.commit?.sha || '',
    f.commit_url || f.commit?.url || '',
    f.fileUrl || f.file_url || '',
    f.created_at || '',
    f.resolved_at || '',
    maskSecret((f.matchingLines || f.matching_lines)?.[0] || ''),
  ]);

  const escape = (val) => {
    const str = String(val == null ? '' : val).replace(/"/g, '""');
    return `"${str}"`;
  };

  return [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))].join('\n');
}

// Severity color map
export const severityColors = {
  critical: { bg: '#ef4444', light: '#fecaca', text: '#991b1b' },
  high: { bg: '#f97316', light: '#fed7aa', text: '#9a3412' },
  medium: { bg: '#eab308', light: '#fef08a', text: '#854d0e' },
  low: { bg: '#3b82f6', light: '#bfdbfe', text: '#1e40af' },
};

// Group findings by a key
export function groupBy(arr, keyFn) {
  return arr.reduce((acc, item) => {
    const key = keyFn(item);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
}
