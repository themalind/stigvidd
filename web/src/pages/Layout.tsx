import Header from "@/components/header";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { Outlet } from "react-router";

export default function Layout() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <Header />
        <Outlet />
      </SidebarInset>
      <Toaster />
    </SidebarProvider>
  );
}
