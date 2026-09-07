"use client";

import { SessionProvider } from "next-auth/react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <div className="flex min-h-screen bg-zinc-950">
        <Sidebar />
        <div className="ml-64 flex-1">
          <Header />
          <main className="p-6">{children}</main>
        </div>
      </div>
    </SessionProvider>
  );
}
