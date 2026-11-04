// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { ProtectedRoute } from "@/features/auth/components/protected-route";
import { lazy, Suspense, type ComponentType } from "react";
import { createBrowserRouter, Navigate, type RouteObject } from "react-router";
import { FullPageLoading } from "@/components/loading-state";
import { paths } from "@/config/paths";
import { onlyWhenParamsChange } from "./loaders";
import { pages, type AppPage } from "./pages";

const Layout = lazy(() => import("@/app/layout/app-layout"));
const LoginPage = lazy(() => import("@/app/routes/login"));
const NotFoundPage = lazy(() => import("@/app/routes/not-found"));

function withSuspense(Component: ComponentType) {
  return (
    <Suspense fallback={<FullPageLoading />}>
      <Component />
    </Suspense>
  );
}

// keep-comment: no Suspense of its own; the layout's QueryBoundary catches both the lazy chunk and the page's queries
function pageRoute({ path, title, component: Page, loader }: AppPage): RouteObject {
  return {
    path,
    handle: { title },
    element: <Page />,
    ...(loader && { loader, shouldRevalidate: onlyWhenParamsChange, HydrateFallback: FullPageLoading }),
  };
}

export const router = createBrowserRouter([
  {
    path: paths.login,
    element: withSuspense(LoginPage),
    errorElement: withSuspense(NotFoundPage),
  },
  {
    // keep-comment: old bookmarks still point at the former login route
    path: "/login",
    element: <Navigate to={paths.login} replace />,
  },
  {
    element: <ProtectedRoute />,
    children: [{ element: withSuspense(Layout), children: pages.map(pageRoute) }],
  },
  {
    path: "*",
    element: withSuspense(NotFoundPage),
  },
]);
