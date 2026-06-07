"use client";

import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-client";
import { ListeningSidebar } from "@/components/listening/ListeningSidebar";
import { ListeningHeader } from "@/components/listening/ListeningHeader";
import { PricingModal } from "@/components/PricingModal";

type SubscriptionPlan = "free" | "pro" | "premium";

interface ProfileRow {
  full_name: string | null;
  subscription_plan: SubscriptionPlan | null;
}

export interface ListeningContextValue {
  user: any;
  displayName: string;
  userPlan: SubscriptionPlan;
  progress: any;
  loading: boolean;
  refreshProgress: () => Promise<void>;
}

const ListeningContext = createContext<ListeningContextValue | null>(null);

export function useListening() {
  const ctx = useContext(ListeningContext);
  if (!ctx) {
    throw new Error("useListening must be used inside ListeningLayoutShell");
  }
  return ctx;
}

interface ListeningLayoutShellProps {
  children: ReactNode;
}

export function ListeningLayoutShell({ children }: ListeningLayoutShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [userPlan, setUserPlan] = useState<SubscriptionPlan>("free");
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [displayName, setDisplayName] = useState("bạn");
  const [progress, setProgress] = useState<any>(null);

  const refreshProgress = async () => {
    try {
      const response = await fetch("/api/progress");
      if (response.ok) {
        setProgress(await response.json());
      }
    } catch (error) {
      console.error("Error loading progress:", error);
    }
  };

  // Refresh progress when navigating back from a video page
  useEffect(() => {
    if (!user) return;
    if (pathname && !pathname.startsWith("/listening/video/")) {
      refreshProgress();
    }
  }, [pathname, user]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        router.push("/signin");
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name, subscription_plan")
        .eq("id", data.user.id)
        .maybeSingle();
      const profile = profileData as ProfileRow | null;

      setUser(data.user);
      setDisplayName(
        profile?.full_name ||
          data.user.user_metadata?.full_name ||
          data.user.user_metadata?.name ||
          data.user.email?.split("@")[0] ||
          "bạn"
      );
      setUserPlan(profile?.subscription_plan || "free");

      await refreshProgress();
      setLoading(false);
    });
  }, [router]);

  if (loading) {
    return (
      <div className="learning-shell min-h-screen flex items-center justify-center bg-[#f8fbff] dark:bg-[#0b1220]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600 dark:text-slate-300">Đang tải...</p>
        </div>
      </div>
    );
  }

  const contextValue: ListeningContextValue = {
    user,
    displayName,
    userPlan,
    progress,
    loading,
    refreshProgress,
  };

  return (
    <ListeningContext.Provider value={contextValue}>
      <div className="learning-shell min-h-screen flex bg-[#f8fbff] text-slate-900 dark:bg-[#0b1220] dark:text-slate-100">
        <ListeningSidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          progress={
            progress
              ? {
                  streak: progress.streak.current,
                  weekDays: progress.streak.week,
                }
              : undefined
          }
        />

        <main
          className={`flex-1 ${sidebarCollapsed ? "ml-20" : "ml-72"} transition-all duration-300`}
        >
          <ListeningHeader
            user={user}
            userPlan={userPlan}
            onUpgradeClick={() => setShowPricingModal(true)}
            showSearch={true}
          />

          {children}
        </main>

        <PricingModal
          isOpen={showPricingModal}
          onClose={() => setShowPricingModal(false)}
          currentPlan={userPlan}
        />
      </div>

      <style jsx global>{`
        @keyframes float-soft {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-8px) rotate(2deg); }
        }
        .learning-shell {
          background-image:
            linear-gradient(rgba(14, 165, 233, 0.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(20, 184, 166, 0.08) 1px, transparent 1px);
          background-size: 28px 28px;
        }
        .dark .learning-shell {
          background-image:
            linear-gradient(rgba(45, 212, 191, 0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(56, 189, 248, 0.06) 1px, transparent 1px);
        }
        .learning-grid {
          background-image:
            linear-gradient(rgba(15, 23, 42, 0.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(15, 23, 42, 0.08) 1px, transparent 1px);
          background-size: 22px 22px;
        }
        .dark .learning-grid {
          background-image:
            linear-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.08) 1px, transparent 1px);
        }
        .animate-float-soft {
          animation: float-soft 4s ease-in-out infinite;
        }
      `}</style>
    </ListeningContext.Provider>
  );
}
