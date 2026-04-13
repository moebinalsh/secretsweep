import { useState, useRef, useEffect } from 'react';
import { Download, ChevronDown, FileText, FileSpreadsheet, Loader2 } from 'lucide-react';
import { generatePDFReport } from '../lib/generateReport';
import logoImg from '../assets/logo.png';

export default function ExportButton({ findings, scanInfo, orgName, repos }) {
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleExcel = async () => {
    setExporting(true);
    try {
      const { generateExcelReport } = await import('../lib/generateExcel');
      await generateExcelReport(findings, scanInfo, orgName, repos);
    } catch (err) {
      console.error('Excel export error:', err);
    }
    setExporting(false);
    setOpen(false);
  };

  const handlePDF = async () => {
    setExporting(true);
    try {
      // Convert logo to small base64 data URL via canvas
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = logoImg;
      await new Promise((resolve) => { img.onload = resolve; img.onerror = resolve; });
      const canvas = document.createElement('canvas');
      canvas.width = 120; canvas.height = 120;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, 120, 120);
      const logoDataUrl = canvas.toDataURL('image/png', 0.9);
      generatePDFReport(findings, scanInfo, orgName, logoDataUrl, repos);
    } catch {
      generatePDFReport(findings, scanInfo, orgName, null);
    }
    setExporting(false);
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        disabled={findings.length === 0 || exporting}
        className="btn-secondary flex items-center gap-2 text-sm"
      >
        {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        Export
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-52 glass-card p-1.5 z-50 animate-fade-in">
          <button
            onClick={handleExcel}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
            Export Excel (.xlsx)
          </button>
          <button
            onClick={handlePDF}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <FileText className="w-4 h-4 text-red-500" />
            Export PDF Report
          </button>
        </div>
      )}
    </div>
  );
}
