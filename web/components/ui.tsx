import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { Activity } from "@/lib/api";

export function Button({ className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`inline-flex min-h-12 items-center justify-center rounded-full bg-lime px-6 font-medium text-ink transition hover:brightness-95 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
      {...props}
    />
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-[28px] bg-card p-5 sm:p-6 ${className}`}>{children}</div>;
}

export function Notice({ tone, title, children }: { tone: "error" | "success" | "info"; title: string; children?: ReactNode }) {
  const tones = {
    error: "bg-alert-soft",
    success: "bg-lime-soft",
    info: "bg-ink/5",
  };
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-2xl px-4 py-3 text-sm text-ink ${tones[tone]}`}>
      <p className="font-bold">{title}</p>
      {children && <div className="mt-1 text-ink/80">{children}</div>}
    </div>
  );
}

export function SpotsBadge({ activity }: { activity: Pick<Activity, "spotsLeft" | "capacity"> }) {
  const { spotsLeft } = activity;
  const style = spotsLeft === 0 ? "bg-ink/10 text-muted" : spotsLeft <= 3 ? "bg-alert-soft text-alert" : "bg-lime-soft text-ink";
  const label = spotsLeft === 0 ? "Full" : spotsLeft === 1 ? "Last spot" : `${spotsLeft} spots left`;
  return (
    <span aria-live="polite" className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${style}`}>
      {spotsLeft > 0 && <span className="size-1.5 animate-pulse rounded-full bg-current" />}
      {label}
    </span>
  );
}

const icons = {
  calendar: (
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </>
  ),
  ticket: <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2ZM13 5v2M13 17v2M13 11v2" />,
  host: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M20 21a8 8 0 0 0-16 0" />
    </>
  ),
};

export function Detail({ icon, children }: { icon: keyof typeof icons; children: ReactNode }) {
  return (
    <p className="flex items-center gap-2.5 text-ink/80">
      <svg viewBox="0 0 24 24" aria-hidden className="size-5 shrink-0 fill-none stroke-current stroke-[1.75] text-muted">
        {icons[icon]}
      </svg>
      {children}
    </p>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-[28px] bg-ink/5 ${className}`} />;
}

export const inputClass =
  "w-full rounded-2xl border border-line bg-card px-4 py-3 text-base text-ink outline-none transition placeholder:text-muted/70 focus:border-ink";
