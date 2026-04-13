export default function Logo({ size = 32, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#06b6d4" />
          <stop offset="50%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#1e40af" />
        </linearGradient>
        <linearGradient id="handleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#2563eb" />
        </linearGradient>
      </defs>
      {/* Magnifying glass circle */}
      <circle cx="26" cy="26" r="18" stroke="url(#logoGrad)" strokeWidth="4" fill="none" opacity="0.9" />
      <circle cx="26" cy="26" r="13" stroke="url(#logoGrad)" strokeWidth="1.5" fill="none" opacity="0.3" />
      {/* Handle */}
      <line x1="39" y1="39" x2="56" y2="56" stroke="url(#handleGrad)" strokeWidth="5" strokeLinecap="round" />
      {/* Lock body */}
      <rect x="19" y="24" width="14" height="11" rx="2" fill="url(#logoGrad)" />
      {/* Lock shackle */}
      <path d="M22 24V20C22 17.2 24.2 15 27 15H25C27.8 15 30 17.2 30 20V24" stroke="url(#logoGrad)" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      {/* Keyhole */}
      <circle cx="26" cy="28.5" r="2" fill="#0f172a" opacity="0.6" />
      <rect x="25.2" y="29.5" width="1.6" height="3" rx="0.8" fill="#0f172a" opacity="0.6" />
    </svg>
  );
}
