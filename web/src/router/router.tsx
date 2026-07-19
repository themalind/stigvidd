import { ProtectedRoute } from "@/components/auth/protected-route";
import { Loader2 } from "lucide-react";
import { lazy, Suspense, type ComponentType } from "react";
import { createBrowserRouter } from "react-router";

const CommingSoonPage = lazy(() => import("@/pages/comming-soon/comming-soon-page"));
const DashboardPage = lazy(() => import("@/pages/dashboard/dashboard-page"));
const Layout = lazy(() => import("@/pages/Layout"));
const LoginPage = lazy(() => import("@/pages/login/login-page"));
const MediaPage = lazy(() => import("@/pages/media/media-page"));
const MigrationPage = lazy(() => import("@/pages/admin/migration-page"));
const NotFoundPage = lazy(() => import("@/pages/NotFoundPage"));
const TrailsPage = lazy(() => import("@/pages/trails/trails-page"));
const UsersPage = lazy(() => import("@/pages/users/users-page"));

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
    element: withSuspense(CommingSoonPage),
    errorElement: withSuspense(NotFoundPage),
  },
  {
    path: "/login",
    element: withSuspense(LoginPage),
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
            path: "/media",
            handle: { title: "Media Library" },
            element: withSuspense(MediaPage),
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
]);
