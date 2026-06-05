import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Play, BookOpen, Trophy, Sparkles } from "lucide-react";

export default function HomePage() {
  return (
    <main className="min-h-screen">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-pink-500 rounded-xl flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold font-heading text-slate-800">LearnEnglish</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/vocabulary">
              <Button variant="ghost" className="text-slate-600 hover:text-indigo-600">
                Từ vựng
              </Button>
            </Link>
            <Link href="/signin">
              <Button variant="ghost" className="text-slate-600">Đăng nhập</Button>
            </Link>
            <Link href="/register">
              <Button className="bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl">
                Bắt đầu ngay
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-indigo-100 text-indigo-700 px-4 py-2 rounded-full text-sm font-medium mb-6 animate-fade-in">
            <Sparkles className="w-4 h-4" />
            Học tiếng Anh qua phim & video YouTube
          </div>
          <h1 className="text-5xl md:text-6xl font-bold font-heading text-slate-800 mb-6 animate-slide-up">
            Học tiếng Anh dễ dàng
            <br />
            <span className="bg-gradient-to-r from-indigo-500 to-pink-500 bg-clip-text text-transparent">
              qua video yêu thích
            </span>
          </h1>
          <p className="text-xl text-slate-600 mb-10 max-w-2xl mx-auto animate-slide-up" style={{ animationDelay: "0.1s" }}>
            Thêm video YouTube bất kỳ, học từ vựng và ngữ pháp qua phụ đề tương tác, luyện nghe và phát âm như người bản ngữ.
          </p>

          {/* YouTube URL Input */}
          <Card className="p-6 max-w-2xl mx-auto animate-scale-in" style={{ animationDelay: "0.2s" }}>
            <form className="flex flex-col sm:flex-row gap-3">
              <Input
                type="url"
                placeholder="Dán link video YouTube vào đây..."
                className="flex-1 h-12 text-base rounded-xl border-slate-200 focus:border-indigo-500 focus:ring-indigo-500"
              />
              <Button type="submit" className="h-12 px-8 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-semibold">
                <Play className="w-5 h-5 mr-2" />
                Bắt đầu học
              </Button>
            </form>
            <p className="text-sm text-slate-500 mt-3">
              Ví dụ: https://www.youtube.com/watch?v=dQw4w9WgXcQ
            </p>
          </Card>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold font-heading text-center text-slate-800 mb-4">
            Tại sao chọn LearnEnglish?
          </h2>
          <p className="text-slate-600 text-center mb-16 max-w-2xl mx-auto">
            Nền tảng học tiếng Anh hiện đại, kết hợp giải trí và giáo dục
          </p>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <Card className="p-8 rounded-2xl border-0 shadow-lg hover:shadow-xl transition-shadow">
              <div className="w-14 h-14 bg-indigo-100 rounded-2xl flex items-center justify-center mb-6">
                <Play className="w-7 h-7 text-indigo-500" />
              </div>
              <h3 className="text-xl font-bold font-heading text-slate-800 mb-3">
                Video YouTube
              </h3>
              <p className="text-slate-600">
                Sử dụng video yêu thích của bạn từ YouTube để học tiếng Anh một cách tự nhiên và thú vị.
              </p>
            </Card>

            {/* Feature 2 */}
            <Card className="p-8 rounded-2xl border-0 shadow-lg hover:shadow-xl transition-shadow">
              <div className="w-14 h-14 bg-pink-100 rounded-2xl flex items-center justify-center mb-6">
                <BookOpen className="w-7 h-7 text-pink-500" />
              </div>
              <h3 className="text-xl font-bold font-heading text-slate-800 mb-3">
                Từ vựng thông minh
              </h3>
              <p className="text-slate-600">
                Click vào bất kỳ từ nào để xem nghĩa, lưu vào danh sách và ôn tập theo lịch trình.
              </p>
            </Card>

            {/* Feature 3 */}
            <Card className="p-8 rounded-2xl border-0 shadow-lg hover:shadow-xl transition-shadow">
              <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center mb-6">
                <Trophy className="w-7 h-7 text-green-500" />
              </div>
              <h3 className="text-xl font-bold font-heading text-slate-800 mb-3">
                Thành tích & XP
              </h3>
              <p className="text-slate-600">
                Kiếm điểm XP, hoàn thành thử thách hàng ngày và theo dõi tiến độ học tập của bạn.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <Card className="p-12 bg-gradient-to-br from-indigo-500 to-pink-500 border-0">
            <h2 className="text-3xl md:text-4xl font-bold font-heading text-white mb-4">
              Sẵn sàng bắt đầu?
            </h2>
            <p className="text-white/90 text-lg mb-8 max-w-xl mx-auto">
              Đăng ký miễn phí ngay hôm nay và bắt đầu hành trình học tiếng Anh của bạn.
            </p>
            <Link href="/register">
              <Button className="h-14 px-10 bg-white text-indigo-600 hover:bg-white/90 rounded-xl font-bold text-lg">
                Đăng ký miễn phí
              </Button>
            </Link>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-slate-200">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-pink-500 rounded-lg flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold font-heading text-slate-700">LearnEnglish</span>
          </div>
          <p className="text-sm text-slate-500">
            © 2026 LearnEnglish. Học tiếng Anh qua video.
          </p>
        </div>
      </footer>
    </main>
  );
}