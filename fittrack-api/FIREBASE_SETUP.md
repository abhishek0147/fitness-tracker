# Firebase Setup Guide for FitTrack

## Overview
The login page is configured to use Firebase for Google authentication and account management. Follow these steps to connect your Firebase project.

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Create a project"**
3. Enter project name: `fittrack` (or your preferred name)
4. Accept the terms and click **"Create project"**
5. Wait for the project to be created

## Step 2: Set Up Authentication

1. In Firebase Console, go to **Build** → **Authentication**
2. Click **"Get started"**
3. Enable these sign-in methods:
   - **Email/Password**: Click on it, toggle **Enable**, and click **Save**
   - **Google**: Click on it, toggle **Enable**, select your support email, add project name, then click **Save**

## Step 3: Get Your Firebase Config

1. In Firebase Console, click the **Settings icon** (⚙️) → **Project settings**
2. Scroll down to **"Your apps"** section
3. If no app exists, click **"Add app"** → select **Web** icon `</>`
4. Enter app name: `fittrack-web`
5. Click **"Register app"**
6. Copy the Firebase config object (you'll see it after registration):

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

## Step 4: Update Login Page with Firebase Config

1. Open `/login.html` in VS Code
2. Find this section (around line 430):
```javascript
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};
```

3. Replace each `YOUR_*` placeholder with values from your Firebase config:
   - `YOUR_API_KEY` → your `apiKey`
   - `YOUR_PROJECT_ID` → your `projectId` (appears 3 times)
   - `YOUR_MESSAGING_SENDER_ID` → your `messagingSenderId`
   - `YOUR_APP_ID` → your `appId`

4. **Save the file** (Cmd+S)

## Step 5: Set Up Google OAuth Consent Screen

For Google Sign-In to work, you need to configure the OAuth consent screen:

1. In Firebase Console, go to **Build** → **Authentication** → **Settings** tab
2. Scroll to **"Authorized domains"**
3. Add these domains:
   - `localhost:8080`
   - `127.0.0.1:8080`
   - Your production domain (if applicable)

## Step 6: Test the Login Page

1. **Start the API server**:
   ```bash
   cd '/Users/abhiharryrockzz/fitness tracker/fittrack-api'
   npm run dev
   ```
   (Should show: "Server running on port 3000")

2. **Start the HTTP server** (if not already running):
   ```bash
   cd '/Users/abhiharryrockzz/fitness tracker/fittrack-api'
   python3 -m http.server 8080
   ```

3. **Open the login page**:
   - Visit: `http://localhost:8080/login.html`

4. **Test functionality**:
   - ✅ **Email/Password Signup**: Fill name, email, password → Click "Sign Up"
   - ✅ **Email/Password Login**: Enter credentials → Click "Login"
   - ✅ **Google Sign-In**: Click "Continue with Google" → Select your Google account

## Features of the Login Page

### Visual Design
- 🎨 **Neon theme** with cyan (#66ffc0), green (#00ff88), and pink (#ff006e) gradients
- ✨ **Smooth animations**: slideUp, slideInLeft, slideInRight, glow effects
- ⭐ **Twinkling stars** background for atmospheric feel
- 🌊 **Hover animations** with glowing shadows and smooth transitions

### Authentication Methods
1. **Email/Password** (Local FitTrack Auth):
   - Signup form with name, email, password fields
   - Login form with email and password
   - Form toggle between Login/Signup modes
   - Real-time validation feedback

2. **Google OAuth** (Firebase):
   - One-click Google account sign-in
   - Auto-creates user account on first login
   - Uses Firebase Authentication popup

### User Experience
- Real-time loading indicators
- Success/error messages with color-coded feedback
- Automatic redirect to live tracker on successful auth
- Token stored in localStorage for session persistence
- Responsive design (mobile-friendly)

## Troubleshooting

### "Firebase not fully configured" message in console
- Make sure you've replaced all `YOUR_*` placeholders in the Firebase config
- Verify config values match your Firebase project exactly

### "Google login failed" error
- Check that you've enabled Google sign-in in Firebase Authentication
- Verify `localhost:8080` is in Authorized Domains
- Check browser console for specific Firebase errors

### "Authentication failed" error on email/password
- Ensure API is running on port 3000 (`npm run dev`)
- Check that user credentials are correct
- Look for error messages in the browser console

### Can't see the login page
- Verify HTTP server is running on port 8080
- Check URL is `http://localhost:8080/login.html` (not https)
- Clear browser cache (Cmd+Shift+R on Mac)

## Next Steps

After setting up Firebase:

1. ✅ Users can sign up/login via email/password
2. ✅ Users can sign in with Google
3. ✅ Tokens stored in localStorage for session persistence
4. ✅ Automatic redirect to live GPS tracker after auth
5. 🔄 Optional: Add Firebase Realtime Database for user profiles
6. 🔄 Optional: Add Firebase Cloud Storage for profile pictures

## Environment Variables

If you want to keep Firebase config secure in production, create a `.env` file:

```env
FIREBASE_API_KEY=your_api_key
FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
FIREBASE_MESSAGING_SENDER_ID=your_sender_id
FIREBASE_APP_ID=your_app_id
```

Then update `login.html` to read from `.env` (requires a build process like Webpack).

## API Endpoints

The login page uses these FitTrack API endpoints:

- `POST /api/auth/register` - Create new account with email/password
- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/google` - Google OAuth login (auto-creates account)

All endpoints return:
```json
{
  "token": "jwt_token_here",
  "user": {
    "id": 1,
    "name": "User Name",
    "email": "user@example.com"
  }
}
```

Tokens are valid for 7 days and stored in localStorage as `fittrack_token`.
