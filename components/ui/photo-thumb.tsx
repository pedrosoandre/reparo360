const GRADIENTS = [
  ["#1E293B", "#0F172A"],
  ["#312E81", "#0F172A"],
  ["#164E63", "#0F172A"],
  ["#3F1D1D", "#0F172A"],
  ["#3F3E1D", "#0F172A"],
  ["#1D3F35", "#0F172A"],
];

export function PhotoThumb({
  seed = 0,
  className = "",
  label,
  showDamage = true,
}: {
  seed?: number;
  className?: string;
  label?: string;
  showDamage?: boolean;
}) {
  const [c1, c2] = GRADIENTS[seed % GRADIENTS.length];
  const damageX = 30 + (seed * 17) % 40;
  const damageY = 35 + (seed * 23) % 30;
  return (
    <div className={`relative aspect-square rounded-xl overflow-hidden border border-[color:var(--color-border)] ${className}`}>
      <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id={`bg-${seed}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={c1} />
            <stop offset="100%" stopColor={c2} />
          </linearGradient>
          <radialGradient id={`carGlow-${seed}`}>
            <stop offset="0%" stopColor="#94A3B8" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#94A3B8" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`dmg-${seed}`}>
            <stop offset="0%" stopColor="#F5A524" stopOpacity="0.85" />
            <stop offset="60%" stopColor="#F5A524" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#F5A524" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="100" height="100" fill={`url(#bg-${seed})`} />
        {/* fake car surface */}
        <ellipse cx="50" cy="70" rx="55" ry="20" fill={`url(#carGlow-${seed})`} />
        <path
          d={`M 10 ${55 + (seed % 3) * 3} Q 50 ${40 + seed % 5} 90 ${55 + (seed * 2) % 6}`}
          stroke="#CBD5E1"
          strokeOpacity="0.35"
          strokeWidth="1.2"
          fill="none"
        />
        {showDamage && (
          <>
            <circle cx={damageX} cy={damageY} r="14" fill={`url(#dmg-${seed})`} />
            <circle cx={damageX} cy={damageY} r="2.5" fill="#F5A524" />
          </>
        )}
      </svg>
      {label && (
        <span className="absolute bottom-1.5 left-1.5 text-[9px] font-medium bg-[color:var(--color-surface)]/90 backdrop-blur px-1.5 py-0.5 rounded text-[color:var(--color-text)]">
          {label}
        </span>
      )}
    </div>
  );
}
