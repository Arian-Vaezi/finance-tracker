import {
  type ButtonHTMLAttributes,
  type ReactNode,
  useEffect,
  useState,
} from 'react';
import type { WarningLevel } from '../lib/calculations';

// ---------------------------------------------------------------------------
// Card + layout
// ---------------------------------------------------------------------------

export function Card({
  children,
  className = '',
  accent,
}: {
  children: ReactNode;
  className?: string;
  accent?: WarningLevel;
}) {
  return (
    <div className={`card ${accent ? `card--${accent}` : ''} ${className}`}>{children}</div>
  );
}

export function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-header">
      <div>
        <h2 className="section-title">{title}</h2>
        {subtitle && <p className="section-subtitle">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat tile (big number on the dashboard)
// ---------------------------------------------------------------------------

export function Stat({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'neutral' | 'safe' | 'warning' | 'danger';
}) {
  return (
    <div className={`stat stat--${tone}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Badge / pill
// ---------------------------------------------------------------------------

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'safe' | 'warning' | 'danger' | 'info';
}) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}

// ---------------------------------------------------------------------------
// Progress bar
// ---------------------------------------------------------------------------

export function ProgressBar({
  fraction,
  tone,
}: {
  fraction: number;
  tone?: 'safe' | 'warning' | 'danger';
}) {
  const clamped = Math.max(0, Math.min(1, fraction || 0));
  const auto: 'safe' | 'warning' | 'danger' =
    clamped < 0.7 ? 'safe' : clamped < 0.95 ? 'warning' : 'danger';
  return (
    <div className="progress">
      <div
        className={`progress-fill progress-fill--${tone ?? auto}`}
        style={{ width: `${clamped * 100}%` }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Warning / advice cards
// ---------------------------------------------------------------------------

export function WarningCard({
  level,
  title,
  message,
}: {
  level: WarningLevel;
  title: string;
  message: string;
}) {
  const icon =
    level === 'danger' ? '⛔' : level === 'warning' ? '⚠️' : level === 'safe' ? '✅' : 'ℹ️';
  return (
    <div className={`warning warning--${level}`}>
      <span className="warning-icon" aria-hidden>
        {icon}
      </span>
      <div>
        <div className="warning-title">{title}</div>
        <div className="warning-message">{message}</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
}

export function Button({ variant = 'primary', className = '', ...rest }: ButtonProps) {
  return <button className={`btn btn--${variant} ${className}`} {...rest} />;
}

/** A two-click delete button: first click asks for confirmation. */
export function ConfirmButton({
  onConfirm,
  label = 'Delete',
  confirmLabel = 'Sure?',
}: {
  onConfirm: () => void;
  label?: string;
  confirmLabel?: string;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);

  return (
    <Button
      variant={armed ? 'danger' : 'ghost'}
      onClick={() => {
        if (armed) {
          onConfirm();
          setArmed(false);
        } else {
          setArmed(true);
        }
      }}
    >
      {armed ? confirmLabel : label}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Modal (used by the add/edit forms)
// ---------------------------------------------------------------------------

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Form field helpers
// ---------------------------------------------------------------------------

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="empty-state">{children}</div>;
}

// ---------------------------------------------------------------------------
// Segmented control (used for the Personal / Demo mode switch)
// ---------------------------------------------------------------------------

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = 'md',
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
}) {
  return (
    <div className={`seg seg--${size}`} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          className={`seg-btn ${value === o.value ? 'active' : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
