/** Barras de ecualizador animadas — indican visualmente la pista que suena. */
export function Equalizer({ className = '' }: { className?: string }) {
  return (
    <span className={`flex h-4 items-end gap-0.5 ${className}`} aria-hidden>
      <span className="eq-bar h-full" style={{ animationDelay: '0ms' }} />
      <span className="eq-bar h-full" style={{ animationDelay: '150ms' }} />
      <span className="eq-bar h-full" style={{ animationDelay: '300ms' }} />
      <span className="eq-bar h-full" style={{ animationDelay: '450ms' }} />
    </span>
  );
}
