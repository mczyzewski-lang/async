import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

export function Section({
  index,
  title,
  open,
  onToggle,
  children,
  badge,
}: {
  index: number;
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <div className="border-b border-line last:border-b-0">
      <button onClick={onToggle} className="group flex w-full items-center gap-3 px-5 py-4 text-left">
        <span className="w-5 text-[11px] font-medium tabular-nums text-faint">{String(index).padStart(2, '0')}</span>
        <span className="flex-1 text-[13.5px] font-medium tracking-[-0.005em] text-ink">{title}</span>
        {badge}
        <ChevronDown size={15} strokeWidth={1.6} className={cx('text-muted transition-transform duration-300', open && 'rotate-180')} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
            className="overflow-hidden"
          >
            <div className="space-y-5 px-5 pb-6 pt-0.5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Label({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-2">
      <span className="text-[11.5px] font-medium uppercase tracking-[0.06em] text-muted">{children}</span>
      {hint && <span className="text-[11px] text-faint">{hint}</span>}
    </div>
  );
}

/** Numeric input in centimetres bound to a value stored in metres */
export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit = 'cm',
  scale = 100,
  decimals = 0,
  slider = true,
  hint,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  scale?: number;
  decimals?: number;
  slider?: boolean;
  hint?: ReactNode;
  disabled?: boolean;
}) {
  const display = +(value * scale).toFixed(decimals);
  const [text, setText] = useState(String(display));
  const [focus, setFocus] = useState(false);
  useEffect(() => {
    if (!focus) setText(String(display).replace('.', ','));
  }, [display, focus]);
  const commit = (raw: string) => {
    const n = parseFloat(raw.replace(',', '.'));
    if (!isFinite(n)) {
      setText(String(display));
      return;
    }
    const clamped = Math.min(max, Math.max(min, n));
    onChange(clamped / scale);
    setText(String(+clamped.toFixed(decimals)).replace('.', ','));
  };
  const fill = ((display - min) / (max - min)) * 100;
  return (
    <div className={cx(disabled && 'pointer-events-none opacity-40')}>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <span className="text-[12.5px] text-ink-2">{label}</span>
        <div className="flex items-center rounded-lg border border-line bg-paper px-2 py-1 transition-colors focus-within:border-ink">
          <input
            type="text"
            inputMode="decimal"
            className="w-[52px] bg-transparent text-right text-[13px] font-medium tabular-nums outline-none"
            value={text}
            onFocus={() => setFocus(true)}
            onChange={(e) => setText(e.target.value)}
            onBlur={(e) => {
              setFocus(false);
              commit(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                e.preventDefault();
                const n = Math.min(max, Math.max(min, display + (e.key === 'ArrowUp' ? step : -step)));
                onChange(n / scale);
              }
            }}
          />
          <span className="ml-1 text-[11px] text-faint">{unit}</span>
        </div>
      </div>
      {slider && (
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={Math.min(max, Math.max(min, display))}
          style={{ ['--fill' as string]: `${fill}%` }}
          onChange={(e) => onChange(parseFloat(e.target.value) / scale)}
        />
      )}
      {hint && <div className="mt-1 text-[11px] text-faint">{hint}</div>}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = 'md',
}: {
  value: T;
  options: { value: T; label: ReactNode; title?: string; disabled?: boolean }[];
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
}) {
  return (
    <div className="flex rounded-xl bg-sand p-[3px]">
      {options.map((o) => (
        <button
          key={o.value}
          title={o.title}
          disabled={o.disabled}
          onClick={() => onChange(o.value)}
          className={cx(
            'relative flex-1 rounded-[9px] px-2 font-medium transition-colors disabled:opacity-35',
            size === 'sm' ? 'py-1.5 text-[11.5px]' : 'py-2 text-[12.5px]',
            value === o.value ? 'text-ink' : 'text-muted hover:text-ink-2',
          )}
        >
          {value === o.value && (
            <motion.span layoutId={undefined} className="absolute inset-0 rounded-[9px] bg-paper shadow-[0_1px_3px_rgb(0_0_0/0.08)]" />
          )}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; hint?: ReactNode }) {
  return (
    <button onClick={() => onChange(!checked)} className="flex w-full items-center justify-between gap-3 text-left">
      <span>
        <span className="block text-[12.5px] text-ink-2">{label}</span>
        {hint && <span className="block text-[11px] text-faint">{hint}</span>}
      </span>
      <span className={cx('relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors', checked ? 'bg-ink' : 'bg-[#dcd7cf]')}>
        <motion.span
          className="absolute top-[3px] h-4 w-4 rounded-full bg-white shadow"
          animate={{ left: checked ? 19 : 3 }}
          transition={{ type: 'spring', stiffness: 500, damping: 32 }}
        />
      </span>
    </button>
  );
}

export function Card({
  selected,
  onClick,
  children,
  className,
  title,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={cx(
        'group relative rounded-2xl border bg-paper text-left transition-all duration-200',
        selected ? 'border-ink shadow-[0_0_0_1px_var(--color-ink)]' : 'border-line hover:border-[#cfc9bf] hover:shadow-soft',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Pill({ tone, children }: { tone: 'ok' | 'warn' | 'err' | 'neutral' | 'accent'; children: ReactNode }) {
  const t = {
    ok: 'bg-ok-soft text-ok',
    warn: 'bg-warn-soft text-warn',
    err: 'bg-err-soft text-err',
    neutral: 'bg-sand text-muted',
    accent: 'bg-accent-soft text-accent',
  }[tone];
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-[3px] text-[10.5px] font-medium', t)}>{children}</span>;
}

export function Swatch({ color, selected, onClick, title, metallic }: { color: string; selected: boolean; onClick: () => void; title: string; metallic?: boolean }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={cx('relative h-9 w-9 rounded-full transition-transform hover:scale-105', selected && 'ring-2 ring-ink ring-offset-2 ring-offset-panel')}
      style={{
        background: metallic
          ? `linear-gradient(135deg, ${color} 0%, #ffffff88 45%, ${color} 60%, ${color} 100%), ${color}`
          : color,
        boxShadow: 'inset 0 0 0 1px rgb(0 0 0 / 0.08)',
      }}
    />
  );
}
