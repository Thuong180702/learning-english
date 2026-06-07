"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Mail, Phone } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [registrationMethod, setRegistrationMethod] = useState<"email" | "phone">("email");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Step 1: Verify OTP if already sent
    if (otpSent) {
      if (!otp.trim()) {
        setError("Vui lòng nhập mã OTP");
        return;
      }

      setLoading(true);
      const supabase = createClient();

      if (registrationMethod === "email") {
        const { error: verifyError } = await supabase.auth.verifyOtp({
          email,
          token: otp,
          type: "email",
        });

        if (verifyError) {
          setError(verifyError.message);
          setLoading(false);
          return;
        }
      } else {
        const { error: verifyError } = await supabase.auth.verifyOtp({
          phone: phone.startsWith("+84") ? phone : `+84${phone.replace(/^0/, "")}`,
          token: otp,
          type: "sms",
        });

        if (verifyError) {
          setError(verifyError.message);
          setLoading(false);
          return;
        }
      }

      // Update user metadata with name if provided
      if (name.trim()) {
        await supabase.auth.updateUser({
          data: { full_name: name },
        });
      }

      router.push("/listening");
      return;
    }

    // Step 2: Sign up and send OTP
    if (password !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp");
      return;
    }

    if (password.length < 6) {
      setError("Mật khẩu phải có ít nhất 6 ký tự");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    if (registrationMethod === "email") {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }

      setOtpSent(true);
      setLoading(false);
    } else {
      const { error: signUpError } = await supabase.auth.signUp({
        phone: phone.startsWith("+84") ? phone : `+84${phone.replace(/^0/, "")}`,
        password,
        options: {
          data: {
            full_name: name,
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }

      setOtpSent(true);
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError("");

    try {
      const supabase = createClient();

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            prompt: "select_account",
          },
        },
      });

      if (error) {
        setError(`Lỗi OAuth: ${error.message}`);
        setGoogleLoading(false);
      }
      // Browser will redirect automatically
    } catch (err) {
      const message = err instanceof Error ? err.message : "Đã có lỗi xảy ra";
      setError(message);
      setGoogleLoading(false);
    }
  };

  return (
    <main className="learning-shell min-h-screen flex items-center justify-center px-6 py-12 bg-[#f8fbff] dark:text-slate-100">
      <div className="w-full max-w-md">
        <Link href="/" className="flex items-center justify-center gap-2 mb-8">
          <div className="relative h-14 w-14 rounded-[1.35rem] bg-lime-200 shadow-lg shadow-lime-300/30 rotate-[-5deg]">
            <Image src="/image/logo.png" alt="LearnEnglish" fill className="object-contain p-1.5" />
          </div>
          <span className="text-2xl font-extrabold text-slate-950">LearnEnglish</span>
        </Link>

        <Card className="rounded-[2.25rem] border-slate-200 bg-white/95 shadow-2xl shadow-slate-200/80">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-3xl font-extrabold text-slate-950">Đăng ký</CardTitle>
            <p className="text-slate-500 mt-2">Tạo tài khoản mới miễn phí</p>
          </CardHeader>
          <CardContent className="space-y-6 pt-4">
            {/* Registration Method Tabs */}
            <div className="flex gap-2 p-1 bg-slate-100 rounded-full dark:bg-slate-950">
              <button
                type="button"
                onClick={() => {
                  setRegistrationMethod("email");
                  setError("");
                  setOtpSent(false);
                }}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full font-medium text-sm transition-all ${
                  registrationMethod === "email"
                    ? "bg-teal-300 text-slate-950 shadow-sm"
                    : "text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
                }`}
              >
                <Mail className="w-4 h-4" />
                Email
              </button>
              <button
                type="button"
                onClick={() => {
                  setRegistrationMethod("phone");
                  setError("");
                  setOtpSent(false);
                }}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full font-medium text-sm transition-all ${
                  registrationMethod === "phone"
                    ? "bg-teal-300 text-slate-950 shadow-sm"
                    : "text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
                }`}
              >
                <Phone className="w-4 h-4" />
                Số điện thoại
              </button>
            </div>

            <Button
              variant="outline"
              className="w-full h-12 rounded-full text-base"
              onClick={handleGoogleSignIn}
              disabled={googleLoading}
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              {googleLoading ? "Đang chuyển..." : "Đăng ký với Google"}
            </Button>

            <div className="flex items-center gap-4">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-sm text-slate-500">hoặc</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 rounded-xl text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-medium text-slate-700">
                  Họ tên (tùy chọn)
                </label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Nguyễn Văn A"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              {registrationMethod === "email" ? (
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium text-slate-700">
                    Email
                  </label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="email@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={otpSent}
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <label htmlFor="phone" className="text-sm font-medium text-slate-700">
                    Số điện thoại
                  </label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="0912345678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    disabled={otpSent}
                  />
                  <p className="text-xs text-slate-500">
                    Nhập số điện thoại Việt Nam (VD: 0912345678)
                  </p>
                </div>
              )}

              {!otpSent && (
                <>
                  <div className="space-y-2">
                    <label htmlFor="password" className="text-sm font-medium text-slate-700">
                      Mật khẩu
                    </label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="confirmPassword" className="text-sm font-medium text-slate-700">
                      Xác nhận mật khẩu
                    </label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                  </div>
                </>
              )}

              {otpSent && (
                <div className="space-y-2">
                  <label htmlFor="otp" className="text-sm font-medium text-slate-700">
                    Mã OTP
                  </label>
                  <Input
                    id="otp"
                    type="text"
                    placeholder="123456"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    required
                    maxLength={6}
                  />
                  <p className="text-xs text-slate-500">
                    Nhập mã {registrationMethod === "email" ? "đã được gửi đến email" : "đã được gửi đến số điện thoại"} của bạn
                  </p>
                </div>
              )}

              <Button type="submit" className="w-full h-12" disabled={loading}>
                {loading
                  ? "Đang xử lý..."
                  : registrationMethod === "phone" && !otpSent
                  ? "Gửi mã OTP"
                  : registrationMethod === "phone" && otpSent
                  ? "Xác nhận OTP"
                  : "Đăng ký"}
              </Button>

              {registrationMethod === "phone" && otpSent && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-10 rounded-full"
                  onClick={() => {
                    setOtpSent(false);
                    setOtp("");
                    setError("");
                  }}
                >
                  Gửi lại mã OTP
                </Button>
              )}
            </form>

            <p className="text-center text-xs text-slate-500">
              Bằng việc đăng ký, bạn đồng ý với{" "}
              <Link href="/terms" className="text-teal-700 hover:underline">
                Điều khoản sử dụng
              </Link>{" "}
              và{" "}
              <Link href="/privacy" className="text-teal-700 hover:underline">
                Chính sách bảo mật
              </Link>
            </p>

            <p className="text-center text-slate-600">
              Đã có tài khoản?{" "}
              <Link href="/signin" className="text-teal-700 font-semibold hover:underline">
                Đăng nhập
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
