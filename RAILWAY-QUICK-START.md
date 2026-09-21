# 🚀 RAILWAY DEPLOYMENT - QUICK START

## ✅ Files Ready for Railway

I've prepared your backend for Railway deployment:

### Created Files:
- ✅ `backend/Procfile` - Tells Railway how to start your server
- ✅ `backend/railway.json` - Railway configuration
- ✅ `backend/package.json` - Updated with Node version requirement
- ✅ `backend/.gitignore` - Already configured correctly

---

## 📋 5-MINUTE DEPLOYMENT CHECKLIST

### 1. Create Railway Account (2 mins)
```
1. Visit: https://railway.app
2. Click "Start a New Project"
3. Sign up with GitHub
4. Get $5 free credit!
```

### 2. Create MySQL Database (1 min)
```
1. In Railway: "New Project" → "Provision MySQL"
2. Copy the database credentials (you'll need them)
3. Save these values:
   - MYSQLHOST
   - MYSQLPORT
   - MYSQLDATABASE
   - MYSQLUSER
   - MYSQLPASSWORD
```

### 3. Push to GitHub (3 mins)

**If you don't have Git initialized:**
```bash
cd "d:\Sehri app\backend"
git init
git add .
git commit -m "Initial commit for Railway"
```

**Create GitHub repo:**
1. Go to: https://github.com/new
2. Name: `sehri-connect-backend`
3. Make it Private
4. Create repository

**Push code:**
```bash
git remote add origin https://github.com/YOUR_USERNAME/sehri-connect-backend.git
git branch -M main
git push -u origin main
```

### 4. Deploy to Railway (2 mins)
```
1. In Railway: "New" → "GitHub Repo"
2. Select "sehri-connect-backend"
3. Railway starts building automatically
4. Wait for deployment to complete
```

### 5. Add Environment Variables (3 mins)
```
1. Click your service → "Variables" tab
2. Click "Raw Editor"
3. Copy-paste this (replace values):
```

```env
NODE_ENV=production
PORT=5000

# Railway MySQL - USE THESE EXACT REFERENCES
DB_HOST=${{MySQL.MYSQLHOST}}
DB_PORT=${{MySQL.MYSQLPORT}}
DB_NAME=${{MySQL.MYSQLDATABASE}}
DB_USER=${{MySQL.MYSQLUSER}}
DB_PASSWORD=${{MySQL.MYSQLPASSWORD}}

# JWT Secrets - KEEP YOUR VALUES
JWT_SECRET=your_super_secret_jwt_key_min_32_chars
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=your_refresh_secret_key
JWT_REFRESH_EXPIRES_IN=30d

# MessageCentral OTP - YOUR CREDENTIALS
MESSAGECENTRAL_CUSTOMER_ID=C-B7A835D9FAAB450
MESSAGECENTRAL_PASSWORD=<your-messagecentral-password>

# Google Maps - YOUR KEY
GOOGLE_MAPS_API_KEY=<your-google-maps-api-key>

# Razorpay - USE LIVE KEYS FOR PRODUCTION!
RAZORPAY_KEY_ID=rzp_live_XXXXXXXXXX
RAZORPAY_KEY_SECRET=your_live_secret_here

# Email - YOUR GMAIL CREDENTIALS
EMAIL_USER=onemessage.support@gmail.com
EMAIL_PASS=apdn xeya nhpv yzkc

# Super Admin - YOUR CREDENTIALS
SUPER_ADMIN_PHONE=9483384972
SUPER_ADMIN_NAME=Rizwan
SUPER_ADMIN_PASSWORD=<choose-a-strong-password>

# Firebase - ADD THIS AS STRING
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"sehri-connect",...}
```

**⚠️ IMPORTANT NOTES:**
- Database variables (`${{MySQL.MYSQLHOST}}`) are Railway references - DON'T change them!
- For Firebase, you need to convert `service-account.json` to a single-line string
- For Razorpay, switch from test to LIVE keys before building production APK

### 6. Generate Public URL (1 min)
```
1. In your service: Settings → Networking
2. Click "Generate Domain"
3. Copy the URL (like: sehri-connect-production.up.railway.app)
```

### 7. Import Database (5 mins)

**Option A: Quick (Let Sequelize create tables)**
Your app will auto-create tables on first run.

**Option B: Import existing data**
```bash
# Export from local MySQL
mysqldump -u root -p sehri_connect > backup.sql

# Import to Railway MySQL (use credentials from Step 2)
# Use TablePlus, MySQL Workbench, or Railway CLI
```

### 8. Test Deployment (2 mins)
```bash
# Test API
curl https://your-railway-url.up.railway.app/api

# Test login
curl https://your-railway-url.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"9876100001","password":"pass@123","role":"user"}'
```

Should return JWT token if successful!

---

## 📱 Update Mobile App & Build APK

### Step 1: Update API URL
Edit `mobile/src/constants/api.ts`:
```typescript
export const API_BASE_URL = 'https://your-railway-url.up.railway.app/api';
```

### Step 2: Test with Expo
```bash
cd mobile
npx expo start
```

Try logging in - should work!

### Step 3: Build Production APK
```bash
eas build --platform android --profile production
```

### Step 4: Test APK
1. Download APK from Expo (takes ~15-20 mins to build)
2. Install on Android phone
3. Login with: 9876100001 / pass@123
4. Test all features!

---

## 🔧 Handling Firebase Service Account

Your `service-account.json` needs special handling for Railway.

### Method 1: Environment Variable (Recommended)

**Step 1:** Convert JSON to single line
```bash
# In backend folder
cat service-account.json | tr -d '\n'
```

**Step 2:** Copy the output and add to Railway variables:
```env
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"...entire_json_here..."}
```

**Step 3:** Update your Firebase initialization code

Find where you initialize Firebase (probably in a middleware or service file):

**Before (file-based):**
```javascript
const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
```

**After (environment variable):**
```javascript
const admin = require('firebase-admin');

const serviceAccount = process.env.NODE_ENV === 'production'
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  : require('./service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
```

### Method 2: Railway Volumes (Advanced)
Use Railway's file storage feature to upload the JSON file.

---

## 💰 Railway Costs

### Your App Usage Estimate:
- **Backend compute**: ~$3-5/month
- **MySQL database**: ~$2-3/month
- **Network/bandwidth**: Usually free (generous limits)
- **Total**: ~$5-8/month

### Free Credit:
- $5 free on signup
- Good for ~3-4 weeks of testing
- No credit card required initially

---

## 🐛 Troubleshooting Common Issues

### Issue 1: Build Fails
```
Check Railway logs:
- Click your service
- "Deployments" tab
- Click latest deployment
- Read error messages
```

**Common fixes:**
- Ensure `package.json` has `"start": "node src/server.js"`
- Check all dependencies are listed
- Node version is >=18

### Issue 2: Database Connection Failed
```
Error: "connect ECONNREFUSED"
```

**Fix:** Check environment variables:
```env
DB_HOST=${{MySQL.MYSQLHOST}}  # Must use Railway reference
DB_PORT=${{MySQL.MYSQLPORT}}
```

### Issue 3: Firebase Error
```
Error: "Could not load the default credentials"
```

**Fix:** Make sure `FIREBASE_SERVICE_ACCOUNT` is set correctly in environment variables.

### Issue 4: Port Already in Use
```
Error: "listen EADDRINUSE: address already in use :::5000"
```

**Fix:** Ensure your server uses Railway's PORT:
```javascript
const PORT = process.env.PORT || 5000;
```

### Issue 5: OTP Not Sending
```
MessageCentral returns error
```

**Fix:** Verify credentials in Railway variables match your MessageCentral account.

---

## ✅ Final Checklist

Before distributing APK:

### Backend (Railway)
- [ ] Service is deployed and running
- [ ] Database is connected
- [ ] All environment variables are set
- [ ] Domain URL is generated
- [ ] API endpoints return correct responses
- [ ] Test login works via curl/Postman
- [ ] Logs show no errors

### Mobile App
- [ ] API_BASE_URL points to Railway URL
- [ ] App builds successfully
- [ ] Can login with test account
- [ ] All features work (polls, donations, chat, etc.)
- [ ] Push notifications work
- [ ] No console errors

### Production Ready
- [ ] Razorpay LIVE keys configured
- [ ] Firebase production credentials
- [ ] Database has real user data
- [ ] Tested on multiple devices
- [ ] Ready for rollout

---

## 🆘 Need Help?

### Railway Issues
- Docs: https://docs.railway.app
- Discord: https://discord.gg/railway
- Support: help@railway.app

### Your App Issues
- Check backend logs in Railway dashboard
- Check mobile app logs in Expo
- Test API endpoints with curl/Postman

---

## 🎯 Next Steps After Deployment

1. **Monitor Railway dashboard** for the first few days
2. **Check logs regularly** for errors
3. **Test with real users** (start with 5-10 students)
4. **Scale gradually** to avoid issues
5. **Keep Razorpay in test mode** until fully tested
6. **Switch to live payments** only when ready

---

## 📊 Deployment Timeline

| Phase | Duration | Action |
|-------|----------|--------|
| Setup Railway | 15 mins | Create account, MySQL, deploy |
| Configure | 10 mins | Environment variables, domain |
| Test Backend | 5 mins | Verify endpoints work |
| Update Mobile | 5 mins | Change API URL |
| Build APK | 20 mins | EAS build time |
| Test APK | 10 mins | Install and test |
| **Total** | **~1 hour** | **Complete deployment** |

---

**You're ready to deploy! Follow the checklist above step by step.** 🚀

For detailed explanations, see: `RAILWAY-DEPLOYMENT.md`

Last Updated: September 2026
