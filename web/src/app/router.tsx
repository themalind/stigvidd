// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { ProtectedRoute } from "@/features/auth/components/protected-route";
import { Loader2 } from "lucide-react";
import { lazy, Suspense, type ComponentType } from "react";
import { createBrowserRouter, Navigate } from "react-router";
import { detailLoaders, onlyWhenParamsChange } from "./loaders";
import { queryClient } from "./query-client";

const loaders = detailLoaders(queryClient);

const CityAreasPage = lazy(() => import("@/app/routes/city-areas"));
const DashboardPage = lazy(() => import("@/app/routes/dashboard"));
const HikeSubmissionReviewPage = lazy(() => import("@/app/routes/hike-submission-review"));
const HikeSubmissionsPage = lazy(() => import("@/app/routes/hike-submissions"));
const Layout = lazy(() => import("@/app/layout/app-layout"));
const LoginPage = lazy(() => import("@/app/routes/login"));
const MailOutboxPage = lazy(() => import("@/app/routes/mail-outbox"));
const MailTemplatePage = lazy(() => import("@/app/routes/mail-template"));
const MailTemplatesPage = lazy(() => import("@/app/routes/mail-templates"));
const MediaPage = lazy(() => import("@/app/routes/media"));
const MigrationPage = lazy(() => import("@/app/routes/migration"));
const ModerationPage = lazy(() => import("@/app/routes/moderation"));
const NotFoundPage = lazy(() => import("@/app/routes/not-found"));
const TrailImportPage = lazy(() => import("@/app/routes/trail-import"));
const TrailImportReviewPage = lazy(() => import("@/app/routes/trail-import-review"));
const TrailsPage = lazy(() => import("@/app/routes/trails"));
const UsersPage = lazy(() => import("@/app/routes/users"));

function PageFallback() {
  return (
    <div className="flex h-svh w-full items-center justify-center">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  );
}

function withSuspense(Component: ComponentType) {
  return (
    <Suspense fallback={<PageFallback />}>
      <Component />
    </Suspense>
  );
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: withSuspense(LoginPage),
    errorElement: withSuspense(NotFoundPage),
  },
  {
    // Old bookmarks and links that still point at the former login route.
    path: "/login",
    element: <Navigate to="/" replace />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: withSuspense(Layout),
        children: [
          {
            path: "/dashboard",
            handle: { title: "Dashboard" },
            element: withSuspense(DashboardPage),
          },
          {
            path: "/users",
            handle: { title: "Users" },
            element: withSuspense(UsersPage),
          },
          {
            path: "/trails",
            handle: { title: "Trails" },
            element: withSuspense(TrailsPage),
          },
          {
            path: "/areas",
            handle: { title: "Areas" },
            element: withSuspense(CityAreasPage),
          },
          {
            path: "/media",
            handle: { title: "Media Library" },
            element: withSuspense(MediaPage),
          },
          {
            path: "/trail-import",
            handle: { title: "Trail Import" },
            element: withSuspense(TrailImportPage),
          },
          {
            path: "/trail-import/:sessionId",
            handle: { title: "Review Import" },
            loader: loaders.trailImportSession,
            shouldRevalidate: onlyWhenParamsChange,
            HydrateFallback: PageFallback,
            element: withSuspense(TrailImportReviewPage),
          },
          {
            path: "/moderation",
            handle: { title: "Moderation" },
            element: withSuspense(ModerationPage),
          },
          {
            path: "/hike-submissions",
            handle: { title: "Hike Submissions" },
            element: withSuspense(HikeSubmissionsPage),
          },
          {
            path: "/hike-submissions/:identifier",
            handle: { title: "Review Submission" },
            loader: loaders.hikeSubmission,
            shouldRevalidate: onlyWhenParamsChange,
            HydrateFallback: PageFallback,
            element: withSuspense(HikeSubmissionReviewPage),
          },
          {
            path: "/mail-templates",
            handle: { title: "Mail Templates" },
            element: withSuspense(MailTemplatesPage),
          },
          {
            path: "/mail-templates/:identifier",
            handle: { title: "Edit Mail Template" },
            loader: loaders.mailTemplate,
            shouldRevalidate: onlyWhenParamsChange,
            HydrateFallback: PageFallback,
            element: withSuspense(MailTemplatePage),
          },
          {
            path: "/mail-outbox",
            handle: { title: "Mail Outbox" },
            element: withSuspense(MailOutboxPage),
          },
          {
            path: "/migration",
            handle: { title: "Migration" },
            element: withSuspense(MigrationPage),
          },
        ],
      },
    ],
  },
  {
    path: "*",
    element: withSuspense(NotFoundPage),
  },
]);
