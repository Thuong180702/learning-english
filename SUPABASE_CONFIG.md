# Supabase Configuration Checklist

## 1. Authentication > URL Configuration

**Site URL**: `http://localhost:3001` (hoặc domain production)

**Redirect URLs** (thêm cả 2):
```
http://localhost:3000/auth/callback
http://localhost:3001/auth/callback
https://yourdomain.com/auth/callback (nếu deploy)
```

## 2. Authentication > Providers > Google

✅ **Enable Sign in with Google**: ON

**Client ID**: `1098133970936-1rmrhc407i0hidlcpv2n9j1o3i6pspc1.apps.googleusercontent.com`

**Client Secret**: (đã điền từ Google Cloud Console)

**Callback URL (for OAuth)**: `https://pureqrxixecxzyuuxtbm.supabase.co/auth/v1/callback`

## 3. Authentication > OAuth Server (BETA)

**Tắt hoặc không cấu hình** - Feature này dùng cho Supabase làm OAuth provider cho app khác, KHÔNG phải cho Google OAuth login.

Nếu đang bật, nó có thể conflict với Google OAuth flow.

## 4. Verification

Chạy: `node test-supabase.js`

Kết quả mong đợi:
```
✅ Database connection successful
✅ Videos table accessible
✅ Vocabulary table accessible
✅ Google OAuth is configured correctly
```

## 5. Test OAuth Flow

1. Hard refresh browser (Ctrl + Shift + R)
2. Vào http://localhost:3001/signin
3. Click "Đăng nhập với Google"
4. Phải redirect sang Google OAuth screen
5. Sau khi chọn tài khoản, redirect về trang chủ đã đăng nhập
