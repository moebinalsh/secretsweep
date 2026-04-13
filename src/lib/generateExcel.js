import ExcelJS from 'exceljs';
import { maskSecret, formatDate } from './utils';
import logoImg from '../assets/logo.png';

const SEV_FILLS = { critical: 'FFFEF2F2', high: 'FFFFF7ED', medium: 'FFFEFCE8', low: 'FFEFF6FF' };
const SEV_FONTS = { critical: 'FF991B1B', high: 'FF9A3412', medium: 'FF854D0E', low: 'FF1E40AF' };
const ST_FONTS = { open: 'FFDC2626', acknowledged: 'FF2563EB', resolved: 'FF059669', false_positive: 'FF6B7280' };
const ST_LABELS = { open: 'Open', acknowledged: 'Acknowledged', resolved: 'Remediated', false_positive: 'False Positive' };
const STAT_COLORS = ['FF2563EB', 'FFDC2626', 'FFEA580C', 'FFCA8A04', 'FF059669', 'FF4F46E5'];

export async function generateExcelReport(findings, scanInfo = {}, orgName = 'Organization', repos = []) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SecretSweep';
  wb.created = new Date();

  const ws = wb.addWorksheet('SecretSweep Report', {
    properties: { tabColor: { argb: 'FF06B6D4' } },
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
  });

  const COLS = 14;
  const widths = [13, 14, 22, 20, 28, 7, 32, 16, 13, 13, 13, 12, 28, 36];
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  // Dark fill helper
  const darkFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  const whiteFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };

  let row = 1;

  // ---- Row 1: Logo + Title (tall row for the logo) ----
  ws.mergeCells(row, 1, row, 2); // logo area
  ws.mergeCells(row, 3, row, COLS); // title area
  ws.getRow(row).height = 50;

  // Add logo image into cells A1:B1
  try {
    const resp = await fetch(logoImg);
    const buf = await resp.arrayBuffer();
    const imgId = wb.addImage({ buffer: buf, extension: 'png' });
    ws.addImage(imgId, {
      tl: { col: 0.2, row: 0.1 },
      ext: { width: 44, height: 44 },
    });
  } catch {}

  // Title text in C1 — centered
  const titleCell = ws.getCell(row, 3);
  titleCell.value = 'SecretSweep — Secret Scanning Report';
  titleCell.font = { size: 16, bold: true, color: { argb: 'FF22D3EE' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  for (let c = 1; c <= COLS; c++) { ws.getCell(row, c).fill = darkFill; }
  row++;

  // ---- Row 2: Org + Provider + Target ----
  const target = scanInfo?.github_org?.replace('__user__:', '') || '';
  const provider = target.startsWith('__gitlab__') ? 'GitLab' : 'GitHub';
  const cleanTarget = target.replace('__gitlab__:', '');
  ws.mergeCells(row, 1, row, COLS);
  const infoCell = ws.getCell(row, 1);
  infoCell.value = `  Organization: ${orgName}  |  Provider: ${provider}  |  Target: ${cleanTarget || '—'}  |  Mode: ${scanInfo?.scan_mode || 'full'}  |  Generated: ${new Date().toLocaleString()}`;
  infoCell.font = { size: 9, color: { argb: 'FF94A3B8' } };
  infoCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
  infoCell.alignment = { vertical: 'middle' };
  ws.getRow(row).height = 22;
  row++;

  // ---- Row 3: Repos scanned (if available) ----
  const repoNames = repos?.length > 0 ? repos.map(r => r.name || r.full_name || r).join(', ') : '';
  if (repoNames) {
    ws.mergeCells(row, 1, row, COLS);
    const reposCell = ws.getCell(row, 1);
    reposCell.value = `  Repositories (${repos.length}): ${repoNames.length > 200 ? repoNames.slice(0, 200) + '...' : repoNames}`;
    reposCell.font = { size: 8, italic: true, color: { argb: 'FF64748B' } };
    reposCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    reposCell.alignment = { vertical: 'middle', wrapText: true };
    ws.getRow(row).height = repoNames.length > 100 ? 30 : 18;
    row++;
  }

  // ---- Row 3: Spacer ----
  ws.getRow(row).height = 6;
  row++;

  // ---- Compute stats ----
  const open = findings.filter(f => !f.status || f.status === 'open' || f.status === 'acknowledged');
  const remediated = findings.filter(f => f.status === 'resolved' || f.status === 'false_positive');
  const bySev = {};
  open.forEach(f => { bySev[f.severity] = (bySev[f.severity] || 0) + 1; });

  const labels = ['Open', 'Critical', 'High', 'Medium/Low', 'Remediated', 'Total'];
  const values = [open.length, bySev.critical || 0, bySev.high || 0, (bySev.medium || 0) + (bySev.low || 0), remediated.length, findings.length];

  // ---- Row 4: Stat labels (spread across columns, 2 cols each + padding) ----
  // Use columns: 1-2, 3-4, 5-6, 7-8, 9-10, 11-12 for 6 stats
  for (let i = 0; i < 6; i++) {
    const startCol = i * 2 + 1;
    ws.mergeCells(row, startCol, row, startCol + 1);
    const c = ws.getCell(row, startCol);
    c.value = labels[i];
    c.font = { size: 8, bold: true, color: { argb: 'FF64748B' } };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
    c.fill = whiteFill;
    c.border = { top: { style: 'medium', color: { argb: STAT_COLORS[i] } } };
    // Also style the merged cell partner
    ws.getCell(row, startCol + 1).fill = whiteFill;
    ws.getCell(row, startCol + 1).border = { top: { style: 'medium', color: { argb: STAT_COLORS[i] } } };
  }
  // Fill remaining cols 13-14
  ws.getCell(row, 13).fill = whiteFill;
  ws.getCell(row, 14).fill = whiteFill;
  ws.getRow(row).height = 18;
  row++;

  // ---- Row 5: Stat values ----
  for (let i = 0; i < 6; i++) {
    const startCol = i * 2 + 1;
    ws.mergeCells(row, startCol, row, startCol + 1);
    const c = ws.getCell(row, startCol);
    c.value = values[i];
    c.font = { size: 20, bold: true, color: { argb: STAT_COLORS[i] } };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
    c.fill = whiteFill;
    ws.getCell(row, startCol + 1).fill = whiteFill;
  }
  ws.getCell(row, 13).fill = whiteFill;
  ws.getCell(row, 14).fill = whiteFill;
  ws.getRow(row).height = 34;
  row++;

  // ---- Row 6: Spacer ----
  ws.getRow(row).height = 8;
  row++;

  // ---- Row 7: Section title ----
  ws.mergeCells(row, 1, row, COLS);
  const secCell = ws.getCell(row, 1);
  secCell.value = `Findings Detail (${findings.length})`;
  secCell.font = { size: 12, bold: true, color: { argb: 'FF0F172A' } };
  secCell.border = { bottom: { style: 'medium', color: { argb: 'FF06B6D4' } } };
  ws.getRow(row).height = 24;
  row++;

  // ---- Row 8: Table headers ----
  const headers = ['Severity', 'Status', 'Secret Type', 'Repository', 'File', 'Line', 'Description', 'Author', 'Committed', 'Found', 'Remediated', 'Commit SHA', 'File URL', 'Matching Code'];
  headers.forEach((h, i) => {
    const c = ws.getCell(row, i + 1);
    c.value = h;
    c.font = { size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = darkFill;
    c.alignment = { vertical: 'middle', wrapText: true };
    c.border = { bottom: { style: 'medium', color: { argb: 'FF06B6D4' } } };
  });
  ws.getRow(row).height = 24;
  row++;

  // ---- Data rows ----
  const dataStartRow = row;
  findings.forEach((f, idx) => {
    const sev = f.severity || 'low';
    const st = f.status || 'open';
    const vals = [
      sev.charAt(0).toUpperCase() + sev.slice(1),
      ST_LABELS[st] || st,
      f.secretType || f.secret_type || '',
      f.repo || '',
      f.file || '',
      f.line || '',
      f.description || '',
      f.commit_author_login || f.commit_author || f.commit?.author || '',
      formatDate(f.commit_date || f.commit?.date) || '',
      formatDate(f.created_at) || '',
      f.resolved_at ? formatDate(f.resolved_at) : '',
      f.commit_sha || f.commit?.sha || '',
      f.fileUrl || f.file_url || '',
      maskSecret((f.matchingLines || f.matching_lines)?.[0] || ''),
    ];

    const bgColor = idx % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC';

    vals.forEach((v, i) => {
      const c = ws.getCell(row, i + 1);
      c.value = v;
      c.font = { size: 9, color: { argb: 'FF334155' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
      c.alignment = { vertical: 'top', wrapText: i === 4 || i === 6 };
      c.border = { bottom: { style: 'thin', color: { argb: 'FFF1F5F9' } } };

      if (i === 0) {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SEV_FILLS[sev] || 'FFFFFFFF' } };
        c.font = { size: 9, bold: true, color: { argb: SEV_FONTS[sev] || 'FF334155' } };
      }
      if (i === 1) {
        c.font = { size: 9, bold: true, color: { argb: ST_FONTS[st] || 'FF334155' } };
      }
    });
    row++;
  });

  // Auto-filter
  if (findings.length > 0) {
    ws.autoFilter = { from: { row: dataStartRow - 1, column: 1 }, to: { row: row - 1, column: COLS } };
  }

  // Freeze at table header
  ws.views = [{ state: 'frozen', ySplit: dataStartRow - 1 }];

  // ---- Download ----
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `secretsweep-report-${new Date().toISOString().slice(0, 10)}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
