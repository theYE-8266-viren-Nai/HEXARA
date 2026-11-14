export function SpaceLoader({ message, detail, className = "" }: { message: string; detail?: string; className?: string }) {
  return <div className={`space-loader ${className}`} role="status" aria-live="polite" aria-busy="true">
    <span className="space-loader-art" aria-hidden="true"><span className="space-loader-orbit" /><span className="space-loader-planet" /><span className="space-loader-signal" /></span>
    <span className="space-loader-copy"><strong>{message}</strong>{detail ? <span>{detail}</span> : null}</span>
  </div>;
}
