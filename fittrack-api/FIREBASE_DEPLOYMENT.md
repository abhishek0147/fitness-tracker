# Firebase Realtime Database & Vercel Deployment Guide

## 📊 Firebase Realtime Database Setup

Your Firebase credentials are already configured:
- **Project ID**: `fitness-tracking-d01f6`
- **Database URL**: `https://fitness-tracking-d01f6.firebaseio.com`

### Step 1: Update Security Rules

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your **fitness-tracking-d01f6** project
3. Navigate to **Build** → **Realtime Database**
4. Click **Rules** tab
5. Replace all content with the rules from `firebase-rules.json`:

```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "$uid === auth.uid || root.child('users').child($uid).child('public').val() === true",
        ".write": "$uid === auth.uid",
        ".validate": "newData.hasChildren(['id', 'name', 'email'])"
      }
    },
    "activities": {
      "$uid": {
        ".read": "$uid === auth.uid || root.child('follows').child(auth.uid).child($uid).exists()",
        ".write": "$uid === auth.uid",
        "$activityId": {
          ".validate": "newData.hasChildren(['id', 'name', 'type'])"
        }
      }
    },
    "routes": {
      "$uid": {
        ".read": "$uid === auth.uid || root.child('follows').child(auth.uid).child($uid).exists()",
        ".write": "$uid === auth.uid",
        "$activityId": {
          ".validate": "newData.hasChildren(['activity_id', 'points'])"
        }
      }
    },
    "follows": {
      "$uid": {
        ".read": true,
        ".write": "$uid === auth.uid",
        "$followingId": {
          ".validate": "newData.isBoolean()"
        }
      }
    },
    "kudos": {
      "$activityId": {
        ".read": true,
        ".write": "auth.uid !== null",
        "$uid": {
          ".validate": "newData.isNumber()"
        }
      }
    },
    "stats": {
      "$uid": {
        ".read": true,
        ".write": "$uid === auth.uid"
      }
    }
  }
}
```

6. Click **Publish** to save

### Security Rules Explanation

- **users**: Each user can read/write their own profile. Public profiles can be read by anyone.
- **activities**: Users can read their own activities or activities from users they follow.
- **routes**: GPS route data is only visible to the activity owner or followers.
- **follows**: Public read, but only users can add/remove their own follows.
- **kudos**: Anyone can give kudos (like) an activity.
- **stats**: Aggregated user statistics, readable by all but writable only by user.

---

## 🚀 Vercel Deployment Setup

### Step 1: Install Vercel CLI

```bash
npm install -g vercel
```

### Step 2: Generate Firebase Service Account Key

1. In Firebase Console, go to **Project Settings** ⚙️
2. Click **Service Accounts** tab
3. Click **Generate New Private Key**
4. This downloads a JSON file with your credentials

### Step 3: Prepare Environment Variables

Create a `.env` file locally:

```bash
cp .env.example .env
```

Then update `.env` with:

```env
FIREBASE_PROJECT_ID=fitness-tracking-d01f6
FIREBASE_DATABASE_URL=https://fitness-tracking-d01f6.firebaseio.com
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"fitness-tracking-d01f6","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"firebase-adminsdk-xxxxx@fitness-tracking-d01f6.iam.gserviceaccount.com","client_id":"..."}
JWT_SECRET=your-production-jwt-secret-here
NODE_ENV=production
```

**⚠️ Note**: Convert the Service Account JSON to a single-line string for the `FIREBASE_SERVICE_ACCOUNT` env var:
```bash
cat /path/to/serviceAccountKey.json | jq -c . | pbcopy
```

### Step 4: Deploy to Vercel

```bash
cd '/Users/abhiharryrockzz/fitness tracker/fittrack-api'
vercel login
vercel --prod
```

### Step 5: Configure Environment Variables on Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your **fittrack-api** project
3. Go to **Settings** → **Environment Variables**
4. Add these variables:
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_DATABASE_URL`
   - `FIREBASE_SERVICE_ACCOUNT`
   - `JWT_SECRET`
   - `NODE_ENV` (set to `production`)

5. Redeploy with `vercel --prod`

---

## 📝 Database Schema in Firebase

The Realtime Database stores data in this structure:

```
/firebase-project-root
├── users/
│   └── {userId}/
│       ├── id
│       ├── name
│       ├── email
│       ├── bio
│       ├── avatar_url
│       └── created_at
├── activities/
│   └── {userId}/
│       └── {activityId}/
│           ├── id
│           ├── name
│           ├── type (run, bike, swim, etc)
│           ├── distance
│           ├── duration
│           ├── calories
│           ├── start_time
│           ├── end_time
│           └── uploaded_at
├── routes/
│   └── {userId}/
│       └── {activityId}/
│           ├── activity_id
│           ├── points: [
│               {latitude, longitude, elevation, timestamp, distance_from_start},
│               ...
│           ]
│           └── uploaded_at
├── follows/
│   └── {userId}/
│       └── {followingId}: true
├── kudos/
│   └── {activityId}/
│       └── {userId}: timestamp
└── stats/
    └── {userId}/
        ├── total_activities
        ├── total_distance
        ├── total_duration
        └── last_activity
```

---

## 🔧 Firebase Service Integration

The app now includes `src/services/firebaseService.js` with these functions:

```javascript
// User Management
await saveUserProfile(userId, userData);
const profile = await getUserProfile(userId);

// Activities
await saveActivity(userId, activityData);
const activities = await getUserActivities(userId, limit);

// GPS Routes
await saveGPSRoute(userId, activityId, routePoints);

// Social Features
await saveFollow(followerId, followingId);
await removeFollow(followerId, followingId);
await addKudos(activityId, userId);

// Feed
const feed = await getUserFeed(userId, limit);
```

These are automatically called when users interact with the app.

---

## ⚙️ Local Development with Firebase

1. **Install dependencies**:
   ```bash
   cd '/Users/abhiharryrockzz/fitness tracker/fittrack-api'
   npm install
   ```

2. **Create local `.env`**:
   ```bash
   cp .env.example .env
   # Edit .env with your Firebase credentials
   ```

3. **Start API**:
   ```bash
   npm run dev
   ```

4. **Start HTTP server** (in another terminal):
   ```bash
   python3 -m http.server 8080
   ```

5. **Test**:
   - Login page: http://localhost:8080/login.html
   - Live tracker: http://localhost:8080/live-tracker-neon.html

---

## 🐛 Troubleshooting

### Firebase connection errors
- Verify `FIREBASE_SERVICE_ACCOUNT` is properly formatted (single-line JSON string)
- Check database URL matches your project ID
- Ensure service account has Realtime Database access

### Vercel deployment fails
- Run locally first: `npm run dev`
- Check all required env vars are set: `vercel env list`
- View logs: `vercel logs`

### Data not syncing to Firebase
- Verify security rules allow the operation
- Check user is authenticated: `auth.uid !== null`
- Look for Firebase errors in browser console

### Service Account Key Issues
- Download fresh key from Firebase Console
- Ensure key is formatted as single-line JSON for env var
- Never commit service account to Git (it's already in `.gitignore`)

---

## 📚 Next Steps

1. ✅ Security rules configured
2. ✅ Service account setup
3. ✅ Environment variables ready
4. 🔄 Deploy to Vercel
5. 🔄 Update frontend to use Firebase for real-time sync
6. 🔄 Setup analytics and monitoring

---

## 🔐 Security Checklist

- ✅ Security rules enforce authentication
- ✅ User data is private by default
- ✅ Service account key stored only in Vercel env
- ✅ Never commit `.env` to Git
- ✅ JWT tokens expire in 7 days
- ⚠️ Update `JWT_SECRET` for production
- ⚠️ Review security rules before production deployment
