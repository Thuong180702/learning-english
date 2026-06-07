"use client";

import { Bell, Search, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { UserDropdown } from "@/components/UserDropdown";

type SubscriptionPlan = "free" | "pro" | "premium";

interface ListeningHeaderProps {
  user: any;
  userPlan: SubscriptionPlan;
  onUpgradeClick: () => void;
  showSearch?: boolean;
}

export function ListeningHeader({
  user,
  userPlan,
  onUpgradeClick,
  showSearch = true,
}: ListeningHeaderProps) {
  const planLabel = userPlan === "free" ? "Free" : userPlan === "pro" ? "Pro" : "Premium";

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center border-b border-slate-200/70 bg-white/[0.85] px-6 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/85">
      <div className="flex w-full items-center justify-between gap-4">
        {showSearch ? (
          <div className="flex-1 max-w-xl">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                type="text"
                placeholder="Nhập từ khóa để tìm kiếm..."
                className="h-11 rounded-full border-slate-200 bg-slate-50 pl-11 text-sm shadow-inner shadow-slate-200/40 focus:bg-white"
              />
            </div>
          </div>
        ) : (
          <div className="flex-1" />
        )}

        <div className="flex items-center gap-2">
          {userPlan !== "premium" && (
            <Button onClick={onUpgradeClick} variant="upgrade" className="h-10 px-4 text-xs">
              <Sparkles className="mr-1.5 h-4 w-4" />
              Nâng cấp
            </Button>
          )}

          <div
            className={`rounded-full px-4 py-2 text-xs font-extrabold ${
              userPlan === "free"
                ? "bg-slate-100 text-slate-700 ring-1 ring-slate-200"
                : userPlan === "pro"
                ? "bg-teal-100 text-teal-700 ring-1 ring-teal-200"
                : "bg-fuchsia-100 text-fuchsia-700 ring-1 ring-fuchsia-200"
            }`}
          >
            {planLabel}
          </div>

          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Bell className="h-4 w-4" />
          </button>

          <UserDropdown user={user} compact={true} />
        </div>
      </div>
    </header>
  );
}
