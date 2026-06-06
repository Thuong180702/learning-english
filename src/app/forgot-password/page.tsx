"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, AlertCircle, Mail, Phone, ArrowLeft } from "lucide-react";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<"input" | "otp" | "reset">("input");
  const [resetMethod, setResetMethod] = useState<"email" | "phone">("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();

    if (resetMethod === "email") {
      if (!email.trim()) {
        setError("Vui lòng nhập email");
        setLoading(false);
        return;
      }

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (resetError) {
        setError(resetError.message);
      } else {
        setStep("otp");
      }
    } else {
      if (!phone.trim()) {
        setError("Vui lòng nhập số điện thoại");
        setLoading(false);
        return;
      }

      // For phone, we use signInWithOtp for password reset flow
      const { error: otpError } = await supabase.auth.signInWithOtp({
        phone: phone.startsWith("+84") ? phone : `+84${phone.replace(/^0/, "")}`,
      });

      if (otpError) {
        setError(otpError.message);
      } else {
        setStep("otp");
      }
    }

    setLoading(false);
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!otp.trim()) {
      setError("Vui lòng nhập mã OTP");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    if (resetMethod === "email") {
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

    setStep("reset");
    setLoading(false);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp");
      return;
    }

    if (newPassword.length < 6) {
      setError("Mật khẩu phải có ít nhất 6 ký tự");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    router.push("/signin?password_reset=true");
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12 bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50">
      <div className="w-full max-w-md">
        <Link href="/signin" className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-800 mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Quay lại đăng nhập
        </Link>

        <Link href="/" className="flex items-center justify-center gap-2 mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-rose-500 rounded-xl flex items-center justify-center">
            <Sparkles className="w-7 h-7 text-white" />
          </div>
          <span className="text-2xl font-bold text-slate-800">LearnEnglish</span>
        </Link>

        <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-2xl">
              {step === "input" && "Quên mật khẩu"}
              {step === "otp" && "Xác nhận OTP"}
              {step === "reset" && "Tạo mật khẩu mới"}
            </CardTitle>
            <p className="text-slate-500 mt-2">
              {step === "input" && "Nhập email hoặc số điện thoại để đặt lại mật khẩu"}
              {step === "otp" && `Nhập mã OTP đã được gửi đến ${resetMethod === "email" ? "email" : "số điện thoại"} của bạn`}
              {step === "reset" && "Nhập mật khẩu mới cho tài khoản của bạn"}
            </p>
          </CardHeader>
          <CardContent className="space-y-6 pt-4">
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 rounded-xl text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            {step === "input" && (
              <>
                {/* Method Tabs */}
                <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setResetMethod("email");
                      setError("");
                    }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium text-sm transition-all ${
                      resetMethod === "email"
                        ? "bg-white text-slate-800 shadow-sm"
                        : "text-slate-600 hover:text-slate-800"
                    }`}
                  >
                    <Mail className="w-4 h-4" />
                    Email
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setResetMethod("phone");
                      setError("");
                    }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium text-sm transition-all ${
                      resetMethod === "phone"
                        ? "bg-white text-slate-800 shadow-sm"
                        : "text-slate-600 hover:text-slate-800"
                    }`}
                  >
                    <Phone className="w-4 h-4" />
                    Số điện thoại
                  </button>
                </div>

                <form onSubmit={handleSendOTP} className="space-y-4">
                  {resetMethod === "email" ? (
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
                      />
                      <p className="text-xs text-slate-500">
                        Nhập số điện thoại Việt Nam (VD: 0912345678)
                      </p>
                    </div>
                  )}

                  <Button type="submit" className="w-full h-12" disabled={loading}>
                    {loading ? "Đang gửi..." : "Gửi mã OTP"}
                  </Button>
                </form>
              </>
            )}

            {step === "otp" && (
              <form onSubmit={handleVerifyOTP} className="space-y-4">
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
                </div>

                <Button type="submit" className="w-full h-12" disabled={loading}>
                  {loading ? "Đang xác nhận..." : "Xác nhận OTP"}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-10"
                  onClick={() => {
                    setStep("input");
                    setOtp("");
                    setError("");
                  }}
                >
                  Gửi lại mã OTP
                </Button>
              </form>
            )}

            {step === "reset" && (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="newPassword" className="text-sm font-medium text-slate-700">
                    Mật khẩu mới
                  </label>
                  <Input
                    id="newPassword"
                    type="password"
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="confirmPassword" className="text-sm font-medium text-slate-700">
                    Xác nhận mật khẩu mới
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

                <Button type="submit" className="w-full h-12" disabled={loading}>
                  {loading ? "Đang cập nhật..." : "Đặt lại mật khẩu"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
