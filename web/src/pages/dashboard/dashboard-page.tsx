// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { getCounts } from "@/api/content-reports";
import { getDashboard, type DashboardReview } from "@/api/dashboard";
import { getOutboxCounts } from "@/api/mail-outbox";
import { getAllTrails } from "@/api/trail";
import { getSessions } from "@/api/trail-import";
import { importsAwaitingReview, relativeTime, share, trailStats } from "@/lib/dashboard";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  CheckCircle2,
  EyeOff,
  Flag,
  ImageIcon,
  ImageOff,
  MailWarning,
  MessageSquareText,
  Mountain,
  Star,
  Upload,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";

type Loadable<T> = { state: "loading" } | { state: "failed" } | { state: "loaded"; value: T };

function useLoad<T>(load: () => Promise<T>): Loadable<T> {
  const [result, setResult] = useState<Loadable<T>>({ state: "loading" });

  useEffect(() => {
    let cancelled = false;
    load()
      .then((value) => !cancelled && setResult({ state: "loaded", value }))
      .catch(() => !cancelled && setResult({ state: "failed" }));
    return () => {
      cancelled = true;
    };
  }, [load]);

  return result;
}

function pick<T>(source: Loadable<T>, select: (value: T) => number): number | undefined | null {
  if (source.state === "loading") return undefined;
  if (source.state === "failed") return null;
  return select(source.value);
}

function display(value: number | undefined | null): string {
  if (value === undefined) return "…";
  if (value === null) return "—";
  return value.toLocaleString("sv-SE");
}

type Tone = "emerald" | "sky" | "violet" | "amber";

const TONES: Record<Tone, { chip: string; bar: string }> = {
  emerald: {
    chip: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    bar: "bg-emerald-500",
  },
  sky: { chip: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300", bar: "bg-sky-500" },
  violet: {
    chip: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
    bar: "bg-violet-500",
  },
  amber: { chip: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300", bar: "bg-amber-500" },
};

function greeting(hour: number): string {
  if (hour < 5) return "Good night";
  if (hour < 10) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

interface AttentionCardProps {
  label: string;
  value: number | undefined | null;
  to: string;
  icon: LucideIcon;
}

function AttentionCard({ label, value, to, icon: Icon }: AttentionCardProps) {
  const pending = typeof value === "number" && value > 0;
  const clear = value === 0;

  return (
    <Link
      to={to}
      className={cn(
        "group flex items-center gap-4 rounded-xs border bg-card p-4 transition-all hover:-translate-y-0.5 hover:shadow-md",
        pending && "border-amber-300 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/30",
      )}
    >
      <span
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-xs",
          pending ? TONES.amber.chip : clear ? TONES.emerald.chip : "bg-muted text-muted-foreground",
        )}
      >
        {clear ? <CheckCircle2 className="size-5" /> : <Icon className="size-5" />}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-muted-foreground truncate text-sm">{label}</span>
        <span
          className="text-2xl font-semibold tabular-nums"
          title={value === null ? "Could not be loaded" : undefined}
        >
          {clear ? (
            <span className="text-base font-medium text-emerald-700 dark:text-emerald-300">All clear</span>
          ) : (
            display(value)
          )}
        </span>
      </span>
      <ArrowRight className="text-muted-foreground size-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
    </Link>
  );
}

interface MetricCardProps {
  label: string;
  value: number | undefined | null;
  delta?: number | null;
  detail?: string;
  to?: string;
  icon: LucideIcon;
  tone: Tone;
}

function MetricCard({ label, value, delta, detail, to, icon: Icon, tone }: MetricCardProps) {
  const body = (
    <>
      <div className="flex items-start justify-between">
        <span className="text-muted-foreground text-sm font-medium">{label}</span>
        <span className={cn("flex size-9 items-center justify-center rounded-xs", TONES[tone].chip)}>
          <Icon className="size-4" />
        </span>
      </div>
      <span className="mt-2 text-4xl font-semibold tracking-tight tabular-nums">{display(value)}</span>
      <span className="text-muted-foreground mt-1 flex items-center gap-2 text-xs">
        {typeof delta === "number" && (
          <span
            className={cn(
              "rounded-xs px-1.5 py-0.5 font-medium",
              delta > 0 ? TONES[tone].chip : "bg-muted text-muted-foreground",
            )}
          >
            +{delta.toLocaleString("sv-SE")}
          </span>
        )}
        {detail}
      </span>
    </>
  );

  const className = "relative flex flex-col overflow-hidden rounded-xs border bg-card p-5";
  const accent = <span className={cn("absolute inset-x-0 top-0 h-1", TONES[tone].bar)} aria-hidden />;

  return to ? (
    <Link to={to} className={cn(className, "transition-all hover:-translate-y-0.5 hover:shadow-md")}>
      {accent}
      {body}
    </Link>
  ) : (
    <div className={className}>
      {accent}
      {body}
    </div>
  );
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`${rating} of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn(
            "size-3.5",
            n <= Math.round(rating) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40",
          )}
        />
      ))}
    </span>
  );
}

function ReviewRow({ review }: { review: DashboardReview }) {
  const author = review.authorNickName ?? "Deleted user";

  return (
    <li className="flex gap-3 py-4 first:pt-0 last:pb-0">
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
          TONES.violet.chip,
        )}
        aria-hidden
      >
        {author.charAt(0).toUpperCase()}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span className="font-medium">{author}</span>
          <span className="text-muted-foreground">on</span>
          <span className="font-medium">{review.trailName}</span>
          <Stars rating={review.rating ?? 0} />
          {review.isHidden && (
            <span className={cn("flex items-center gap-1 rounded-xs px-1.5 py-0.5 text-xs", TONES.amber.chip)}>
              <EyeOff className="size-3" /> Hidden
            </span>
          )}
        </div>
        {review.text ? (
          <p className="text-muted-foreground line-clamp-2 text-sm">{review.text}</p>
        ) : (
          <p className="text-muted-foreground/70 text-sm italic">No text, just a rating</p>
        )}
        <div className="text-muted-foreground flex items-center gap-3 text-xs">
          {review.createdAt && <span>{relativeTime(review.createdAt)}</span>}
          {(review.imageCount ?? 0) > 0 && (
            <span className="flex items-center gap-1">
              <ImageIcon className="size-3" /> {review.imageCount}
            </span>
          )}
        </div>
      </div>
    </li>
  );
}

function HealthBar({ label, percent, tone, to }: { label: string; percent: number; tone: Tone; to: string }) {
  return (
    <Link to={to} className="group flex flex-col gap-1.5">
      <span className="flex items-baseline justify-between text-sm">
        <span className="group-hover:underline">{label}</span>
        <span className="font-medium tabular-nums">{percent}%</span>
      </span>
      <span className="bg-muted h-2 overflow-hidden rounded-xs">
        <span
          className={cn("block h-full rounded-xs transition-[width] duration-700", TONES[tone].bar)}
          style={{ width: `${percent}%` }}
        />
      </span>
    </Link>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">{children}</h2>;
}

export default function DashboardPage() {
  const reports = useLoad(getCounts);
  const outbox = useLoad(getOutboxCounts);
  const trails = useLoad(getAllTrails);
  const sessions = useLoad(getSessions);
  const dashboard = useLoad(getDashboard);

  const stats = trails.state === "loaded" ? trailStats(trails.value) : undefined;
  const now = new Date();

  return (
    <main>
      <div className="container mx-auto flex flex-col gap-10 py-10">
        <header className="relative overflow-hidden rounded-xs border bg-gradient-to-br from-emerald-50 via-background to-sky-50 p-8 dark:from-emerald-950/40 dark:to-sky-950/40">
          <Mountain
            className="absolute -right-6 -bottom-10 size-56 text-emerald-600/10 dark:text-emerald-400/10"
            aria-hidden
          />
          <p className="text-muted-foreground text-sm">
            {now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{greeting(now.getHours())}</h1>
          <p className="text-muted-foreground mt-2 max-w-xl">Here is what is happening in Stigvidd right now.</p>
        </header>

        <section className="flex flex-col gap-3">
          <SectionTitle>Needs attention</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <AttentionCard
              label="Reports to moderate"
              value={pick(reports, (c) => c.pending ?? 0)}
              to="/moderation"
              icon={Flag}
            />
            <AttentionCard
              label="Failed mails"
              value={pick(outbox, (c) => c.failed ?? 0)}
              to="/mail-outbox"
              icon={MailWarning}
            />
            <AttentionCard
              label="Imports awaiting review"
              value={pick(sessions, importsAwaitingReview)}
              to="/trail-import"
              icon={Upload}
            />
            <AttentionCard
              label="Trails with example images"
              value={pick(trails, () => stats?.withExampleImages ?? 0)}
              to="/trails?missing=ExampleImages"
              icon={ImageOff}
            />
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <SectionTitle>Overview</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Users"
              value={pick(dashboard, (d) => d.userCount ?? 0)}
              delta={dashboard.state === "loaded" ? (dashboard.value.newUsersLast7Days ?? 0) : null}
              detail="new this week"
              icon={Users}
              tone="sky"
            />
            <MetricCard
              label="Reviews"
              value={pick(dashboard, (d) => d.reviewCount ?? 0)}
              delta={dashboard.state === "loaded" ? (dashboard.value.reviewsLast7Days ?? 0) : null}
              detail="new this week"
              icon={MessageSquareText}
              tone="violet"
            />
            <MetricCard
              label="Trails"
              value={pick(trails, (t) => t.length)}
              detail={stats ? `${stats.total - stats.inactive} active in the app` : undefined}
              to="/trails"
              icon={Mountain}
              tone="emerald"
            />
            <MetricCard
              label="Inactive trails"
              value={pick(trails, () => stats?.inactive ?? 0)}
              detail="hidden in the app"
              to="/trails?status=Inactive"
              icon={EyeOff}
              tone="amber"
            />
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-3">
          <section className="flex flex-col gap-3 lg:col-span-2">
            <SectionTitle>Latest reviews</SectionTitle>
            <div className="rounded-xs border bg-card p-5">
              {dashboard.state === "loading" && <p className="text-muted-foreground text-sm">Loading…</p>}
              {dashboard.state === "failed" && (
                <p className="text-muted-foreground text-sm">The latest reviews could not be loaded.</p>
              )}
              {dashboard.state === "loaded" &&
                (dashboard.value.latestReviews.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No reviews yet.</p>
                ) : (
                  <ul className="divide-y">
                    {dashboard.value.latestReviews.map((review) => (
                      <ReviewRow key={review.identifier} review={review} />
                    ))}
                  </ul>
                ))}
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <SectionTitle>Trail health</SectionTitle>
            <div className="flex flex-col gap-5 rounded-xs border bg-card p-5">
              {stats ? (
                <>
                  <HealthBar
                    label="Active in the app"
                    percent={share(stats.total - stats.inactive, stats.total)}
                    tone="emerald"
                    to="/trails?status=Inactive"
                  />
                  <HealthBar
                    label="Have images"
                    percent={share(stats.total - stats.withoutImages, stats.total)}
                    tone="sky"
                    to="/trails?missing=Images"
                  />
                  <HealthBar
                    label="Real photos, not examples"
                    percent={share(stats.total - stats.withExampleImages, stats.total)}
                    tone="violet"
                    to="/trails?missing=ExampleImages"
                  />
                  <HealthBar
                    label="Have a short description"
                    percent={share(stats.total - stats.withoutDescription, stats.total)}
                    tone="amber"
                    to="/trails?missing=Description"
                  />
                </>
              ) : (
                <p className="text-muted-foreground text-sm">
                  {trails.state === "failed" ? "The trails could not be loaded." : "Loading…"}
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
