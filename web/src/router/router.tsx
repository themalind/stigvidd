import CommingSoonPage from "@/pages/comming-soon/comming-soon-page";
import DashboardPage from "@/pages/dashboard/dashboard-page";
import Layout from "@/pages/Layout";
import LoginPage from "@/pages/login/login-page";
import TrailsPage from "@/pages/trails/trails-page";
import UsersPage from "@/pages/users/users-page";
import { createBrowserRouter } from "react-router";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <CommingSoonPage />,
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
        element: <DashboardPage />,
      },
      {
        path: "/users",
        element: <UsersPage />,
      },
      {
        path: "/trails",
        element: <TrailsPage />,
      },
    ],
  },
]);
