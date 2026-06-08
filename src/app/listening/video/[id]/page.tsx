"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import YouTube from "react-youtube";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface Subtitle {
  start: number;
  end: number;
  text: string;
}

const SUBTITLE_OFFSET_STORAGE_PREFIX = "learnenglish:subtitle-offset:1";
const SUBTITLE_OFFSET_STEP = 0.5;
const SUBTITLE_OFFSET_LIMIT = 10;

function clampSubtitleOffset(value: number) {
  if (!Number.isFinite(value)) return 0;
  const rounded = Math.round(value * 10) / 10;
  return Math.max(-SUBTITLE_OFFSET_LIMIT, Math.min(SUBTITLE_OFFSET_LIMIT, rounded));
}

function adjustedSubtitleTime(seconds: number, offset: number) {
  return Math.max(0, seconds + offset);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function VideoLearningPage() {
  const params = useParams();
  const router = useRouter();
  const videoId = params.id as string;
  const playerRef = useRef<any>(null);
  const pauseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const startedEventSentRef = useRef(false);
  const completedEventSentRef = useRef(false);
  const subtitleButtonRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  const lastAutoScrolledSubtitleRef = useRef(-1);

  const [video, setVideo] = useState<any>(null);
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [subtitleLanguage, setSubtitleLanguage] = useState<string>("vi");
  const [autoTranslated, setAutoTranslated] = useState(false);
  const [subtitleError, setSubtitleError] = useState<string | null>(null);
  const [subtitleOffset, setSubtitleOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [currentSubtitle, setCurrentSubtitle] = useState<Subtitle | null>(null);
  const [activeSubtitleIndex, setActiveSubtitleIndex] = useState<number>(-1);
  const [completedSubtitles, setCompletedSubtitles] = useState<Set<number>>(new Set());
  const [isPlaying, setIsPlaying] = useState(false);

  const [userTranslation, setUserTranslation] = useState("");
  const [showAnswer, setShowAnswer] = useState(false);
  const [correctAnswer, setCorrectAnswer] = useState("");
  const [loadingAnswer, setLoadingAnswer] = useState(false);
  const [matchResult, setMatchResult] = useState<"correct" | "close" | "incorrect" | null>(null);

  // Post a learning event (study_time / video_started / video_completed)
  const postProgressEvent = useCallback(
    async (
      type: "study_time" | "video_started" | "video_completed",
      payload: { studySeconds?: number; positionSeconds?: number } = {}
    ) => {
      if (!video?.id) return;

      try {
        await fetch("/api/progress/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type,
            videoId: video.id,
            ...payload,
            metadata: { youtubeId: videoId },
          }),
        });
      } catch (error) {
        console.error("Error recording learning progress:", error);
      }
    },
    [video?.id, videoId]
  );

  // Save subtitle progress to DB
  const saveSubtitleProgress = useCallback(
    async (
      subtitleIndex: number,
      payload: {
        completed?: boolean;
      }
    ) => {
      try {
        await fetch("/api/subtitle-progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            videoId,
            subtitleIndex,
            completed: payload.completed !== false,
          }),
        });
      } catch (error) {
        console.error("Error saving subtitle progress:", error);
      }
    },
    [videoId]
  );

  useEffect(() => {
    fetchVideoData();
    fetchSubtitles();
    fetchCompletedSubtitles();
  }, [videoId]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(
        `${SUBTITLE_OFFSET_STORAGE_PREFIX}:${videoId}`
      );
      setSubtitleOffset(clampSubtitleOffset(raw ? Number(raw) : 0));
    } catch {
      setSubtitleOffset(0);
    }
  }, [videoId]);

  // Fetch the user's completed subtitles for this video from DB
  const fetchCompletedSubtitles = async () => {
    try {
      const response = await fetch(
        `/api/subtitle-progress?videoId=${encodeURIComponent(videoId)}`
      );
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data.completed)) {
          setCompletedSubtitles(new Set<number>(data.completed));
        }
      }
    } catch (error) {
      console.error("Failed to load completed subtitles:", error);
    }
  };

  useEffect(() => {
    const idx = subtitles.findIndex((item) => {
      const start = adjustedSubtitleTime(item.start, subtitleOffset);
      const end = Math.max(
        start + 0.1,
        adjustedSubtitleTime(item.end, subtitleOffset)
      );
      return currentTime >= start && currentTime <= end;
    });
    if (idx >= 0) {
      setCurrentSubtitle(subtitles[idx]);
      setActiveSubtitleIndex(idx);
    } else {
      setCurrentSubtitle(null);
    }
  }, [currentTime, subtitles, subtitleOffset]);

  useEffect(() => {
    if (activeSubtitleIndex < 0) return;
    if (lastAutoScrolledSubtitleRef.current === activeSubtitleIndex) return;

    lastAutoScrolledSubtitleRef.current = activeSubtitleIndex;
    const frameId = window.requestAnimationFrame(() => {
      subtitleButtonRefs.current[activeSubtitleIndex]?.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "nearest",
      });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [activeSubtitleIndex]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (playerRef.current) {
        setCurrentTime(playerRef.current.getCurrentTime());
      }
    }, 300);

    return () => clearInterval(interval);
  }, []);

  // Track watch time - send to backend every 30s while playing
  useEffect(() => {
    if (!isPlaying || !video?.id) return;

    const interval = setInterval(() => {
      const positionSeconds = playerRef.current?.getCurrentTime?.() || 0;
      postProgressEvent("study_time", {
        studySeconds: 30,
        positionSeconds,
      });
    }, 30000);

    return () => clearInterval(interval);
  }, [isPlaying, postProgressEvent, video?.id]);

  // Track partial study time when leaving page
  const lastStudyFlushRef = useRef<number>(Date.now());
  useEffect(() => {
    if (isPlaying) {
      lastStudyFlushRef.current = Date.now();
    }
  }, [isPlaying]);

  useEffect(() => {
    if (!video?.id) return;

    const flushPartialStudy = () => {
      if (!isPlaying) return;
      const elapsed = Math.floor((Date.now() - lastStudyFlushRef.current) / 1000);
      if (elapsed < 5) return; // skip very small intervals

      const positionSeconds = playerRef.current?.getCurrentTime?.() || 0;
      const payload = JSON.stringify({
        type: "study_time",
        videoId: video.id,
        studySeconds: Math.min(elapsed, 5 * 60),
        positionSeconds,
        metadata: { youtubeId: videoId },
      });

      // Use sendBeacon for reliable delivery on page unload
      if (typeof navigator !== "undefined" && navigator.sendBeacon) {
        navigator.sendBeacon(
          "/api/progress/events",
          new Blob([payload], { type: "application/json" })
        );
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushPartialStudy();
      } else {
        lastStudyFlushRef.current = Date.now();
      }
    };

    window.addEventListener("beforeunload", flushPartialStudy);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      flushPartialStudy();
      window.removeEventListener("beforeunload", flushPartialStudy);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isPlaying, video?.id, videoId]);

  const fetchVideoData = async () => {
    try {
      const videoResponse = await fetch(`/api/videos/${videoId}`);
      if (videoResponse.ok) {
        setVideo(await videoResponse.json());
      }
    } catch (error) {
      console.error("Error fetching video:", error);
    }
  };

  const fetchServerTranscript = async () => {
    const maxAttempts = 30;
    let assemblyTranscriptId: string | null = null;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const params = new URLSearchParams();
      if (assemblyTranscriptId) {
        params.set("assemblyTranscriptId", assemblyTranscriptId);
      }
      const query = params.toString();
      const response = await fetch(
        `/api/transcript/${encodeURIComponent(videoId)}${
          query ? `?${query}` : ""
        }`
      );
      const data = await response.json().catch(() => null);

      if (response.ok && data?.subtitles?.length) {
        return data;
      }

      if (response.status === 202 && data?.pending) {
        if (typeof data.transcriptId === "string") {
          assemblyTranscriptId = data.transcriptId;
        }
        setSubtitleError("Dang tao phu de bang AssemblyAI...");
        await delay(Number(data.retryAfterMs || 4000));
        continue;
      }

      return data || { error: "Khong the tai phu de" };
    }

    return { error: "AssemblyAI dang xu ly lau hon du kien. Thu lai sau." };
  };

  const fetchSubtitles = async () => {
    try {
      setSubtitleError(null);
      const serverTranscript = await fetchServerTranscript();

      if (serverTranscript?.subtitles?.length) {
        setSubtitles(serverTranscript.subtitles);
        setSubtitleLanguage(serverTranscript.language || "vi");
        setAutoTranslated(serverTranscript.autoTranslated || false);
        return;
      }

      setSubtitles([]);
      setSubtitleError(
        serverTranscript?.error || "Khong the tai phu de tu Supadata"
      );
    } catch (error) {
      console.error("Error fetching subtitles:", error);
      setSubtitles([]);
      setSubtitleError("Khong the tai phu de");
    } finally {
      setLoading(false);
    }
  };

  const onPlayerReady = (event: any) => {
    playerRef.current = event.target;
    try {
      event.target.loadModule?.("captions");
      event.target.setOption?.("captions", "track", { languageCode: "vi" });
      event.target.setOption?.("captions", "reload", true);
    } catch (error) {
      console.warn("Could not enable YouTube captions:", error);
    }
  };

  const onPlayerStateChange = useCallback(
    (event: any) => {
      if (playerRef.current) {
        setCurrentTime(playerRef.current.getCurrentTime());
      }

      // 1 = playing
      if (event.data === 1) {
        setIsPlaying(true);

        if (!startedEventSentRef.current && video?.id) {
          startedEventSentRef.current = true;
          postProgressEvent("video_started", {
            positionSeconds: playerRef.current?.getCurrentTime?.() || 0,
          });
        }
      }

      // 2 = paused, 0 = ended
      if (event.data === 2 || event.data === 0) {
        setIsPlaying(false);
      }

      // 0 = ended
      if (event.data === 0 && !completedEventSentRef.current && video?.id) {
        completedEventSentRef.current = true;
        postProgressEvent("video_completed", {
          positionSeconds: playerRef.current?.getDuration?.() || currentTime,
        });
      }
    },
    [currentTime, postProgressEvent, video?.id]
  );

  const handleSubtitleClick = (subtitle: Subtitle, index: number) => {
    if (!playerRef.current) return;

    if (pauseTimeoutRef.current) {
      clearTimeout(pauseTimeoutRef.current);
    }

    const start = adjustedSubtitleTime(subtitle.start, subtitleOffset);
    const end = Math.max(
      start + 0.5,
      adjustedSubtitleTime(subtitle.end, subtitleOffset)
    );

    playerRef.current.seekTo(start, true);
    playerRef.current.playVideo();

    const duration = (end - start) * 1000;
    pauseTimeoutRef.current = setTimeout(() => {
      if (playerRef.current) {
        playerRef.current.pauseVideo();
      }
    }, duration);

    setActiveSubtitleIndex(index);
    setUserTranslation("");
    setShowAnswer(false);
    setCorrectAnswer("");
    setMatchResult(null);
  };

  const updateSubtitleOffset = (delta: number) => {
    setSubtitleOffset((previous) => {
      const next = clampSubtitleOffset(previous + delta);
      try {
        window.localStorage.setItem(
          `${SUBTITLE_OFFSET_STORAGE_PREFIX}:${videoId}`,
          String(next)
        );
      } catch {
        // Keep the in-memory value if browser storage is unavailable.
      }
      return next;
    });
  };

  const resetSubtitleOffset = () => {
    setSubtitleOffset(0);
    try {
      window.localStorage.removeItem(
        `${SUBTITLE_OFFSET_STORAGE_PREFIX}:${videoId}`
      );
    } catch {
      // Browser storage can be unavailable.
    }
  };

  const handleReplayCurrent = () => {
    if (currentSubtitle) {
      const idx = subtitles.findIndex((s) => s.start === currentSubtitle.start);
      handleSubtitleClick(currentSubtitle, idx);
    }
  };

  const normalize = (text: string) =>
    text
      .toLowerCase()
      .replace(/[.,!?;:'"()\-—]/g, "")
      .replace(/\s+/g, " ")
      .trim();

  const calculateSimilarity = (a: string, b: string): number => {
    const normA = normalize(a);
    const normB = normalize(b);
    if (normA === normB) return 1;
    if (!normA || !normB) return 0;

    const wordsA = normA.split(" ");
    const wordsB = normB.split(" ");
    const setB = new Set(wordsB);
    const matches = wordsA.filter((w) => setB.has(w)).length;
    return matches / Math.max(wordsA.length, wordsB.length);
  };

  const translateInBrowser = async (
    text: string,
    source: string,
    target: string
  ) => {
    const url =
      "https://translate.googleapis.com/translate_a/single" +
      `?client=gtx&sl=${encodeURIComponent(source)}` +
      `&tl=${encodeURIComponent(target)}&dt=t` +
      `&q=${encodeURIComponent(text)}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("Translation failed");
    }

    const data = await response.json();
    return Array.isArray(data?.[0])
      ? data[0].map((item: any) => item[0]).join("")
      : "";
  };

  const handleCheckAnswer = async () => {
    if (!currentSubtitle || !userTranslation.trim()) return;

    setLoadingAnswer(true);
    try {
      const answer = await translateInBrowser(currentSubtitle.text, "vi", "en");
      setCorrectAnswer(answer || "Khong the lay dap an");

      if (answer) {
        const similarity = calculateSimilarity(userTranslation, answer);
        let result: "correct" | "close" | "incorrect";
        if (similarity >= 0.8) {
          result = "correct";
          setCompletedSubtitles((prev) => {
            const next = new Set(prev);
            next.add(activeSubtitleIndex);
            return next;
          });
          // Save to DB as completed
          saveSubtitleProgress(activeSubtitleIndex, {
            completed: true,
          });
        } else if (similarity >= 0.5) {
          result = "close";
          // Save attempt without marking complete
          saveSubtitleProgress(activeSubtitleIndex, {
            completed: false,
          });
        } else {
          result = "incorrect";
          saveSubtitleProgress(activeSubtitleIndex, {
            completed: false,
          });
        }
        setMatchResult(result);
      }
    } catch {
      setCorrectAnswer("Lỗi khi lấy đáp án");
    } finally {
      setLoadingAnswer(false);
      setShowAnswer(true);
    }
  };

  const handleMarkComplete = () => {
    if (activeSubtitleIndex < 0 || !currentSubtitle) return;
    setCompletedSubtitles((prev) => {
      const next = new Set(prev);
      next.add(activeSubtitleIndex);
      return next;
    });
    saveSubtitleProgress(activeSubtitleIndex, {
      completed: true,
    });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatOffset = (seconds: number) =>
    `${seconds > 0 ? "+" : ""}${seconds.toFixed(1)}s`;

  const completedCount = completedSubtitles.size;
  const totalCount = subtitles.length;
  const completionPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-teal-600" />
          <p className="font-semibold text-slate-600 dark:text-slate-300">
            Đang tải video và phụ đề...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-3 lg:px-5 xl:px-6">
      {/* Title row with back button */}
      <div className="mb-2 flex items-center gap-3">
        <Button
          variant="ghost"
          onClick={() => router.push("/listening/myvideo")}
          className="h-8 gap-1.5 px-2 text-xs text-slate-700 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Quay lại danh sách
        </Button>
        <span className="h-4 w-px bg-slate-300 dark:bg-slate-700" />
        <p className="rounded-full bg-teal-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-teal-700 dark:bg-teal-900/40 dark:text-teal-300">
          Đang học
        </p>
        <h1 className="font-heading text-sm font-extrabold text-slate-950 dark:text-white line-clamp-1 min-w-0">
          {video?.title || "Video luyện nghe"}
        </h1>
      </div>

      {/* Two-column layout */}
      <div
        className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(420px,28vw)] xl:grid-cols-[minmax(0,1fr)_minmax(460px,30vw)] 2xl:grid-cols-[minmax(0,1fr)_minmax(500px,31vw)]"
        style={{ height: "calc(100vh - 7.5rem)" }}
      >
        {/* Left column: Video + Subtitle + Translation */}
        <section className="min-w-0 flex h-full flex-col gap-2 overflow-y-auto pr-1">
          <div className="mx-auto w-full max-w-[1080px] shrink-0 overflow-hidden rounded-xl border border-slate-800 bg-slate-950 p-1 shadow-lg shadow-slate-900/20">
            <div className="aspect-video overflow-hidden rounded-lg bg-black">
              <YouTube
                videoId={videoId}
                opts={{
                  height: "100%",
                  width: "100%",
                  playerVars: {
                    autoplay: 0,
                    cc_lang_pref: "vi",
                    cc_load_policy: 1,
                    hl: "vi",
                  },
                }}
                onReady={onPlayerReady}
                onStateChange={onPlayerStateChange}
                className="h-full w-full"
              />
            </div>
          </div>

          {/* Vietnamese subtitle box */}
          <Card className="shrink-0 border-teal-200 bg-white/95 shadow-sm shadow-teal-100/40 dark:border-teal-900/40 dark:bg-slate-900/95 dark:shadow-teal-950/30">
            <CardContent className="px-3 py-2">
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-teal-700 dark:text-teal-300 shrink-0">
                  {autoTranslated ? "Phụ đề tiếng Việt (auto)" : "Phụ đề tiếng Việt"}
                </p>
                {currentSubtitle && (
                  <Button
                    onClick={handleReplayCurrent}
                    size="sm"
                    variant="outline"
                    className="h-6 gap-1 px-2 text-[10px]"
                  >
                    <Play className="h-2.5 w-2.5" />
                    Nghe lại
                  </Button>
                )}
              </div>
              <div className="rounded-md bg-teal-50/50 px-2.5 py-1.5 dark:bg-teal-950/30">
                {currentSubtitle ? (
                  <p className="text-sm font-semibold leading-snug text-slate-950 dark:text-white">
                    {currentSubtitle.text}
                  </p>
                ) : (
                  <p className="text-xs italic text-slate-400 dark:text-slate-500">
                    Phát video hoặc chọn câu trong timeline để bắt đầu luyện dịch
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* English translation input */}
          <Card className="shrink-0 border-slate-200 bg-white/95 shadow-sm shadow-slate-200/40 dark:border-slate-700 dark:bg-slate-900/95 dark:shadow-slate-950/30">
            <CardContent className="px-3 py-2">
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-700 dark:text-slate-300 shrink-0">
                  Bản dịch tiếng Anh của bạn
                </p>
                <div className="flex gap-1.5">
                  {currentSubtitle && completedSubtitles.has(activeSubtitleIndex) && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                      <CheckCircle2 className="h-2.5 w-2.5" />
                      Đã hoàn thành
                    </span>
                  )}
                  <Button
                    onClick={handleCheckAnswer}
                    disabled={!currentSubtitle || !userTranslation.trim() || loadingAnswer}
                    size="sm"
                    className="h-6 px-2 text-[10px]"
                  >
                    {loadingAnswer ? "Đang kiểm tra..." : "Kiểm tra"}
                  </Button>
                </div>
              </div>
              <input
                type="text"
                value={userTranslation}
                onChange={(e) => {
                  setUserTranslation(e.target.value);
                  setShowAnswer(false);
                  setMatchResult(null);
                }}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    currentSubtitle &&
                    userTranslation.trim() &&
                    !loadingAnswer
                  ) {
                    handleCheckAnswer();
                  }
                }}
                placeholder={
                  currentSubtitle
                    ? "Nhập bản dịch tiếng Anh của bạn ở đây..."
                    : "Chọn một câu để bắt đầu luyện dịch"
                }
                disabled={!currentSubtitle}
                className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100 disabled:bg-slate-50 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-teal-500 dark:disabled:bg-slate-900 dark:disabled:text-slate-600"
              />

              {showAnswer && correctAnswer && (
                <div
                  className={`mt-1.5 rounded-md border px-2.5 py-1.5 ${
                    matchResult === "correct"
                      ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/30"
                      : matchResult === "close"
                      ? "border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/30"
                      : "border-rose-200 bg-rose-50 dark:border-rose-900/40 dark:bg-rose-950/30"
                  }`}
                >
                  <div className="mb-0.5 flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5">
                      {matchResult === "correct" ? (
                        <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                      ) : matchResult === "close" ? (
                        <CheckCircle2 className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                      ) : (
                        <XCircle className="h-3 w-3 text-rose-600 dark:text-rose-400" />
                      )}
                      <p
                        className={`text-[10px] font-bold uppercase tracking-[0.14em] ${
                          matchResult === "correct"
                            ? "text-emerald-700 dark:text-emerald-300"
                            : matchResult === "close"
                            ? "text-amber-700 dark:text-amber-300"
                            : "text-rose-700 dark:text-rose-300"
                        }`}
                      >
                        {matchResult === "correct"
                          ? "Chính xác!"
                          : matchResult === "close"
                          ? "Gần đúng - Bản tham khảo"
                          : "Chưa đúng - Bản tham khảo"}
                      </p>
                    </div>
                    {matchResult !== "correct" && (
                      <Button
                        onClick={handleMarkComplete}
                        size="sm"
                        variant="outline"
                        className="h-5 px-1.5 text-[9px]"
                      >
                        Đánh dấu hoàn thành
                      </Button>
                    )}
                  </div>
                  <p className="text-sm text-slate-800 dark:text-slate-200">{correctAnswer}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Right column: Subtitle timeline */}
        <aside className="min-w-0 overflow-hidden">
          <Card className="flex h-full flex-col overflow-hidden border-slate-200 bg-white shadow-sm shadow-slate-200/40 dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/30">
            <div className="border-b border-slate-100 bg-gradient-to-r from-teal-50 to-white px-3 py-2 dark:border-slate-800 dark:from-teal-950/40 dark:to-slate-900">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-teal-700 dark:text-teal-300">
                    Timeline phụ đề
                  </p>
                  <h2 className="mt-0.5 font-heading text-xs font-extrabold text-slate-900 dark:text-white">
                    {completedCount}/{totalCount} câu ({completionPercent}%)
                  </h2>
                </div>
                <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-bold text-teal-700 dark:bg-teal-900/40 dark:text-teal-300">
                  {subtitleLanguage === "vi-translated"
                    ? "VI (auto)"
                    : subtitleLanguage === "vi-auto"
                    ? "VI (auto)"
                    : subtitleLanguage.toUpperCase()}
                </span>
              </div>
              {subtitles.length > 0 && (
                <div className="mt-2 flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-white/70 px-2 py-1 dark:border-slate-700 dark:bg-slate-950/40">
                  <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                    Sync {formatOffset(subtitleOffset)}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      title="Phu de som hon 0.5s"
                      onClick={() => updateSubtitleOffset(-SUBTITLE_OFFSET_STEP)}
                      className="h-7 w-7 p-0"
                    >
                      <SkipBack className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      title="Dat lai sync"
                      onClick={resetSubtitleOffset}
                      className="h-7 w-7 p-0"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      title="Phu de muon hon 0.5s"
                      onClick={() => updateSubtitleOffset(SUBTITLE_OFFSET_STEP)}
                      className="h-7 w-7 p-0"
                    >
                      <SkipForward className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex-1 space-y-1 overflow-y-auto p-2">
              {subtitles.length === 0 ? (
                <div className="py-8 text-center">
                  <XCircle className="mx-auto mb-3 h-10 w-10 text-slate-300 dark:text-slate-700" />
                  <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                    {subtitleError || "Video này không có phụ đề"}
                  </p>
                  <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                    {subtitleError
                      ? "Hãy thử video có CC hoặc auto-caption trên YouTube"
                      : "Hãy chọn video khác có phụ đề để luyện tập"}
                  </p>
                </div>
              ) : (
                subtitles.map((subtitle, index) => {
                  const isCompleted = completedSubtitles.has(index);
                  const isActive = activeSubtitleIndex === index;
                  return (
                    <button
                      key={`${subtitle.start}-${index}`}
                      ref={(node) => {
                        subtitleButtonRefs.current[index] = node;
                      }}
                      onClick={() => handleSubtitleClick(subtitle, index)}
                      className={`w-full rounded-md border p-2 text-left transition-all ${
                        isActive
                          ? isCompleted
                            ? "border-emerald-400 bg-emerald-50 shadow-sm shadow-emerald-100/60 dark:border-emerald-700 dark:bg-emerald-950/40"
                            : "border-teal-300 bg-teal-50 shadow-sm shadow-teal-100/60 dark:border-teal-700 dark:bg-teal-950/40"
                          : isCompleted
                          ? "border-emerald-200 bg-emerald-50/50 hover:border-emerald-300 hover:bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/30"
                          : "border-slate-200 bg-white hover:border-teal-200 hover:bg-teal-50/30 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-teal-800 dark:hover:bg-teal-950/20"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`text-[10px] font-bold ${
                            isActive
                              ? "text-teal-700 dark:text-teal-300"
                              : isCompleted
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-slate-400 dark:text-slate-500"
                          }`}
                        >
                          {formatTime(
                            adjustedSubtitleTime(subtitle.start, subtitleOffset)
                          )}
                        </span>
                        <div className="flex items-center gap-1">
                          {isCompleted && (
                            <CheckCircle2
                              className="h-3 w-3 text-emerald-600 dark:text-emerald-400"
                              fill="currentColor"
                              fillOpacity={0.2}
                            />
                          )}
                          {isActive && (
                            <Play className="h-2 w-2 text-teal-600 dark:text-teal-400" fill="currentColor" />
                          )}
                        </div>
                      </div>
                      <p
                        className={`mt-0.5 text-xs leading-tight ${
                          isActive
                            ? "font-semibold text-slate-900 dark:text-white"
                            : isCompleted
                            ? "text-emerald-900 line-through decoration-emerald-300/70 dark:text-emerald-200"
                            : "text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        {subtitle.text}
                      </p>
                    </button>
                  );
                })
              )}
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
