import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { Activity } from "@/lib/api";

export function Button({ className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`inline-flex min-h-12 items-center justify-center rounded-full bg-sunset px-6 font-semibold text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-line disabled:text-muted ${className}`}
      {...props}
    />
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-3xl border border-line bg-card p-5 ${className}`}>{children}</div>;
}

export function Notice({ tone, title, children }: { tone: "error" | "success" | "info"; title: string; children?: ReactNode }) {
  const tones = {
    error: "bg-sunset-soft text-ink",
    success: "bg-lagoon-soft text-ink",
    info: "bg-line/50 text-ink",
  };
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-2xl px-4 py-3 text-sm ${tones[tone]}`}>
      <p className="font-semibold">{title}</p>
      {children && <div className="mt-1 text-muted">{children}</div>}
    </div>
  );
}

export function SpotsBadge({ activity }: { activity: Pick<Activity, "spotsLeft" | "capacity"> }) {
  const { spotsLeft } = activity;
  const style = spotsLeft === 0 ? "bg-line text-muted" : spotsLeft <= 3 ? "bg-sunset-soft text-sunset" : "bg-lagoon-soft text-lagoon";
  const label = spotsLeft === 0 ? "Full" : spotsLeft === 1 ? "Last spot" : `${spotsLeft} spots left`;
  return (
    <span aria-live="polite" className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${style}`}>
      {spotsLeft > 0 && <span className="size-1.5 animate-pulse rounded-full bg-current" />}
      {label}
    </span>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-3xl bg-line/60 ${className}`} />;
}

export const inputClass =
  "w-full rounded-2xl border border-line bg-card px-4 py-3 text-base outline-none transition focus:border-ink";
