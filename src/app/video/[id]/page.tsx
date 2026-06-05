"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-client";
import Link from "next/link";
import YouTube from "react-youtube";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, BookOpen, Volume2, Save, X, Loader2 } from "lucide-react";

interface Subtitle {
  start: number;
  end: number;
  text: string;
}

interface WordDefinition {
  word: string;
  phonetic?: string;
  audio?: string;
  definition?: string;
  partOfSpeech?: string;
  meanings?: Array<{
    partOfSpeech: string;
    definitions: string[];
  }>;
}

interface User {
  id: string;
  email?: string;
}

export default function VideoPage() {
  const params = useParams();
  const router = useRouter();
  const videoId = params.id as string;
  const playerRef = useRef<any>(null);
  const [user, setUser] = useState<User | null>(null);
  const [video, setVideo] = useState<any>(null);
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [currentSubtitle, setCurrentSubtitle] = useState<Subtitle | null>(null);
  const [showDefinition, setShowDefinition] = useState(false);
  const [selectedWord, setSelectedWord] = useState<{ word: string; sentence: string; index: number } | null>(null);
  const [wordDefinition, setWordDefinition] = useState<WordDefinition | null>(null);
  const [definitionLoading, setDefinitionLoading] = useState(false);
  const [savingWord, setSavingWord] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      fetchVideoData(data.user);
    });
  }, [videoId]);

  useEffect(() => {
    const subtitle = subtitles.find(
      (s) => currentTime >= s.start && currentTime <= s.end
    );
    setCurrentSubtitle(subtitle || null);
  }, [currentTime, subtitles]);

  const fetchVideoData = async (currentUser: any) => {
    try {
      const videoResponse = await fetch(`/api/videos/${videoId}`);
      if (videoResponse.ok) {
        const videoData = await videoResponse.json();
        setVideo(videoData);
        if (videoData.subtitles && Array.isArray(videoData.subtitles)) {
          setSubtitles(videoData.subtitles);
        }
      }

      if (!subtitles.length) {
        setSubtitles(getSampleSubtitles());
      }
    } catch (error) {
      console.error("Error fetching video:", error);
      setSubtitles(getSampleSubtitles());
    } finally {
      setLoading(false);
    }
  };

  const getSampleSubtitles = (): Subtitle[] => {
    return [
      { start: 0, end: 5, text: "Welcome to today's lesson on English expressions." },
      { start: 5, end: 10, text: "We're going to learn some very useful phrases." },
      { start: 10, end: 15, text: "Pay attention and try to repeat after me." },
      { start: 15, end: 20, text: "The weather is beautiful today, isn't it?" },
      { start: 20, end: 25, text: "I absolutely love learning new languages." },
      { start: 25, end: 30, text: "Practice makes perfect, as they say." },
      { start: 30, end: 35, text: "Can you tell me the difference between these two words?" },
      { start: 35, end: 40, text: "Understanding context is crucial for fluency." },
      { start: 40, end: 45, text: "Let's continue with more advanced vocabulary." },
      { start: 45, end: 50, text: "Thank you for watching this lesson!" },
    ];
  };

  const onPlayerReady = (event: any) => {
    playerRef.current = event.target;
  };

  const onPlayerStateChange = useCallback(() => {
    if (playerRef.current) {
      const time = playerRef.current.getCurrentTime();
      setCurrentTime(time);
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (playerRef.current) {
        setCurrentTime(playerRef.current.getCurrentTime());
      }
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const handleWordClick = async (word: string, sentence: string, index: number) => {
    setSelectedWord({ word, sentence, index });
    setShowDefinition(true);
    setDefinitionLoading(true);

    try {
      const response = await fetch(`/api/lookup?word=${encodeURIComponent(word)}`);
      const data = await response.json();
      setWordDefinition(data);
    } catch {
      setWordDefinition({ word, definition: "Không tìm thấy nghĩa" });
    } finally {
      setDefinitionLoading(false);
    }
  };

  const handleSaveWord = async () => {
    if (!selectedWord || !wordDefinition) return;

    setSavingWord(true);

    try {
      const response = await fetch("/api/vocabulary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          word: selectedWord.word,
          phonetic: wordDefinition.phonetic,
          meaning: wordDefinition.definition,
          sentence: selectedWord.sentence,
          videoId: video?.id,
          sentenceIndex: selectedWord.index,
        }),
      });

      if (response.ok) {
        setShowDefinition(false);
        setSelectedWord(null);
      }
    } catch {
      console.error("Error saving word");
    } finally {
      setSavingWord(false);
    }
  };

  const renderSubtitleText = (text: string) => {
    const words = text.split(" ");
    return words.map((word, index) => {
      const cleanWord = word.replace(/[^a-zA-Z]/g, "").toLowerCase();
      if (cleanWord.length > 2) {
        return (
          <span
            key={index}
            onClick={() => handleWordClick(cleanWord, text, index)}
            className="cursor-pointer hover:bg-indigo-100 rounded px-0.5 transition-colors"
          >
            {word}{" "}
          </span>
        );
      }
      return <span key={index}>{word} </span>;
    });
  };

  const getYouTubeId = () => {
    if (videoId && videoId.includes("-")) {
      return videoId;
    }
    return videoId;
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-indigo-500 mx-auto mb-4" />
          <p className="text-slate-600">Đang tải video...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-pink-500 rounded-xl flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-slate-800">LearnEnglish</span>
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/vocabulary" className="text-slate-600 hover:text-indigo-600 flex items-center gap-1">
              <BookOpen className="w-5 h-5" />
              Từ vựng
            </Link>
            {user ? (
              <Link href="/signout" className="text-slate-600 hover:text-indigo-600">
                Đăng xuất
              </Link>
            ) : (
              <Link href="/signin" className="bg-indigo-500 text-white px-4 py-2 rounded-lg hover:bg-indigo-600">
                Đăng nhập
              </Link>
            )}
          </nav>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Video Player */}
          <div className="lg:col-span-2">
            <div className="bg-black rounded-2xl overflow-hidden aspect-video mb-6">
              <YouTube
                videoId={getYouTubeId()}
                opts={{ height: "100%", width: "100%", playerVars: { autoplay: 0 } }}
                onReady={onPlayerReady}
                onStateChange={onPlayerStateChange}
                className="w-full h-full"
              />
            </div>

            {/* Current Subtitle */}
            {currentSubtitle && (
              <Card className="mb-6">
                <CardContent className="pt-6">
                  <p className="text-xl leading-relaxed">{renderSubtitleText(currentSubtitle.text)}</p>
                </CardContent>
              </Card>
            )}

            {/* Subtitle List */}
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-slate-800 mb-4">Phụ đề</h2>
              {subtitles.map((subtitle, index) => (
                <div
                  key={index}
                  onClick={() => {
                    if (playerRef.current) {
                      playerRef.current.seekTo(subtitle.start, true);
                    }
                  }}
                  className={`p-4 rounded-xl cursor-pointer transition-all ${
                    currentSubtitle?.start === subtitle.start
                      ? "bg-indigo-100 border-indigo-300"
                      : "bg-white hover:bg-slate-50 border border-slate-200"
                  }`}
                >
                  <p className="text-slate-800">{subtitle.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            {/* Word Lookup */}
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-indigo-500" />
                  Tra từ
                </h3>
                <p className="text-sm text-slate-500 mb-4">
                  Click vào từ bất kỳ trong phụ đề để xem nghĩa
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Word Definition Modal */}
      {showDefinition && selectedWord && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md animate-scale-in">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-slate-800">{selectedWord.word}</h3>
                <button
                  onClick={() => setShowDefinition(false)}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              {definitionLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                </div>
              ) : wordDefinition ? (
                <>
                  {wordDefinition.phonetic && (
                    <p className="text-slate-500 mb-2">{wordDefinition.phonetic}</p>
                  )}
                  {wordDefinition.definition && (
                    <div className="mb-4">
                      <span className="text-xs font-semibold text-indigo-600 uppercase">
                        {wordDefinition.partOfSpeech}
                      </span>
                      <p className="text-slate-800 mt-1">{wordDefinition.definition}</p>
                    </div>
                  )}

                  {wordDefinition.meanings && wordDefinition.meanings.length > 0 && (
                    <div className="space-y-2 mb-4">
                      {wordDefinition.meanings.slice(0, 2).map((meaning, index) => (
                        <div key={index}>
                          <span className="text-xs font-semibold text-pink-600 uppercase">
                            {meaning.partOfSpeech}
                          </span>
                          <ul className="list-disc list-inside text-sm text-slate-600 mt-1">
                            {meaning.definitions.slice(0, 2).map((def, i) => (
                              <li key={i}>{def}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}

                  {selectedWord.sentence && (
                    <div className="bg-slate-50 p-3 rounded-lg mb-4">
                      <p className="text-sm text-slate-600 italic">"{selectedWord.sentence}"</p>
                    </div>
                  )}

                  <div className="flex gap-3">
                    {wordDefinition.audio && (
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => {
                          const audio = new Audio(wordDefinition?.audio);
                          audio?.play();
                        }}
                      >
                        <Volume2 className="w-5 h-5 mr-2" />
                        Phát âm
                      </Button>
                    )}
                    <Button
                      className="flex-1 bg-indigo-500 hover:bg-indigo-600"
                      onClick={handleSaveWord}
                      disabled={savingWord || !wordDefinition?.definition}
                    >
                      <Save className="w-5 h-5 mr-2" />
                      {savingWord ? "Đang lưu..." : "Lưu từ"}
                    </Button>
                  </div>
                </>
              ) : (
                <p className="text-slate-500">Không tìm thấy nghĩa của từ này</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </main>
  );
}
