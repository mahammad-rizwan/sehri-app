# 🕌 ONE MESSAGE - Sehri Connect App

**Muslim student food coordination app for RV College, Bangalore**

---

## 📱 Quick Overview

**What it does:** Helps students vote for daily Sehri food, track deliveries, donate, and stay connected.

**Tech Stack:**
- Frontend: React Native (Expo)
- Backend: Node.js + Express + MySQL
- Real-time: Socket.IO
- Payments: Razorpay

---

## 🚀 For Development

### Start Backend
```bash
# Double-click this file:
start-backend.bat

# Or manually:
cd backend
node src/server.js
```

Backend runs on: `http://localhost:5000`

### Start Mobile App
```bash
cd mobile
npx expo start
```

---

## 📦 Build APK

### Prerequisites
1. Backend must be accessible via public URL (see BUILD-APK-GUIDE.md)
2. Update API URL in `mobile/src/constants/api.ts`

### Build Command
```bash
cd mobile
eas build --platform android --profile preview
```

**⚠️ IMPORTANT:** Read `BUILD-APK-GUIDE.md` before building for production!

---

## 🔑 Test Accounts

### Users (password: pass@123)
- 9876100001 to 9876100008

### Zone Admins (password: Admin@123)
- 9876200001 to 9876200004

### Super Admin
- Phone: 9483384972
- Password: Rizwan@2004
- Access: Tap moon logo 5× on welcome screen

---

## 📚 Documentation

| File | Purpose |
|------|---------|
| `PROJECT.md` | Complete technical documentation |
| `BUILD-APK-GUIDE.md` | APK deployment guide |
| `CREDENTIALS.txt` | All login credentials |
| `README.md` | This file |

---

## ⚠️ Production Deployment

**Current Setup:** Using ngrok (requires PC running 24/7)

**For Production:** Deploy backend to cloud hosting (Railway/Render/Heroku)

See `BUILD-APK-GUIDE.md` for detailed instructions.

---

## 🆘 Support

**Technical Issues:** Check backend logs at `backend/logs/`  
**API Issues:** Verify backend is running and accessible

---

## 📞 Contact

EAS Project: `rizwan866/sehri-connect`  
Package: `com.sehriconnect.app`

---

Last Updated: September 2026
