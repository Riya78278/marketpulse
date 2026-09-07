"use client";

import { useSession } from "next-auth/react";

export function Header() {
  const { data: session } = useSession();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <header className="flex h-16 items-center justify-between border-b border-zinc-800 bg-zinc-950 px-6">
      <div>
        <h1 className="text-lg font-semibold text-white">
          {getGreeting()}{session?.user?.name ? `, ${session.user.name}` : ""}
        </h1>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-xs text-zinc-500">Last updated</p>
          <p className="text-sm text-zinc-400">
            {new Date().toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20 text-sm font-medium text-emerald-500">
          {session?.user?.name?.[0]?.toUpperCase() || "U"}
        </div>
      </div>
    </header>
  );
}
