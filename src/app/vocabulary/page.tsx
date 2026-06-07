"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, ExternalLink, Search, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

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
        return;
      }

      setUser(data.user);
      fetchVocabularies(data.user.id);
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
        setVocabularies((prev) => prev.filter((vocab) => vocab.id !== id));
      }
    } catch (error) {
      console.error("Error deleting vocabulary:", error);
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="learning-shell flex min-h-screen items-center justify-center bg-[#f8fbff] dark:text-slate-100">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-teal-500 border-t-transparent" />
          <p className="font-semibold text-slate-600">Đang tải từ vựng...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="learning-shell min-h-screen bg-[#f8fbff] text-slate-950 dark:text-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/80 px-4 py-4 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/85">
        <nav className="mx-auto flex max-w-6xl items-center justify-between rounded-full border border-slate-200 bg-white/90 px-4 py-2 shadow-lg shadow-slate-200/60">
          <Link href="/listening" className="flex items-center gap-3">
            <div className="relative h-12 w-12 rotate-[-5deg] rounded-[1.25rem] bg-lime-200 shadow-lg shadow-lime-300/30">
              <Image src="/image/logo.png" alt="LearnEnglish" fill className="object-contain p-1.5" />
            </div>
            <div>
              <p className="text-lg font-black leading-tight text-slate-950">LearnEnglish</p>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-teal-700">Vocabulary</p>
            </div>
          </Link>
          <Link href="/listening">
            <Button variant="outline" className="h-10 px-5">
              Về trang học
            </Button>
          </Link>
        </nav>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-10">
        <section className="mb-8 overflow-hidden rounded-[2.5rem] border border-teal-200 bg-gradient-to-br from-teal-100 via-emerald-50 to-lime-100 p-7 shadow-xl shadow-teal-100/60">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-sm font-extrabold text-teal-800 shadow-sm">
                <BookOpen className="h-4 w-4" />
                Sổ tay của bạn
              </div>
              <h1 className="font-heading text-4xl font-black leading-tight text-slate-950 md:text-5xl">
                Từ vựng đã lưu
              </h1>
              <p className="mt-3 max-w-2xl text-slate-700">
                Gom lại các từ bạn đã tra trong video để ôn nhanh theo ngữ cảnh.
              </p>
            </div>
            <div className="rounded-[1.75rem] bg-white/80 px-7 py-5 text-slate-950 shadow-xl shadow-teal-100/60 ring-1 ring-teal-200 dark:bg-slate-900 dark:text-white dark:shadow-slate-950/30 dark:ring-slate-700">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700 dark:text-teal-200">Tổng từ</p>
              <p className="mt-1 text-4xl font-black">{vocabularies.length}</p>
            </div>
          </div>
        </section>

        <section className="mb-7 rounded-[2rem] border border-slate-200 bg-white/90 p-4 shadow-lg shadow-slate-200/60 backdrop-blur">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Tìm kiếm từ vựng..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-12 pl-12"
              />
            </div>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value)}
              className="h-12 rounded-full border-2 border-slate-200 bg-white px-5 font-semibold text-slate-700 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
            >
              <option value="newest">Mới nhất</option>
              <option value="alphabetical">A-Z</option>
            </select>
          </div>
        </section>

        {vocabularies.length === 0 ? (
          <Card className="overflow-hidden border-teal-100 bg-white/90 shadow-xl shadow-slate-200/70">
            <CardContent className="grid gap-8 p-8 text-center md:grid-cols-[180px_1fr] md:text-left">
              <div className="mx-auto flex h-40 w-40 items-center justify-center rounded-[2rem] bg-teal-50 text-teal-700">
                <BookOpen className="h-16 w-16" />
              </div>
              <div className="flex flex-col justify-center">
                <h3 className="text-2xl font-black text-slate-950">
                  {search ? "Không tìm thấy từ phù hợp" : "Sổ tay còn trống"}
                </h3>
                <p className="mt-2 max-w-xl text-slate-600">
                  {search
                    ? "Thử đổi từ khóa hoặc quay lại danh sách đầy đủ."
                    : "Mở một video, bấm vào từ trong phụ đề và lưu lại để ôn sau."}
                </p>
                <div className="mt-6">
                  <Link href="/listening">
                    <Button>Khám phá video</Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {vocabularies.map((vocab) => (
              <Card
                key={vocab.id}
                className="group overflow-hidden border-slate-200 bg-white/95 shadow-sm hover:-translate-y-0.5 hover:shadow-xl hover:shadow-slate-200/70"
              >
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.25rem] bg-teal-50 text-2xl font-black uppercase text-teal-700">
                      {vocab.word.slice(0, 1)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-3">
                        <h3 className="text-2xl font-black text-slate-950">{vocab.word}</h3>
                        {vocab.phonetic && (
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-500">
                            {vocab.phonetic}
                          </span>
                        )}
                      </div>
                      {vocab.meaning && <p className="text-slate-700">{vocab.meaning}</p>}
                      {vocab.sentence && (
                        <p className="mt-3 rounded-[1.25rem] bg-slate-50 px-4 py-3 text-sm italic text-slate-600">
                          &ldquo;{vocab.sentence}&rdquo;
                        </p>
                      )}
                      {vocab.videos && (
                        <Link
                          href={`/video/${vocab.videos.youtube_id}`}
                          className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-teal-700 hover:text-teal-800"
                        >
                          <ExternalLink className="h-4 w-4" />
                          {vocab.videos.title || "Xem video gốc"}
                        </Link>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(vocab.id)}
                      disabled={deletingId === vocab.id}
                      className="text-slate-400 opacity-100 hover:bg-red-50 hover:text-red-500 md:opacity-0 md:group-hover:opacity-100"
                      aria-label="Xóa từ"
                    >
                      <Trash2 className="h-5 w-5" />
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
