import { type ButtonHTMLAttributes, type ReactNode, useEffect, useState } from 'react';
import { CircleCheck, Info, OctagonX, TriangleAlert } from 'lucide-react';
import type { WarningLevel } from '../lib/calculations';
import { cn } from '@/lib/utils';
import { Card as ShadCard } from '@/components/ui/card';
import { Badge as ShadBadge } from '@/components/ui/badge';
import { Button as ShadButton } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

// ---------------------------------------------------------------------------
// Compatibility layer.
// Same component APIs the pages have always imported from '../components/ui',
// reimplemented on shadcn/ui primitives so every page picks up the design
// system (and dark mode) without touching page logic.
// ---------------------------------------------------------------------------

type Tone = 'neutral' | 'safe' | 'warning' | 'danger';

// ---------------------------------------------------------------------------
// Card + layout
// ---------------------------------------------------------------------------

const CARD_ACCENT: Record<WarningLevel, string> = {
  danger: 'border-l-2 border-l-destructive',
  warning: 'border-l-2 border-l-warning',
  safe: 'border-l-2 border-l-success',
  info: 'border-l-2 border-l-primary',
};

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
    <ShadCard className={cn('block gap-0 p-5', accent && CARD_ACCENT[accent], className)}>
      {children}
    </ShadCard>
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
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat tile (big number on the dashboard)
// ---------------------------------------------------------------------------

const STAT_VALUE: Record<Tone, string> = {
  neutral: 'text-foreground',
  safe: 'text-success',
  warning: 'text-warning',
  danger: 'text-destructive',
};

export function Stat({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: Tone;
}) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3.5 shadow-2xs">
      <div className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
        {label}
      </div>
      <div className={cn('mt-1 text-xl leading-tight font-semibold', STAT_VALUE[tone])}>
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Badge / pill
// ---------------------------------------------------------------------------

const BADGE_TONE: Record<Tone | 'info', string> = {
  neutral: 'bg-secondary text-secondary-foreground',
  safe: 'bg-success/10 text-success dark:bg-success/15',
  warning: 'bg-warning/10 text-warning dark:bg-warning/15',
  danger: 'bg-destructive/10 text-destructive dark:bg-destructive/15',
  info: 'bg-accent text-accent-foreground',
};

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: Tone | 'info';
}) {
  return (
    <ShadBadge variant="secondary" className={cn('mx-1 align-middle', BADGE_TONE[tone])}>
      {children}
    </ShadBadge>
  );
}

// ---------------------------------------------------------------------------
// Progress bar
// ---------------------------------------------------------------------------

const PROGRESS_FILL: Record<Exclude<Tone, 'neutral'>, string> = {
  safe: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-destructive',
};

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
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
      className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
    >
      <div
        className={cn('h-full rounded-full transition-[width]', PROGRESS_FILL[tone ?? auto])}
        style={{ width: `${clamped * 100}%` }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Warning / advice cards
// ---------------------------------------------------------------------------

const WARNING_STYLE: Record<WarningLevel, { icon: typeof Info; className: string }> = {
  danger: {
    icon: OctagonX,
    className: 'border-destructive/30 bg-destructive/5 [&>svg]:text-destructive',
  },
  warning: {
    icon: TriangleAlert,
    className: 'border-warning/40 bg-warning/5 [&>svg]:text-warning',
  },
  safe: {
    icon: CircleCheck,
    className: 'border-success/40 bg-success/5 [&>svg]:text-success',
  },
  info: {
    icon: Info,
    className: 'border-border bg-card [&>svg]:text-primary',
  },
};

export function WarningCard({
  level,
  title,
  message,
}: {
  level: WarningLevel;
  title: string;
  message: string;
}) {
  const { icon: IconComp, className } = WARNING_STYLE[level];
  return (
    <Alert className={cn('mb-2', className)}>
      <IconComp aria-hidden />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
}

const BUTTON_VARIANT = {
  primary: 'default',
  secondary: 'secondary',
  ghost: 'ghost',
  danger: 'destructive',
} as const;

export function Button({ variant = 'primary', className = '', ...rest }: ButtonProps) {
  return <ShadButton variant={BUTTON_VARIANT[variant]} className={className} {...rest} />;
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
// Radix Dialog underneath: focus trap, Escape, backdrop click and aria wiring
// come for free — the page-facing API stays `title`/`onClose`/`children`.

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-h-[85dvh] overflow-y-auto sm:max-w-md"
        aria-describedby={undefined}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Form field helpers
// ---------------------------------------------------------------------------
// Kept as an implicit <label> wrapper: whatever single control the pages put
// inside is automatically associated with the label text - no ids needed.

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
    <label className="field flex w-full flex-col gap-1.5">
      <span className="text-sm leading-snug font-medium">{label}</span>
      {children}
      {hint && <span className="text-xs leading-normal text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
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
    <ToggleGroup
      type="single"
      variant="outline"
      size={size === 'sm' ? 'sm' : 'default'}
      value={value}
      onValueChange={(v) => v && onChange(v as T)}
    >
      {options.map((o) => (
        <ToggleGroupItem
          key={o.value}
          value={o.value}
          className="px-3 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground"
        >
          {o.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
