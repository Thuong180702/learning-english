"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  User,
  Mail,
  Phone,
  Lock,
  ArrowLeft,
  Camera,
  Link2,
  AlertCircle,
  Check,
  X
} from "lucide-react";

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [userPlan, setUserPlan] = useState<"free" | "pro" | "premium">("free");

  // Profile section
  const [displayName, setDisplayName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Link account section
  const [showLinkPanel, setShowLinkPanel] = useState(false);
  const [linkMethod, setLinkMethod] = useState<"email" | "phone">("email");
  const [linkEmail, setLinkEmail] = useState("");
  const [linkPhone, setLinkPhone] = useState("");
  const [linkOtp, setLinkOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpCountdown, setOtpCountdown] = useState(0);

  // Change password section
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.push("/signin");
      } else {
        setUser(data.user);
        setDisplayName(data.user.user_metadata?.full_name || "");
      }
      setLoading(false);
    });
  }, [router]);

  // OTP countdown timer
  useEffect(() => {
    if (otpCountdown > 0) {
      const timer = setTimeout(() => setOtpCountdown(otpCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [otpCountdown]);

  const handleUpdateName = async () => {
    setError("");
    setSuccess("");
    setSavingName(true);

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({
      data: { full_name: displayName },
    });

    if (updateError) {
      setError(updateError.message);
    } else {
      setSuccess("Cập nhật tên hiển thị thành công");
      setEditingName(false);
      // Refresh user data
      const { data } = await supabase.auth.getUser();
      setUser(data.user);
    }
    setSavingName(false);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError("Vui lòng chọn file ảnh");
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setError("Kích thước ảnh không được vượt quá 2MB");
      return;
    }

    setError("");
    setSuccess("");
    setUploadingAvatar(true);

    const supabase = createClient();

    // Upload to storage
    const fileExt = file.name.split('.').pop();
    const fileName = `${user?.id}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, file, { upsert: true });

    if (uploadError) {
      setError(uploadError.message);
      setUploadingAvatar(false);
      return;
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName);

    // Update user metadata
    const { error: updateError } = await supabase.auth.updateUser({
      data: { avatar_url: publicUrl },
    });

    if (updateError) {
      setError(updateError.message);
    } else {
      setSuccess("Cập nhật ảnh đại diện thành công");
      // Refresh user data
      const { data } = await supabase.auth.getUser();
      setUser(data.user);
    }

    setUploadingAvatar(false);
  };

  const handleSendLinkOtp = async () => {
    setError("");
    setSuccess("");
    setSendingOtp(true);

    const supabase = createClient();

    if (linkMethod === "email") {
      if (!linkEmail.trim()) {
        setError("Vui lòng nhập email");
        setSendingOtp(false);
        return;
      }

      const { error: otpError } = await supabase.auth.updateUser({
        email: linkEmail,
      });

      if (otpError) {
        setError(otpError.message);
        setSendingOtp(false);
      } else {
        setOtpSent(true);
        setOtpCountdown(60);
        setSuccess("Mã OTP đã được gửi đến email");
        setSendingOtp(false);
      }
    } else {
      if (!linkPhone.trim()) {
        setError("Vui lòng nhập số điện thoại");
        setSendingOtp(false);
        return;
      }

      const { error: otpError } = await supabase.auth.updateUser({
        phone: linkPhone.startsWith("+84") ? linkPhone : `+84${linkPhone.replace(/^0/, "")}`,
      });

      if (otpError) {
        setError(otpError.message);
        setSendingOtp(false);
      } else {
        setOtpSent(true);
        setOtpCountdown(60);
        setSuccess("Mã OTP đã được gửi đến số điện thoại");
        setSendingOtp(false);
      }
    }
  };

  const handleVerifyLinkOtp = async () => {
    setError("");
    setSuccess("");
    setVerifyingOtp(true);

    if (!linkOtp.trim()) {
      setError("Vui lòng nhập mã OTP");
      setVerifyingOtp(false);
      return;
    }

    const supabase = createClient();

    if (linkMethod === "email") {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: linkEmail,
        token: linkOtp,
        type: "email_change",
      });

      if (verifyError) {
        setError(verifyError.message);
      } else {
        setSuccess("Liên kết email thành công");
        setOtpSent(false);
        setLinkOtp("");
        setLinkEmail("");
        // Refresh user data
        const { data } = await supabase.auth.getUser();
        setUser(data.user);
      }
    } else {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        phone: linkPhone.startsWith("+84") ? linkPhone : `+84${linkPhone.replace(/^0/, "")}`,
        token: linkOtp,
        type: "phone_change",
      });

      if (verifyError) {
        setError(verifyError.message);
      } else {
        setSuccess("Liên kết số điện thoại thành công");
        setOtpSent(false);
        setLinkOtp("");
        setLinkPhone("");
        // Refresh user data
        const { data } = await supabase.auth.getUser();
        setUser(data.user);
      }
    }

    setVerifyingOtp(false);
  };

  const handleChangePassword = async () => {
    setError("");
    setSuccess("");

    if (newPassword !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp");
      return;
    }

    if (newPassword.length < 6) {
      setError("Mật khẩu mới phải có ít nhất 6 ký tự");
      return;
    }

    setChangingPassword(true);

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      setError(updateError.message);
    } else {
      setSuccess("Đổi mật khẩu thành công");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }

    setChangingPassword(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50">
        <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/listening"
            className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-800 mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Quay lại
          </Link>
          <h1 className="text-3xl font-bold text-slate-800">Cài đặt tài khoản</h1>
        </div>

        {/* Notifications */}
        {error && (
          <div className="mb-6 flex items-center gap-2 p-4 bg-red-50 text-red-600 rounded-xl">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            {error}
          </div>
        )}
        {success && (
          <div className="mb-6 flex items-center gap-2 p-4 bg-green-50 text-green-600 rounded-xl">
            <Check className="w-5 h-5 flex-shrink-0" />
            {success}
          </div>
        )}

        <div className="space-y-6">
          {/* Current Plan Card */}
          <Card className="p-6 bg-white/80 backdrop-blur-sm">
            <h2 className="text-xl font-bold text-slate-800 mb-4">Gói hiện tại</h2>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`px-4 py-2 rounded-xl text-lg font-bold ${
                  userPlan === "free"
                    ? "bg-slate-100 text-slate-700"
                    : userPlan === "pro"
                    ? "bg-gradient-to-r from-orange-100 to-rose-100 text-orange-700"
                    : "bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700"
                }`}>
                  {userPlan === "free" ? "Free" : userPlan === "pro" ? "Pro" : "Premium"}
                </div>
                <div className="text-slate-600">
                  {userPlan === "free" && "10 video mỗi tháng, 50 từ vựng"}
                  {userPlan === "pro" && "Video không giới hạn, từ vựng không giới hạn"}
                  {userPlan === "premium" && "Tất cả tính năng Pro + AI Coach"}
                </div>
              </div>
              {userPlan !== "premium" && (
                <Button className="bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-600 hover:to-rose-600 text-white">
                  Nâng cấp
                </Button>
              )}
            </div>
          </Card>

          {/* Profile Card */}
          <Card className="p-6 bg-white/80 backdrop-blur-sm">
            <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
              <User className="w-5 h-5" />
              Thông tin cá nhân
            </h2>

            <div className="space-y-6">
              {/* Avatar */}
              <div className="flex items-center gap-4">
                <div className="relative">
                  {user?.user_metadata?.avatar_url ? (
                    <img
                      src={user.user_metadata.avatar_url}
                      alt="Avatar"
                      className="w-24 h-24 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-24 h-24 bg-gradient-to-br from-orange-500 to-rose-500 rounded-full flex items-center justify-center text-white font-bold text-3xl">
                      {(user?.user_metadata?.full_name?.[0] || user?.email?.[0] || user?.phone?.slice(-4)?.[0] || 'U').toUpperCase()}
                    </div>
                  )}
                  <input
                    type="file"
                    id="avatar-upload"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarUpload}
                    disabled={uploadingAvatar}
                  />
                  <label
                    htmlFor="avatar-upload"
                    className="absolute bottom-0 right-0 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    {uploadingAvatar ? (
                      <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Camera className="w-4 h-4 text-slate-600" />
                    )}
                  </label>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Ảnh đại diện</p>
                  <p className="text-xs text-slate-400 mt-1">Nhấn vào icon camera để thay đổi</p>
                  <p className="text-xs text-slate-400">Tối đa 2MB</p>
                </div>
              </div>

              {/* Display Name */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Tên hiển thị</label>
                <div className="flex gap-2">
                  <Input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Nhập tên hiển thị"
                    disabled={!editingName}
                    className="flex-1"
                  />
                  {!editingName ? (
                    <Button
                      onClick={() => setEditingName(true)}
                      variant="outline"
                    >
                      Chỉnh sửa
                    </Button>
                  ) : (
                    <>
                      <Button
                        onClick={handleUpdateName}
                        disabled={savingName}
                        className="bg-green-500 hover:bg-green-600 text-white"
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button
                        onClick={() => {
                          setEditingName(false);
                          setDisplayName(user?.user_metadata?.full_name || "");
                        }}
                        variant="outline"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Email */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Email</label>
                <div className="flex gap-2">
                  <Input
                    value={user?.email || "Chưa liên kết"}
                    disabled
                    className="bg-slate-50 flex-1"
                  />
                  {!user?.email && (
                    <Button
                      onClick={() => {
                        setLinkMethod("email");
                        setShowLinkPanel(true);
                        setError("");
                        setSuccess("");
                      }}
                      variant="outline"
                    >
                      Liên kết
                    </Button>
                  )}
                </div>
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Số điện thoại</label>
                <div className="flex gap-2">
                  <Input
                    value={user?.phone || "Chưa liên kết"}
                    disabled
                    className="bg-slate-50 flex-1"
                  />
                  {!user?.phone && (
                    <Button
                      onClick={() => {
                        setLinkMethod("phone");
                        setShowLinkPanel(true);
                        setError("");
                        setSuccess("");
                      }}
                      variant="outline"
                    >
                      Liên kết
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </Card>

          {/* Link Panel Modal */}
          {showLinkPanel && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
              <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-lg mx-4">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold text-slate-800">
                    Liên kết {linkMethod === "email" ? "Email" : "Số điện thoại"}
                  </h3>
                  <button
                    onClick={() => {
                      setShowLinkPanel(false);
                      setOtpSent(false);
                      setLinkEmail("");
                      setLinkPhone("");
                      setLinkOtp("");
                      setError("");
                      setSuccess("");
                    }}
                    className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    <X className="w-6 h-6 text-slate-600" />
                  </button>
                </div>

                <div className="space-y-6">
                  {!otpSent ? (
                    <>
                      {linkMethod === "email" ? (
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-700">Email</label>
                          <Input
                            type="email"
                            placeholder="email@example.com"
                            value={linkEmail}
                            onChange={(e) => setLinkEmail(e.target.value)}
                            className="h-12 text-base"
                          />
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-700">Số điện thoại</label>
                          <Input
                            type="tel"
                            placeholder="0912345678"
                            value={linkPhone}
                            onChange={(e) => setLinkPhone(e.target.value)}
                            className="h-12 text-base"
                          />
                          <p className="text-sm text-slate-500">
                            Nhập số điện thoại Việt Nam (VD: 0912345678)
                          </p>
                        </div>
                      )}

                      <Button
                        onClick={handleSendLinkOtp}
                        disabled={sendingOtp || otpCountdown > 0}
                        className="w-full h-12 text-base"
                      >
                        {sendingOtp
                          ? "Đang gửi..."
                          : otpCountdown > 0
                          ? `Gửi lại sau ${otpCountdown}s`
                          : "Gửi mã OTP"}
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Mã OTP</label>
                        <Input
                          type="text"
                          placeholder="123456"
                          value={linkOtp}
                          onChange={(e) => setLinkOtp(e.target.value)}
                          maxLength={6}
                          className="h-12 text-base text-center text-2xl tracking-widest"
                        />
                        <p className="text-sm text-slate-500 text-center">
                          Nhập mã OTP đã được gửi đến {linkMethod === "email" ? "email" : "số điện thoại"} của bạn
                        </p>
                      </div>

                      <div className="flex gap-3">
                        <Button
                          onClick={handleVerifyLinkOtp}
                          disabled={verifyingOtp}
                          className="flex-1 h-12 text-base bg-green-500 hover:bg-green-600 text-white"
                        >
                          {verifyingOtp ? "Đang xác nhận..." : "Xác nhận"}
                        </Button>
                        <Button
                          onClick={() => {
                            setOtpSent(false);
                            setLinkOtp("");
                            setError("");
                            setOtpCountdown(0);
                          }}
                          disabled={otpCountdown > 0}
                          variant="outline"
                          className="h-12 text-base px-6"
                        >
                          {otpCountdown > 0 ? `${otpCountdown}s` : "Gửi lại"}
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Change Password Card */}
          <Card className="p-6 bg-white/80 backdrop-blur-sm">
            <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Lock className="w-5 h-5" />
              Đổi mật khẩu
            </h2>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Mật khẩu hiện tại</label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Mật khẩu mới</label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Xác nhận mật khẩu mới</label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>

              <Button
                onClick={handleChangePassword}
                disabled={changingPassword}
                className="w-full"
              >
                {changingPassword ? "Đang cập nhật..." : "Đổi mật khẩu"}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
