"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { PricingModal } from "@/components/PricingModal";
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

type SubscriptionPlan = "free" | "pro" | "premium";

interface ProfileRow {
  full_name: string | null;
  avatar_url: string | null;
  subscription_plan: SubscriptionPlan | null;
}

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [userPlan, setUserPlan] = useState<SubscriptionPlan>("free");
  const [showPricingModal, setShowPricingModal] = useState(false);

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
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        router.push("/signin");
      } else {
        setUser(data.user);
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("full_name, avatar_url, subscription_plan")
          .eq("id", data.user.id)
          .maybeSingle();

        if (profileError) {
          console.warn("Profile fetch error:", profileError.message);
        }

        const typedProfile = profileData as ProfileRow | null;
        setProfile(typedProfile);
        setDisplayName(
          typedProfile?.full_name || data.user.user_metadata?.full_name || ""
        );
        setUserPlan(typedProfile?.subscription_plan || "free");
      }
      setLoading(false);
    });
  }, [router]);

  const closeLinkPanel = () => {
    setShowLinkPanel(false);
    setOtpSent(false);
    setLinkEmail("");
    setLinkPhone("");
    setLinkOtp("");
    setOtpCountdown(0);
  };

  const upsertProfile = async (updates: Partial<ProfileRow>) => {
    if (!user?.id) return null;

    const supabase = createClient();
    const { data, error: profileError } = await supabase
      .from("profiles")
      .upsert(
        {
          id: user.id,
          ...updates,
        },
        { onConflict: "id" }
      )
      .select("full_name, avatar_url, subscription_plan")
      .single();

    if (profileError) {
      console.warn("Profile sync error:", profileError.message);
      return null;
    }

    const nextProfile = data as ProfileRow;
    setProfile(nextProfile);
    setUserPlan(nextProfile.subscription_plan || "free");
    return nextProfile;
  };

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
      const nextProfile = await upsertProfile({ full_name: displayName });

      setSuccess("Cập nhật tên hiển thị thành công");
      setEditingName(false);
      if (!nextProfile) {
        setProfile((current) =>
          current ? { ...current, full_name: displayName } : current
        );
      }
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
      const nextProfile = await upsertProfile({ avatar_url: publicUrl });

      setSuccess("Cập nhật ảnh đại diện thành công");
      if (!nextProfile) {
        setProfile((current) =>
          current ? { ...current, avatar_url: publicUrl } : current
        );
      }
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
        // Refresh user data
        const { data } = await supabase.auth.getUser();
        setUser(data.user);
        closeLinkPanel();
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
        // Refresh user data
        const { data } = await supabase.auth.getUser();
        setUser(data.user);
        closeLinkPanel();
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

  const profileFullName = profile?.full_name || user?.user_metadata?.full_name || "";
  const avatarUrl =
    profile?.avatar_url ||
    user?.user_metadata?.avatar_url ||
    user?.user_metadata?.picture ||
    "";

  if (loading) {
    return (
      <div className="learning-shell min-h-screen flex items-center justify-center bg-[#f8fbff] dark:text-slate-100">
        <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="learning-shell min-h-screen bg-[#f8fbff] py-8 px-4 dark:text-slate-100">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8 rounded-[2.25rem] border border-teal-200 bg-gradient-to-br from-teal-100 via-emerald-50 to-lime-100 p-7 text-slate-950 shadow-xl shadow-teal-100/60 dark:border-teal-500/25 dark:from-slate-900 dark:via-teal-950 dark:to-slate-950 dark:text-white dark:shadow-teal-950/30">
          <Link
            href="/listening"
            className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-sm font-bold text-teal-700 transition-colors hover:bg-white dark:bg-white/10 dark:text-teal-200 dark:hover:bg-white/15"
          >
            <ArrowLeft className="w-4 h-4" />
            Quay lại
          </Link>
          <h1 className="font-heading text-4xl font-extrabold">Cài đặt tài khoản</h1>
          <p className="mt-2 text-sm font-medium text-slate-600 dark:text-slate-300">
            Quản lý hồ sơ, bảo mật và gói học của bạn.
          </p>
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
          <Card className="settings-card rounded-[2.25rem] p-6 bg-white shadow-xl shadow-slate-200/60">
            <h2 className="text-xl font-bold text-slate-800 mb-4">Gói hiện tại</h2>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`px-4 py-2 rounded-full text-lg font-extrabold ${
                  userPlan === "free"
                    ? "bg-slate-100 text-slate-700"
                  : userPlan === "pro"
                    ? "bg-teal-100 text-teal-700"
                    : "bg-lime-100 text-lime-700"
                }`}>
                  {userPlan === "free" ? "Free" : userPlan === "pro" ? "Pro" : "Premium"}
                </div>
                <div className="text-slate-600 dark:text-slate-300">
                  {userPlan === "free" && "10 video mỗi tháng, 50 từ vựng"}
                  {userPlan === "pro" && "Video không giới hạn, từ vựng không giới hạn"}
                  {userPlan === "premium" && "Tất cả tính năng Pro + AI Coach"}
                </div>
              </div>
              {userPlan !== "premium" && (
                <Button
                  onClick={() => setShowPricingModal(true)}
                  variant="upgrade"
                >
                  Nâng cấp
                </Button>
              )}
            </div>
          </Card>

          {/* Profile Card */}
          <Card className="settings-card rounded-[2.25rem] p-6 bg-white shadow-xl shadow-slate-200/60">
            <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
              <User className="w-5 h-5" />
              Thông tin cá nhân
            </h2>

            <div className="space-y-6">
              {/* Avatar */}
              <div className="flex items-center gap-4">
                <div className="relative">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt="Avatar"
                      className="w-24 h-24 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-24 h-24 bg-gradient-to-br from-teal-400 to-lime-300 rounded-full flex items-center justify-center text-slate-950 font-bold text-3xl">
                      {(profileFullName?.[0] || user?.email?.[0] || user?.phone?.slice(-4)?.[0] || 'U').toUpperCase()}
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
                    className="absolute bottom-0 right-0 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-slate-50 transition-colors cursor-pointer dark:bg-slate-800 dark:hover:bg-slate-700 dark:ring-1 dark:ring-slate-600"
                  >
                    {uploadingAvatar ? (
                      <div className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Camera className="w-4 h-4 text-slate-600 dark:text-slate-200" />
                    )}
                  </label>
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-300">Ảnh đại diện</p>
                  <p className="text-xs text-slate-400 mt-1 dark:text-slate-400">Nhấn vào icon camera để thay đổi</p>
                  <p className="text-xs text-slate-400 dark:text-slate-400">Tối đa 2MB</p>
                </div>
              </div>

              {/* Display Name */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Tên hiển thị</label>
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
                          setDisplayName(profileFullName);
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
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Email</label>
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
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Số điện thoại</label>
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
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
              <div className="w-full max-w-lg rounded-[2.25rem] bg-white p-8 shadow-2xl shadow-slate-950/25 dark:bg-slate-900 dark:text-slate-100">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold text-slate-800">
                    Liên kết {linkMethod === "email" ? "Email" : "Số điện thoại"}
                  </h3>
                  <button
                    onClick={() => {
                      closeLinkPanel();
                      setError("");
                      setSuccess("");
                    }}
                    className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors"
                  >
                    <X className="w-6 h-6 text-slate-600 dark:text-slate-200" />
                  </button>
                </div>

                <div className="space-y-6">
                  {!otpSent ? (
                    <>
                      {linkMethod === "email" ? (
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Email</label>
                          <Input
                            type="email"
                            placeholder="email@example.com"
                            value={linkEmail}
                            onChange={(e) => setLinkEmail(e.target.value)}
                            className="h-12 rounded-full text-base"
                          />
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Số điện thoại</label>
                          <Input
                            type="tel"
                            placeholder="0912345678"
                            value={linkPhone}
                            onChange={(e) => setLinkPhone(e.target.value)}
                            className="h-12 rounded-full text-base"
                          />
                          <p className="text-sm text-slate-500 dark:text-slate-400">
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
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Mã OTP</label>
                        <Input
                          type="text"
                          placeholder="123456"
                          value={linkOtp}
                          onChange={(e) => setLinkOtp(e.target.value)}
                          maxLength={6}
                          className="h-12 rounded-full text-base text-center text-2xl tracking-widest"
                        />
                        <p className="text-sm text-slate-500 text-center dark:text-slate-400">
                          Nhập mã OTP đã được gửi đến {linkMethod === "email" ? "email" : "số điện thoại"} của bạn
                        </p>
                      </div>

                      <div className="flex gap-3">
                        <Button
                          onClick={handleVerifyLinkOtp}
                          disabled={verifyingOtp}
                          className="flex-1 h-12 rounded-full text-base bg-teal-500 hover:bg-teal-600 text-white"
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
                          className="h-12 rounded-full text-base px-6"
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
          <Card className="settings-card rounded-[2.25rem] p-6 bg-white shadow-xl shadow-slate-200/60">
            <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Lock className="w-5 h-5" />
              Đổi mật khẩu
            </h2>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Mật khẩu hiện tại</label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Mật khẩu mới</label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Xác nhận mật khẩu mới</label>
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
      <PricingModal
        isOpen={showPricingModal}
        onClose={() => setShowPricingModal(false)}
        currentPlan={userPlan}
      />
    </div>
  );
}
