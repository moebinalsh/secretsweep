import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Loader2, StopCircle, GitBranch, Building2, Clock, Hash, User, Globe, Lock, ShieldCheck, CheckCircle, XCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ScanProgress from '../components/ScanProgress';
import Dashboard from '../components/Dashboard';
import FilterPanel from '../components/FilterPanel';
import ResultsTable from '../components/ResultsTable';

export default function ScanDetailPage() {
  const { scanId } = useParams();
  const { authFetch, accessToken, refreshAccessToken, user, org } = useAuth();

  const [scan, setScan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [findings, setFindings] = useState([]);
  const [repos, setRepos] = useState([]);
  const [scanProgress, setScanProgress] = useState(null);
  const [scanLog, setScanLog] = useState([]);
  const eventSourceRef = useRef(null);
  const lastEventIndexRef = useRef(0);
  const pollRef = useRef(null);

  const [filters, setFilters] = useState({ severity: [], secretType: [], repo: [], search: '' });
  const [dashboardFilter, setDashboardFilter] = useState(null);

  const isRunning = scan?.status === 'running';

  // Poll scan status from DB as a reliable fallback
  const pollScanStatus = useCallback(async () => {
    try {
      const res = await authFetch(`/api/scans/${scanId}`);
      const data = await res.json();
      setScan(data);
      if (data.status !== 'running') {
        // Scan finished — stop polling, load findings from DB
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
        const fRes = await authFetch(`/api/scans/${scanId}/findings?limit=100`);
        const fData = await fRes.json();
        setFindings(fData.findings || []);
      }
    } catch {}
  }, [scanId, authFetch]);

  // Try SSE, fall back to polling
  const connectSSE = useCallback(async () => {
    let token = accessToken;
    if (!token) {
      try {
        token = await refreshAccessToken();
      } catch {}
    }

    // Always start polling as a reliable fallback
    if (!pollRef.current) {
      pollRef.current = setInterval(pollScanStatus, 5000);
    }

    if (!token) return;
    if (eventSourceRef.current) eventSourceRef.current.close();

    const es = new EventSource(`/api/scans/${scanId}/stream?token=${encodeURIComponent(token)}&fromIndex=${lastEventIndexRef.current}`);

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data._idx !== undefined) lastEventIndexRef.current = data._idx + 1;
        if (data.type === 'finding') {
          setFindings((prev) => {
            if (prev.some(f => f.id === data.id)) return prev;
            return [...prev, data];
          });
        } else if (data.type === 'enrich') {
          setFindings((prev) => prev.map((f) => (f.id === data.id ? { ...f, commit: data.commit } : f)));
        } else if (data.type === 'progress') {
          setScanProgress(data);
          setScanLog((prev) => [...prev.slice(-100), { time: new Date(), ...data }]);
        } else if (data.type === 'rate_limit' || data.type === 'error') {
          setScanLog((prev) => [...prev.slice(-100), { time: new Date(), ...data }]);
        } else if (data.type === 'repos') {
          setRepos(data.repos || []);
          setScan((prev) => ({ ...prev, total_repos: data.count }));
        } else if (data.type === 'complete') {
          setScan((prev) => ({ ...prev, status: 'completed', total_findings: data.totalFindings }));
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          es.close();
          loadFindings();
        } else if (data.type === 'cancelled') {
          setScan((prev) => ({ ...prev, status: 'cancelled' }));
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          es.close();
        } else if (data.type === 'status') {
          setScan((prev) => ({ ...prev, status: data.status }));
          if (data.status !== 'running') {
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = null;
            es.close();
            loadFindings();
          }
        }
      } catch {}
    };

    es.onerror = () => {
      es.close();
      // Polling fallback is already running — it will keep the UI updated
    };

    eventSourceRef.current = es;
  }, [scanId, accessToken, refreshAccessToken, pollScanStatus]);

  // Load scan details
  useEffect(() => {
    authFetch(`/api/scans/${scanId}`)
      .then((r) => r.json())
      .then((data) => {
        setScan(data);
        if (data.status === 'running') {
          connectSSE();
        } else {
          loadFindings();
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));

    return () => {
      if (eventSourceRef.current) eventSourceRef.current.close();
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [scanId]);

  // Remediation validation
  const [validating, setValidating] = useState(false);
  const [validationResults, setValidationResults] = useState(null);

  const handleValidateRemediation = useCallback(async () => {
    setValidating(true);
    setValidationResults(null);
    try {
      const res = await authFetch('/api/findings/validate-remediation', {
        method: 'POST',
        body: JSON.stringify({ scanId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setValidationResults(data);

      // Update local findings state based on validation results
      if (data.results) {
        const remediatedIds = new Set(data.results.filter(r => r.status === 'remediated').map(r => r.findingId));
        const reopenedIds = new Set(data.results.filter(r => r.status === 'still_present').map(r => r.findingId));
        setFindings(prev => prev.map(f => {
          if (remediatedIds.has(f.id)) return { ...f, status: 'resolved', resolved_at: new Date().toISOString() };
          if (reopenedIds.has(f.id) && f.status === 'resolved') return { ...f, status: 'open', resolved_at: null };
          return f;
        }));
      }
    } catch (err) {
      setValidationResults({ error: err.message });
    } finally {
      setValidating(false);
    }
  }, [scanId, authFetch]);

  const handleCancelScan = useCallback(async () => {
    try {
      await authFetch(`/api/scans/${scanId}/cancel`, { method: 'PATCH' });
      if (eventSourceRef.current) eventSourceRef.current.close();
      setScan((prev) => ({ ...prev, status: 'cancelled' }));
    } catch {}
  }, [scanId, authFetch]);

  const loadFindings = useCallback(async () => {
    try {
      const res = await authFetch(`/api/scans/${scanId}/findings?limit=100`);
      const data = await res.json();
      setFindings(data.findings || []);
    } catch {}
  }, [scanId, authFetch]);

  // Apply filters (panel filters + dashboard card filter)
  const filteredFindings = findings.filter((f) => {
    // Dashboard card filter
    if (dashboardFilter) {
      const st = f.status || 'open';
      if (dashboardFilter === 'open' && st !== 'open' && st !== 'acknowledged') return false;
      if (dashboardFilter === 'critical' && (f.severity !== 'critical' || (st !== 'open' && st !== 'acknowledged'))) return false;
      if (dashboardFilter === 'high' && (f.severity !== 'high' || (st !== 'open' && st !== 'acknowledged'))) return false;
      if (dashboardFilter === 'medlow' && !['medium', 'low'].includes(f.severity)) return false;
      if (dashboardFilter === 'medlow' && st !== 'open' && st !== 'acknowledged') return false;
      if (dashboardFilter === 'remediated' && st !== 'resolved' && st !== 'false_positive') return false;
    }
    // Panel filters
    if (filters.severity.length > 0 && !filters.severity.includes(f.severity)) return false;
    if (filters.secretType.length > 0 && !filters.secretType.includes(f.secretType || f.secret_type)) return false;
    if (filters.repo.length > 0 && !filters.repo.includes(f.repo)) return false;
    if (filters.search) {
      const s = filters.search.toLowerCase();
      return f.repo.toLowerCase().includes(s) || f.file.toLowerCase().includes(s) || (f.secretType || f.secret_type || '').toLowerCase().includes(s);
    }
    return true;
  });

  // Normalize DB findings to match component expectations
  const normalizedFindings = findings.map((f) => ({
    ...f,
    secretType: f.secretType || f.secret_type,
    secretTypeId: f.secretTypeId || f.secret_type_id,
    repoUrl: f.repoUrl || f.repo_url,
    fileUrl: f.fileUrl || f.file_url,
    matchingLines: f.matchingLines || f.matching_lines || [],
  }));
  const normalizedFiltered = filteredFindings.map((f) => ({
    ...f,
    secretType: f.secretType || f.secret_type,
    secretTypeId: f.secretTypeId || f.secret_type_id,
    repoUrl: f.repoUrl || f.repo_url,
    fileUrl: f.fileUrl || f.file_url,
    matchingLines: f.matchingLines || f.matching_lines || [],
  }));

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-brand-500" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/scans" className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{scan?.github_org?.replace('__user__:', '') || 'Scan'}</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              {scan?.status === 'running' ? 'Scanning...' : scan?.status === 'cancelled' ? 'Cancelled' : `${scan?.total_findings || findings.length} findings`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isRunning && findings.length > 0 && (
            <button onClick={handleValidateRemediation} disabled={validating} className="btn-primary flex items-center gap-2 text-sm">
              {validating ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              {validating ? 'Checking files...' : 'Validate Remediation'}
            </button>
          )}
          {isRunning && user?.role === 'admin' && (
            <button onClick={handleCancelScan} className="btn-danger flex items-center gap-2">
              <StopCircle className="w-4 h-4" />
              Cancel Scan
            </button>
          )}
        </div>
      </div>

      {/* Scan Details */}
      <div className="glass-card glow-card p-5">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Hash className="w-4 h-4 text-gray-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-gray-400">Scan ID</p>
              <p className="text-gray-700 dark:text-gray-300 font-mono text-xs truncate" title={scan?.id}>{scan?.id?.slice(0, 8)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-gray-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-gray-400">Organization</p>
              <p className="text-gray-700 dark:text-gray-300 truncate">{scan?.github_org?.replace('__user__:', '') || '—'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-gray-400 shrink-0" />
            <div>
              <p className="text-xs text-gray-400">Repos</p>
              <p className="text-gray-700 dark:text-gray-300">
                {scan?.total_repos ?? repos.length ?? '—'}
                <span className="text-xs text-gray-400 ml-1">({scan?.scan_mode || 'full'})</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-gray-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-gray-400">Started by</p>
              <p className="text-gray-700 dark:text-gray-300 truncate">{scan?.started_by_name || '—'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-400 shrink-0" />
            <div>
              <p className="text-xs text-gray-400">Started</p>
              <p className="text-gray-700 dark:text-gray-300">{scan?.started_at ? new Date(scan.started_at).toLocaleString() : '—'}</p>
            </div>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
            scan?.status === 'running' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' :
            scan?.status === 'completed' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' :
            scan?.status === 'failed' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
            'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
          }`}>
            {scan?.status === 'running' && <Loader2 className="w-3 h-3 animate-spin" />}
            {scan?.status?.charAt(0).toUpperCase() + scan?.status?.slice(1) || 'Unknown'}
          </span>
          {scan?.completed_at && (
            <span className="text-xs text-gray-400">
              Completed {new Date(scan.completed_at).toLocaleString()}
            </span>
          )}
        </div>
      </div>

      {/* Validation Results */}
      {validationResults && !validationResults.error && (
        <div className="glass-card glow-card p-5">
          <div className="flex items-center gap-3 mb-3">
            <ShieldCheck className="w-5 h-5 text-brand-600" />
            <h3 className="font-semibold text-gray-800 dark:text-gray-200">Remediation Validation Results</h3>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50">
              <CheckCircle className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{validationResults.remediated}</p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400">Remediated</p>
            </div>
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50">
              <XCircle className="w-5 h-5 text-red-600 mx-auto mb-1" />
              <p className="text-2xl font-bold text-red-700 dark:text-red-400">{validationResults.stillPresent}</p>
              <p className="text-xs text-red-600 dark:text-red-400">Still Present</p>
            </div>
            <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
              <Hash className="w-5 h-5 text-gray-500 mx-auto mb-1" />
              <p className="text-2xl font-bold text-gray-700 dark:text-gray-300">{validationResults.total}</p>
              <p className="text-xs text-gray-500">Total Checked</p>
            </div>
          </div>
        </div>
      )}

      {isRunning && <ScanProgress progress={scanProgress} log={scanLog} findingsCount={findings.length} />}

      {(findings.length > 0 || !isRunning) && (
        <>
          <Dashboard findings={normalizedFiltered} allFindings={normalizedFindings} repos={repos} scanSummary={scan?.summary} activeFilter={dashboardFilter} onFilterChange={setDashboardFilter} />

          {normalizedFindings.length > 0 && (
            <div className="flex flex-col lg:flex-row gap-6 mt-6">
              <FilterPanel findings={normalizedFindings} filters={filters} setFilters={setFilters} />
              <div className="flex-1 min-w-0">
                <ResultsTable findings={normalizedFiltered} totalFindings={normalizedFindings.length} scanInfo={scan} orgName={org?.name} repos={repos} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
