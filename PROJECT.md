# One Message — Complete Project Documentation

> **App name:** One Message  
> **Slug / EAS project:** `sehri-connect` (rizwan866)  
> **Package:** `com.sehriconnect.app`  
> **EAS Project ID:** `07ed36cc-e75c-47bb-afb0-0b464d4bd275`  
> **Build command:** `eas build --platform android --profile preview`

---

## What is One Message?

One Message is a Ramzan/Sehri food distribution coordination app for Muslim students at **RV College, Kengeri, Bangalore**. The name comes from the Shahada — one declaration of faith, one community, one purpose. Every feature serves that community: making sure students get their Sehri food organized, tracked, and paid for with minimal friction.

---

## Tech Stack

### Backend — Node.js + Express + MySQL
| Component | Detail |
|---|---|
| Framework | Express.js |
| Database | MySQL via Sequelize ORM |
| Real-time | Socket.IO |
| Auth | JWT (7-day access token, 30-day refresh token) |
| Push notifications | Expo Push via `exp.host` gateway (not raw FCM) |
| OTP SMS | MessageCentral VerifyNow (Indian SMS, credentials: `C-6754BD9901EF45D`) |
| Payments | Razorpay (UPI only) |
| Prayer timings | AlAdhan API (Bangalore) |
| Email receipts | Nodemailer (Gmail: `onemessage.support@gmail.com`) |
| Scheduled jobs | node-cron (10 PM / 5 AM / 9:50 AM IST) |
| Public URL | ngrok static domain: `ungraded-reminder-booted.ngrok-free.dev` |
| Security | Helmet, CORS, compression, morgan, rate limiting |

### Mobile — React Native + Expo SDK 54 + TypeScript
| Component | Detail |
|---|---|
| Navigation | Expo Router (file-based) |
| State management | Zustand (auth store) |
| Token storage | expo-secure-store |
| Real-time chat | Socket.IO client |
| Payment checkout | react-native-webview (Razorpay HTML) |
| Push notifications | expo-notifications |
| Arabic font | IndopakNastaleeq.ttf |
| Quran data | api.quran.com/api/v4 |
| Maps | Google Maps JS API via WebView |
| Architecture | New Architecture enabled (`newArchEnabled: true`) |

---

## User Roles

| Role | DB Table | Description |
|---|---|---|
| `user` | `users` | Regular app user; needs admin approval after registration |
| `admin` | `admins` | Zone admin; manages one zone's users, sees zone poll stats |
| `super_admin` | `super_admins` | Full control — creates admins, toggles polls, manages riders, sees all zones |
| `rider` | `tracking` | Separate login; pushes live GPS every 20 seconds |

One phone number can hold multiple roles simultaneously. Role switching is instant — no re-login — via `POST /auth/switch-role`.

---

## Zones (4 Delivery Areas Near RV College)

| Zone Key | Label | Emoji | Color |
|---|---|---|---|
| `masjid` | Masjid Zone | 🕌 | `#C9A84C` (Gold) |
| `boys_hostel` | Boys Hostel Zone | 🏠 | `#4FC3F7` (Blue) |
| `stanza` | Stanza Zone | 🏡 | `#AB47BC` (Purple) |
| `girls` | Girls Zone | 🌸 | `#EC407A` (Pink) |

---

## All Features

### 1. Registration & Login
- OTP-based registration via MessageCentral (Indian SMS)
- Location cascade: Bangalore Area → Locality (Kengeri etc.) → College (RV College etc.) → Zone → PG/Address (30+ known PGs listed per zone)
- New users start as `pending` — a zone admin must approve them
- Forgot password: OTP verify → new password (users only; admins contact super admin)
- Profile edit requests require admin approval
- Pending approval overlay shows zone admin contact number

### 2. Daily Sehri Poll *(Core Feature)*
- One poll per calendar day
- Voting window: **10 PM → 10 AM IST** (voting tonight = Sehri for tomorrow)
- Users vote Yes/No — "Will you have Sehri food?"
- After window closes, users can file a **special case** (changed their mind):
  - `want` — didn't vote yes but now needs food
  - `dont_want` — voted yes but no longer wants food
  - Can be undone
- Super admin can manually override poll open/close at any time
- Admins see voter list grouped by PG address — makes distribution quantity planning easy
- Push notifications fire on poll open, poll close, and scheduled reminders

### 3. Live Delivery Tracking
- Super admin creates rider accounts (name, phone, password, zone)
- Riders log in on a separate screen with phone + password
- Rider's phone pushes GPS every 20 seconds via a background foreground service
- Users see the moving pin on embedded Google Maps WebView for their zone's active rider

### 4. Donations
- Razorpay UPI-only checkout (WebView-embedded HTML)
- Preset amounts: ₹50, 100, 200, 500, 1000, 2000 + custom input
- Optional anonymous mode — hides from history UI but stores real data for admin records
- Email receipt sent automatically after payment
- Total donated displayed on HomeScreen for all users
- Super admin sees full donation history table with donor details + anonymous badge

### 5. Admin Chat (Group Messaging)
- Groups created by super admin only; members can be any mix of users, admins, super admins
- Real-time delivery via Socket.IO
- Features: reply-to messages (swipe right gesture), delete messages, unread count badges, paginated history (50/page)
- Push notification sent to all group members on every new message
- Back button in chat room goes to group list (not dashboard)

### 6. Prayer Timings
- Fetched daily from AlAdhan API for Bangalore; stored in DB; auto-refreshed at 00:05 IST
- Displays: Tahajjud, Imsak (Sehri End), Fajr, Sunrise, Dhuhr, Asr, Iftar, Maghrib, Isha
- Active prayer highlighted with "NOW" badge, updates every minute
- Hijri date shown alongside Gregorian
- Falls back to hardcoded values if API is unreachable

### 7. Al-Quran
- All 114 Surahs from api.quran.com
- Arabic text in IndopakNastaleeq font
- Search by number, English name, or translation
- Bookmarks, verse reader
- Reader settings: 4 themes (dark/sepia/light/green), 4 font sizes

### 8. Duas
- Daily supplications browsable by category
- Bookmarks

### 9. Feedback
- Users submit with category (food_quality/distribution/suggestion/complaint/general) + optional 1–5 star rating
- Admins see all feedback, mark read/unread
- Users can view their own submission history

### 10. Poll History (Admin)
- Calendar view — dates where a poll exists are highlighted in gold
- Tap any date → full stats: total yes, special cases, zone breakdown, voter list grouped by PG address

---

## All API Endpoints (42 total)

### Auth `/api/auth`
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/send-otp` | Public | Send registration OTP |
| POST | `/register` | Public | Register user (OTP + password) |
| POST | `/login` | Public | Role-based login |
| POST | `/forgot-password/send-otp` | Public | Send reset OTP |
| POST | `/forgot-password/verify-otp` | Public | Verify OTP |
| POST | `/forgot-password/reset` | Public | Set new password |
| POST | `/create-admin` | super_admin | Create zone admin |
| POST | `/create-super-admin` | super_admin | Create super admin |
| GET | `/list-admins` | super_admin | List all admins |
| DELETE | `/admins/:id` | super_admin | Delete admin |
| DELETE | `/super-admins/:id` | super_admin | Delete super admin |
| POST | `/switch-role` | Any | Switch roles without re-login |
| POST | `/refresh` | Public | Refresh access token |
| POST | `/fcm-token` | Any | Update push token |
| GET | `/zone-admin` | Any | Get admin for user's zone |

### Users `/api/users`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/me` | Any | Get own profile |
| GET | `/` | admin/super_admin | List users (admin: own zone) |
| PATCH | `/:id/status` | admin/super_admin | Approve/reject user |
| DELETE | `/:id` | admin/super_admin | Delete user |
| POST | `/request-profile-edit` | user | Request profile change |
| GET | `/profile-edit-requests` | admin/super_admin | List pending edit requests |
| PATCH | `/profile-edit-requests/:id` | admin/super_admin | Approve/reject edit |

### Polls `/api/polls`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/active` | user | Current poll + user's vote |
| GET | `/active/stats` | admin/super_admin | Full stats for today |
| PATCH | `/active/toggle` | super_admin | Override poll open/close |
| POST | `/:pollId/respond` | user | Vote yes/no |
| POST | `/:pollId/special-case` | user | Submit special case |
| POST | `/:pollId/special-case/undo` | user | Undo special case |
| GET | `/my-responses` | user | Own poll history |
| GET | `/history` | admin/super_admin | All poll dates |
| GET | `/date/:date/stats` | admin/super_admin | Stats for a specific date |
| GET | `/:pollId/stats` | admin/super_admin | Stats for a specific poll |
| GET | `/:pollId/zone-voters` | Any | Voters for user's zone |

### Donations `/api/donations`
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/create-order` | Any | Create Razorpay order |
| POST | `/verify-payment` | Any | Verify payment signature |
| GET | `/history` | Any | Own donation history |
| GET | `/summary` | Any | Total stats |
| GET | `/all` | super_admin | Full donation history |

### Feedback `/api/feedback`
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/` | user | Submit feedback |
| GET | `/` | admin/super_admin | All feedback |
| PATCH | `/:id/read` | admin/super_admin | Toggle read status |
| GET | `/my` | user | Own feedback |

### Tracking `/api/tracking`
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/rider-login` | Public | Rider login |
| GET | `/active` | Any | Active riders for user's zone |
| PATCH | `/:id/push-location` | rider | Push live GPS |
| GET | `/all` | super_admin | All riders |
| POST | `/` | super_admin | Create rider |
| PATCH | `/:id/location` | super_admin | Manual location update |
| PATCH | `/:id/toggle` | super_admin | Activate/deactivate rider |
| DELETE | `/:id` | super_admin | Delete rider |

### Chat `/api/chat`
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/groups` | super_admin | Create group |
| GET | `/groups` | Any | List my groups |
| GET | `/groups/:id` | Any | Group details + members |
| DELETE | `/groups/:id` | super_admin | Delete group |
| GET | `/groups/:id/members` | super_admin | List members |
| POST | `/groups/:id/members` | super_admin | Add members |
| DELETE | `/groups/:id/members/:userId` | super_admin | Remove member |
| GET | `/groups/:id/messages` | Member | Get messages (paginated) |
| POST | `/groups/:id/messages` | Member | Send message |
| DELETE | `/groups/:id/messages/:msgId` | Member/super_admin | Delete message |
| POST | `/groups/:id/read` | Member | Mark group as read |
| GET | `/admins` | super_admin | List admins for group creation |

### Prayers `/api/prayers`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | Any | Today's prayer timings |
| POST | `/refresh` | Any | Force re-fetch from AlAdhan |

---

## Database Models (13 Tables)

### `users`
| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| name | VARCHAR(100) | |
| phone | VARCHAR(15) | Unique |
| password | VARCHAR(255) | bcrypt hashed |
| gender | ENUM(male, female) | |
| occupation | ENUM(student, employee, others) | |
| city | VARCHAR(100) | Default: Bangalore |
| area | ENUM(kengeri, nayandahalli, nagarabavi, uttarahalli) | |
| zone | ENUM(masjid, boys_hostel, stanza, girls) | |
| address | TEXT | PG/address name |
| status | ENUM(pending, approved, rejected) | |
| is_phone_verified | BOOLEAN | |
| fcm_token | TEXT | Expo push token |
| profile_picture | TEXT | |
| last_login_at | DATE | |

### `admins`
| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| name, phone (unique), password | | |
| zone | ENUM(masjid, boys_hostel, stanza, girls) | |
| fcm_token | TEXT | |

### `super_admins`
| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| name, phone (unique), password, fcm_token | | |

### `polls`
| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| date | DATEONLY | Unique — one poll per day |
| question | VARCHAR(300) | |
| is_active | BOOLEAN | |
| deadline_time | TIME | Stores override hour for auto-resync |

### `poll_responses`
| Field | Type | Notes |
|---|---|---|
| poll_id + user_id | | Unique pair |
| response | ENUM(yes, no) | |
| zone | ENUM | |
| is_special_case | BOOLEAN | Changed mind after window |
| special_case_type | ENUM(want, dont_want) | |
| special_case_at | DATE | |

### `donations`
| Field | Type | Notes |
|---|---|---|
| razorpay_order_id | VARCHAR(200) | Unique |
| amount | DECIMAL(10,2) | |
| status | ENUM(created, paid, failed, refunded) | |
| donor_name, donor_phone, donor_email | | Always stored |
| payment_method | VARCHAR(50) | upi / card / etc. |
| is_anonymous | BOOLEAN | UI flag only; real data always stored |

### `chat_groups` + `chat_group_members` + `chat_messages`
- Groups have a `created_by` (super_admin UUID)
- Members have `user_type` (super_admin / admin / user) and `last_read_at` for unread counts
- Messages support `reply_to_id`, `reply_to_message`, `reply_to_sender`

### `tracking`
| Field | Notes |
|---|---|
| rider_name, rider_phone | |
| rider_password | bcrypt hashed |
| latitude, longitude | DECIMAL; updated every ~20s |
| zone | ENUM + 'all' |
| status | ENUM(idle, delivering, completed) |
| is_active | BOOLEAN |
| eta_minutes, current_address | Optional; set by rider |

### `feedbacks`
- category: `general / food_quality / distribution / suggestion / complaint`
- rating: 1–5 integer, optional

### `prayer_timings`
- date (unique), city, country, timings (JSON), tahajjud_time, date_hijri

### `profile_edit_requests`
- requested_changes (JSON), status (pending/approved/rejected), reviewed_by, rejection_reason

### `otps`
- phone, otp (verificationId from MC), purpose, is_used, expires_at

---

## Navigation Structure

### Auth Stack `/(auth)`
| Screen | File | Description |
|---|---|---|
| `welcome` | WelcomeScreen | Arabic Shahada, app name, Why One Message card, feature chips, hadith, CTA buttons |
| `login` | LoginScreen | Phone + password, forgot password modal, pending approval overlay |
| `register` | RegisterScreen | 4-step: Location cascade → Personal details → OTP → Success |
| `rider-login` | — | Hidden; accessible via 5-tap Easter egg on crescent moon on Welcome screen |

### App Tabs `/(app)` — role-dependent

| Tab | User | Admin | Super Admin |
|---|---|---|---|
| 1 | Home | Dashboard | Dashboard |
| 2 | Donate | Users | Users |
| 3 | Duas | Chat | Chat |
| 4 | Quran | Polls | Admins |
| 5 | Track | Profile | Profile |
| 6 | Profile | — | — |

### Sub-screens (no tab bar)
- `/(app)/feedback` — Submit feedback
- `/(app)/poll-history` — User's own poll history
- `/(app)/rider` — Rider GPS broadcast screen
- `/(app)/dua/category/[id]` — Dua category
- `/(app)/dua/bookmarks` — Bookmarked duas
- `/(app)/quran/[surahId]` — Surah reader
- `/(app)/quran/bookmarks` — Quran bookmarks
- `/(app)/admin/chat/[id]` — Chat room
- `/(app)/admin/chat/create` — Create chat group
- `/(app)/admin/tracking` — Rider management
- `/(app)/admin/feedback` — View all feedback
- `/(app)/admin/donation-history` — Full donation history (super_admin only)
- `/(app)/admin/poll-history` — Poll history calendar

---

## Notification System

| What | Detail |
|---|---|
| Provider | Expo Push (`exp.host/--/api/v2/push/send`) |
| Token storage | `fcm_token` in users / admins / super_admins |
| Deduplication | `[...new Set(tokens)]` before sending — handles multi-role users |
| Channel | `default` (Android HIGH importance, vibration, gold light) |
| Scheduled (cron, IST) | 10:00 PM, 5:00 AM, 9:50 AM daily |
| Poll toggle | Broadcast to all users when super admin opens/closes poll |
| Chat messages | Push to all group members except sender |
| Tap behaviour | Chat → opens that group; Poll → opens home screen |

---

## Real-Time (Socket.IO)

| Item | Detail |
|---|---|
| Auth | JWT token in `socket.handshake.auth.token` |
| On connect | User auto-joins all their group rooms (`group:<id>`) |
| Events (server → client) | `new-message`, `delete-message` |
| Events (client → server) | `join-group`, `leave-group` |
| Reconnection | 10 attempts, 2-second delay |

---

## Design System

### Colors
| Name | Hex | Usage |
|---|---|---|
| Primary / Gold | `#C9A84C` | Buttons, highlights, active states |
| Primary Light | `#E8C97A` | Gradients, avatars |
| Background | `#0D1B2A` | App background (deep navy) |
| Background card | `#1A2E45` | Cards, modals |
| Background secondary | `#152336` | |
| Background elevated | `#1F3654` | |
| Text primary | `#F0E6C8` | Warm off-white |
| Text secondary | `#A8B8C8` | Labels, subtitles |
| Text muted | `#6B7C8A` | Placeholders, timestamps |
| Text on primary | `#0D1B2A` | Text on gold buttons |
| Accent blue | `#4FC3F7` | Boys hostel zone, info |
| Accent green | `#4CAF50` | Success, "yes" votes |
| Accent red | `#EF5350` | Errors, delete |
| Accent orange | `#FF9800` | Special cases, warnings |
| Accent purple | `#AB47BC` | Stanza zone |
| Accent pink | `#EC407A` | Girls zone |
| Border | `#2A3F55` | All borders |

### Typography
- **UI text:** System font (iOS/Android default) for all UI
- **Arabic Quran text:** `IndopakNastaleeq.ttf` (custom font, loaded via expo-font)
- **Scale reference:** 390px screen width; `responsiveSize()` normalizes all sizes

### Spacing
| Token | Size |
|---|---|
| xs | 4px |
| sm | 8px |
| md | 12px |
| base | 16px |
| lg | 20px |
| xl | 24px |
| xxl | 32px |

### Border Radius
| Token | Size |
|---|---|
| sm | 8 |
| md | 12 |
| lg | 16 |
| xl | 20 |
| round | 50 |
| full | 999 |

### Shadows
| Name | Elevation | Notes |
|---|---|---|
| sm | 2 | Subtle card depth |
| md | 5 | Standard cards |
| lg | 10 | Modals, floating elements |
| gold | 8 | `shadowColor: #C9A84C` |
| glow | 12 | Gold glow, `shadowRadius: 20` |

### Animations
- **Spring physics** for entrance slides (tension 50–60, friction 8)
- `Easing.linear` for slow rotations (Islamic geometric, 30–60s per turn)
- `Easing.inOut(Easing.sin)` for breathing pulses (crescent moon, 2.8s cycle)
- Staggered sequential entrance on WelcomeScreen (moon → Shahada → name → slogan → cards → buttons)

---

## Key Business Logic

| Rule | Detail |
|---|---|
| Poll date logic | Voting at 10 PM on the 23rd is for the **24th's** Sehri; at 2 AM on the 24th, still the 24th's poll |
| Admin vs user poll view | Admin always sees **today's calendar date**; user sees the **active voting poll** (may be tomorrow's) |
| Race condition fix | `findOrCreate` used for polls instead of `findOne` + `create` |
| Poll override | Super admin's manual toggle stores the IST hour in `deadline_time`; auto-sync resumes when window boundary is crossed (10 AM or 10 PM) |
| Zone filtering | Stats exclude entries with unknown/legacy zones — only counts the 4 known zones |
| Voter address grouping | Voter lists grouped by PG address for easy distribution planning |
| Anonymous donations | Real donor info **always stored** in DB regardless of `is_anonymous` flag — flag only affects UI display |
| Donation signature | Razorpay HMAC-SHA256 verified on backend before marking as paid |
| Prayer fallback | Hardcoded fallback timings returned if AlAdhan API is unreachable |

---

## Current State

| Item | Status |
|---|---|
| Backend URL | ngrok static domain `ungraded-reminder-booted.ngrok-free.dev` — ngrok must be running on PC |
| Start backend | Run `d:\Sehri app\start-backend.bat` — starts Node server + ngrok tunnel |
| Razorpay keys | **Placeholder in `.env`** — fill in live keys from Razorpay Dashboard → Settings → API Keys |
| Email receipts | Gmail credentials set in `.env` (`onemessage.support@gmail.com`) |
| MC OTP | Switched to backup credentials `C-6754BD9901EF45D` / `Riz@2004` |
| New Architecture | Enabled (`newArchEnabled: true` in app.json) |
| App name | "One Message" (EAS slug stays `sehri-connect` for project continuity) |
| Android package | `com.sehriconnect.app` (matches google-services.json — do not change) |
| EAS owner | `rizwan866` |
| Node version | v20.17.0 (EBADENGINE warnings are non-fatal for this project) |
| Last successful build | APK via `eas build --platform android --profile preview` |

---

## Running Locally

### Backend
```bash
cd "d:\Sehri app\backend"
node src/server.js
```
Or double-click `d:\Sehri app\start-backend.bat` to start both Node and ngrok.

### Mobile (development)
```bash
cd "d:\Sehri app\mobile"
npx expo start
```

### Build APK
```bash
cd "d:\Sehri app\mobile"
eas build --platform android --profile preview
```

### Build AAB (Play Store)
```bash
eas build --platform android --profile production
```

---

## Environment Variables (backend/.env)

| Variable | Description |
|---|---|
| `PORT` | Server port (5000) |
| `DB_HOST / DB_PORT / DB_NAME / DB_USER / DB_PASSWORD` | MySQL connection |
| `JWT_SECRET / JWT_EXPIRES_IN` | Access token (7d) |
| `JWT_REFRESH_SECRET / JWT_REFRESH_EXPIRES_IN` | Refresh token (30d) |
| `MESSAGECENTRAL_CUSTOMER_ID` | MC account ID for OTP |
| `MESSAGECENTRAL_PASSWORD` | MC account password |
| `GOOGLE_MAPS_API_KEY` | Maps JavaScript API key |
| `RAZORPAY_KEY_ID` | Razorpay live key ID |
| `RAZORPAY_KEY_SECRET` | Razorpay live key secret |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to Firebase service-account.json |
| `EMAIL_USER` | Gmail address for donation receipts |
| `EMAIL_PASS` | Gmail App Password (16-char) |
| `SUPER_ADMIN_PHONE / NAME / PASSWORD` | Initial super admin seed credentials |
