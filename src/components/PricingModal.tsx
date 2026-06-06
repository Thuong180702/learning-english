"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";

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
      name: "Miễn phí",
      price: "0đ",
      description: "Bắt đầu học ngay",
      features: [
        "10 video mỗi tháng",
        "Lưu 50 từ vựng",
        "Tính năng tra từ cơ bản",
        "Phụ đề tiếng Anh",
      ],
      cta: "Bắt đầu miễn phí",
      color: "from-slate-500 to-slate-600",
      bgColor: "bg-white",
    },
    {
      id: "pro",
      name: "Pro",
      price: "99,000đ",
      period: "/tháng",
      description: "Dành cho người học nghiêm túc",
      features: [
        "Video không giới hạn",
        "Từ vựng không giới hạn",
        "Tra từ nâng cao + phát âm",
        "Phụ đề song ngữ",
        "Thống kê tiến độ chi tiết",
        "Ôn tập thông minh",
      ],
      cta: "Nâng cấp Pro",
      color: "from-orange-500 to-rose-500",
      bgColor: "bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50",
      popular: currentPlan === "free",
    },
    {
      id: "premium",
      name: "Premium",
      price: "199,000đ",
      period: "/tháng",
      description: "Trải nghiệm cao cấp nhất",
      features: [
        "Tất cả tính năng Pro",
        "AI Coach cá nhân hóa",
        "Luyện phát âm với AI",
        "Bài tập tương tác",
        "Tải video offline",
        "Hỗ trợ ưu tiên",
      ],
      cta: "Nâng cấp Premium",
      color: "from-purple-500 to-pink-500",
      bgColor: "bg-white",
    },
  ];

  // Filter plans based on current plan
  const visiblePlans = plans.filter((plan) => {
    if (currentPlan === "free") return true; // Show all 3 plans
    if (currentPlan === "pro") return plan.id !== "free"; // Show Pro, Premium only
    if (currentPlan === "premium") return plan.id === "premium"; // Show Premium only
    return true;
  });

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-6xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 rounded-3xl shadow-2xl m-4">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center bg-white/80 hover:bg-white rounded-full transition-colors z-10"
        >
          <X className="w-5 h-5 text-slate-600" />
        </button>

        <div className="p-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
              Chọn gói phù hợp với bạn
            </h2>
            <p className="text-slate-600 text-lg">
              Bắt đầu miễn phí, nâng cấp khi sẵn sàng
            </p>
          </div>

          <div className={`grid gap-6 ${visiblePlans.length === 3 ? "md:grid-cols-3" : visiblePlans.length === 2 ? "md:grid-cols-2 max-w-4xl mx-auto" : "max-w-md mx-auto"}`}>
            {visiblePlans.map((plan) => (
              <Card
                key={plan.id}
                className={`relative overflow-hidden transition-all hover:shadow-2xl hover:-translate-y-2 ${
                  plan.popular
                    ? "border-2 border-orange-500 shadow-xl shadow-orange-500/20 scale-105"
                    : plan.id === currentPlan
                    ? "border-2 border-green-500 shadow-xl shadow-green-500/20"
                    : "border border-slate-200 bg-white/80 backdrop-blur-sm"
                } ${plan.bgColor}`}
              >
                {plan.popular && (
                  <div className="absolute top-0 left-0 right-0">
                    <div className="bg-gradient-to-r from-orange-500 to-rose-500 text-white text-center py-2 text-sm font-semibold">
                      Phổ biến nhất
                    </div>
                  </div>
                )}
                {plan.id === currentPlan && (
                  <div className="absolute top-0 left-0 right-0">
                    <div className="bg-gradient-to-r from-green-500 to-emerald-500 text-white text-center py-2 text-sm font-semibold">
                      Gói hiện tại
                    </div>
                  </div>
                )}
                <div className={`p-8 ${plan.popular || plan.id === currentPlan ? "pt-16" : ""}`}>
                  <h3 className="text-2xl font-bold text-slate-800 mb-2">
                    {plan.name}
                  </h3>
                  <p className="text-slate-500 text-sm mb-6">
                    {plan.description}
                  </p>
                  <div className="mb-6">
                    <span className={`text-5xl font-bold bg-gradient-to-r ${plan.color} bg-clip-text text-transparent`}>
                      {plan.price}
                    </span>
                    {plan.period && (
                      <span className="text-slate-500 ml-1">{plan.period}</span>
                    )}
                  </div>
                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-3">
                        <Check className={`w-5 h-5 flex-shrink-0 mt-0.5 bg-gradient-to-r ${plan.color} text-white rounded-full p-0.5`} />
                        <span className="text-slate-600">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    disabled={plan.id === currentPlan}
                    className={`w-full h-12 rounded-xl font-semibold transition-all ${
                      plan.popular
                        ? "bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-600 hover:to-rose-600 text-white shadow-lg shadow-orange-500/30"
                        : plan.id === currentPlan
                        ? "bg-green-100 text-green-700 cursor-not-allowed"
                        : "bg-slate-100 hover:bg-slate-200 text-slate-800"
                    }`}
                  >
                    {plan.id === currentPlan ? "Gói hiện tại" : plan.cta}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
