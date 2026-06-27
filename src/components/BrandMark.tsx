export function BrandMark({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <path d="M12 18 L32 36 L52 18" stroke="#28D6B6" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
      <path d="M18 27 L32 41 L46 27" stroke="#4FB6F7" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
      <path d="M24 35 L32 43 L40 35" stroke="#FF6E5B" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="32" cy="51" r="3.4" fill="#FF6E5B" />
    </svg>
  );
}

export function BrandWordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-serif font-semibold tracking-tight ${className}`} style={{ fontFamily: "Fraunces, Georgia, serif" }}>
      VeloMed <span style={{ color: "#28D6B6" }}>OS</span>
    </span>
  );
}