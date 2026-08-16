import { clsx, type ClassValue } from "clsx";
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

export function cx(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

type ButtonVariant = "primary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-accent text-bg hover:bg-accent-strong disabled:opacity-40 border border-accent",
  ghost: "bg-transparent text-muted hover:text-text border border-line hover:border-ink/50",
  danger: "bg-transparent text-danger border border-danger/40 hover:border-danger",
};

export function Button({ variant = "primary", className, ...props }: ButtonProps) {
  return (
    <button
      className={cx(
        "inline-flex h-9 cursor-pointer items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed",
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
      className={cx("rounded-lg border border-line bg-surface p-4 shadow-sm", className)}
      {...props}
    />
  );
}

type BadgeTone = "neutral" | "accent" | "danger" | "ok";

const badgeTones: Record<BadgeTone, string> = {
  neutral: "border-line text-muted",
  accent: "border-ink/40 text-ink",
  danger: "border-danger/40 text-danger",
  ok: "border-ok/40 text-ok",
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
      className={cx(
        "inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[11px] uppercase tracking-wide",
        badgeTones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
