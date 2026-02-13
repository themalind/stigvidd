import Header from "@/components/header";
import { Outlet } from "react-router";

export default function Layout() {
  return (
    <>
      <Header />
      <main>
        <Outlet />
      </main>
    </>
  );
}
