"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Sparkles, X, Zap } from "lucide-react";

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlan: "free" | "pro" | "premium";
}

export function PricingModal({ isOpen, onClose, currentPlan }: PricingModalProps) {
  if (!isOpen) return null;

  const plans = [
    {
      id: "free",
      name: "Free",
      price: "0đ",
      description: "Bắt đầu học với các video cơ bản.",
      features: [
        "10 video mỗi tháng",
        "Lưu 50 từ vựng",
        "Tra từ cơ bản",
        "Phụ đề tiếng Anh",
      ],
      cta: "Đang dùng",
      accent: "from-slate-400 to-slate-500",
    },
    {
      id: "pro",
      name: "Pro",
      price: "99,000đ",
      period: "/tháng",
      description: "Cho người học đều đặn mỗi ngày.",
      features: [
        "Video không giới hạn",
        "Từ vựng không giới hạn",
        "Tra từ nâng cao + phát âm",
        "Phụ đề song ngữ",
        "Thống kê tiến độ chi tiết",
        "Ôn tập thông minh",
      ],
      cta: "Nâng cấp Pro",
      accent: "from-teal-400 to-lime-300",
      popular: currentPlan === "free",
    },
    {
      id: "premium",
      name: "Premium",
      price: "199,000đ",
      period: "/tháng",
      description: "Mở đầy đủ bộ công cụ học cá nhân.",
      features: [
        "Tất cả tính năng Pro",
        "AI Coach cá nhân hóa",
        "Luyện phát âm với AI",
        "Bài tập tương tác",
        "Tải video offline",
        "Hỗ trợ ưu tiên",
      ],
      cta: "Nâng cấp Premium",
      accent: "from-sky-400 to-teal-300",
    },
  ];

  const visiblePlans = plans.filter((plan) => {
    if (currentPlan === "free") return true;
    if (currentPlan === "pro") return plan.id !== "free";
    if (currentPlan === "premium") return plan.id === "premium";
    return true;
  });

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm animate-fadeIn">
      <div className="learning-shell relative max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-[2.5rem] bg-[#f8fbff] shadow-2xl shadow-slate-950/30 dark:bg-slate-950 dark:text-slate-100">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-600 shadow-lg ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:text-slate-950 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700 dark:hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="relative overflow-hidden rounded-t-[2.5rem] bg-gradient-to-br from-teal-100 via-emerald-50 to-lime-100 px-8 py-10 text-slate-950 dark:from-slate-900 dark:via-teal-950 dark:to-slate-950 dark:text-white">
          <div className="absolute inset-0 learning-grid opacity-35" />
          <div className="relative max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-sm font-extrabold text-teal-700 dark:bg-white/10 dark:text-teal-200">
              <Sparkles className="h-4 w-4" />
              Upgrade lab
            </div>
            <h2 className="font-heading text-4xl font-extrabold leading-tight">
              Chọn gói học phù hợp
            </h2>
            <p className="mt-3 text-base font-medium leading-7 text-slate-600 dark:text-slate-300">
              Giữ giao diện học tập gọn gàng, mở thêm giới hạn video, từ vựng và công cụ luyện tập khi cần.
            </p>
          </div>
        </div>

        <div className="p-6 lg:p-8">
          <div className={`grid gap-5 ${visiblePlans.length === 3 ? "lg:grid-cols-3" : visiblePlans.length === 2 ? "lg:grid-cols-2" : "max-w-md"}`}>
            {visiblePlans.map((plan) => {
              const isCurrent = plan.id === currentPlan;

              return (
                <Card
                  key={plan.id}
                  className={`relative overflow-hidden rounded-[2rem] p-6 shadow-xl transition hover:-translate-y-1 ${
                    plan.popular
                      ? "border-teal-300 bg-gradient-to-br from-teal-50 to-lime-50 shadow-teal-100/80 dark:from-slate-900 dark:to-teal-950 dark:shadow-slate-950/30"
                      : isCurrent
                      ? "border-emerald-300 bg-emerald-50 shadow-emerald-100/80 dark:bg-slate-900 dark:shadow-slate-950/30"
                      : "border-slate-200 bg-white shadow-slate-200/70 dark:bg-slate-900 dark:shadow-slate-950/30"
                  }`}
                >
                  {(plan.popular || isCurrent) && (
                    <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-slate-950 px-3 py-1.5 text-xs font-extrabold text-white dark:bg-teal-300 dark:text-slate-950">
                      {isCurrent ? <Check className="h-3.5 w-3.5" /> : <Zap className="h-3.5 w-3.5" />}
                      {isCurrent ? "Gói hiện tại" : "Nên chọn"}
                    </div>
                  )}

                  <h3 className="font-heading text-2xl font-extrabold text-slate-950 dark:text-white">
                    {plan.name}
                  </h3>
                  <p className="mt-2 min-h-[48px] text-sm font-medium leading-6 text-slate-500 dark:text-slate-300">
                    {plan.description}
                  </p>

                  <div className="mt-6">
                    <span className={`bg-gradient-to-r ${plan.accent} bg-clip-text font-heading text-5xl font-extrabold text-transparent`}>
                      {plan.price}
                    </span>
                    {plan.period && (
                      <span className="ml-1 text-sm font-semibold text-slate-500">{plan.period}</span>
                    )}
                  </div>

                  <ul className="mt-7 space-y-3">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-3">
                        <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-r ${plan.accent} text-slate-950`}>
                          <Check className="h-3.5 w-3.5" />
                        </span>
                        <span className="text-sm font-medium leading-6 text-slate-600 dark:text-slate-300">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    disabled={isCurrent}
                    variant={isCurrent ? "outline" : plan.popular ? "upgrade" : "create"}
                    className={`mt-8 h-12 w-full font-extrabold ${
                      isCurrent
                        ? "bg-white text-emerald-700 ring-1 ring-emerald-200 dark:bg-slate-800 dark:text-emerald-300 dark:ring-slate-700"
                        : ""
                    }`}
                  >
                    {isCurrent ? "Gói hiện tại" : plan.cta}
                  </Button>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
