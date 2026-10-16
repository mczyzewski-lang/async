import { AnimatePresence, motion } from 'motion/react';
import { ChevronLeft, X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router';

export function Chip({ active, onClick, children, testId, className = '' }: { active?: boolean; onClick?: () => void; children: ReactNode; testId?: string; className?: string }) {
  return (
    <button type="button" className={`chip ${className}`} data-active={!!active} aria-pressed={!!active} onClick={onClick} data-testid={testId}>
      {children}
    </button>
  );
}

export function Section({ title, action, children, className = '' }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`mt-8 ${className}`}>
      {(title || action) && (
        <div className="mb-3 flex items-end justify-between gap-3">
          {title && <h2 className="font-display text-[1.35rem] leading-tight font-normal text-ink">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function PageHeader({ title, subtitle, back, right }: { title: ReactNode; subtitle?: ReactNode; back?: boolean | string; right?: ReactNode }) {
  const nav = useNavigate();
  return (
    <header className="safe-top safe-x sticky top-0 z-20 bg-paper/90 pb-3 backdrop-blur-md">
      <div className="flex min-h-11 items-center gap-2">
        {back && (
          <button
            className="icon-btn -ml-2 hover:bg-ink/5"
            aria-label="Wróć"
            onClick={() => (typeof back === 'string' ? nav(back) : history.length > 1 ? nav(-1) : nav('/'))}
          >
            <ChevronLeft size={24} strokeWidth={1.6} />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-[1.65rem] leading-tight font-normal">{title}</h1>
          {subtitle && <p className="truncate text-sm text-ink-soft">{subtitle}</p>}
        </div>
        {right}
      </div>
    </header>
  );
}

export function Sheet({ open, onClose, title, children, testId, dark = false }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; testId?: string; dark?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <button aria-label="Zamknij" className="absolute inset-0 bg-ink/35" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            data-testid={testId}
            className={`relative max-h-[86dvh] w-full max-w-xl overflow-y-auto rounded-t-[1.75rem] ${dark ? 'bg-ink text-paper' : 'bg-mist'} safe-bottom px-5 pt-3 shadow-[var(--shadow-float)]`}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-current opacity-20" />
            <div className="mb-3 flex items-start justify-between gap-3">
              {title && <h3 className="font-display text-xl leading-snug">{title}</h3>}
              <button className="icon-btn -mr-2 -mt-1 shrink-0 hover:bg-current/10" aria-label="Zamknij" onClick={onClose}>
                <X size={20} strokeWidth={1.6} />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="card p-4">
      <div className="eyebrow">{label}</div>
      <div className="mt-1 font-display text-3xl leading-none">{value}</div>
      {hint && <div className="mt-1 text-xs text-ink-soft">{hint}</div>}
    </div>
  );
}

export function Toggle({ checked, onChange, label, description, testId }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string; testId?: string }) {
  return (
    <label className="flex min-h-12 cursor-pointer items-center justify-between gap-4 py-2">
      <span>
        <span className="block font-medium">{label}</span>
        {description && <span className="block text-sm text-ink-soft">{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        data-testid={testId}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? 'bg-sage-deep' : 'bg-ink/15'}`}
      >
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
    </label>
  );
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'sage' | 'gold' | 'coral' }) {
  const tones = {
    neutral: 'bg-ink/6 text-ink-2',
    sage: 'bg-sage-soft text-sage-deep',
    gold: 'bg-[#f1e6cc] text-[#7d6330]',
    coral: 'bg-coral-soft text-[#9b4430]',
  };
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.72rem] font-semibold ${tones[tone]}`}>{children}</span>;
}

export function Disclaimer({ compact = false }: { compact?: boolean }) {
  return (
    <p className={`text-ink-soft ${compact ? 'text-xs' : 'text-sm'} leading-relaxed`}>
      Flowspace ma charakter edukacyjny i nie zastępuje porady lekarza, fizjoterapeuty ani nauczyciela jogi. Ćwicz w swoim zakresie ruchu, bez bólu.
      Aplikacja nie analizuje Twojej postawy.
    </p>
  );
}
