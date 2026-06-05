# Phase 1: MVP - Core
**Date:** 2026-06-05
**Project:** LearnEnglish - Learn English Through Video & Film
**Scope:** Auth, Video Player, Subtitles, Watch Mode, Basic Vocabulary

---

## 1. Overview

Phase 1 là nền tảng cốt lõi của hệ thống, cho phép người dùng:
- Đăng nhập/đăng ký bằng Google OAuth hoặc Email + Password
- Thêm video YouTube và xem với subtitles
- Click vào từ để xem nghĩa và lưu vào vocabulary

---

## 2. Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14 (App Router) + TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| Database | PostgreSQL (via Prisma ORM) |
| Auth | NextAuth.js v5 |
| Cache | Vercel KV (Redis) - word definitions |
| Dictionary API | Free Dictionary API |

---

## 3. Design System

### 3.1 Visual Style
- **Phong cách:** Hoạt hình (cartoon-like), tối giản (minimal), thân thiện (friendly)
- **Characteristics:**
  - Rounded corners (border-radius: 12px-16px)
  - Soft shadows (box-shadow nhẹ)
  - Smooth animations (fade-in, scale)
  - Clean whitespace
  - Friendly illustrations

### 3.2 Color Palette

| Name | Hex | Usage |
|------|-----|-------|
| Primary | `#6366F1` (Indigo) | Main buttons, CTAs |
| Primary Hover | `#4F46E5` | Button hover states |
| Secondary | `#F472B6` (Pink) | Accents, highlights |
| Background | `#F8FAFC` (Light) | Page backgrounds |
| Surface | `#FFFFFF` | Cards, containers |
| Text Primary | `#1E293B` | Headings |
| Text Secondary | `#64748B` | Body text, captions |
| Success | `#22C55E` | Success states |
| Error | `#EF4444` | Error states |

### 3.3 Typography

| Element | Font | Size | Weight |
|---------|------|------|--------|
| H1 | Nunito | 36px | Bold (700) |
| H2 | Nunito | 24px | SemiBold (600) |
| Body | Inter | 16px | Regular (400) |
| Caption | Inter | 14px | Medium (500) |

### 3.4 Spacing Scale
- xs: 4px
- sm: 8px
- md: 16px
- lg: 24px
- xl: 32px
- 2xl: 48px

### 3.5 Border Radius
- Buttons: 12px
- Cards: 16px
- Inputs: 12px
- Popups: 16px

---

## 4. Database Schema

### 4.1 Users Table
```
users
├── id: UUID (PK)
├── email: VARCHAR(255) UNIQUE NOT NULL
├── password_hash: VARCHAR(255) NULL
├── name: VARCHAR(100)
├── avatar_url: TEXT NULL
├── google_id: VARCHAR(255) NULL UNIQUE
├── email_verified: BOOLEAN DEFAULT false
├── verification_token: VARCHAR(255) NULL
├── created_at: TIMESTAMP
└── updated_at: TIMESTAMP
```

### 4.2 Videos Table
```
videos
├── id: UUID (PK)
├── youtube_id: VARCHAR(20) UNIQUE NOT NULL
├── title: VARCHAR(500)
├── thumbnail_url: TEXT
├── duration: INTEGER (seconds)
├── subtitles: JSONB [{start, end, text}]
├── cached_at: TIMESTAMP
└── created_at: TIMESTAMP
```

### 4.3 User Videos Table
```
user_videos
├── id: UUID (PK)
├── user_id: UUID (FK → users.id)
├── video_id: UUID (FK → videos.id)
├── last_position: INTEGER (seconds)
├── completed: BOOLEAN DEFAULT false
├── last_watched_at: TIMESTAMP
└── created_at: TIMESTAMP
UNIQUE: (user_id, video_id)
```

### 4.4 Vocabulary Table
```
vocabulary
├── id: UUID (PK)
├── user_id: UUID (FK → users.id)
├── video_id: UUID (FK → videos.id)
├── sentence_index: INTEGER
├── word: VARCHAR(100) NOT NULL
├── phonetic: VARCHAR(100)
├── meaning: VARCHAR(500)
├── sentence: TEXT
├── created_at: TIMESTAMP
INDEX: (user_id, created_at DESC)
```

---

## 5. Authentication

### 5.1 Login Methods
1. **Google OAuth** - One-click sign in
2. **Email + Password** - Traditional registration with email verification

### 5.2 Auth Flow - Email Registration
```
User registers → Create pending account → Send verification email →
User clicks link → Account activated → Login success
```

### 5.3 Verification Email Content
- Subject: "Xác minh tài khoản LearnEnglish"
- Contains: Verification link with token
- Token expires: 24 hours

---

## 6. Features

### 6.1 Homepage
- Hero section với YouTube URL input
- Input validation (check YouTube URL format)
- Quick start buttons (Browse, Features)
- "Continue Learning" section (logged-in users)
- Features overview

### 6.2 Video Player Page
- YouTube embed player
- Subtitle display bên dưới video
- Sentence list sidebar (scrollable)
- Clickable words để xem definition
- Save word to vocabulary button
- Light/Dark mode toggle

### 6.3 Vocabulary Page
- List all saved words
- Search/filter words
- Word card: word, phonetic, meaning, sentence context
- Delete word functionality
- Sort by date or alphabetically

### 6.4 Word Lookup
- Click word → Popup hiển thị:
  - Word
  - Phonetic (IPA)
  - Vietnamese meaning
  - Part of speech
- Cache definitions (24h)
- "Save to Vocabulary" button

---

## 7. API Endpoints

### 7.1 Auth APIs
```
POST /api/auth/register     - Register with email/password
GET  /api/auth/verify       - Verify email token
GET  /api/auth/google       - Google OAuth redirect
GET  /api/auth/callback     - Google OAuth callback
GET  /api/auth/session      - Get current session
POST /api/auth/signout      - Sign out
```

### 7.2 Video APIs
```
GET  /api/videos            - List user's videos (paginated)
POST /api/videos           - Add video by YouTube URL
GET  /api/videos/[id]      - Get video details + subtitles
PATCH /api/videos/[id]     - Update watch position
```

### 7.3 Vocabulary APIs
```
GET  /api/vocabulary        - List user's words
POST /api/vocabulary       - Save a word
DELETE /api/vocabulary/[id] - Delete a word
```

### 7.4 Lookup APIs
```
GET  /api/lookup?word=xxx  - Get word definition (cached)
```

---

## 8. Component Structure

```
src/
├── app/
│   ├── page.tsx                    # Homepage
│   ├── video/[id]/page.tsx         # Video player
│   ├── vocabulary/page.tsx        # Vocabulary list
│   ├── signin/page.tsx            # Sign in page
│   ├── register/page.tsx         # Register page
│   └── api/...                    # API routes
│
├── components/
│   ├── ui/                         # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── card.tsx
│   │   └── ...
│   │
│   ├── auth/
│   │   ├── auth-provider.tsx
│   │   ├── sign-in-button.tsx
│   │   └── user-menu.tsx
│   │
│   ├── video/
│   │   ├── video-player.tsx
│   │   ├── subtitle-display.tsx
│   │   ├── sentence-list.tsx
│   │   └── word-popup.tsx
│   │
│   └── vocabulary/
│       ├── vocabulary-list.tsx
│       └── vocabulary-card.tsx
│
├── lib/
│   ├── db.ts                       # Prisma client
│   ├── auth.ts                     # NextAuth config
│   ├── youtube.ts                  # YouTube API helpers
│   └── dictionary.ts               # Dictionary API helpers
│
└── stores/
    └── vocabulary-store.ts        # Zustand store
```

---

## 9. Environment Variables

```bash
# .env.local
DATABASE_URL="postgresql://user:password@host:5432/dbname"
NEXTAUTH_SECRET="your-secret-here"
NEXTAUTH_URL="http://localhost:3000"
GOOGLE_CLIENT_ID="xxx.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="xxx"
EMAIL_SERVICE_API_KEY="for sending verification emails"
```

---

## 10. Non-Functional Requirements

### 10.1 Performance
- Page load: < 2 seconds
- Video subtitle load: < 3 seconds (after YouTube fetch)
- Word lookup: < 500ms (cached)

### 10.2 Scalability
- Support 10,000+ concurrent users
- Rate limiting: 100 requests/minute per user
- Cached subtitles: 1 hour TTL

### 10.3 Security
- Password hashing: bcrypt
- CSRF protection (NextAuth built-in)
- SQL injection prevention (Prisma)
- XSS prevention

---

## 11. Out of Scope (Future Phases)

- AI Grading System
- Dictation & Shadowing modes
- XP, Streaks, Achievements
- Subscription tiers
- Advanced analytics

---

## 12. Dependencies

```json
{
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.2.0",
    "typescript": "^5.0.0",
    "@prisma/client": "^5.0.0",
    "next-auth": "^5.0.0-beta.0",
    "zustand": "^4.4.0",
    "youtube-transcript-api": "^0.6.0",
    "framer-motion": "^10.0.0",
    "clsx": "^2.0.0",
    "tailwind-merge": "^2.0.0"
  },
  "devDependencies": {
    "prisma": "^5.0.0",
    "tailwindcss": "^3.3.0",
    "@types/node": "^20.0.0",
    "@types/react": "^18.2.0"
  }
}
```

---

## 13. Implementers Notes

1. **Start with Auth** - Setup NextAuth first with both Google and Credentials providers
2. **Database Setup** - Run Prisma migrate to create tables
3. **Video API** - Test youtube-transcript-api server-side
4. **Page by Page** - Build homepage → video player → vocabulary
5. **UI Polish** - Add animations last with framer-motion
