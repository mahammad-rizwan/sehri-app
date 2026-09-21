# 🚂 RAILWAY DEPLOYMENT GUIDE - Complete Setup

## 📋 What You'll Get

After this setup:
- ✅ Backend running 24/7 on Railway
- ✅ MySQL database on Railway
- ✅ Permanent URL like: `https://sehri-connect-production.up.railway.app`
- ✅ No PC needed (completely cloud-based)
- ✅ Auto-deploys on git push
- ✅ First $5 free, then ~$5-10/month

---

## 🎯 Step-by-Step Railway Setup

### STEP 1: Prepare Your Backend for Railway

#### 1.1 Create `.gitignore` for backend
```bash
cd "d:\Sehri app\backend"
```

Create/update `.gitignore`:
```
node_modules/
.env
*.log
uploads/
service-account.json
```

#### 1.2 Add Railway-specific files

**Create `Procfile` in backend folder:**
```
web: node src/server.js
```

**Create `railway.json` in backend folder:**
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "node src/server.js",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

#### 1.3 Update `package.json` (if not already present)

Make sure you have:
```json
{
  "engines": {
    "node": ">=18.x"
  },
  "scripts": {
    "start": "node src/server.js"
  }
}
```

---

### STEP 2: Create Railway Account

1. Go to: https://railway.app
2. Click **"Start a New Project"**
3. Sign up with GitHub (recommended) or Email
4. Verify your email
5. You get **$5 free credit** (no card required initially)

---

### STEP 3: Create MySQL Database

#### 3.1 Create New Project
1. Click **"New Project"**
2. Select **"Provision MySQL"**
3. Railway creates a MySQL instance

#### 3.2 Get Database Credentials
1. Click on the MySQL service
2. Go to **"Variables"** tab
3. You'll see:
   ```
   MYSQLHOST=containers-us-west-xxx.railway.app
   MYSQLPORT=6379
   MYSQLDATABASE=railway
   MYSQLUSER=root
   MYSQLPASSWORD=xxxxxxxxxxxxx
   ```
4. **Copy these values** - you'll need them!

#### 3.3 Optional: Connect via TablePlus/MySQL Workbench
To import your existing database:
```
Host: [MYSQLHOST]
Port: [MYSQLPORT]
User: [MYSQLUSER]
Password: [MYSQLPASSWORD]
Database: railway
```

---

### STEP 4: Push Backend to GitHub

#### 4.1 Initialize Git (if not already done)
```bash
cd "d:\Sehri app\backend"
git init
git add .
git commit -m "Initial backend setup for Railway"
```

#### 4.2 Create GitHub Repository
1. Go to: https://github.com/new
2. Name: `sehri-connect-backend`
3. Make it **Private**
4. Don't initialize with README
5. Click **Create repository**

#### 4.3 Push to GitHub
```bash
git remote add origin https://github.com/YOUR_USERNAME/sehri-connect-backend.git
git branch -M main
git push -u origin main
```

---

### STEP 5: Deploy Backend to Railway

#### 5.1 Deploy from GitHub
1. In Railway, click **"New"** → **"GitHub Repo"**
2. Connect your GitHub account (if not connected)
3. Select `sehri-connect-backend` repository
4. Railway starts deploying automatically

#### 5.2 Add Environment Variables
1. Click on your backend service
2. Go to **"Variables"** tab
3. Click **"Raw Editor"**
4. Paste ALL variables from your `.env`:

```env
NODE_ENV=production
PORT=5000

# Database - USE RAILWAY VALUES
DB_HOST=${{MySQL.MYSQLHOST}}
DB_PORT=${{MySQL.MYSQLPORT}}
DB_NAME=${{MySQL.MYSQLDATABASE}}
DB_USER=${{MySQL.MYSQLUSER}}
DB_PASSWORD=${{MySQL.MYSQLPASSWORD}}

# JWT - KEEP YOUR VALUES
JWT_SECRET=your_super_secret_jwt_key_min_32_chars
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=your_refresh_secret_key
JWT_REFRESH_EXPIRES_IN=30d

# MessageCentral - KEEP YOUR VALUES
MESSAGECENTRAL_CUSTOMER_ID=C-B7A835D9FAAB450
MESSAGECENTRAL_PASSWORD=<your-messagecentral-password>

# Google Maps - KEEP YOUR VALUE
GOOGLE_MAPS_API_KEY=<your-google-maps-api-key>

# Razorpay - SWITCH TO LIVE KEYS
RAZORPAY_KEY_ID=rzp_live_XXXXXXXXXX
RAZORPAY_KEY_SECRET=your_live_secret

# Email - KEEP YOUR VALUES
EMAIL_USER=onemessage.support@gmail.com
EMAIL_PASS=apdn xeya nhpv yzkc

# Super Admin - KEEP YOUR VALUES
SUPER_ADMIN_PHONE=9483384972
SUPER_ADMIN_NAME=Rizwan
SUPER_ADMIN_PASSWORD=<choose-a-strong-password>
```

**⚠️ IMPORTANT:** 
- Database variables use Railway's references: `${{MySQL.MYSQLHOST}}`
- This automatically connects to your Railway MySQL
- Railway will replace these with actual values

#### 5.3 Handle Firebase Service Account

**Option A: Upload via Railway (Recommended)**
1. Go to your service → **"Settings"** → **"Volumes"**
2. Or use Railway CLI to upload `service-account.json`

**Option B: Use Environment Variable**
1. Copy content of `service-account.json`
2. Add as environment variable:
   ```env
   FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"..."}
   ```
3. Update your code to use this variable instead of file

**Quick code fix for Option B:**
```javascript
// In your Firebase initialization:
const serviceAccount = process.env.NODE_ENV === 'production'
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  : require('./service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
```

#### 5.4 Generate Domain
1. In your service settings
2. Go to **"Settings"** → **"Networking"**
3. Click **"Generate Domain"**
4. You'll get URL like: `https://sehri-connect-production.up.railway.app`

---

### STEP 6: Import Database to Railway

#### Method A: Using Railway MySQL Terminal
1. Click MySQL service → **"Data"** tab
2. Export your local database:
   ```bash
   mysqldump -u root -p sehri_connect > backup.sql
   ```
3. Use Railway's MySQL client to import

#### Method B: Using TablePlus/MySQL Workbench
1. Connect to Railway MySQL (credentials from Step 3.2)
2. Export from local MySQL
3. Import to Railway MySQL

#### Method C: Let App Auto-Create Tables
Your Sequelize models will auto-create tables on first run if you have:
```javascript
// In connection.js
sequelize.sync({ alter: true })
```

---

### STEP 7: Test Your Deployment

#### 7.1 Check Deployment Logs
1. Click on your service
2. Go to **"Deployments"** tab
3. Click latest deployment
4. Check logs for errors

#### 7.2 Test API Endpoint
```bash
curl https://your-railway-url.up.railway.app/api
```

Should return backend response.

#### 7.3 Test Login Endpoint
```bash
curl https://your-railway-url.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"9876100001","password":"pass@123","role":"user"}'
```

Should return JWT token.

---

### STEP 8: Update Mobile App

#### 8.1 Update API URL
Edit `mobile/src/constants/api.ts`:
```typescript
export const API_BASE_URL = 'https://your-railway-url.up.railway.app/api';
```

#### 8.2 Test Mobile App
```bash
cd mobile
npx expo start
```

Try logging in - should connect to Railway backend!

---

### STEP 9: Build Production APK

#### 9.1 Final Check
- [ ] Railway backend is running
- [ ] Database is connected
- [ ] All environment variables are set
- [ ] API URL is updated in mobile app
- [ ] Test login works

#### 9.2 Build APK
```bash
cd mobile
eas build --platform android --profile production
```

#### 9.3 Download & Test APK
1. Wait for build to complete (~15-20 minutes)
2. Download APK from Expo
3. Install on Android phone
4. Test login with: 9876100001 / pass@123
5. Test all features

---

## 📁 Required Files to Create

### 1. `backend/Procfile`
```
web: node src/server.js
```

### 2. `backend/railway.json`
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "node src/server.js",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### 3. `backend/.gitignore`
```
node_modules/
.env
*.log
uploads/
service-account.json
.DS_Store
```

### 4. Update `backend/package.json`
Add:
```json
{
  "engines": {
    "node": ">=18.x"
  }
}
```

---

## 🔧 Common Issues & Solutions

### Issue 1: "Cannot connect to database"

**Solution:**
Check environment variables in Railway:
```env
DB_HOST=${{MySQL.MYSQLHOST}}
DB_PORT=${{MySQL.MYSQLPORT}}
```

Make sure MySQL service is running.

### Issue 2: "Firebase initialization failed"

**Solution:**
Upload `service-account.json` or use environment variable method (see Step 5.3).

### Issue 3: "Port already in use"

**Solution:**
Railway automatically assigns PORT. Make sure your server uses:
```javascript
const PORT = process.env.PORT || 5000;
```

### Issue 4: "Build failed"

**Solution:**
- Check Railway logs
- Ensure `package.json` has correct `start` script
- Check all dependencies are in `package.json`

### Issue 5: "OTP not sending"

**Solution:**
MessageCentral credentials must be correct in environment variables.

---

## 💰 Railway Pricing

### Free Tier
- $5 free credit (one-time)
- Enough for ~2-3 weeks of testing

### Paid Plan
- Pay-as-you-go after free credit
- ~$5-10/month for small app
- Scales automatically with usage

### What Uses Resources:
- **Compute**: Backend running 24/7
- **Database**: MySQL storage & queries
- **Network**: API requests (generous free allowance)

### Cost Estimate for Your App:
- Backend: ~$3-5/month
- MySQL: ~$2-3/month
- **Total: ~$5-8/month**

---

## 🚀 Post-Deployment Checklist

After Railway deployment is live:

### Backend
- [ ] Railway service is running
- [ ] Database is connected and populated
- [ ] All environment variables are set
- [ ] Domain is generated
- [ ] API endpoints respond correctly
- [ ] Logs show no errors

### Mobile App
- [ ] API_BASE_URL updated to Railway URL
- [ ] Socket.IO connects successfully
- [ ] Login works
- [ ] OTP sending works
- [ ] Polls work
- [ ] Donations work (test mode first!)
- [ ] Chat works
- [ ] Push notifications work
- [ ] GPS tracking works

### Testing
- [ ] Test on Android emulator
- [ ] Test on physical device
- [ ] Test all user roles (user/admin/super admin)
- [ ] Test with real user accounts
- [ ] Monitor Railway logs for errors

### Production
- [ ] Switch Razorpay to live keys
- [ ] Build production APK
- [ ] Test APK on multiple devices
- [ ] Prepare for rollout

---

## 📞 Railway Support

- **Documentation**: https://docs.railway.app
- **Discord**: https://discord.gg/railway
- **Status**: https://status.railway.app

---

## 🎯 Quick Command Reference

### Deploy to Railway
```bash
# After pushing to GitHub, Railway auto-deploys
git add .
git commit -m "Update backend"
git push origin main
```

### View Logs
```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# View logs
railway logs
```

### Connect to Railway MySQL
```bash
railway connect MySQL
```

---

## ✅ Final Steps Summary

1. ✅ Create Railway account
2. ✅ Create MySQL database on Railway
3. ✅ Push backend to GitHub
4. ✅ Deploy to Railway from GitHub
5. ✅ Add environment variables
6. ✅ Import database data
7. ✅ Generate domain URL
8. ✅ Update mobile app API URL
9. ✅ Test thoroughly
10. ✅ Build production APK

---

**Your app will now work 24/7 without your PC!** 🎉

Last Updated: September 2026
