# 🏗️ APK BUILD GUIDE - ONE MESSAGE APP

## ⚠️ CRITICAL: Understanding Your Backend Setup

### Current Configuration
```
Backend URL: https://ungraded-reminder-booted.ngrok-free.dev/api
Location: mobile/src/constants/api.ts
```

### ⚠️ PRODUCTION DEPLOYMENT REQUIREMENT

**YOUR BACKEND MUST BE ACCESSIBLE 24/7 FOR THE APP TO WORK**

When users download your APK and try to login:
```
User's Phone → ngrok URL → YOUR PC (must be running!)
```

If your PC is off or ngrok stops → **App will not work for any user**

---

## 🎯 Two Approaches for APK Deployment

### Approach A: Testing APK (Current Setup - ngrok)
✅ Good for: Testing with friends, demo, development  
❌ Bad for: Real users, production, app store

### Approach B: Production APK (Cloud Hosting)
✅ Good for: Real users, production, app store  
❌ Requires: One-time cloud deployment setup

---

## 📱 Approach A: Build Testing APK (Using ngrok)

### Prerequisites
1. ✅ Backend running on your PC
2. ✅ ngrok tunnel active
3. ✅ ngrok URL is correct in api.ts

### Step 1: Verify Backend is Accessible
```bash
# Test from browser or PowerShell:
curl https://ungraded-reminder-booted.ngrok-free.dev/api
```

Should return backend response (not 404).

### Step 2: Verify Configuration
Check `mobile/src/constants/api.ts`:
```typescript
export const API_BASE_URL = 'https://ungraded-reminder-booted.ngrok-free.dev/api';
```

### Step 3: Build APK
```bash
cd "d:\Sehri app\mobile"
eas build --platform android --profile preview
```

### Step 4: Important Notes
⚠️ **After distributing this APK:**
- Keep your PC running 24/7
- Keep backend running: `start-backend.bat`
- Keep ngrok running
- Don't let PC sleep
- Don't close terminals

### Step 5: Testing the APK
1. Download APK from EAS build page
2. Install on Android phone
3. Open app
4. Try logging in with: 9876100001 / pass@123
5. If you get "Network Error":
   - Check backend is running
   - Check ngrok is running
   - Check ngrok URL hasn't changed

---

## 🚀 Approach B: Production APK (Recommended)

### Why You Need This
- Users can access app anytime
- You don't need to keep PC running
- Professional, reliable solution
- Required for Play Store

### Step 1: Deploy Backend to Cloud

**Option 1: Railway.app (Easiest)**

1. Create account: https://railway.app
2. Click "New Project" → "Deploy from GitHub repo"
3. Connect your GitHub (push backend folder to GitHub first)
4. Railway will:
   - Auto-detect Node.js
   - Install dependencies
   - Start server
5. Add environment variables from your `.env` file
6. You'll get URL like: `https://sehri-connect.up.railway.app`

**Option 2: Render.com**

1. Create account: https://render.com
2. New Web Service → Connect Repository
3. Configure:
   - Build: `npm install`
   - Start: `node src/server.js`
4. Add environment variables
5. Deploy

**Option 3: Heroku**

1. Create account: https://heroku.com
2. Install Heroku CLI
3. Login: `heroku login`
4. Create app: `heroku create sehri-connect-api`
5. Deploy:
   ```bash
   cd backend
   git init
   heroku git:remote -a sehri-connect-api
   git add .
   git commit -m "Deploy backend"
   git push heroku master
   ```

### Step 2: Update Mobile App Configuration

After deploying, update `mobile/src/constants/api.ts`:
```typescript
export const API_BASE_URL = 'https://your-app.railway.app/api';
// or
export const API_BASE_URL = 'https://your-app.onrender.com/api';
```

### Step 3: Build Production APK
```bash
cd "d:\Sehri app\mobile"
eas build --platform android --profile production
```

### Step 4: Distribute
- Upload to Google Play Store
- Or share APK link directly

---

## 🔧 Build Commands Reference

### Development Build (for testing on physical device)
```bash
cd mobile
npx expo start --dev-client
```

### Preview APK (testing, no Play Store)
```bash
eas build --platform android --profile preview
```

### Production APK (Play Store ready)
```bash
eas build --platform android --profile production
```

### Check Build Status
```bash
eas build:list
```

### Download Latest Build
Visit: https://expo.dev/accounts/rizwan866/projects/sehri-connect/builds

---

## 🐛 Common Issues During APK Testing

### Issue 1: "Network Error" on Login

**Cause**: Backend not accessible

**Solutions:**
1. Check backend is running: `start-backend.bat`
2. Check ngrok is running
3. Test URL in browser: `https://ungraded-reminder-booted.ngrok-free.dev/api`
4. Check ngrok URL hasn't changed: `get-ngrok-url.bat`
5. If URL changed, update `api.ts` and rebuild APK

### Issue 2: "Connection Timeout"

**Cause**: Slow network or backend not responding

**Solutions:**
1. Increase timeout in `api.ts` (currently 15000ms)
2. Check backend logs for errors: `backend/logs/combined.log`
3. Restart backend

### Issue 3: "Cannot Connect to Server"

**Cause**: ngrok expired or PC is off

**Solutions:**
1. Check PC is on and connected to internet
2. Check ngrok is running
3. Restart ngrok if needed

### Issue 4: App Installs but Crashes

**Cause**: Build issues or missing dependencies

**Solutions:**
1. Check EAS build logs
2. Clear cache: `eas build:clear-cache`
3. Rebuild with: `--clear-cache` flag

---

## 📊 Testing Checklist Before Distribution

### Backend Health
- [ ] Backend server running
- [ ] ngrok tunnel active
- [ ] Database connected (MySQL)
- [ ] API endpoints responding
- [ ] Test URL in browser works

### Mobile App
- [ ] API_BASE_URL is correct in api.ts
- [ ] Build completed successfully
- [ ] APK downloaded from EAS
- [ ] APK installed on test device
- [ ] Login works (test account: 9876100001 / pass@123)
- [ ] OTP sending works (MessageCentral configured)
- [ ] Poll voting works
- [ ] Donations work (Razorpay configured)
- [ ] Chat messages work (Socket.IO)
- [ ] Push notifications work
- [ ] Prayer timings display

---

## 🎯 Recommended Production Workflow

### For RV College Deployment:

1. **Week 1**: Deploy backend to Railway/Render
2. **Week 2**: Test with cloud URL thoroughly
3. **Week 3**: Build production APK
4. **Week 4**: Soft launch with 10-20 students
5. **Week 5**: Full rollout

### Cost Estimate:
- **Railway.app**: $5-10/month (first $5 free)
- **Render.com**: Free tier available (scales to $7/month)
- **Database**: Included or use Railway MySQL
- **ngrok**: Free (only for development/testing)

---

## 💡 Pro Tips

1. **Use environment-based URLs** (development vs production)
2. **Test APK on multiple devices** before distribution
3. **Keep test accounts active** for troubleshooting
4. **Monitor backend logs** during initial rollout
5. **Have rollback plan** (previous APK version ready)

---

## 🆘 Emergency Response

### If App Stops Working After Distribution:

**Scenario**: Users report "Can't login"

**Quick Fix:**
1. Check ngrok dashboard: http://127.0.0.1:4040
2. If ngrok died, restart: `start-ngrok.bat`
3. If URL changed → PROBLEM:
   - Old APK has old URL hardcoded
   - All users need new APK
   - **This is why production hosting is critical**

**Permanent Fix:**
- Deploy backend to cloud hosting
- Build new APK with permanent URL
- Notify users to update

---

## 📞 Support Contact for Users

Include in your app/documentation:

**Technical Issues:**
- Backend Status: Check if backend is running
- Support Contact: [Your phone/email]
- Expected Response: Within 2 hours

**Login Issues:**
- Test Account: 9876100001 / pass@123
- If login fails, contact super admin: 9483384972

---

## 🎓 Summary

### Current Setup (ngrok):
✅ Good for: Development, testing with small group  
❌ Bad for: Production, large user base  
⚠️ Requires: PC running 24/7

### Recommended Setup (Cloud):
✅ Good for: Production, scalability, reliability  
✅ No PC required: Runs independently  
✅ Professional: Suitable for app store

### Next Step:
**Choose one:**
1. **Testing only**: Keep current setup, build preview APK
2. **Production**: Deploy to cloud, build production APK

---

Last Updated: September 2026  
App: One Message (Sehri Connect)  
Version: 1.0.0
