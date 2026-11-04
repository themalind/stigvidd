// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { EyeOff, Flag, ImageOff, MailWarning, MessageSquareText, Mountain, Upload, Users } from "lucide-react";
import { dashboardQueryOptions } from "@/features/dashboard/api/dashboard";
import { AttentionCard, HealthBar, MetricCard, SectionTitle } from "@/features/dashboard/components/dashboard-cards";
import { ReviewRow } from "@/features/dashboard/components/review-row";
import { importsAwaitingReview, share, trailStats } from "@/features/dashboard/utils/dashboard";
import { outboxCountsQueryOptions } from "@/features/mail/api/mail-outbox";
import { reportCountsQueryOptions } from "@/features/moderation/api/content-reports";
import { sessionsQueryOptions } from "@/features/trail-import/api/trail-import";
import { Page } from "@/components/page";
import { trailsQueryOptions } from "@/features/trails/api/trail";

const LIVE = { refetchInterval: 60_000 };

// keep-comment: undefined = still loading ("…"), null = failed with nothing cached ("—")
function pick<T>(
  query: Pick<UseQueryResult<T, unknown>, "data" | "isError">,
  select: (value: T) => number,
): number | undefined | null {
  if (query.data !== undefined) return select(query.data);
  return query.isError ? null : undefined;
}

function greeting(hour: number): string {
  if (hour < 5) return "Good night";
  if (hour < 10) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

// keep-comment: useQuery, not suspense: every tile loads and fails on its own without blanking the rest
export default function DashboardPage() {
  const reports = useQuery({ ...reportCountsQueryOptions(), ...LIVE });
  const outbox = useQuery({ ...outboxCountsQueryOptions(), ...LIVE });
  const sessions = useQuery({ ...sessionsQueryOptions(), ...LIVE });
  const dashboard = useQuery({ ...dashboardQueryOptions(), ...LIVE });
  const trails = useQuery({ ...trailsQueryOptions(), select: trailStats });
  const stats = trails.data;
  const now = new Date();

  return (
    <Page width="full" className="space-y-10">
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
            value={pick(reports, (c) => c.pending)}
            to="/moderation"
            icon={Flag}
          />
          <AttentionCard
            label="Failed mails"
            value={pick(outbox, (c) => c.failed)}
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
            value={pick(trails, (t) => t.withExampleImages)}
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
            value={pick(dashboard, (d) => d.userCount)}
            delta={dashboard.data?.newUsersLast7Days}
            detail="new this week"
            icon={Users}
            tone="sky"
          />
          <MetricCard
            label="Reviews"
            value={pick(dashboard, (d) => d.reviewCount)}
            delta={dashboard.data?.reviewsLast7Days}
            detail="new this week"
            icon={MessageSquareText}
            tone="violet"
          />
          <MetricCard
            label="Trails"
            value={pick(trails, (t) => t.total)}
            detail={stats ? `${stats.total - stats.inactive} active in the app` : undefined}
            to="/trails"
            icon={Mountain}
            tone="emerald"
          />
          <MetricCard
            label="Inactive trails"
            value={pick(trails, (t) => t.inactive)}
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
            {dashboard.isPending && <p className="text-muted-foreground text-sm">Loading…</p>}
            {dashboard.isError && !dashboard.data && (
              <p className="text-muted-foreground text-sm">The latest reviews could not be loaded.</p>
            )}
            {dashboard.data &&
              (dashboard.data.latestReviews.length === 0 ? (
                <p className="text-muted-foreground text-sm">No reviews yet.</p>
              ) : (
                <ul className="divide-y">
                  {dashboard.data.latestReviews.map((review) => (
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
                {trails.isError ? "The trails could not be loaded." : "Loading…"}
              </p>
            )}
          </div>
        </section>
      </div>
    </Page>
  );
}
