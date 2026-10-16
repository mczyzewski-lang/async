export function Loading({ label = 'Przygotowuję przestrzeń…' }: { label?: string }) {
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-4" role="status" aria-live="polite">
      <div className="relative h-14 w-14">
        <div className="absolute inset-0 animate-ping rounded-full bg-sage/30" style={{ animationDuration: '2.4s' }} />
        <div className="absolute inset-3 rounded-full bg-sage/60" />
      </div>
      <p className="text-sm text-ink-soft">{label}</p>
    </div>
  );
}
