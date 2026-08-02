# One Message — Plain English Project Guide

---

## The Big Picture

One Message is a mobile app built for Muslim students living near RV College in Kengeri, Bangalore. Every year during Ramzan, students who are staying in PGs and hostels need Sehri food (the pre-dawn meal before the fast). Coordinating who wants food, how many portions to prepare, where to deliver, and how to collect donations is a mess when done manually over WhatsApp.

This app solves that. It gives students a simple way to say "yes I want Sehri tomorrow" or "no I don't", lets admins see exactly how many students need food in each area, lets a rider share their live location while delivering, and lets the community donate to fund the whole operation.

The name "One Message" comes from the Shahada — the Islamic declaration of faith. It is the one message that unites the entire community, and every feature in the app serves that community.

---

## Who Uses the App

There are four types of people who use this app, each with different access.

**Regular Users** are students living in PGs or hostels. They register, wait for their zone admin to approve them, and then they can vote in the daily poll, see the live map when their food is being delivered, read Quran, browse duas, donate, and give feedback.

**Zone Admins** are trusted community members who manage one specific zone (like the Masjid area or the Stanza area). They approve or reject new user registrations for their zone, see exactly how many students in their zone want food and their PG addresses, and participate in group chats.

**Super Admins** have full control. They can do everything a zone admin can do, plus they can create admins, see all zones at once, open and close the poll manually, create and manage delivery riders, see all donations, and manage chat groups.

**Riders** are the delivery people. They don't use the main app — they have a separate simple login screen where they enter their phone number and password. Once logged in, their phone automatically sends their GPS location every 20 seconds so students can track where their food is.

---

## The Four Zones

The students are divided into four delivery zones based on where they live near RV College.

- **Masjid Zone** — students who live near or around the masjid
- **Boys Hostel Zone** — students in the college hostels
- **Stanza Zone** — students in Stanza Living and the many PGs in that cluster
- **Girls Zone** — female students in the various ladies PGs around the area

When a student registers, they pick their zone and their specific PG or address from a list. This is how the admin knows exactly where to deliver food.

---

## How the Daily Poll Works

This is the heart of the app. Every evening at 10 PM, the poll opens. Students have until 10 AM the next morning to vote yes or no — "Will you have Sehri food tomorrow?"

The idea is simple: the people preparing the food need to know how many portions to make before Sehri time (which is around 4–5 AM). By collecting votes the night before, they can prepare exactly the right amount.

When a student votes yes, the admin can see their name and their PG address. This is how the rider knows exactly which buildings to stop at on the route.

After the voting window closes at 10 AM, the poll locks. But life happens — sometimes a student forgets to vote, or they change their mind. For these situations there is a "special case" feature. A student can tell the app "I need Sehri" or "I don't want Sehri anymore" even after the window is closed. The admin sees these special cases separately so they can handle them individually.

The super admin can also manually open or close the poll at any time, overriding the automatic schedule. When they do this, all users get a push notification.

---

## How Delivery Tracking Works

When the rider sets off to deliver Sehri food, they open the rider section of the app on their phone and tap "Start Broadcasting". The app then sends the rider's GPS coordinates to the server every 20 seconds, even when the phone screen is off.

On the user's side, there is a tracking screen that shows a live Google Maps view with the rider's moving pin. Users can see exactly where the rider is and roughly how far away they are.

The rider's location updates automatically as they move. When delivery is done, they tap "Stop Broadcasting" and their status is marked as completed.

---

## How Registration Works

When a new student downloads the app, they go through a four-step registration.

First, they pick their location — Bangalore area, then locality (like Kengeri), then college (like RV College), then which zone they belong to (Masjid, Boys Hostel, Stanza, or Girls), and finally their specific PG or address from a dropdown list with over 30 known addresses.

Second, they enter their personal details — name, phone number, gender, occupation, and a password. The password must be at least 8 characters and include at least one special character.

Third, they verify their phone number with a 4-digit OTP sent via SMS.

After registering, their account sits as "pending" until a zone admin approves them. The app shows them the phone number of their zone admin so they can contact them directly for faster approval.

---

## How Donations Work

Anyone can donate to support the Sehri food program. On the donation screen, they pick an amount (₹50, 100, 200, 500, 1000, 2000, or a custom amount), enter their email for a receipt, add an optional message, and tap donate.

The payment goes through Razorpay using UPI — so students can pay with PhonePe, Google Pay, Paytm, or any UPI app. After payment is confirmed, the app automatically sends a receipt to their email with the payment details.

Students can also donate anonymously if they prefer — their name won't appear in the donation history that admins can see, though the information is still stored internally for record-keeping.

The total amount donated is shown on the home screen for all users to see. The super admin has access to a full table showing every donation with donor details, date, amount, and payment method.

---

## How Chat Works

The super admin creates chat groups and adds members — these can be any combination of admins, super admins, and regular users.

Inside a group, members can send messages in real time. Messages arrive instantly without needing to refresh. You can swipe right on any message to reply to it, which shows the original message as a quote inside your reply. Long-pressing a message gives the option to delete it.

Every unread message shows a badge on the group list screen. When you open a group, it's automatically marked as read.

When someone sends a message, all other group members get a push notification on their phone, even if the app is closed.

---

## Prayer Timings

The home screen shows a prayer timetable for the current day in Bangalore. It includes Tahajjud, Sehri End (Imsak), Fajr, Sunrise, Dhuhr, Asr, Iftari, Maghrib, and Isha. Whichever prayer time is currently active is highlighted with a "NOW" badge that updates every minute.

The times are fetched from a reliable Islamic API and stored in the database. If the internet is down, the app falls back to hardcoded times for Bangalore so the screen is never empty.

The Hijri (Islamic calendar) date is also shown.

---

## Al-Quran and Duas

The app includes a full Quran reader with all 114 Surahs. Arabic text is displayed in the IndopakNastaleeq style which is how most people in South Asia are used to reading. You can search by Surah name or number, bookmark ayahs, and adjust the theme (dark, sepia, light, or green) and text size.

There is also a duas section with daily supplications organized by category, with a bookmark feature.

---

## Feedback

Users can submit feedback about the food quality, the distribution, general suggestions, or complaints. They can also give a star rating from 1 to 5. Admins can view all feedback and mark each one as read once they've reviewed it.

---

## Push Notifications

The app sends push notifications automatically in several situations.

Every day at three times — 10 PM, 5 AM, and 9:50 AM — everyone gets a reminder to vote in the poll. These are sent from the server automatically without any manual action.

When the super admin manually opens or closes the poll, everyone gets notified immediately.

When a new chat message is sent in a group, all other members get a notification. Tapping it takes you straight to that chat group.

If you tap a poll notification, it opens the home screen where you can vote.

---

## How the Backend Works

The backend is a Node.js server running on a Windows laptop. Since it's on a local machine and not on a public server, it uses ngrok — a tool that creates a secure public URL (a tunnel) pointing to the laptop's local server. The static ngrok domain `ungraded-reminder-booted.ngrok-free.dev` is baked into the app so it always knows where to connect.

This means the backend needs to be running on the laptop for the app to work. There is a batch file called `start-backend.bat` in the project folder that starts both the Node.js server and the ngrok tunnel with one double-click.

The database is MySQL running locally. All the data — users, polls, votes, messages, donations — is stored there.

---

## What the App Looks Like

The design is dark navy blue with gold accents throughout. The gold colour (`#C9A84C`) is used for anything important — buttons, highlights, active states. The background is a deep dark blue (`#0D1B2A`). Text is a warm off-white rather than pure white, which is easier on the eyes.

Every zone has its own colour. Masjid zone is gold, Boys Hostel is blue, Stanza is purple, and Girls zone is pink. These colours appear consistently throughout the app wherever zone-specific information is shown.

The welcome screen shows the Arabic Shahada at the top, then the app name "One Message", then a card explaining what the name means and why it was chosen, then a list of the app's features, a hadith about the reward for feeding a fasting person, and finally two buttons — Login and Register.

The home screen has a prayer timetable card at the top, then the daily Sehri poll card, then a total donations amount, then quick action buttons for Quran, Duas, live tracking, donations, and feedback.

---

## Important Things to Know Before Building the APK

**Razorpay live keys** — the payment system is currently set up with placeholder keys in the `.env` file. Before building a release APK, you need to log into your Razorpay dashboard, switch to live mode, copy the live Key ID and Key Secret, and paste them into `backend/.env`. Without this, users will see payment errors.

**ngrok must be running** — the app connects to `ungraded-reminder-booted.ngrok-free.dev`. This only works when the laptop is on, the backend server is running, and ngrok is connected. For a proper production setup, the backend should be moved to a real server (VPS or cloud).

**Email receipts** — the Gmail credentials are already set in `.env` so donation receipts will send automatically.

**OTP for registration** — OTP is sent via MessageCentral. The backup account (`C-6754BD9901EF45D`) is currently active. If OTP stops working, the credits on the account may have run out and you'll need to top up or switch accounts.

---

## How to Run Everything

**Start the backend and ngrok together:**
Just double-click `start-backend.bat` in the main project folder. It opens two command prompt windows — one for the Node.js server, one for ngrok.

**Start development on the mobile app:**
Open a terminal in the `mobile` folder and run `npx expo start`. Then scan the QR code with the Expo Go app on your phone, or press `a` to open on a connected Android device.

**Build an APK for testing:**
Open a terminal in the `mobile` folder and run `eas build --platform android --profile preview`. This builds an `.apk` file that you can install directly on any Android phone without needing the Play Store.

**Build for Play Store:**
Same as above but with `--profile production`. This builds an `.aab` file which is what the Play Store requires.

---

## Files and Folders

```
Sehri app/
├── backend/                    The Node.js server
│   ├── src/
│   │   ├── controllers/        The logic for each feature
│   │   ├── models/             Database table definitions
│   │   ├── routes/             URL paths for the API
│   │   ├── services/           Push notifications, email, socket
│   │   ├── middleware/         Auth checks, rate limiting
│   │   └── utils/              JWT, OTP, logging helpers
│   ├── .env                    Secret keys and config (never commit this)
│   └── server.js (in src/)     The main entry point
│
├── mobile/                     The React Native app
│   ├── app/                    Screens organised by URL path (Expo Router)
│   │   ├── (auth)/             Login, register, welcome screens
│   │   ├── (app)/              All logged-in screens
│   │   └── (rider)/            Rider GPS broadcast screen
│   ├── src/
│   │   ├── components/         Reusable UI pieces
│   │   ├── constants/          Colors, API URLs, theme values
│   │   ├── screens/            The actual screen components
│   │   ├── services/           API calls, socket, notifications
│   │   ├── store/              Auth state (Zustand)
│   │   └── utils/              Map HTML builder
│   ├── assets/                 Icons, fonts, images
│   ├── app.json                App config for EAS builds
│   └── eas.json                Build profiles (preview/production)
│
├── start-backend.bat           One-click to start server + ngrok
├── PROJECT.md                  Technical reference documentation
└── PROJECT_PLAIN.md            This file — plain English guide
```

---

## Frequently Asked Questions

**Why is the app called One Message and not Sehri Connect?**
The original name was Sehri Connect during development. It was renamed to One Message before release because the new name has a deeper meaning rooted in the Shahada — it reflects the Islamic values the app is built around, not just the food distribution function.

**Why do students need admin approval to join?**
This ensures that only real students in the community can access the app. Without approval, anyone with a phone number could sign up and mess with the poll data or chat groups.

**What happens if the voting window closes and I forgot to vote?**
You can use the special case feature. It lets you tell the admin you need food even after the poll has closed. The admin sees a separate list of special cases and handles them individually.

**Can the same person be a user and an admin at the same time?**
Yes. A student who is also a zone admin has both roles on the same phone number. The app has a "switch role" button that instantly swaps between user mode and admin mode without logging out. This is common — the admin might want to vote in the poll as a user, then switch to admin mode to see the stats.

**What if the rider's phone dies mid-delivery?**
The last known location stays on the map. The rider's status won't update, but users can still see where the rider was last seen. The rider can restart broadcasting once their phone is charged.

**Why does the app only support UPI for donations?**
UPI was chosen because it's what everyone in India uses — PhonePe, Google Pay, Paytm. Cash and card payments can be made directly to the admin outside the app (the donation page tells users this).

**What is ngrok and why is it needed?**
The backend server runs on someone's laptop, not on a proper server in a data centre. Normally, other devices on the internet can't reach a laptop directly. ngrok creates a public URL that forwards traffic to the laptop, which is why the app can connect to it from anywhere. The downside is the laptop must be on and ngrok must be running for the app to work. This is fine for testing but not suitable for a permanent production setup.
