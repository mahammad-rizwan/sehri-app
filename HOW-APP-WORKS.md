# 🎯 HOW YOUR ONE MESSAGE APP WORKS

## 📱 App Architecture Explained Simply

```
┌─────────────┐         ┌──────────┐         ┌─────────────┐
│   Mobile    │────────>│  ngrok   │────────>│   Backend   │
│     App     │         │  Tunnel  │         │  (Your PC)  │
│  (APK)      │<────────│          │<────────│   Node.js   │
└─────────────┘         └──────────┘         └─────────────┘
                                                     │
                                                     ↓
                                              ┌─────────────┐
                                              │   MySQL     │
                                              │  Database   │
                                              └─────────────┘
```

---

## 🔄 What Happens When User Opens Your App

### 1️⃣ **App Launch (First Time)**
```
User installs APK → Opens app
       ↓
Splash screen shows (logo animation)
       ↓
Welcome screen displays:
  - Islamic shahada
  - Feature cards
  - Login/Register buttons
```

### 2️⃣ **User Taps "Login"**
```
LoginScreen opens
       ↓
User enters:
  - Phone: 9876100001
  - Password: pass@123
  - Role: User (or Admin/Super Admin)
       ↓
User taps "Sign In" button
```

### 3️⃣ **Behind the Scenes - Network Request**
```javascript
// Your app does this:
const response = await fetch(
  'https://ungraded-reminder-booted.ngrok-free.dev/api/auth/login',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phoneNumber: '9876100001',
      password: 'pass@123',
      role: 'user'
    }),
    timeout: 15000 // 15 seconds
  }
);
```

### 4️⃣ **Request Journey**
```
Step 1: Phone sends request over internet
        ↓ (WiFi or Mobile Data)
        
Step 2: Request reaches ngrok servers (USA/Cloud)
        ↓
        
Step 3: ngrok checks: "Is tunnel alive?"
        ↓
        ├─> YES: Forward to your PC (localhost:5000)
        └─> NO:  Return error "ERR_NGROK_3200"
        
Step 4: Your PC receives request at port 5000
        ↓
        
Step 5: Backend checks MySQL database
        ↓
        SELECT * FROM users 
        WHERE phone = '9876100001'
        ↓
        
Step 6: Backend validates password (bcrypt)
        ↓
        
Step 7: Backend generates JWT tokens:
        - Access Token (expires: 7 days)
        - Refresh Token (expires: 30 days)
        ↓
        
Step 8: Backend sends response back:
        {
          success: true,
          token: "eyJhbGc...",
          refreshToken: "eyJhbGc...",
          user: { id, name, phone, zone, ... }
        }
        ↓
        
Step 9: Response travels back through ngrok
        ↓
        
Step 10: Mobile app receives response
```

### 5️⃣ **App Processes Response**
```javascript
// Your app does this:
if (response.success) {
  // Save tokens securely
  await SecureStore.setItemAsync('accessToken', response.token);
  await SecureStore.setItemAsync('refreshToken', response.refreshToken);
  
  // Save user data
  useAuthStore.setState({ user: response.user, isAuthenticated: true });
  
  // Navigate to home screen
  router.replace('/(app)/home');
} else {
  // Show error
  Alert.alert('Login Failed', response.message);
}
```

### 6️⃣ **User Sees Home Screen**
```
HomeScreen loads:
  ↓
Makes multiple API calls:
  1. GET /api/prayers → Fetch today's prayer times
  2. GET /api/polls/active → Get today's Sehri poll
  3. GET /api/donations/summary → Get total donated amount
  4. Socket.IO connects → Real-time chat ready
  ↓
All data displayed to user
```

---

## ❌ WHEN THINGS GO WRONG - Network Errors Explained

### Error 1: "Network request failed"
**Cause:** Phone has no internet connection  
**User sees:** Can't connect to server  
**Fix:** Check WiFi/mobile data

### Error 2: "ERR_NGROK_3200" or "Tunnel not found"
**Cause:** ngrok is not running on your PC  
**User sees:** Unable to reach server  
**Fix:** 
```bash
# On your PC:
start-backend.bat  # This starts both backend and ngrok
```

### Error 3: "Connection timeout"
**Cause:** Request took longer than 15 seconds  
**Possible reasons:**
- Backend is slow (database query taking time)
- ngrok server is slow
- Network is slow
**Fix:** 
- Restart backend
- Check backend logs: `backend/logs/combined.log`

### Error 4: "404 Not Found"
**Cause:** 
- ngrok URL changed
- Wrong API endpoint
**Fix:** 
- Check current ngrok URL matches api.ts
- Rebuild APK if URL changed

### Error 5: "500 Internal Server Error"
**Cause:** Backend crashed or has bugs  
**Fix:**
- Check backend logs
- Restart backend

---

## 🔐 How Authentication Works

### Token Flow
```
Login successful
    ↓
App receives 2 tokens:
    1. Access Token (short-lived: 7 days)
       - Used for all API requests
       - Sent in header: Authorization: Bearer <token>
    
    2. Refresh Token (long-lived: 30 days)
       - Used to get new access token
       - When access token expires
    ↓
Every API request includes access token:
    GET /api/users/me
    Headers: { Authorization: "Bearer eyJhbGc..." }
    ↓
Backend verifies token:
    - Is it valid? ✅
    - Is it expired? ❌
    - Does user still exist? ✅
    ↓
If valid: Process request
If expired: Return 401 Unauthorized
    ↓
App automatically refreshes token:
    POST /api/auth/refresh
    Body: { refreshToken: "..." }
    ↓
Get new access token, retry original request
```

### What Happens on Logout
```javascript
// App does this:
await SecureStore.deleteItemAsync('accessToken');
await SecureStore.deleteItemAsync('refreshToken');
useAuthStore.setState({ user: null, isAuthenticated: false });
router.replace('/(auth)/welcome');
```

---

## 📡 Real-Time Features (Socket.IO)

### Chat System
```
User opens chat group
    ↓
App connects to Socket.IO:
    socket.connect('wss://ungraded-reminder-booted.ngrok-free.dev')
    socket.emit('join-group', { groupId: '123' })
    ↓
When another user sends message:
    Backend → socket.to('group:123').emit('new-message', message)
    ↓
Your app instantly receives it:
    socket.on('new-message', (message) => {
      // Add message to chat UI immediately
      setMessages([...messages, message]);
    })
```

### GPS Tracking (Rider Mode)
```
Rider starts delivery
    ↓
App starts background task (every 20 seconds):
    navigator.geolocation.getCurrentPosition()
    ↓
Send GPS to backend:
    PATCH /api/tracking/:id/push-location
    Body: { latitude: 12.9141, longitude: 77.6411 }
    ↓
Users watching map get real-time updates:
    socket.on('rider-location-updated', (data) => {
      // Move marker on map
      updateMarkerPosition(data.latitude, data.longitude);
    })
```

---

## 💰 How Donations Work

### Payment Flow
```
User taps "Donate ₹100"
    ↓
App creates Razorpay order:
    POST /api/donations/create-order
    Body: { amount: 100, isAnonymous: false }
    ↓
Backend creates order with Razorpay API:
    const order = await razorpay.orders.create({
      amount: 10000, // paise (₹100 = 10000 paise)
      currency: 'INR'
    });
    ↓
Backend returns order details:
    { orderId: "order_xyz", amount: 10000 }
    ↓
App opens Razorpay WebView checkout:
    <WebView source={{ html: razorpayHTML }} />
    ↓
User completes UPI payment
    ↓
Razorpay sends response to WebView:
    { razorpay_payment_id, razorpay_order_id, razorpay_signature }
    ↓
App sends to backend for verification:
    POST /api/donations/verify-payment
    ↓
Backend verifies signature (HMAC-SHA256):
    const expectedSignature = crypto
      .createHmac('sha256', RAZORPAY_SECRET)
      .update(order_id + "|" + payment_id)
      .digest('hex');
    
    if (signature === expectedSignature) {
      // Payment is genuine
      // Mark donation as "paid" in database
      // Send email receipt
    }
    ↓
User sees success screen
```

---

## 🗳️ How Daily Poll Works

### Poll Voting System
```
User opens app at 10 PM
    ↓
App fetches today's poll:
    GET /api/polls/active
    ↓
Backend logic:
    const currentHour = moment().tz('Asia/Kolkata').hour();
    const today = moment().tz('Asia/Kolkata').format('YYYY-MM-DD');
    
    if (currentHour >= 22) {
      // After 10 PM: show tomorrow's poll
      const pollDate = moment().add(1, 'day').format('YYYY-MM-DD');
    } else {
      // Before 10 PM: show today's poll
      const pollDate = today;
    }
    
    const poll = await Poll.findOne({ where: { date: pollDate } });
    ↓
App shows poll question: "Will you have Sehri food tomorrow?"
    ↓
User votes "Yes"
    ↓
App sends vote:
    POST /api/polls/:pollId/respond
    Body: { response: 'yes' }
    ↓
Backend saves vote:
    INSERT INTO poll_responses (poll_id, user_id, response, zone)
    VALUES ('poll123', 'user456', 'yes', 'masjid')
    ↓
Admins see updated stats:
    Total Yes: 45 students
    By Zone:
      - Masjid: 15 students
      - Boys Hostel: 12 students
      - Stanza: 10 students
      - Girls: 8 students
```

---

## 🔔 How Push Notifications Work

### Notification Flow
```
Backend needs to send notification
    ↓
Gets user's Expo Push Token from database:
    const user = await User.findByPk(userId);
    const pushToken = user.fcm_token;
    ↓
Sends to Expo Push Service:
    POST https://exp.host/--/api/v2/push/send
    Body: [{
      to: pushToken,
      title: "Poll Closed",
      body: "Today's Sehri poll has ended",
      data: { type: 'poll', pollId: '123' }
    }]
    ↓
Expo routes to user's device via FCM (Android) or APNs (iOS)
    ↓
User's phone receives notification
    ↓
User taps notification:
    App opens
    App reads data.type = 'poll'
    App navigates to poll screen
```

---

## ⚙️ Critical Configuration Points

### 1. API Base URL (MOST IMPORTANT)
**File:** `mobile/src/constants/api.ts`
```typescript
export const API_BASE_URL = 'https://ungraded-reminder-booted.ngrok-free.dev/api';
```

**⚠️ This URL must be:**
- Accessible 24/7
- Not change after APK is built
- Use HTTPS (not HTTP)

### 2. Backend Environment
**File:** `backend/.env`
```env
# Database
DB_HOST=localhost
DB_NAME=sehri_connect
DB_USER=root
DB_PASSWORD=your_password

# JWT Secrets
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret

# Razorpay
RAZORPAY_KEY_ID=rzp_live_xxx
RAZORPAY_KEY_SECRET=your_secret

# MessageCentral (OTP)
MESSAGECENTRAL_CUSTOMER_ID=<your-messagecentral-customer-id>
MESSAGECENTRAL_PASSWORD=Riz@2004
```

### 3. Socket.IO Connection
**Automatically connects to same URL as API:**
```javascript
const socket = io(API_BASE_URL.replace('/api', ''), {
  auth: { token: accessToken }
});
```

---

## 🎯 Summary: Key Points for APK Deployment

### ✅ What Works Now (Development):
- Backend runs on your PC
- ngrok creates public URL
- Mobile app connects via ngrok
- **PC MUST BE ON for app to work**

### ⚠️ What Breaks in Production:
- If PC turns off → App stops working for everyone
- If ngrok URL changes → All APKs become useless
- If internet disconnects → No one can login

### ✅ What You Need for Production:
1. **Deploy backend to cloud** (Railway/Render/Heroku)
2. **Get permanent URL** (e.g., `https://sehri-api.railway.app`)
3. **Update api.ts** with permanent URL
4. **Build production APK**
5. **Distribute to users**

### 📊 Cost Comparison:

| Option | Monthly Cost | Reliability | PC Required |
|--------|-------------|-------------|-------------|
| ngrok (current) | Free | ❌ Poor | ✅ Yes (24/7) |
| Railway | $5-10 | ✅ Excellent | ❌ No |
| Render | Free/$7 | ✅ Excellent | ❌ No |
| Heroku | $7 | ✅ Excellent | ❌ No |

---

## 🆘 When Users Report "Can't Login"

### Quick Diagnosis:
```bash
# 1. Check if backend is running
curl https://ungraded-reminder-booted.ngrok-free.dev/api

# 2. Check ngrok status
# Visit: http://127.0.0.1:4040

# 3. Check backend logs
type "d:\Sehri app\backend\logs\combined.log"

# 4. Restart everything
start-backend.bat
```

### Common User Issues:

**"Network Error"**
- Their internet is off
- Your PC/ngrok is off

**"Login Failed"**
- Wrong credentials
- Account not approved (status=pending)

**"App is slow"**
- Backend database is slow
- Too many users at once
- Need to optimize queries

---

**Read BUILD-APK-GUIDE.md for deployment instructions!**

Last Updated: September 2026
