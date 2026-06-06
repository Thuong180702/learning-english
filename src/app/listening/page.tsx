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
  Headphones,
  Upload,
  Link2,
  Play,
  Clock,
  Search,
  Trash2,
  LayoutDashboard,
  Video,
  BookMarked,
  FileText,
  ChevronLeft,
  ChevronRight,
  Flame,
  Target,
  TrendingUp,
  Award,
  Star,
  Zap,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { PetMascot } from "@/components/PetMascot";
import { UserDropdown } from "@/components/UserDropdown";
import { PricingModal } from "@/components/PricingModal";

interface Video {
  id: string;
  youtube_id: string;
  title: string;
  created_at: string;
}

export default function ListeningPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [videos, setVideos] = useState<Video[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [uploadMethod, setUploadMethod] = useState<"url" | "file">("url");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeSection, setActiveSection] = useState<"dashboard" | "add-video" | "system-videos" | "vocabulary" | "tests">("dashboard");
  const [userPlan, setUserPlan] = useState<"free" | "pro" | "premium">("free");
  const [showPricingModal, setShowPricingModal] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.push("/signin");
      } else {
        setUser(data.user);
        fetchVideos();
      }
      setLoading(false);
    });
  }, [router]);

  const fetchVideos = async () => {
    // TODO: Fetch videos from Supabase
    setVideos([
      {
        id: "1",
        youtube_id: "dQw4w9WgXcQ",
        title: "English Conversation Practice - Daily Life",
        created_at: new Date().toISOString(),
      },
      {
        id: "2",
        youtube_id: "9bZkp7q19f0",
        title: "Business English - Meeting Phrases",
        created_at: new Date().toISOString(),
      },
    ]);
  };

  const handleAddVideo = async () => {
    if (!youtubeUrl.trim()) return;
    console.log("Adding video:", youtubeUrl);
    setYoutubeUrl("");
  };

  const filteredVideos = videos.filter((video) =>
    video.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Đang tải...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50">
      {/* Left Sidebar */}
      <aside className={`${sidebarCollapsed ? "w-16" : "w-60"} bg-white/80 backdrop-blur-md border-r border-slate-200 flex flex-col transition-all duration-300 fixed left-0 top-0 bottom-0 z-40`}>
        {/* Logo */}
        {!sidebarCollapsed && (
          <div className="h-12 px-4 border-b border-slate-200 flex items-center">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="relative w-7 h-7 transition-transform group-hover:scale-110 flex-shrink-0">
                <Image
                  src="/image/logo.png"
                  alt="LearnEnglish"
                  fill
                  className="object-contain drop-shadow-lg"
                />
              </div>
              <span className="text-sm font-bold bg-gradient-to-r from-orange-600 to-rose-600 bg-clip-text text-transparent">
                LearnEnglish
              </span>
            </Link>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1">
          <Button
            variant="ghost"
            onClick={() => setActiveSection("dashboard")}
            className={`${sidebarCollapsed ? "w-12 px-0" : "w-full"} justify-start text-sm ${
              activeSection === "dashboard"
                ? "bg-purple-50 text-purple-600 border-l-4 border-purple-600"
                : "text-slate-600 hover:text-purple-600 hover:bg-purple-50"
            }`}
            title="Dashboard"
          >
            <LayoutDashboard className={`w-4 h-4 ${sidebarCollapsed ? "mx-auto" : "mr-2"}`} />
            {!sidebarCollapsed && "Dashboard"}
          </Button>

          <Button
            variant="ghost"
            onClick={() => setActiveSection("add-video")}
            className={`${sidebarCollapsed ? "w-12 px-0" : "w-full"} justify-start text-sm ${
              activeSection === "add-video"
                ? "bg-purple-50 text-purple-600 border-l-4 border-purple-600"
                : "text-slate-600 hover:text-purple-600 hover:bg-purple-50"
            }`}
            title="Video của tôi"
          >
            <Upload className={`w-4 h-4 ${sidebarCollapsed ? "mx-auto" : "mr-2"}`} />
            {!sidebarCollapsed && "Video của tôi"}
          </Button>

          <Button
            variant="ghost"
            onClick={() => setActiveSection("system-videos")}
            className={`${sidebarCollapsed ? "w-12 px-0" : "w-full"} justify-start text-sm ${
              activeSection === "system-videos"
                ? "bg-purple-50 text-purple-600 border-l-4 border-purple-600"
                : "text-slate-600 hover:text-purple-600 hover:bg-purple-50"
            }`}
            title="Kho video"
          >
            <Video className={`w-4 h-4 ${sidebarCollapsed ? "mx-auto" : "mr-2"}`} />
            {!sidebarCollapsed && "Kho video"}
          </Button>

          <Button
            variant="ghost"
            onClick={() => setActiveSection("vocabulary")}
            className={`${sidebarCollapsed ? "w-12 px-0" : "w-full"} justify-start text-sm ${
              activeSection === "vocabulary"
                ? "bg-purple-50 text-purple-600 border-l-4 border-purple-600"
                : "text-slate-600 hover:text-purple-600 hover:bg-purple-50"
            }`}
            title="Từ vựng"
          >
            <BookMarked className={`w-4 h-4 ${sidebarCollapsed ? "mx-auto" : "mr-2"}`} />
            {!sidebarCollapsed && "Từ vựng"}
          </Button>

          <Button
            variant="ghost"
            onClick={() => setActiveSection("tests")}
            className={`${sidebarCollapsed ? "w-12 px-0" : "w-full"} justify-start text-sm ${
              activeSection === "tests"
                ? "bg-purple-50 text-purple-600 border-l-4 border-purple-600"
                : "text-slate-600 hover:text-purple-600 hover:bg-purple-50"
            }`}
            title="Thi Thử"
          >
            <FileText className={`w-4 h-4 ${sidebarCollapsed ? "mx-auto" : "mr-2"}`} />
            {!sidebarCollapsed && "Thi Thử"}
          </Button>
        </nav>

        {/* Collapse Button */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="absolute -right-3 top-6 w-6 h-6 bg-white border border-slate-200 rounded-full flex items-center justify-center hover:bg-slate-50 transition-colors shadow-md z-50"
        >
          {sidebarCollapsed ? (
            <ChevronRight className="w-4 h-4 text-slate-600" />
          ) : (
            <ChevronLeft className="w-4 h-4 text-slate-600" />
          )}
        </button>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 ${sidebarCollapsed ? "ml-16" : "ml-60"} transition-all duration-300`}>
        {/* Header */}
        <header className="sticky top-0 z-30 h-12 bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 flex items-center">
          <div className="flex items-center justify-between gap-4 w-full">
            {/* Search Bar */}
            <div className="flex-1 max-w-xl">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Nhập từ khóa để tìm kiếm..."
                  className="pl-9 h-7 bg-slate-50 border-slate-200 focus:bg-white text-sm"
                />
              </div>
            </div>

            {/* User section - grouped together */}
            <div className="flex items-center gap-2">
              {/* Upgrade Button (only show for free/pro users) */}
              {userPlan !== "premium" && (
                <Button
                  onClick={() => setShowPricingModal(true)}
                  className="h-7 px-3 text-xs bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-600 hover:to-rose-600 text-white shadow-md font-semibold rounded-lg"
                >
                  Nâng cấp
                </Button>
              )}

              {/* User Plan Badge */}
              <div className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                userPlan === "free"
                  ? "bg-slate-100 text-slate-700 border border-slate-200"
                  : userPlan === "pro"
                  ? "bg-gradient-to-r from-orange-100 to-rose-100 text-orange-700 border border-orange-200"
                  : "bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 border border-purple-200"
              }`}>
                {userPlan === "free" ? "Free" : userPlan === "pro" ? "Pro" : "Premium"}
              </div>

              <UserDropdown user={user} compact={true} />
            </div>
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto">
          {/* Dashboard Section */}
          {activeSection === "dashboard" && (
            <>
              {/* Welcome Banner */}
              <div className="mb-6 p-6 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl border border-emerald-200">
                <h1 className="text-2xl font-bold text-slate-800 mb-1">
                  Xin chào, {user?.email?.split('@')[0] || 'bạn'} 👋
                </h1>
                <p className="text-slate-600">
                  Một ngày mới để theo đuổi mục tiêu học tập của bạn!
                </p>
              </div>

              {/* Today's Mission - Large Card */}
              <Card className="mb-6 p-6 bg-gradient-to-br from-emerald-50 to-green-50 border-2 border-emerald-200 hover:shadow-lg transition-all">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <Target className="w-6 h-6 text-emerald-600" />
                    Nhiệm vụ hôm nay
                  </h2>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-emerald-600">0%</div>
                    <div className="text-sm text-slate-500">Hoàn thành</div>
                  </div>
                </div>
                <div className="mb-4">
                  <div className="flex justify-between text-sm text-slate-600 mb-2">
                    <span>Tiến độ</span>
                    <span className="font-semibold">Còn 30 phút</span>
                  </div>
                  <div className="h-3 bg-emerald-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full transition-all duration-500" style={{ width: "0%" }} />
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Star className="w-4 h-4 text-amber-500" />
                  <span>Quest: Học liên tục 5 ngày</span>
                </div>
              </Card>

              {/* Quest Progress */}
              <div className="mb-6">
                <h3 className="text-lg font-bold text-slate-800 mb-4">Quest đang tiến hành</h3>
                <div className="grid md:grid-cols-3 gap-4">
                  <Card className="p-4 bg-white hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-slate-700">Học liên tục 5 ngày</span>
                      <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded">+50</span>
                    </div>
                    <div className="text-xl font-bold text-emerald-600">2/5</div>
                  </Card>
                  <Card className="p-4 bg-white hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-slate-700">Học liên tục 20 ngày</span>
                      <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded">+300</span>
                    </div>
                    <div className="text-xl font-bold text-slate-400">2/20</div>
                  </Card>
                  <Card className="p-4 bg-white hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-slate-700">Đăng nhập 10 ngày</span>
                      <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded">+500</span>
                    </div>
                    <div className="text-xl font-bold text-slate-400">2/10</div>
                  </Card>
                </div>
              </div>

              {/* Progress Overview */}
              <div className="mb-6">
                <h3 className="text-lg font-bold text-slate-800 mb-4">Tổng quan tiến độ</h3>
                <div className="grid md:grid-cols-4 gap-4">
                  <Card className="p-5 bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-200 hover:shadow-md transition-all">
                    <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-xl mb-3">
                      <Play className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="text-3xl font-bold text-blue-600 mb-1">0</div>
                    <div className="text-sm text-slate-600">Video hoàn thành</div>
                  </Card>

                  <Card className="p-5 bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 hover:shadow-md transition-all">
                    <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-xl mb-3">
                      <BookMarked className="w-6 h-6 text-green-600" />
                    </div>
                    <div className="text-3xl font-bold text-green-600 mb-1">0</div>
                    <div className="text-sm text-slate-600">Từ vựng đã học</div>
                  </Card>

                  <Card className="p-5 bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 hover:shadow-md transition-all">
                    <div className="flex items-center justify-center w-12 h-12 bg-amber-100 rounded-xl mb-3">
                      <Flame className="w-6 h-6 text-amber-600" />
                    </div>
                    <div className="text-3xl font-bold text-amber-600 mb-1">2 phút</div>
                    <div className="text-sm text-slate-600">Phút học tuần này</div>
                  </Card>

                  <Card className="p-5 bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 hover:shadow-md transition-all">
                    <div className="flex items-center justify-center w-12 h-12 bg-purple-100 rounded-xl mb-3">
                      <Target className="w-6 h-6 text-purple-600" />
                    </div>
                    <div className="text-3xl font-bold text-purple-600 mb-1">—</div>
                    <div className="text-sm text-slate-600">Điểm thi TB</div>
                  </Card>
                </div>
              </div>

              {/* My Courses */}
              <Card className="p-6 bg-white/80 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-slate-800">Khóa học của tôi</h2>
                  <button className="text-sm text-emerald-600 hover:text-emerald-700 font-medium">
                    Xem tất cả →
                  </button>
                </div>
                <div className="text-center py-16">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <BookMarked className="w-8 h-8 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-700 mb-2">Chưa có khóa học nào</h3>
                  <p className="text-slate-500 mb-6">
                    Tạo khóa học đầu tiên để có trải nghiệm học tốt hơn
                  </p>
                  <button
                    onClick={() => setActiveSection("add-video")}
                    className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-medium hover:shadow-lg transition-all"
                  >
                    Tạo khóa học →
                  </button>
                </div>
              </Card>
            </>
          )}

          {/* Add Video Section */}
          {activeSection === "add-video" && (
            <>
              <div className="mb-8">
                <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
                  Video của tôi
                </h1>
                <p className="text-slate-600 text-lg">
                  Quản lý và thêm video học tập của bạn
                </p>
              </div>

              {/* Add Video Form */}
              <Card className="p-6 mb-8 bg-white/80 backdrop-blur-sm border-2 border-purple-200">
                <h2 className="text-2xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <Upload className="w-6 h-6 text-purple-600" />
                  Thêm video mới
                </h2>

                {/* Method Tabs */}
                <div className="flex gap-2 mb-6">
                  <Button
                    onClick={() => setUploadMethod("url")}
                    variant={uploadMethod === "url" ? "default" : "outline"}
                    className={
                      uploadMethod === "url"
                        ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white"
                        : ""
                    }
                  >
                    <Link2 className="w-4 h-4 mr-2" />
                    Link YouTube
                  </Button>
                  <Button
                    onClick={() => setUploadMethod("file")}
                    variant={uploadMethod === "file" ? "default" : "outline"}
                    className={
                      uploadMethod === "file"
                        ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white"
                        : ""
                    }
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Tải lên file
                  </Button>
                </div>

                {/* URL Input */}
                {uploadMethod === "url" && (
                  <div className="flex gap-3">
                    <Input
                      type="url"
                      placeholder="https://www.youtube.com/watch?v=..."
                      value={youtubeUrl}
                      onChange={(e) => setYoutubeUrl(e.target.value)}
                      className="flex-1 h-12 text-base"
                    />
                    <Button
                      onClick={handleAddVideo}
                      className="h-12 px-8 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
                    >
                      <Play className="w-5 h-5 mr-2" />
                      Thêm video
                    </Button>
                  </div>
                )}

                {/* File Upload */}
                {uploadMethod === "file" && (
                  <div className="border-2 border-dashed border-slate-300 rounded-xl p-12 text-center hover:border-purple-400 transition-colors cursor-pointer">
                    <Upload className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                    <p className="text-slate-600 mb-2">
                      Kéo thả file video vào đây hoặc click để chọn
                    </p>
                    <p className="text-sm text-slate-500">
                      Hỗ trợ MP4, WebM, AVI (tối đa 500MB)
                    </p>
                  </div>
                )}
              </Card>

              {/* My Videos List */}
              <Card className="p-6 bg-white/80 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-slate-800">
                    Video của tôi ({filteredVideos.length})
                  </h2>
                  <div className="relative w-80">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <Input
                      placeholder="Tìm kiếm video..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-12 h-11"
                    />
                  </div>
                </div>

                {filteredVideos.length === 0 ? (
                  <div className="text-center py-12">
                    <Headphones className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-slate-700 mb-2">
                      Chưa có video nào
                    </h3>
                    <p className="text-slate-500">
                      Thêm video YouTube để bắt đầu luyện nghe
                    </p>
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredVideos.map((video) => (
                      <Card
                        key={video.id}
                        className="group overflow-hidden bg-white hover:shadow-xl transition-all cursor-pointer"
                      >
                        <div className="relative aspect-video bg-slate-900">
                          <Image
                            src={`https://img.youtube.com/vi/${video.youtube_id}/maxresdefault.jpg`}
                            alt={video.title}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Play className="w-16 h-16 text-white" />
                          </div>
                        </div>
                        <div className="p-4">
                          <h3 className="font-semibold text-slate-800 mb-2 line-clamp-2 group-hover:text-purple-600 transition-colors">
                            {video.title}
                          </h3>
                          <div className="flex items-center justify-between text-sm text-slate-500">
                            <div className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              <span>
                                {new Date(video.created_at).toLocaleDateString("vi-VN")}
                              </span>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-slate-400 hover:text-red-500"
                              onClick={(e) => {
                                e.stopPropagation();
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </Card>
            </>
          )}

          {/* System Videos Section */}
          {activeSection === "system-videos" && (
            <>
              <div className="mb-8">
                <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
                  Kho video
                </h1>
                <p className="text-slate-600 text-lg">
                  Khám phá thư viện video học tập phong phú
                </p>
              </div>

              <Card className="p-6 bg-white/80 backdrop-blur-sm">
                <p className="text-center text-slate-500 py-12">
                  Tính năng đang được phát triển
                </p>
              </Card>
            </>
          )}

          {/* Vocabulary Section */}
          {activeSection === "vocabulary" && (
            <>
              <div className="mb-8">
                <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
                  Từ vựng
                </h1>
                <p className="text-slate-600 text-lg">
                  Kho từ vựng cá nhân của bạn
                </p>
              </div>

              <Card className="p-6 bg-white/80 backdrop-blur-sm">
                <p className="text-center text-slate-500 py-12">
                  Chưa có từ vựng nào được lưu
                </p>
              </Card>
            </>
          )}

          {/* Tests Section */}
          {activeSection === "tests" && (
            <>
              <div className="mb-8">
                <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
                  Thi Thử
                </h1>
                <p className="text-slate-600 text-lg">
                  Kiểm tra năng lực và rèn luyện kỹ năng
                </p>
              </div>

              <Card className="p-6 bg-white/80 backdrop-blur-sm">
                <p className="text-center text-slate-500 py-12">
                  Tính năng đang được phát triển
                </p>
              </Card>
            </>
          )}
        </div>
      </main>

      {/* Pet Mascot */}
      <PetMascot />

      {/* Pricing Modal */}
      <PricingModal
        isOpen={showPricingModal}
        onClose={() => setShowPricingModal(false)}
        currentPlan={userPlan}
      />

      <style jsx global>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slide-in-left {
          from { opacity: 0; transform: translateX(-20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes expand {
          from { width: 0; }
          to { width: var(--target-width); }
        }
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        .animate-fade-in {
          animation: fade-in 0.6s ease-out forwards;
        }
        .animate-slide-in-left {
          animation: slide-in-left 0.6s ease-out forwards;
        }
        .animate-expand {
          animation: expand 1s ease-out forwards;
        }
        .animate-bounce-slow {
          animation: bounce-slow 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
