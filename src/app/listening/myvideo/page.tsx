"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Clock,
  Headphones,
  Link2,
  Play,
  Search,
  Trash2,
  Upload,
} from "lucide-react";

interface Video {
  id: string;
  youtube_id: string;
  title: string;
  created_at: string;
}

export default function MyVideoPage() {
  const router = useRouter();
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [videos, setVideos] = useState<Video[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [uploadMethod, setUploadMethod] = useState<"url" | "file">("url");

  useEffect(() => {
    fetchVideos();
  }, []);

  const fetchVideos = async () => {
    const response = await fetch("/api/videos");
    if (!response.ok) {
      setVideos([]);
      return;
    }
    const data = await response.json();
    setVideos(Array.isArray(data) ? data : []);
  };

  const handleAddVideo = async () => {
    if (!youtubeUrl.trim()) return;
    const response = await fetch("/api/videos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ youtubeUrl }),
    });

    if (!response.ok) return;

    setYoutubeUrl("");
    await fetchVideos();
  };

  const handleDeleteVideo = async (videoId: string) => {
    if (!confirm("Bạn có chắc muốn xóa video này?")) return;

    const response = await fetch(`/api/videos/${videoId}`, {
      method: "DELETE",
    });

    if (response.ok) {
      await fetchVideos();
    }
  };

  const filteredVideos = videos.filter((video) =>
    video.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-[1500px] p-6 lg:p-8">
      <div className="mb-8 rounded-[2.25rem] bg-white p-7 shadow-xl shadow-slate-200/60 ring-1 ring-slate-200 dark:bg-slate-900 dark:shadow-slate-950/30 dark:ring-slate-700">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-teal-700 dark:text-teal-200">
          Studio
        </p>
        <h1 className="font-heading text-4xl font-extrabold text-slate-950 dark:text-white mb-2">
          Video của tôi
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-base font-medium">
          Quản lý và thêm video học tập của bạn
        </p>
      </div>

      <Card className="relative mb-8 overflow-hidden rounded-[2.25rem] border-teal-200 bg-gradient-to-br from-white to-teal-50 p-7 shadow-xl shadow-teal-100/60 dark:border-slate-700 dark:from-slate-900 dark:to-slate-900 dark:shadow-slate-950/30">
        <div className="absolute inset-0 learning-grid opacity-40" />
        <div className="relative">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300">
              <Upload className="w-5 h-5" />
            </span>
            Thêm video mới
          </h2>

          <div className="mb-6 inline-flex rounded-full bg-slate-100 p-1 dark:bg-slate-950">
            <Button
              onClick={() => setUploadMethod("url")}
              variant={uploadMethod === "url" ? "default" : "outline"}
              className={
                uploadMethod === "url"
                  ? "rounded-full bg-teal-300 text-slate-950 hover:bg-teal-300 shadow-none"
                  : "rounded-full border-0 bg-transparent text-slate-600 hover:bg-white hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
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
                  ? "rounded-full bg-teal-300 text-slate-950 hover:bg-teal-300 shadow-none"
                  : "rounded-full border-0 bg-transparent text-slate-600 hover:bg-white hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
              }
            >
              <Upload className="w-4 h-4 mr-2" />
              Tải lên file
            </Button>
          </div>

          {uploadMethod === "url" && (
            <div className="flex gap-3">
              <Input
                type="url"
                placeholder="https://www.youtube.com/watch?v=..."
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                className="flex-1 h-12 rounded-full bg-white text-base shadow-inner shadow-slate-200/50"
              />
              <Button onClick={handleAddVideo} variant="create" className="h-12 px-8">
                <Play className="w-5 h-5 mr-2" />
                Thêm video
              </Button>
            </div>
          )}

          {uploadMethod === "file" && (
            <div className="rounded-[2rem] border-2 border-dashed border-teal-300 bg-white/70 p-12 text-center transition-colors hover:border-teal-500 cursor-pointer dark:border-slate-700 dark:bg-slate-900/70">
              <Upload className="w-12 h-12 text-teal-500 mx-auto mb-4" />
              <p className="text-slate-600 dark:text-slate-300 mb-2">
                Kéo thả file video vào đây hoặc click để chọn
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Hỗ trợ MP4, WebM, AVI (tối đa 500MB)
              </p>
            </div>
          )}
        </div>
      </Card>

      <Card className="rounded-[2.25rem] border-slate-200 bg-white p-7 shadow-xl shadow-slate-200/60 dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/30">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">
            Video của tôi ({filteredVideos.length})
          </h2>
          <div className="relative w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <Input
              placeholder="Tìm kiếm video..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 h-11 rounded-full"
            />
          </div>
        </div>

        {filteredVideos.length === 0 ? (
          <div className="text-center py-12">
            <Headphones className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Chưa có video nào
            </h3>
            <p className="text-slate-500 dark:text-slate-400">
              Thêm video YouTube để bắt đầu luyện nghe
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredVideos.map((video) => (
              <Card
                key={video.id}
                className="group overflow-hidden rounded-[1.75rem] bg-white hover:shadow-xl transition-all cursor-pointer dark:bg-slate-950 dark:ring-1 dark:ring-slate-800"
                onClick={() => router.push(`/listening/video/${video.youtube_id}`)}
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
                  <h3 className="font-semibold text-slate-800 dark:text-white mb-2 line-clamp-2 group-hover:text-teal-700 dark:group-hover:text-teal-300 transition-colors">
                    {video.title}
                  </h3>
                  <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      <span>{new Date(video.created_at).toLocaleDateString("vi-VN")}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-slate-400 hover:text-red-500"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteVideo(video.id);
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
    </div>
  );
}
