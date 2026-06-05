"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, Search, Trash2, BookOpen, ExternalLink } from "lucide-react";

interface VocabularyItem {
  id: string;
  word: string;
  phonetic?: string;
  meaning?: string;
  sentence?: string;
  created_at: string;
  videos?: {
    title?: string;
    youtube_id?: string;
  };
}

export default function VocabularyPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [vocabularies, setVocabularies] = useState<VocabularyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("newest");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.push("/signin");
      } else {
        setUser(data.user);
        fetchVocabularies(data.user.id);
      }
    });
  }, [router]);

  useEffect(() => {
    if (user) {
      fetchVocabularies(user.id);
    }
  }, [search, sort, user]);

  const fetchVocabularies = async (userId?: string) => {
    if (!userId) return;

    try {
      let query = `/api/vocabulary?sort=${sort}`;
      if (search) query += `&search=${encodeURIComponent(search)}`;

      const response = await fetch(query);
      if (response.ok) {
        const data = await response.json();
        setVocabularies(data || []);
      }
    } catch (error) {
      console.error("Error fetching vocabularies:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Bạn có chắc muốn xóa từ này?")) return;

    setDeletingId(id);
    try {
      const response = await fetch(`/api/vocabulary/${id}`, { method: "DELETE" });
      if (response.ok) {
        setVocabularies((prev) => prev.filter((v) => v.id !== id));
      }
    } catch (error) {
      console.error("Error deleting vocabulary:", error);
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-slate-500">Đang tải...</div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-pink-500 rounded-xl flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-slate-800">LearnEnglish</span>
          </Link>
          <Link href="/">
            <Button variant="ghost" className="text-slate-600">
              Quay lại trang chủ
            </Button>
          </Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-800 mb-2 flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-indigo-500" />
            Từ vựng của tôi
          </h1>
          <p className="text-slate-600">
            {vocabularies.length} từ đã lưu
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <Input
              placeholder="Tìm kiếm từ vựng..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-12 h-12"
            />
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="h-12 px-4 rounded-xl border-2 border-slate-200 bg-white text-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
          >
            <option value="newest">Mới nhất</option>
            <option value="alphabetical">A-Z</option>
          </select>
        </div>

        {vocabularies.length === 0 ? (
          <Card className="p-12 text-center">
            <BookOpen className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-700 mb-2">
              {search ? "Không tìm thấy từ nào" : "Chưa có từ vựng nào"}
            </h3>
            <p className="text-slate-500 mb-6">
              {search
                ? "Thử tìm kiếm với từ khóa khác"
                : "Bắt đầu học video để lưu từ vựng mới"}
            </p>
            <Link href="/">
              <Button className="bg-indigo-500 hover:bg-indigo-600">
                Khám phá video
              </Button>
            </Link>
          </Card>
        ) : (
          <div className="space-y-3">
            {vocabularies.map((vocab) => (
              <Card key={vocab.id} className="group hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-slate-800">{vocab.word}</h3>
                        {vocab.phonetic && (
                          <span className="text-sm text-slate-400">{vocab.phonetic}</span>
                        )}
                      </div>
                      {vocab.meaning && (
                        <p className="text-slate-600 mb-2">{vocab.meaning}</p>
                      )}
                      {vocab.sentence && (
                        <p className="text-sm text-slate-500 italic bg-slate-50 p-2 rounded-lg">
                          &ldquo;{vocab.sentence}&rdquo;
                        </p>
                      )}
                      {vocab.videos && (
                        <Link
                          href={`/video/${vocab.videos.youtube_id}`}
                          className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline mt-2"
                        >
                          <ExternalLink className="w-3 h-3" />
                          {vocab.videos.title || "Xem video gốc"}
                        </Link>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(vocab.id)}
                      disabled={deletingId === vocab.id}
                      className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-5 h-5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
