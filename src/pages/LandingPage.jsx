import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Shield, Lock, Scan, GitBranch, Zap, Bell, BarChart3, Users, CheckCircle, ArrowRight, Send, Calendar, ShieldCheck, Sun, Moon } from 'lucide-react';
import logoFull from '../assets/logo-full.png';
import logoIcon from '../assets/logo.png';

// ─── Enhanced Particles ───
function Particles({ dark }) {
  const ref = useRef(null);
  const mouseRef = useRef({ x: -1000, y: -1000, clicking: false });

  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); let raf;
    const ps = []; const N = 120; const CONN = 150;
    const mouse = mouseRef.current;

    function resize() { c.width = window.innerWidth; c.height = Math.max(document.documentElement.scrollHeight, window.innerHeight * 5); }
    resize(); window.addEventListener('resize', resize);

    for (let i = 0; i < N; i++) ps.push({
      x: Math.random() * c.width, y: Math.random() * c.height,
      vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4,
      s: Math.random() * 2.5 + 0.8, o: Math.random() * 0.5 + 0.2,
      pulsePhase: Math.random() * Math.PI * 2,
    });

    const onM = e => { mouse.x = e.clientX; mouse.y = e.clientY + window.scrollY; };
    const onD = () => { mouse.clicking = true; setTimeout(() => { mouse.clicking = false; }, 300); };
    window.addEventListener('mousemove', onM);
    window.addEventListener('mousedown', onD);

    let time = 0;
    function draw() {
      time += 0.01;
      ctx.clearRect(0, 0, c.width, c.height);

      const pColor = dark ? '6, 182, 212' : '59, 130, 246';
      const lColor = dark ? '34, 211, 238' : '96, 165, 250';
      const pMult = dark ? 1 : 0.6;

      for (const p of ps) {
        const dx = p.x - mouse.x, dy = p.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Mouse attraction (gentle pull) + click burst (push)
        if (dist < 200 && dist > 0) {
          if (mouse.clicking) {
            // Burst: push particles away
            p.vx += (dx / dist) * 0.8;
            p.vy += (dy / dist) * 0.8;
          } else {
            // Gentle pull toward cursor
            p.vx -= (dx / dist) * 0.008;
            p.vy -= (dy / dist) * 0.008;
          }
        }

        // Speed limit
        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (speed > 2) { p.vx *= 0.95; p.vy *= 0.95; }

        p.vx *= 0.998; p.vy *= 0.998;
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = c.width; if (p.x > c.width) p.x = 0;
        if (p.y < 0) p.y = c.height; if (p.y > c.height) p.y = 0;

        // Pulsing size
        const pulse = 1 + Math.sin(time * 2 + p.pulsePhase) * 0.3;
        const size = p.s * pulse;

        ctx.beginPath(); ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${pColor}, ${p.o * pMult})`;
        if (dark) { ctx.shadowBlur = 12; ctx.shadowColor = `rgba(${pColor}, 0.4)`; }
        ctx.fill(); ctx.shadowBlur = 0;
      }

      // Connections
      for (let i = 0; i < ps.length; i++) {
        for (let j = i + 1; j < ps.length; j++) {
          const dx = ps[i].x - ps[j].x, dy = ps[i].y - ps[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < CONN) {
            ctx.beginPath(); ctx.moveTo(ps[i].x, ps[i].y); ctx.lineTo(ps[j].x, ps[j].y);
            ctx.strokeStyle = `rgba(${pColor}, ${(1 - d / CONN) * (dark ? 0.12 : 0.07)})`;
            ctx.lineWidth = 0.6; ctx.stroke();
          }
        }

        // Mouse connection lines (brighter)
        const mdx = ps[i].x - mouse.x, mdy = ps[i].y - mouse.y;
        const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
        if (mdist < 250) {
          ctx.beginPath(); ctx.moveTo(ps[i].x, ps[i].y); ctx.lineTo(mouse.x, mouse.y);
          ctx.strokeStyle = `rgba(${lColor}, ${(1 - mdist / 250) * (dark ? 0.2 : 0.12)})`;
          ctx.lineWidth = 1; ctx.stroke();
        }
      }

      raf = requestAnimationFrame(draw);
    }
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); window.removeEventListener('mousemove', onM); window.removeEventListener('mousedown', onD); };
  }, [dark]);

  return <canvas ref={ref} className="absolute inset-0 pointer-events-none" style={{ zIndex: 1 }} />;
}

// ─── Dashboard Mockup ───
function DashboardMockup({ dark }) {
  return (
    <div className="relative mx-auto max-w-4xl group">
      <div className="absolute -inset-4 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
      <div className={`relative rounded-2xl border overflow-hidden shadow-2xl transition-all duration-500 group-hover:scale-[1.01] group-hover:shadow-cyan-500/20 ${dark ? 'border-white/10 bg-[#0d1321] shadow-cyan-500/10' : 'border-gray-200 bg-white shadow-gray-200'}`}>
        <div className="absolute inset-0 bg-gradient-to-t from-[#070b14] via-transparent to-transparent z-10 pointer-events-none opacity-60" />
        {/* Header */}
        <div className={`flex items-center gap-3 px-5 py-3 border-b ${dark ? 'border-white/5 bg-white/[0.02]' : 'border-gray-100 bg-gray-50'}`}>
          <img src={logoIcon} className="w-6 h-6" alt="" />
          <span className={`text-sm font-bold ${dark ? 'text-cyan-400' : 'text-cyan-600'}`}>SecretSweep</span>
          <div className={`ml-auto flex gap-4 text-[10px] ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
            <span className={dark ? 'text-white/40' : 'text-gray-700'}>Dashboard</span><span>Scans</span><span>Findings</span>
          </div>
        </div>
        {/* Stats */}
        <div className="p-5">
          <div className="grid grid-cols-5 gap-3 mb-5">
            {[
              { label: 'Open Findings', value: '24', color: dark ? 'text-blue-400' : 'text-blue-600', border: dark ? 'border-blue-500/30' : 'border-blue-400' },
              { label: 'Critical', value: '3', color: dark ? 'text-red-400' : 'text-red-600', border: dark ? 'border-red-500/30' : 'border-red-400' },
              { label: 'High', value: '8', color: dark ? 'text-orange-400' : 'text-orange-600', border: dark ? 'border-orange-500/30' : 'border-orange-400' },
              { label: 'Remediated', value: '47', color: dark ? 'text-emerald-400' : 'text-emerald-600', border: dark ? 'border-emerald-500/30' : 'border-emerald-400' },
              { label: 'Repos Scanned', value: '156', color: dark ? 'text-gray-300' : 'text-gray-700', border: dark ? 'border-gray-500/30' : 'border-gray-300' },
            ].map(s => (
              <div key={s.label} className={`rounded-xl p-3 border-t-2 ${s.border} ${dark ? 'bg-white/[0.03]' : 'bg-gray-50'}`}>
                <p className={`text-[9px] uppercase tracking-wider ${dark ? 'text-gray-500' : 'text-gray-400'}`}>{s.label}</p>
                <p className={`text-2xl font-bold ${s.color} mt-1`}>{s.value}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className={`rounded-xl p-4 border ${dark ? 'bg-white/[0.02] border-white/5' : 'bg-gray-50 border-gray-100'}`}>
              <p className={`text-[9px] uppercase tracking-wider mb-3 ${dark ? 'text-gray-500' : 'text-gray-400'}`}>Severity Breakdown</p>
              <div className="flex items-end gap-2 h-20">
                {[60, 80, 40, 20].map((h, i) => (
                  <div key={i} className="flex-1 rounded-t transition-all duration-500 group-hover:opacity-100 opacity-80" style={{ height: `${h}%`, background: ['#ef4444','#f97316','#eab308','#3b82f6'][i] }} />
                ))}
              </div>
            </div>
            <div className={`rounded-xl p-4 border ${dark ? 'bg-white/[0.02] border-white/5' : 'bg-gray-50 border-gray-100'}`}>
              <p className={`text-[9px] uppercase tracking-wider mb-3 ${dark ? 'text-gray-500' : 'text-gray-400'}`}>Finding Status</p>
              <div className="h-3 rounded-full overflow-hidden flex mb-3">
                <div className="bg-red-500 transition-all duration-1000" style={{ width: '30%' }} />
                <div className="bg-blue-500 transition-all duration-1000" style={{ width: '10%' }} />
                <div className="bg-emerald-500 transition-all duration-1000" style={{ width: '60%' }} />
              </div>
              <div className={`flex gap-3 text-[9px] ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-500" />Open</span>
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-blue-500" />Ack</span>
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Fixed</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Findings Mockup ───
function FindingsMockup({ dark }) {
  const rows = [
    { sev: 'critical', type: 'AWS Access Key', repo: 'backend-api', file: 'config/prod.env', status: 'Open', stColor: dark ? 'text-red-400' : 'text-red-600' },
    { sev: 'high', type: 'GitHub PAT', repo: 'deploy-scripts', file: '.github/workflows/ci.yml', status: 'Open', stColor: dark ? 'text-red-400' : 'text-red-600' },
    { sev: 'critical', type: 'Stripe Secret Key', repo: 'payment-svc', file: 'src/billing.js:42', status: 'Remediated', stColor: dark ? 'text-emerald-400' : 'text-emerald-600' },
    { sev: 'medium', type: 'Slack Token', repo: 'notifications', file: 'src/slack.ts:18', status: 'Remediated', stColor: dark ? 'text-emerald-400' : 'text-emerald-600' },
  ];
  const sevColors = { critical: dark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-700', high: dark ? 'bg-orange-500/20 text-orange-400' : 'bg-orange-100 text-orange-700', medium: dark ? 'bg-yellow-500/20 text-yellow-400' : 'bg-yellow-100 text-yellow-700' };

  return (
    <div className="relative max-w-3xl mx-auto group">
      <div className="absolute -inset-4 bg-gradient-to-r from-indigo-500/15 to-cyan-500/15 rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
      <div className={`relative rounded-2xl border overflow-hidden shadow-2xl transition-all duration-500 group-hover:scale-[1.01] ${dark ? 'border-white/10 bg-[#0d1321] shadow-cyan-500/5' : 'border-gray-200 bg-white'}`}>
        <div className={`px-5 py-3 border-b flex items-center justify-between ${dark ? 'border-white/5' : 'border-gray-100'}`}>
          <span className={`text-sm font-semibold ${dark ? 'text-white' : 'text-gray-900'}`}>Findings</span>
          <span className={`text-[10px] ${dark ? 'text-gray-500' : 'text-gray-400'}`}>4 results</span>
        </div>
        <table className="w-full text-[11px]">
          <thead><tr className={`border-b text-[9px] uppercase tracking-wider ${dark ? 'border-white/5 text-gray-500' : 'border-gray-100 text-gray-400'}`}>
            <th className="px-4 py-2 text-left">Severity</th><th className="px-4 py-2 text-left">Type</th><th className="px-4 py-2 text-left">Repository</th><th className="px-4 py-2 text-left">File</th><th className="px-4 py-2 text-left">Status</th>
          </tr></thead>
          <tbody>{rows.map((r, i) => (
            <tr key={i} className={`border-b transition-colors ${dark ? 'border-white/[0.03] hover:bg-white/[0.03]' : 'border-gray-50 hover:bg-gray-50'}`}>
              <td className="px-4 py-2.5"><span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${sevColors[r.sev]}`}>{r.sev}</span></td>
              <td className={`px-4 py-2.5 ${dark ? 'text-gray-300' : 'text-gray-700'}`}>{r.type}</td>
              <td className={`px-4 py-2.5 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>{r.repo}</td>
              <td className={`px-4 py-2.5 font-mono text-[10px] ${dark ? 'text-gray-500' : 'text-gray-400'}`}>{r.file}</td>
              <td className={`px-4 py-2.5 font-semibold ${r.stColor}`}>{r.status}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

const FEATURES = [
  { icon: Scan, title: 'Deep Secret Scanning', desc: 'Scan every file and commit for exposed secrets, API keys, and credentials.' },
  { icon: Lock, title: 'AES-256 Encryption', desc: 'All tokens encrypted at rest. Zero plaintext storage anywhere.' },
  { icon: GitBranch, title: 'GitHub & GitLab', desc: 'Full support including self-hosted instances. Scan entire orgs.' },
  { icon: Zap, title: 'Real-Time Alerts', desc: 'Slack notifications for critical findings the moment they appear.' },
  { icon: BarChart3, title: 'Rich Reporting', desc: 'PDF and Excel reports with charts, severity breakdown, and tracking.' },
  { icon: ShieldCheck, title: 'Remediation Validation', desc: 'Verify fixes against live code. Auto-resolve confirmed remediations.' },
  { icon: Users, title: 'Multi-Tenant Isolation', desc: 'Complete org isolation with database-level row security.' },
  { icon: Bell, title: 'Scheduled Scans', desc: 'Automate daily, weekly, or monthly scans across all repos.' },
];

const STATS = [
  { value: '50+', label: 'Secret Patterns' },
  { value: '< 5min', label: 'Scan Time' },
  { value: '100%', label: 'Tenant Isolation' },
  { value: '24/7', label: 'Monitoring' },
];

export default function LandingPage() {
  const [dark, setDark] = useState(() => localStorage.getItem('darkMode') !== 'false');
  const [formData, setFormData] = useState({ name: '', email: '', company: '', message: '' });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('darkMode', dark);
  }, [dark]);

  const handleSubmit = async (e) => {
    e.preventDefault(); setSubmitting(true);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (res.ok) setSubmitted(true);
    } catch {}
    setSubmitting(false);
  };

  const bg = dark ? 'bg-[#070b14]' : 'bg-gray-50';
  const text = dark ? 'text-white' : 'text-gray-900';
  const sub = dark ? 'text-gray-400' : 'text-gray-500';
  const cardBg = dark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-white border-gray-200';
  const inputCls = dark
    ? 'bg-white/[0.05] border-white/[0.1] text-white placeholder-gray-600 focus:ring-cyan-500/50'
    : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:ring-cyan-500/50';

  return (
    <div className={`min-h-screen ${bg} ${text} relative overflow-x-hidden transition-colors duration-500`}>
      <Particles dark={dark} />

      {/* Glow orbs */}
      {dark && <>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full opacity-20 pointer-events-none" style={{ background: 'radial-gradient(ellipse, rgba(6,182,212,0.15), transparent 70%)' }} />
        <div className="absolute top-[60vh] right-0 w-[400px] h-[400px] rounded-full opacity-10 pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.2), transparent 70%)' }} />
      </>}

      {/* Nav */}
      <nav className="relative z-20 max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={logoIcon} alt="SecretSweep" className="w-9 h-9 object-contain logo-glow" />
          <span className="text-lg font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">SecretSweep</span>
        </div>
        <div className="flex items-center gap-5">
          <a href="#features" className={`text-sm hover:text-cyan-400 transition-colors hidden sm:block ${sub}`}>Features</a>
          <a href="#platform" className={`text-sm hover:text-cyan-400 transition-colors hidden sm:block ${sub}`}>Platform</a>
          <a href="#contact" className={`text-sm hover:text-cyan-400 transition-colors hidden sm:block ${sub}`}>Contact</a>
          <button onClick={() => setDark(!dark)} className={`p-2 rounded-xl transition-colors ${dark ? 'bg-white/10 hover:bg-white/20' : 'bg-gray-200 hover:bg-gray-300'}`}>
            {dark ? <Sun className="w-4 h-4 text-yellow-400" /> : <Moon className="w-4 h-4 text-gray-600" />}
          </button>
          <Link to="/login" className="px-5 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40 transition-all">
            Sign In
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pt-20 pb-8 text-center">
        <img src={logoFull} alt="SecretSweep" className="w-72 mx-auto mb-6 logo-animated" style={{ filter: dark ? 'drop-shadow(0 0 30px rgba(6,182,212,0.2))' : 'drop-shadow(0 0 20px rgba(6,182,212,0.15))' }} />
        <p className="text-cyan-500 text-sm font-semibold tracking-[0.2em] uppercase mb-6">Secret Scanning Platform</p>
        <h1 className="text-5xl md:text-7xl font-black leading-[1.1] mb-8 tracking-tight">
          Stop Secrets From<br />
          <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400 bg-clip-text text-transparent">Becoming Breaches</span>
        </h1>
        <p className={`text-lg md:text-xl max-w-2xl mx-auto mb-12 leading-relaxed ${sub}`}>
          Continuously scan your GitHub and GitLab repositories for exposed API keys, credentials, and secrets — remediate before attackers find them.
        </p>
        <div className="flex items-center justify-center gap-4 mb-20">
          <a href="#contact" className="group px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-2xl font-semibold text-white shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all flex items-center gap-2 text-lg">
            <Calendar className="w-5 h-5" /> Schedule a Demo <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </a>
        </div>
        <div className="flex items-center justify-center gap-8 md:gap-16 mb-16">
          {STATS.map(s => (
            <div key={s.label} className="text-center">
              <p className={`text-2xl md:text-3xl font-black ${text}`}>{s.value}</p>
              <p className={`text-xs uppercase tracking-wider mt-1 ${dark ? 'text-gray-500' : 'text-gray-400'}`}>{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Platform Preview */}
      <section id="platform" className="relative z-10 max-w-6xl mx-auto px-6 pb-24">
        <p className="text-cyan-500 text-xs font-semibold tracking-[0.2em] uppercase text-center mb-4">The Platform</p>
        <h2 className={`text-3xl md:text-4xl font-black text-center mb-4 tracking-tight ${text}`}>See What You're Getting</h2>
        <p className={`text-center mb-12 max-w-xl mx-auto ${sub}`}>A powerful dashboard with real-time scanning, severity tracking, and remediation validation.</p>
        <DashboardMockup dark={dark} />
      </section>

      {/* Findings */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pb-24">
        <p className="text-cyan-500 text-xs font-semibold tracking-[0.2em] uppercase text-center mb-4">Detailed Findings</p>
        <h2 className={`text-3xl md:text-4xl font-black text-center mb-4 tracking-tight ${text}`}>Every Secret, <span className="text-cyan-400">Tracked</span></h2>
        <p className={`text-center mb-12 max-w-xl mx-auto ${sub}`}>See exactly what was found, where, by whom, and whether it's been fixed.</p>
        <FindingsMockup dark={dark} />
      </section>

      {/* Features */}
      <section id="features" className="relative z-10 max-w-6xl mx-auto px-6 py-24">
        <p className="text-cyan-500 text-xs font-semibold tracking-[0.2em] uppercase text-center mb-4">Features</p>
        <h2 className={`text-3xl md:text-4xl font-black text-center mb-4 tracking-tight ${text}`}>Everything You Need</h2>
        <p className={`text-center mb-16 max-w-xl mx-auto ${sub}`}>Enterprise-grade secret scanning with the tools your security team demands.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className={`border rounded-2xl p-6 transition-all duration-300 group hover:scale-[1.02] ${cardBg} hover:border-cyan-500/30 hover:shadow-lg hover:shadow-cyan-500/5`}>
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 transition-colors ${dark ? 'bg-cyan-500/10 group-hover:bg-cyan-500/20' : 'bg-cyan-50 group-hover:bg-cyan-100'}`}>
                <Icon className={`w-5 h-5 ${dark ? 'text-cyan-400' : 'text-cyan-600'}`} />
              </div>
              <h3 className={`font-bold mb-2 ${text}`}>{title}</h3>
              <p className={`text-sm leading-relaxed ${dark ? 'text-gray-500' : 'text-gray-400'}`}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="relative z-10 max-w-2xl mx-auto px-6 py-24">
        <p className="text-cyan-500 text-xs font-semibold tracking-[0.2em] uppercase text-center mb-4">Get Started</p>
        <h2 className={`text-3xl md:text-4xl font-black text-center mb-4 tracking-tight ${text}`}>Schedule a Demo</h2>
        <p className={`text-center mb-10 ${sub}`}>See SecretSweep in action. We'll reach out within 24 hours.</p>

        {submitted ? (
          <div className={`border rounded-2xl p-12 text-center ${dark ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-emerald-50 border-emerald-200'}`}>
            <CheckCircle className="w-14 h-14 text-emerald-400 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-emerald-500 mb-2">Thank you!</h3>
            <p className={sub}>We'll be in touch within 24 hours.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className={`relative border rounded-2xl p-8 space-y-4 transition-all duration-500 hover:shadow-xl group ${cardBg} ${dark ? 'hover:border-cyan-500/30 hover:shadow-cyan-500/10' : 'hover:border-cyan-300 hover:shadow-cyan-100'}`}>
            <div className="absolute -inset-3 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[{ label: 'Name', key: 'name', ph: 'John Smith', type: 'text' }, { label: 'Email', key: 'email', ph: 'john@company.com', type: 'email' }].map(f => (
                <div key={f.key}>
                  <label className={`block text-xs mb-1.5 uppercase tracking-wider font-semibold ${sub}`}>{f.label}</label>
                  <input type={f.type} value={formData[f.key]} onChange={(e) => setFormData({ ...formData, [f.key]: e.target.value })}
                    className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 ${inputCls}`} placeholder={f.ph} required />
                </div>
              ))}
            </div>
            <div>
              <label className={`block text-xs mb-1.5 uppercase tracking-wider font-semibold ${sub}`}>Company</label>
              <input value={formData.company} onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 ${inputCls}`} placeholder="Acme Corp" required />
            </div>
            <div>
              <label className={`block text-xs mb-1.5 uppercase tracking-wider font-semibold ${sub}`}>Message</label>
              <textarea value={formData.message} onChange={(e) => setFormData({ ...formData, message: e.target.value })} rows={3}
                className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 resize-none ${inputCls}`} placeholder="Tell us about your security needs..." />
            </div>
            <button type="submit" disabled={submitting}
              className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 rounded-xl font-bold text-lg text-white shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {submitting ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Send className="w-5 h-5" /> Request Demo</>}
            </button>
          </form>
        )}
      </section>

      <footer className={`relative z-10 border-t ${dark ? 'border-white/[0.06]' : 'border-gray-200'}`}>
        <div className="max-w-6xl mx-auto px-6 py-8 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={logoIcon} alt="" className="w-5 h-5 opacity-50" />
            <span className={`text-sm ${dark ? 'text-gray-600' : 'text-gray-400'}`}>SecretSweep</span>
          </div>
          <div className={`flex items-center gap-4 text-xs ${dark ? 'text-gray-600' : 'text-gray-400'}`}>
            <span>AES-256 Encrypted</span><span>&middot;</span><span>Multi-Tenant Isolated</span><span>&middot;</span>
            <Link to="/login" className="text-cyan-500 hover:text-cyan-400">Sign In</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
