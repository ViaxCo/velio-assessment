import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { Activity } from "@/lib/api";

export function Button({
  arrow,
  small,
  pending,
  disabled,
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { arrow?: boolean; small?: boolean; pending?: boolean }) {
  const shape = arrow ? "justify-between py-1.5 pl-5 pr-1.5" : small ? "justify-center px-4" : "justify-center px-5";
  return (
    <button
      disabled={disabled || pending}
      aria-busy={pending}
      className={`group inline-flex items-center gap-3 rounded-full bg-lime font-medium text-ink transition-all duration-300 enabled:hover:bg-lime-hover enabled:active:scale-95 ${pending ? "cursor-wait" : "disabled:cursor-not-allowed disabled:opacity-40"} ${small ? "min-h-10 text-sm" : "min-h-12 text-[15px]"} ${shape} ${className}`}
      {...props}
    >
      {children}
      {arrow && (
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white transition-transform duration-300 group-hover:rotate-45">
          <svg
            viewBox="0 0 24 24"
            aria-hidden
            className={`size-4 fill-none stroke-current stroke-2 [stroke-linecap:round] [stroke-linejoin:round] ${pending ? "animate-spin" : ""}`}
          >
            <path d={pending ? "M21 12a9 9 0 1 1-6.2-8.6" : "M7 7h10v10M7 17 17 7"} />
          </svg>
        </span>
      )}
    </button>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-[32px] bg-card p-6 md:p-8 ${className}`}>{children}</div>;
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
    <span
      key={label}
      aria-live="polite"
      className={`inline-flex shrink-0 animate-pop items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition-colors duration-300 ${style}`}
    >
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

export function BackLink() {
  return (
    <Link
      href="/"
      className="group inline-flex items-center gap-2 rounded-full bg-card py-1.5 pl-1.5 pr-4 text-sm font-medium shadow-xs transition-all duration-300 hover:bg-white/60 active:scale-95"
    >
      <span className="flex size-7 items-center justify-center rounded-full bg-canvas transition-transform duration-300 group-hover:-translate-x-0.5">
        <svg viewBox="0 0 24 24" aria-hidden className="size-4 fill-none stroke-current stroke-2 [stroke-linecap:round] [stroke-linejoin:round]">
          <path d="m12 19-7-7 7-7M19 12H5" />
        </svg>
      </span>
      All activities
    </Link>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-[32px] bg-ink/5 ${className}`} />;
}

export const inputClass =
  "w-full rounded-2xl border border-line bg-card px-4 py-3 text-base text-ink outline-none transition placeholder:text-[#0a0a0a]/30 focus:border-ink";
