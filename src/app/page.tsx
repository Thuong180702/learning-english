"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase-client";
import { UserDropdown } from "@/components/UserDropdown";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check } from "lucide-react";

export default function HomePage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
    });
  }, []);

  return (
    <main className="learning-shell min-h-screen bg-[#f8fbff] relative overflow-hidden dark:text-slate-100">
      {/* Header */}
      <header className="relative z-40 px-6 py-5">
        <nav className="max-w-7xl mx-auto flex items-center justify-between rounded-full border border-slate-200 bg-white/85 px-5 py-3 shadow-lg shadow-slate-200/60 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/85 dark:shadow-slate-950/30">
          <Link href="/" className="flex items-center gap-4 group">
            <div className="relative w-20 h-20 transition-transform group-hover:scale-110 group-hover:rotate-6">
              <Image
                src="/image/logo.png"
                alt="LearnEnglish Logo"
                fill
                className="object-contain drop-shadow-2xl"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-extrabold text-slate-950 leading-tight">
                LearnEnglish
              </span>
              <span className="text-xs text-teal-700 font-bold uppercase tracking-[0.18em]">
                Học tiếng Anh qua video
              </span>
            </div>
          </Link>

          {!loading && (
            <div className="flex items-center gap-3">
              {user ? (
                <UserDropdown user={user} />
              ) : (
                <>
                  <Link href="/signin">
                    <Button
                      variant="ghost"
                      className="rounded-full text-slate-700 hover:text-teal-700 hover:bg-teal-50 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      Đăng nhập
                    </Button>
                  </Link>
                  <Link href="/register">
                    <Button className="transition-all">
                      Bắt đầu ngay
                    </Button>
                  </Link>
                </>
              )}
            </div>
          )}
        </nav>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 px-6 pt-16 pb-24">
        <div className="max-w-6xl mx-auto text-center">
          <div className="inline-block mb-6 animate-fade-in">
            <span className="inline-flex items-center gap-2 px-4 py-2 bg-white/85 backdrop-blur-sm rounded-full text-sm font-bold text-teal-700 shadow-lg shadow-slate-200/60 border border-teal-200">
              <span className="w-2 h-2 bg-teal-500 rounded-full animate-pulse" />
              Học tiếng Anh thông qua video YouTube
            </span>
          </div>

          <h1 className="text-6xl md:text-7xl font-bold mb-6 animate-slide-up leading-tight">
            <span className="bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 bg-clip-text text-transparent">
              Chinh phục tiếng Anh
            </span>
            <br />
            <span className="bg-gradient-to-r from-teal-600 via-emerald-600 to-lime-600 bg-clip-text text-transparent">
              cùng video yêu thích
            </span>
          </h1>

          <p className="text-xl text-slate-600 mb-12 max-w-2xl mx-auto animate-slide-up leading-relaxed" style={{ animationDelay: "0.1s" }}>
            Học từ vựng, luyện phát âm và cải thiện kỹ năng nghe qua những video bạn yêu thích trên YouTube
          </p>

          <div className="animate-scale-in" style={{ animationDelay: "0.2s" }}>
            <Link href={user ? "/listening" : "/register"}>
              <Button className="h-14 px-10 text-lg">
                {user ? "Vào học ngay" : "Bắt đầu học miễn phí"}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative z-10 px-3 py-20">
        <div className="w-full">
          <h2 className="text-4xl font-bold text-center mb-4 bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
            4 kỹ năng cốt lõi
          </h2>
          <p className="text-center text-slate-600 mb-16 text-lg">
            Phát triển toàn diện khả năng tiếng Anh của bạn
          </p>

          <div className="grid md:grid-cols-2 gap-4">
            {[
              {
                title: "Reading",
                subtitle: "Đọc hiểu",
                description: "Rèn luyện khả năng đọc hiểu qua phụ đề video, mở rộng vốn từ vựng",
                image: "/image/reading.png",
                color: "from-blue-500 to-cyan-500",
                bgColor: "bg-blue-50/50",
                link: "/reading",
              },
              {
                title: "Listening",
                subtitle: "Luyện nghe",
                description: "Cải thiện khả năng nghe qua video thực tế với nhiều giọng nói khác nhau",
                image: "/image/listening.png",
                color: "from-teal-500 to-lime-400",
                bgColor: "bg-teal-50/70",
                link: "/listening",
              },
              {
                title: "Writing",
                subtitle: "Viết",
                description: "Thực hành viết và ghi chép từ vựng, câu văn trong ngữ cảnh thực tế",
                image: "/image/writing.png",
                color: "from-green-500 to-emerald-500",
                bgColor: "bg-green-50/50",
                link: "/writing",
              },
              {
                title: "Speaking",
                subtitle: "Nói",
                description: "Luyện phát âm chuẩn, bắt chước người bản ngữ từ các video",
                image: "/image/speaking.png",
                color: "from-amber-500 to-lime-500",
                bgColor: "bg-amber-50/70",
                link: "/speaking",
              },
            ].map((feature, index) => (
              <Link key={feature.title} href={feature.link}>
                <Card
                  className={`learning-home-card group relative overflow-hidden border-2 hover:border-teal-200 transition-all hover:shadow-2xl hover:-translate-y-2 ${feature.bgColor} backdrop-blur-sm animate-fade-in cursor-pointer dark:border-slate-800 dark:bg-slate-900 dark:hover:border-teal-500`}
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                <div className="p-14">
                  <div className="flex items-center gap-12">
                    <div className="relative w-64 h-64 flex-shrink-0">
                      <div className={`absolute inset-0 bg-gradient-to-br ${feature.color} rounded-3xl opacity-10 blur-3xl scale-125`} />
                      <div className="relative w-full h-full">
                        <Image
                          src={feature.image}
                          alt={feature.title}
                          fill
                          className="object-contain drop-shadow-2xl"
                        />
                      </div>
                    </div>
                    <div className="flex-1">
                      <h3 className={`text-5xl font-bold mb-3 bg-gradient-to-r ${feature.color} bg-clip-text text-transparent`}>
                        {feature.title}
                      </h3>
                      <p className="text-xl text-slate-500 mb-5 font-medium">
                        {feature.subtitle}
                      </p>
                      <p className="text-slate-600 leading-relaxed text-xl">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                </div>
                <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${feature.color} transform scale-x-0 group-hover:scale-x-100 transition-transform`} />
              </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="relative z-10 px-6 py-20">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-4 bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
            Chọn gói phù hợp với bạn
          </h2>
          <p className="text-center text-slate-600 mb-16 text-lg">
            Bắt đầu miễn phí, nâng cấp khi sẵn sàng
          </p>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
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
                popular: false,
              },
              {
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
                popular: true,
              },
              {
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
                popular: false,
              },
            ].map((plan, index) => (
              <Card
                key={plan.name}
                className={`learning-home-card relative overflow-hidden transition-all hover:shadow-2xl hover:-translate-y-2 animate-fade-in ${
                  plan.popular
                    ? "border-2 border-teal-400 shadow-xl shadow-teal-500/20"
                    : "border border-slate-200 bg-white/80 backdrop-blur-sm"
                }`}
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                {plan.popular && (
                  <div className="absolute top-0 left-0 right-0">
                    <div className="bg-gradient-to-r from-teal-400 to-lime-300 text-slate-950 text-center py-2 text-sm font-extrabold">
                      Phổ biến nhất
                    </div>
                  </div>
                )}
                <div className={`p-8 ${plan.popular ? "pt-16" : ""}`}>
                  <h3 className="text-2xl font-bold text-slate-800 mb-2">
                    {plan.name}
                  </h3>
                  <p className="text-slate-500 text-sm mb-6">
                    {plan.description}
                  </p>
                  <div className="mb-6">
                    <span className="text-5xl font-bold bg-gradient-to-r from-teal-600 to-lime-600 bg-clip-text text-transparent">
                      {plan.price}
                    </span>
                    {plan.period && (
                      <span className="text-slate-500 ml-1">{plan.period}</span>
                    )}
                  </div>
                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-3">
                        <Check className="w-5 h-5 text-teal-500 flex-shrink-0 mt-0.5" />
                        <span className="text-slate-600">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Link href="/register">
                    <Button
                      variant={plan.popular ? "upgrade" : "create"}
                      className="w-full h-12 rounded-xl font-semibold transition-all"
                    >
                      {plan.cta}
                    </Button>
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 px-6 py-12 mt-20 border-t border-slate-200/50 bg-white/30 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="relative w-14 h-14">
                <Image
                  src="/image/logo.png"
                  alt="LearnEnglish Logo"
                  fill
                  className="object-contain drop-shadow-lg"
                />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-slate-800 text-lg">LearnEnglish</span>
                <span className="text-xs text-slate-500">Học qua video</span>
              </div>
            </div>
            <p className="text-sm text-slate-500">
              © 2026 LearnEnglish. Học tiếng Anh qua video yêu thích.
            </p>
          </div>
        </div>
      </footer>

      <style jsx global>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
        @keyframes float-delayed {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-30px); }
        }
        @keyframes float-slow {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-15px); }
        }
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes scale-in {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-float {
          animation: float 8s ease-in-out infinite;
        }
        .animate-float-delayed {
          animation: float-delayed 10s ease-in-out infinite;
        }
        .animate-float-slow {
          animation: float-slow 12s ease-in-out infinite;
        }
        .animate-bounce-slow {
          animation: bounce-slow 3s ease-in-out infinite;
        }
        .animate-fade-in {
          animation: fade-in 0.6s ease-out forwards;
        }
        .animate-slide-up {
          animation: slide-up 0.6s ease-out forwards;
        }
        .animate-scale-in {
          animation: scale-in 0.6s ease-out forwards;
        }
      `}</style>
    </main>
  );
}
