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
| OTP SMS | MessageCentral VerifyNow (Indian SMS, credentials: `<your-messagecentral-customer-id>`) |
| Donations | Manual UPI (QR + UPI ID) with screenshot proof, approved by super admin |
| Prayer timings | AlAdhan API (Bangalore) |
| Proof storage | Cloudinary when configured, local disk fallback (`services/storageService.js`) |
| Scheduled jobs | node-cron (10 PM / 5 AM / 9:50 AM IST) |
| Public URL | Railway: `https://sehri-app-production.up.railway.app` |
| Security | Helmet, CORS, compression, morgan, rate limiting |

### Mobile — React Native + Expo SDK 54 + TypeScript
| Component | Detail |
|---|---|
| Navigation | Expo Router (file-based) |
| State management | Zustand (auth store) |
| Token storage | expo-secure-store |
| Real-time chat | Socket.IO client |
| Donation flow | Copy UPI ID / save QR, then upload payment screenshot |
| Push notifications | expo-notifications |
| Arabic font | IndopakNastaleeq.ttf |
| Quran data | api.quran.com/api/v4 |
| Maps | `react-native-maps` 1.20.1 — native Google Maps Android SDK |
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
- **Editing a pending registration does not ask for OTP again.** The phone number
  is unchanged and was already verified, so a second SMS proves nothing. Instead
  the backend issues a short-lived (30 min) *edit token*:
  - on a pending login — the password was already checked before the 403
  - right after registering — the OTP was just verified
  The token is signed with a secret derived from `JWT_SECRET`, so it cannot be
  replayed as an access or refresh token anywhere else in the API. `PATCH
  /auth/pending-registration` refuses it once the account leaves `pending`, and
  phone number and status are not editable through it.
- **Rejection is a round trip, not a dead end.** Rejecting a user opens a remark
  sheet (with common presets); the remark is stored on `users.rejection_reason`
  and pushed to them. At login the rejected applicant sees the remark, taps
  **Fix My Details & Resubmit**, corrects their details with no new OTP, and the
  account returns to `pending` with the remark cleared. Reviewers get a
  "Registration Resubmitted" push. Approving or reverting to pending also clears
  the remark, so a stale reason is never shown.
- Profile edit requests (after approval) still require admin approval
- Pending approval overlay shows zone admin contact number

### 1a. Guest Mode

**Continue as Guest** on the Welcome screen opens the app with no account, no
OTP and no backend call. Guests get the content that needs no identity:

| Available to guests | Requires sign-in |
|---|---|
| 📖 Al-Quran (all 114 surahs, bookmarks, reader settings) | Sehri poll & special cases |
| 🤲 Duas (categories, bookmarks) | Live delivery tracking |
| 🕌 Prayer timings on Home | Donations & donation history |
| | Feedback, chat, profile |

No backend changes were needed — `GET /prayers` is already public, and the
Quran and Dua screens fetch straight from `api.quran.com` and `ummahapi.com`.
Guests carry no token, and `loadData()` on Home is skipped for them so the
authenticated calls never fire and 401.

Guests get their own four-tab bar (Home, Duas, Quran, Profile). Home stays
clean — prayer timings, then Quran and Dua shortcuts, with the poll section
simply absent rather than replaced by a nag. The sign-in invitation lives in
one place: the Profile tab. The choice persists across restarts via the
`guestMode` flag in SecureStore, and is cleared on sign-in, sign-up or logout,
so a guest is never silently dropped back into guest mode after logging out.

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

The map is **`react-native-maps`** (native Google Maps Android SDK), not a
WebView running the Maps JavaScript SDK. Native map loads are not a billed
Google SKU, there is no browser engine to boot, and markers are ordinary React
components — no injected JS or `postMessage` bridge.

- `src/components/map/DeliveryMap.tsx` — the shared map, used by the user
  tracking screen and the rider's preview of it.
- `src/constants/mapData.ts` — coordinates, dark map style, zone colours,
  legend, and the clustering helpers.
- The Android key comes from `app.json` → `android.config.googleMaps.apiKey`
  (which was previously dead config, since only the WebView copy was in use).
- Google Maps on **both** platforms, so the dark style and zone colours match.
  Keys: `android.config.googleMaps.apiKey` and `ios.config.googleMapsApiKey`.
- Girls-zone drop points are clustered by on-screen distance at the current
  zoom — 27 points collapse to ~17 markers at zoom 15 and separate fully as you
  zoom in. A fixed lat/lng grid does not work for this data, which ranges from
  ~5m to ~110m apart.
- Polling is gated on screen focus, and the camera follows the rider until the
  user pans away, at which point a "Recentre on rider" pill appears.

- Super admin creates rider accounts (name, phone, password, zone)
- Riders log in on a separate screen with phone + password
- Rider's phone pushes GPS every 20 seconds via a background foreground service
- Users see the moving pin on embedded Google Maps WebView for their zone's active rider

### 4. Donations
Presented as three numbered steps, in the order the donor actually works through:

1. **Pay via UPI** — copiable UPI ID, then the QR code with a "Save QR Code" button
2. **Your Details** — name (or donate anonymously), amount paid, optional message
3. **Upload Payment Proof** — the payment screenshot — then Submit

- User pays in their own UPI app, then uploads a payment screenshot as proof
- Donation lands as `pending`; super admin reviews the proof and marks it `paid` (setting
  the confirmed amount) or `rejected`
- Optional anonymous mode — hides from history UI but stores real data for admin records
- Proof images go to Cloudinary when credentials are set, local disk otherwise, and are
  only ever served back through the authenticated `/donations/:id/proof` route
- **Guests can donate** without an account. They supply their own name and a
  10-digit mobile number (the only way to reach them); `user_id` and
  `donor_zone` are stored NULL, since a guest genuinely has no account and no
  delivery zone, and `is_guest` is set. The admin panel gets a **👤 Guests**
  filter bucket alongside the four zones. Guests get no My Donations tab —
  there is no account to look history up against.
- **My Donations** tab: the user's own contributions, each tagged
  ⏳ Awaiting verification / ✅ Verified / ❌ Not accepted, with a running total of
  everything verified. (`GET /donations/history` existed but had no UI.)
- Total donated displayed on HomeScreen for all users
- Super admin donation panel filters **server-side**:
  - **Zone** — all zones by default
  - **Status** — **Pending by default**, since that is the queue that needs work;
    also Accepted, Rejected and All, each with a live count
  - **How many** — dropdown: Last 20 (default), 30, 40, 50, or All
- Accepting or rejecting reloads the list, so the item leaves the Pending queue
  and the zone/status counters update
- Donor details + anonymous badge shown throughout

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

### 9a. Profile Changes (after approval)

- The profile screen has **Request Profile Edit** (name, gender, occupation, zone, address).
  Only fields that actually changed are sent.
- Submitting sets the account back to `pending`, notifies the zone admin **and** every
  super admin, then warns the user and signs them out.
- Reviewers see each change as `old → new` with a **CHANGED** tag, under
  Dashboard → Edit Requests (badge shows the queue size).
- Approve applies the changes; reject keeps the old values. **Either outcome
  restores `status: 'approved'`**, so the user can always log back in.
- While a request is queued the user cannot use the pending-registration edit
  token — that would sidestep the review. Login shows "Changes Under Review"
  with no edit shortcut.
- **Change Password** is separate and needs no approval and no OTP — the current
  password is the confirmation. Riders are excluded (they authenticate against
  `tracking.rider_password`).

### 8a. Broadcast Announcements

One-way channels. Staff post, everyone in the target zones reads and gets a
push. **No user can reply or send** — there is no such endpoint.

| Channel | Reaches |
|---|---|
| 📢 All Zones | Everyone |
| 👨 Boys Channel | Masjid + Boys Hostel + Stanza (everything except girls) |
| 🌸 Girls Channel | Girls zone |
| 🕌 / 🏠 / 🏡 Per-zone | That single zone |

- **Super admin** — any channel, or hand-pick zones. A hand-picked set that
  happens to match a preset collapses to that preset's name in the feed.
- **Zone admin** — their own zone only. `resolveAudience()` in
  `constants/channels.js` is the single enforcement point: passing a wider
  `channelKey` is rejected with 403, and passing an explicit `zones` array is
  clamped to their own zone rather than honoured.

Audience is stored as the **resolved zone list** on each message, not a channel
id, so a message's reach can never change retroactively. Membership needs no
table — a user's `zone` alone decides what they see, so moving zones updates
their channels immediately.

**Text and links only.** There is no upload path, and `extractLinks()` drops
anything pointing at an image/video file and anything that is not `http(s)` —
so `javascript:` and `data:` URIs cannot get through. Google Maps and YouTube
links render as labelled buttons.

### 9. Feedback
Lives in **Profile → Share Feedback** (moved off the Home screen), with two tabs:

- **Write** — category chips (general / food_quality / distribution / suggestion /
  complaint) each with a one-line hint about what belongs there, an optional 1–5
  star rating with a Clear option, and a message box with a live `n/1000`
  counter and the 5-character minimum surfaced inline. The placeholder adapts to
  the chosen category.
- **My Feedback** — the user's own history, each entry tagged
  **✓ Seen by admin** or **⏳ Awaiting review**. This closes the loop so people
  know they were actually heard. (`GET /feedback/my` existed but had no UI.)

Admins see all feedback and mark it read/unread as before.

### 10. Poll History (Admin)
- Calendar view — dates where a poll exists are highlighted in gold
- Tap any date → full stats: total yes, special cases, zone breakdown, voter list grouped by PG address

---

## All API Endpoints (84 total)

### Auth `/api/auth`
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/send-otp` | Public | Send registration OTP |
| POST | `/register` | Public | Register user (OTP + password) |
| PATCH | `/pending-registration` | Edit token | Edit a pending registration — **no OTP** |
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
| PATCH | `/:id/status` | admin/super_admin | Approve/reject user (`rejection_reason` on reject) |
| DELETE | `/:id` | admin/super_admin | Delete user |
| POST | `/request-profile-edit` | user | Request profile change — sets account back to `pending` |
| POST | `/change-password` | user/admin/super_admin | Change own password — no approval, no OTP |
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
| POST | `/submit` | Any | Submit donation + proof image (multipart) |
| PATCH | `/:id/status` | super_admin | Accept (`paid` + amount) or reject |
| GET | `/history` | Any | Own donation history |
| GET | `/summary` | admin/super_admin | Totals + filtered list (`?zone=&status=&limit=`) |
| GET | `/:id/proof` | admin/super_admin | Stream the proof image |

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

### Sync `/api/sync`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/versions` | Any | Content cache versions — clients bust their cache when these change |
| GET | `/status` | super_admin | State of all three sync sources |
| POST | `/prayers` | super_admin | Force re-fetch from AlAdhan (overwrites today) |
| POST | `/quran` | super_admin | Bump Quran content version |
| POST | `/dua` | super_admin | Bump Dua content version |

### Broadcasts `/api/broadcasts`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | Any | Announcements for the caller's zone |
| GET | `/channels` | admin/super_admin | Channels this sender may post to |
| POST | `/` | admin/super_admin | Send an announcement |
| DELETE | `/:id` | admin (own) / super_admin | Delete an announcement |

### Prayers `/api/prayers`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | Any | Today's prayer timings |
| POST | `/refresh` | Any | Force re-fetch from AlAdhan |

---

## Sync Data (Super Admin)

Dashboard → **Sync Data**, three tabs, each showing when it last synced, who
triggered it, and whether it succeeded.

| Tab | Where the data lives | Automatic? | What Force Sync does |
|---|---|---|---|
| 🕌 **Namaz** | Server (`prayer_timings`) | Yes — AlAdhan, daily 00:05 IST | Re-fetches today's timings and **overwrites** the stored row |
| 📖 **Quran** | Each device's AsyncStorage, from api.quran.com | No — content is static | Bumps a version so every device rebuilds its cached copy |
| 🤲 **Dua** | Each device's AsyncStorage | No — content is static | Same as Quran |

**Why the version counter.** Quran and Dua content is cached on each phone, so
the server cannot clear it directly. The super admin bumps `sync_state.version`;
every client compares it on login/launch and rebuilds its own cache when it
differs. That is what makes the sync button actually fix *other people's* broken
apps rather than only the admin's. Bookmarks, reading position and reader
settings are never touched — only the content cache keys are cleared.

**Prayer timings honesty.** The nightly cron silently falls back to a local
calculation when AlAdhan is unreachable, and those figures are approximate. The
panel now reports which source was actually used, so a forced sync once the
connection is back replaces them with real API values.

> Note: `fetchAndSavePrayerTimings()` previously returned early if today's row
> existed, which made the old `POST /prayers/refresh` a no-op. It now takes a
> `force` flag and updates the row in place.

---

## Database Models (14 Tables)

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
| rejection_reason | TEXT | Admin's remark; shown at login, cleared on resubmit/approve |
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
| amount | DECIMAL(10,2) | Null until the super admin confirms it |
| status | ENUM(pending, paid, rejected) | |
| donor_name, donor_phone, donor_zone | | Always stored |
| message | TEXT | Optional note from the donor |
| proof_url | VARCHAR(500) | Cloudinary URL, or `/uploads/...` on disk fallback |
| is_anonymous | TINYINT | UI flag only; real data always stored |

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

### `sync_state`
| Field | Notes |
|---|---|
| key | PK — `prayers` / `quran` / `dua` |
| version | Bumped on content sync; clients bust their cache when it changes |
| last_synced_at, last_synced_by | `by` is a super admin name, or `system (scheduled)` |
| last_status, last_detail | `success`/`failed`, plus which source the data came from |

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
- `/(app)/feedback` — Feedback form + own history (reached from Profile)
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
| Deduplication | `[...new Set(tokens)]` in `notifyAllUsers` — one push per device for multi-role users |
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
| Donation approval | Super admin verifies the uploaded proof manually and sets the final amount when marking it paid |
| Prayer fallback | Hardcoded fallback timings returned if AlAdhan API is unreachable |

---

## Current State

| Item | Status |
|---|---|
| Backend URL | Railway `https://sehri-app-production.up.railway.app` (set in `mobile/src/constants/api.ts`) |
| Start backend | Run `d:\Sehri app\start-backend.bat` — starts Node server + ngrok tunnel |
| Cloudinary | **Not yet configured** — until `CLOUDINARY_URL` is set, donation proofs are written to Railway's ephemeral disk and lost on every redeploy |
| Email receipts | Not implemented — the old `emailService.js` was dead code and has been removed |
| MC OTP | Switched to backup credentials `<your-messagecentral-customer-id>` / `Riz@2004` |
| New Architecture | Enabled (`newArchEnabled: true` in app.json) |
| App name | "One Message" in `app.json`; EAS slug stays `sehri-connect` for project continuity |
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
The mobile app points at Railway, not localhost — change `mobile/src/constants/api.ts` to test against a local server.

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
| `MESSAGECENTRAL_CUSTOMER_ID1 / PASSWORD1` | Optional backup OTP credentials, tried if the primary pair fails |
| `CLOUDINARY_URL` | `cloudinary://key:secret@cloud` — donation proof storage |
| `FRONTEND_URL` | CORS / Socket.IO origin in production |
| `SUPER_ADMIN_PHONE / NAME / PASSWORD` | Super admin seed credentials — **required**, seeding now fails without them |

---

## Running on Multiple Devices (Expo Go)

`npm start` goes through `mobile/scripts/start-dev.js`, which picks the network
interface to advertise in the QR code rather than letting Expo guess.

This matters on the dev machine: VMware installs two virtual adapters at
`192.168.128.1` and `192.168.169.1`, and Expo frequently advertises one of
those instead of the real Wi-Fi. Phones cannot route to a virtual adapter, so
the QR scan just hangs with no error. The launcher ranks physical adapters
above virtual ones and pins the winner via `REACT_NATIVE_PACKAGER_HOSTNAME`.

| Command | Use when |
|---|---|
| `npm start` | Everyone on the same Wi-Fi. Fastest. |
| `npm run start:tunnel` | Different networks, mobile data, or Wi-Fi that blocks device-to-device traffic (common on campus). Slower but always reachable. |
| `npm run start:plain` | Stock `expo start`, bypassing the launcher. |

Any number of devices can connect at once — scan the QR in Expo Go on each,
and press `a` / `i` for an emulator alongside them.

### Maps in Expo Go

Expo Go's iOS binary has no Google Maps SDK compiled in, so `PROVIDER_GOOGLE`
cannot initialise there and MapKit falls back to its hardcoded default region
(Apple's Cupertino HQ) — the "map shows America" symptom. `DeliveryMap` now
requests Google only on iOS **outside** Expo Go; Android always uses its single
available provider, and iOS Expo Go falls back to Apple Maps, correctly centred
on Bangalore but without the dark styling. A real build gets Google on both.

---

## iOS Support

The app ships for **both Android and iOS**. What that required:

| Item | Detail |
|---|---|
| `eas.json` | Every profile was Android-only — an iOS build was impossible. All profiles now declare `ios`, plus a `preview-simulator` profile. |
| Maps key | `ios.config.googleMapsApiKey` added; resolves to `GMSApiKey` in Info.plist. Without it `PROVIDER_GOOGLE` renders a blank map. |
| Background location | `UIBackgroundModes: ['location']` added. Without it iOS kills the rider's location updates the moment the app is backgrounded — the tracking feature silently dies. |
| Location strings | `NSLocationAlwaysAndWhenInUseUsageDescription` added. `NSLocationAlwaysUsageDescription` alone is iOS 10 and earlier; iOS 11+ ignores it. |
| Rider tracking | `activityType: AutomotiveNavigation` stops Core Location throttling updates. `foregroundService` stays for Android and is ignored on iOS. |
| Export compliance | `ITSAppUsesNonExemptEncryption: false` — skips the question on every TestFlight upload. |
| Camera | `expo-image-picker` was auto-declaring `NSCameraUsageDescription`, but only the photo library is used. Disabled via `cameraPermission: false`. |
| App icons | Verified alpha-free (`assets/icon.png` is RGB, no alpha) — Apple rejects icons with an alpha channel. |

### Still needed from you for iOS

1. **Apple Developer Program membership** ($99/yr) — required to build or ship.
2. **Fill in `eas.json` → `submit.production.ios`**: `appleId`, `ascAppId`, `appleTeamId`.
3. **APNs key** for push — `eas credentials -p ios` and let EAS create/upload a
   push key. `google-services.json` is Android-only and does nothing for iOS.
4. **A separate iOS Maps key.** `ios.config.googleMapsApiKey` currently reuses
   the Android value, which only works while that key is unrestricted. Create a
   second key restricted to the iOS bundle ID `com.sehriconnect.app`, enable
   **Maps SDK for iOS** on it, and restrict the Android key to the package name
   + SHA-1. One key cannot be restricted to both platforms.

---

## Open Follow-ups (need action outside the codebase)

| # | Item | Why it matters |
|---|---|---|
| 1 | **Rotate the agentrouter.org API key** that was in `abc.json` | The file has been deleted, but the key was sitting in the project folder in plaintext. Deleting it does not un-leak it — issue a new key and revoke the old one. |
| 2 | **Rotate the MessageCentral password and super admin password** | Both used the same value, committed in plaintext across `RAILWAY-ENV-TEMPLATE.txt`, `RAILWAY-DEPLOYMENT.md`, `RAILWAY-QUICK-START.md`, `README.md` and `seed.js`. All copies are scrubbed, but treat the value as compromised. |
| 3 | **Redeploy the backend** | The schema now tops itself up on boot (`src/database/ensureSchema.js`), creating `sync_state` and `profile_edit_requests.previous_values` automatically. A restart is enough — no manual `npm run migrate`. Until it restarts, Sync Data and Edit Requests will keep returning fetch errors. |
| 4 | **Set `CLOUDINARY_URL` in Railway** | Until then donation proofs land on Railway's ephemeral disk and are wiped on every redeploy. The code already falls back to disk, so nothing breaks — the images just do not survive. |
| 5 | **Confirm the Railway Root Directory** | `sehri-app/src/` and `sehri-app/backend/src/` are byte-identical duplicates, each with its own `package.json`, `Procfile` and `railway.json`. Both are currently kept in sync by hand. Check Railway → Service → Settings → Root Directory and delete the copy that is not used. |
| 6 | **Restrict the Google Maps API key** | The key in `app.json` is a client key and will ship inside the APK. Lock it to `com.sehriconnect.app` + your release SHA-1 in Google Cloud Console → Credentials. |
| 7 | **`usesCleartextTraffic` is now `false`** | The app talks to Railway over HTTPS. If you ever point `mobile/src/constants/api.ts` at a plain `http://` dev server, flip this back to `true` in `app.json` or the requests will be blocked on Android. |
