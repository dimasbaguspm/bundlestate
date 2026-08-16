import { useState } from "react";
import { clsx } from "clsx";
import { Check, Copy, Search } from "lucide-react";
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

/** Shared UI class constants — mirrors the syntaxdiff design system. */
export const btn =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-edge bg-surface-2 px-3 py-2 text-sm font-medium text-ink transition-colors hover:border-edge-strong hover:bg-[var(--edge)] focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-50";

export const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent-strong focus:outline-none focus:ring-2 focus:ring-accent/50 disabled:cursor-not-allowed disabled:opacity-50";

export const btnActive =
  "border-accent/60 bg-accent/10 text-accent hover:border-accent/60 hover:bg-accent/15";

export const inputCls =
  "w-full rounded-lg border border-edge bg-well px-3 py-2 text-sm text-ink placeholder-faint focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20";

export function Spinner() {
  return (
    <span className="inline-block size-4 animate-spin rounded-full border-2 border-edge border-t-accent" />
  );
}

/** Compact search input used by each report tab to filter its view. */
export function FilterInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="relative block w-full">
      <Search
        className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-faint"
        aria-hidden
      />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full rounded-lg border border-edge bg-well py-1.5 pr-3 pl-8 text-sm text-ink placeholder-faint focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20"
      />
    </label>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="rounded-lg border border-[var(--tint-rose-bd)] bg-[var(--tint-rose-bg)] px-4 py-3 font-mono text-sm text-[var(--tint-rose-fg)]"
    >
      {message}
    </div>
  );
}

export function CopyButton({
  value,
  label = "Copy",
  className,
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable — ignore
    }
  };
  return (
    <button type="button" className={clsx(btn, className)} onClick={() => void copy()}>
      {copied ? (
        <Check className="size-3.5" aria-hidden />
      ) : (
        <Copy className="size-3.5" aria-hidden />
      )}
      {copied ? "Copied" : label}
    </button>
  );
}

type ButtonVariant = "primary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const buttonVariants: Record<ButtonVariant, string> = {
  primary: btnPrimary,
  ghost: btn,
  danger:
    "inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--tint-rose-bd)] bg-[var(--tint-rose-bg)] px-3 py-2 text-sm font-medium text-[var(--tint-rose-fg)] transition-colors hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-50",
};

export function Button({ variant = "primary", className, ...props }: ButtonProps) {
  return (
    <button
      className={clsx(
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        buttonVariants[variant],
        className,
      )}
      {...props}
    />
  );
}

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx("rounded-lg border border-edge bg-surface p-4 shadow-[var(--shadow)]", className)}
      {...props}
    />
  );
}

type BadgeTone = "neutral" | "accent" | "danger" | "ok";

const badgeTones: Record<BadgeTone, string> = {
  neutral: "border-edge text-dim",
  accent: "border-accent/60 bg-accent/10 text-accent",
  danger: "border-[var(--tint-rose-bd)] bg-[var(--tint-rose-bg)] text-[var(--tint-rose-fg)]",
  ok: "border-[var(--tint-emerald-bd)] bg-[var(--tint-emerald-bg)] text-[var(--tint-emerald-fg)]",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[11px] uppercase tracking-wide",
        badgeTones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}