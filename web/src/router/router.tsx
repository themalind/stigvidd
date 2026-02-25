import CommingSoonPage from "@/pages/comming-soon/comming-soon-page";
import DashboardPage from "@/pages/dashboard/dashboard-page";
import Layout from "@/pages/Layout";
import LoginPage from "@/pages/login/login-page";
import NotFoundPage from "@/pages/NotFoundPage";
import TrailsPage from "@/pages/trails/trails-page";
import UsersPage from "@/pages/users/users-page";
import { createBrowserRouter } from "react-router";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <CommingSoonPage />,
    errorElement: <NotFoundPage />,
  },
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    element: <Layout />,
    children: [
      {
        path: "/dashboard",
        handle: { title: "Dashboard" },
        element: <DashboardPage />,
      },
      {
        path: "/users",
        handle: { title: "Users" },
        element: <UsersPage />,
      },
      {
        path: "/trails",
        handle: { title: "Trails" },
        element: <TrailsPage />,
      },
    ],
  },
]);
