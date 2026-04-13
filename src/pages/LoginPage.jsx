import { useState, useEffect, useRef } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { AlertCircle, Eye, EyeOff, Shield, Lock, Scan, GitBranch, Zap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from '../components/ThemeToggle';
import logoFull from '../assets/logo-full.png';
import logoIcon from '../assets/logo.png';

function LoginParticles() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let raf;
    const particles = [];
    const COUNT = 90;
    const CONN = 140;
    const mouse = { x: -1000, y: -1000 };

    function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
    resize();
    window.addEventListener('resize', resize);

    for (let i = 0; i < COUNT; i++) {
      particles.push({
        x: Math.random() * canvas.width, y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.5, vy: (Math.random() - 0.5) * 0.5,
        size: Math.random() * 2.5 + 1, opacity: Math.random() * 0.6 + 0.3,
      });
    }

    function onMouse(e) { mouse.x = e.clientX; mouse.y = e.clientY; }
    function onLeave() { mouse.x = -1000; mouse.y = -1000; }
    window.addEventListener('mousemove', onMouse);
    window.addEventListener('mouseleave', onLeave);

    function animate() {
      const dark = document.documentElement.classList.contains('dark');
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const pColor = dark ? '6, 182, 212' : '59, 130, 246';
      const lColor = dark ? '34, 211, 238' : '96, 165, 250';
      const pAlpha = dark ? 0.8 : 0.5;
      const cAlpha = dark ? 0.15 : 0.1;
      const mAlpha = dark ? 0.25 : 0.15;

      for (const p of particles) {
        const dx = p.x - mouse.x, dy = p.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 160 && dist > 0) { p.vx += (dx / dist) * 0.015; p.vy += (dy / dist) * 0.015; }
        p.vx *= 0.999; p.vy *= 0.999;
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = canvas.width; if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height; if (p.y > canvas.height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${pColor}, ${p.opacity * pAlpha})`;
        if (dark) { ctx.shadowBlur = 10; ctx.shadowColor = `rgba(${pColor}, 0.5)`; }
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x, dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < CONN) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(${pColor}, ${(1 - dist / CONN) * cAlpha})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
        const mdx = particles[i].x - mouse.x, mdy = particles[i].y - mouse.y;
        const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
        if (mdist < 200) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.strokeStyle = `rgba(${lColor}, ${(1 - mdist / 200) * mAlpha})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
      raf = requestAnimationFrame(animate);
    }
    animate();

    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); window.removeEventListener('mousemove', onMouse); window.removeEventListener('mouseleave', onLeave); };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none" style={{ zIndex: 1 }} />;
}

const FEATURES = [
  { icon: Scan, title: 'Deep Scanning', desc: 'Scan every repo, file, and commit for exposed secrets' },
  { icon: Lock, title: 'Encrypted Storage', desc: 'Tokens and credentials encrypted at rest with AES-256' },
  { icon: GitBranch, title: 'GitHub & GitLab', desc: 'Scan entire organizations across GitHub and GitLab' },
  { icon: Zap, title: 'Real-Time Alerts', desc: 'Get Slack notifications for critical findings instantly' },
];

export default function LoginPage({ darkMode, setDarkMode }) {
  const { login, isAuthenticated } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try { await login(email, password); } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-gray-50 dark:bg-[#070b14] transition-colors duration-500">
      {/* Background gradients */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-indigo-50/50 to-cyan-50/30 dark:from-[#0a1628] dark:via-[#0c1631] dark:to-[#0f0a2e] transition-colors duration-500" />
      <div className="absolute inset-0 opacity-20 dark:opacity-30" style={{
        backgroundImage: 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(6, 182, 212, 0.15), transparent)',
      }} />

      <LoginParticles />

      {/* Grid overlay */}
      <div className="absolute inset-0 opacity-40 dark:opacity-100" style={{
        backgroundImage: 'linear-gradient(rgba(6, 182, 212, 0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(6, 182, 212, 0.02) 1px, transparent 1px)',
        backgroundSize: '60px 60px', zIndex: 1,
      }} />

      <div className="absolute top-6 right-6 z-30">
        <ThemeToggle darkMode={darkMode} setDarkMode={setDarkMode} />
      </div>

      <div className="relative z-10 min-h-screen flex">
        {/* Left — branding (desktop) */}
        <div className="hidden lg:flex flex-1 flex-col justify-center items-center px-12">
          <div className="max-w-md text-center">
            <img src={logoFull} alt="SecretSweep" className="w-96 mx-auto mb-8 logo-animated" />
            <p className="text-gray-500 dark:text-gray-400 text-lg leading-relaxed mb-12">
              Protect your organization from exposed secrets, API keys, and credentials across all your repositories.
            </p>
            <div className="grid grid-cols-2 gap-4 text-left">
              {FEATURES.map(({ icon: Icon, title, desc }) => (
                <div key={title} className="bg-white/60 dark:bg-white/[0.03] backdrop-blur-sm border border-gray-200/50 dark:border-white/[0.06] rounded-xl p-4 hover:bg-white/80 dark:hover:bg-white/[0.06] hover:border-cyan-300/30 dark:hover:border-cyan-500/20 transition-all duration-300 group">
                  <Icon className="w-5 h-5 text-cyan-600 dark:text-cyan-400 mb-2 group-hover:text-cyan-500 dark:group-hover:text-cyan-300 transition-colors" />
                  <h3 className="text-gray-800 dark:text-white text-sm font-semibold mb-1">{title}</h3>
                  <p className="text-gray-500 dark:text-gray-500 text-xs leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right — form */}
        <div className="flex-1 lg:flex-none lg:w-[480px] flex items-center justify-center px-6">
          <div className="w-full max-w-sm">
            {/* Mobile logo */}
            <div className="lg:hidden text-center mb-8">
              <img src={logoIcon} alt="SecretSweep" className="w-28 mx-auto mb-4 object-contain logo-animated" />
              <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent leading-tight">SecretSweep</h1>
            </div>

            <div className="bg-white/70 dark:bg-white/[0.04] backdrop-blur-xl border border-gray-200/60 dark:border-white/[0.08] rounded-2xl p-8 shadow-2xl">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Welcome back</h2>
              <p className="text-gray-500 text-sm mb-6">Sign in to your account</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">Email</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.1] rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all"
                    placeholder="you@company.com" required autoFocus />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">Password</label>
                  <div className="relative">
                    <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.1] rounded-xl px-4 py-3 pr-12 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all"
                      placeholder="Enter your password" required />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg px-3 py-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
                  </div>
                )}

                <button type="submit" disabled={loading}
                  className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold py-3 rounded-xl transition-all duration-200 shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2">
                  {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Shield className="w-4 h-4" /> Sign In</>}
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-gray-500">
                Need an account? Contact your administrator.
              </p>
            </div>

            <div className="flex items-center justify-center gap-6 mt-6 text-xs text-gray-400 dark:text-gray-600">
              <span className="flex items-center gap-1"><Lock className="w-3 h-3" /> AES-256 Encrypted</span>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-4 left-0 right-0 text-center text-xs text-gray-400 dark:text-gray-600 z-10">
        SecretSweep &mdash; Secure your organization
      </div>
    </div>
  );
}
