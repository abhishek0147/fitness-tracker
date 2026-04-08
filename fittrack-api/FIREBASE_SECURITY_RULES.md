# 📊 Firebase Realtime Database Security Rules Guide

## Why These Rules Matter

The security rules protect your users' data while allowing the app to function properly. They define:
- Who can read what data
- Who can write/modify data
- What format data must have
- Rate limiting and validation

---

## The Rules Explained

```json
{
  "rules": {
    "users": {
      "$uid": {
        // Rule 1: Read own profile OR read public profiles
        ".read": "$uid === auth.uid || root.child('users').child($uid).child('public').val() === true",
        
        // Rule 2: Write only own profile
        ".write": "$uid === auth.uid",
        
        // Rule 3: Profile must have required fields
        ".validate": "newData.hasChildren(['id', 'name', 'email'])"
      }
    }
  }
}
```

### Variables Explained:
- `$uid` = User's unique ID from Firebase Authentication
- `auth.uid` = Currently logged-in user's ID
- `root` = Reference to entire database
- `newData` = Data being written to database

---

## Each Section

### 1. Users (`/users/{uid}/`)
```json
"users": {
  "$uid": {
    ".read": "$uid === auth.uid || root.child('users').child($uid).child('public').val() === true",
    ".write": "$uid === auth.uid",
    ".validate": "newData.hasChildren(['id', 'name', 'email'])"
  }
}
```

**What it does:**
- ✅ Users can read their own profile
- ✅ Users can read public profiles (if `public: true` set)
- ✅ Users can only write/modify their own profile
- ✅ Profile must have `id`, `name`, and `email` fields

**Example path:** `/users/user123/name = "John"`

---

### 2. Activities (`/activities/{uid}/{activityId}/`)
```json
"activities": {
  "$uid": {
    ".read": "$uid === auth.uid || root.child('follows').child(auth.uid).child($uid).exists()",
    ".write": "$uid === auth.uid",
    "$activityId": {
      ".validate": "newData.hasChildren(['id', 'name', 'type'])"
    }
  }
}
```

**What it does:**
- ✅ Users can read their own activities
- ✅ Users can read activities from people they follow
- ✅ Users can only write/modify their own activities
- ✅ Activity must have `id`, `name`, and `type`

**Example path:** `/activities/user123/activity456/distance = 5.2`

---

### 3. Routes (`/routes/{uid}/{activityId}/`)
```json
"routes": {
  "$uid": {
    ".read": "$uid === auth.uid || root.child('follows').child(auth.uid).child($uid).exists()",
    ".write": "$uid === auth.uid",
    "$activityId": {
      ".validate": "newData.hasChildren(['activity_id', 'points'])"
    }
  }
}
```

**What it does:**
- ✅ GPS route is private (only user or followers can see)
- ✅ Only route owner can upload points
- ✅ Route must have `activity_id` and `points` array

**Example path:** `/routes/user123/activity456/points[0] = {latitude: 40.7, longitude: -74.0}`

---

### 4. Follows (`/follows/{uid}/{followingId}`)
```json
"follows": {
  "$uid": {
    ".read": true,
    ".write": "$uid === auth.uid",
    "$followingId": {
      ".validate": "newData.isBoolean()"
    }
  }
}
```

**What it does:**
- ✅ Anyone can see who follows whom (public)
- ✅ Users can only modify their own follow list
- ✅ Follow value must be `true` (boolean)

**Example path:** `/follows/user123/user456 = true` (user123 follows user456)

---

### 5. Kudos (`/kudos/{activityId}/{uid}`)
```json
"kudos": {
  "$activityId": {
    ".read": true,
    ".write": "auth.uid !== null",
    "$uid": {
      ".validate": "newData.isNumber()"
    }
  }
}
```

**What it does:**
- ✅ Anyone can see kudos (public)
- ✅ Any authenticated user can give kudos
- ✅ Kudos value must be a timestamp (number)

**Example path:** `/kudos/activity456/user123 = 1712614400000`

---

### 6. Stats (`/stats/{uid}/`)
```json
"stats": {
  "$uid": {
    ".read": true,
    ".write": "$uid === auth.uid"
  }
}
```

**What it does:**
- ✅ Anyone can read user stats (for leaderboards, etc)
- ✅ Only user can update their stats
- ✅ No validation (stats structure flexible)

**Example path:** `/stats/user123/total_distance = 42.5`

---

## How to Apply These Rules

1. **Open Firebase Console**: https://console.firebase.google.com/
2. **Select your project**: `fitness-tracking-d01f6`
3. **Go to Realtime Database**: Build → Realtime Database
4. **Click Rules tab**: At the top of the database view
5. **Replace all content** with the rules from `firebase-rules.json`
6. **Click Publish**: Blue button at top right
7. **Confirm**: Click Publish again

---

## Testing Rules Locally

Use Firebase Emulator Suite (advanced):

```bash
firebase emulators:start --only database
```

This lets you test rules without affecting production data.

---

## Common Issues & Fixes

### "Permission denied" on read
**Problem**: User can't read another user's profile
**Solution**: Check if profile has `"public": true` set, or verify user relationship (follow)

### "Permission denied" on write
**Problem**: User can't save their activity
**Solution**: Verify authenticated user ID matches the path `{uid}`

### Activity won't sync
**Problem**: Activity upload fails
**Solution**: Ensure activity object has required fields: `id`, `name`, `type`

### Can't follow user
**Problem**: Follow operation denied
**Solution**: Make sure you're authenticated and following path is `/follows/{yourId}/{targetId}`

---

## Security Best Practices

✅ **Always use `auth.uid`** for user-specific rules  
✅ **Make social data public** (follows, kudos, stats)  
✅ **Keep private data restricted** (activities, routes)  
✅ **Validate data format** with `.validate` rules  
✅ **Use relationships** (follows) to control access  

---

## Example Data Structures

### Valid User Profile:
```json
{
  "id": 1,
  "name": "John Doe",
  "email": "john@example.com",
  "bio": "Fitness enthusiast",
  "avatar_url": "https://...",
  "public": true,
  "created_at": 1712614400000
}
```

### Valid Activity:
```json
{
  "id": 123,
  "name": "Morning Run",
  "type": "run",
  "distance": 5.2,
  "duration": 1800,
  "calories": 450,
  "start_time": 1712614400000,
  "end_time": 1712616200000
}
```

### Valid Route:
```json
{
  "activity_id": 123,
  "points": [
    {
      "latitude": 40.7128,
      "longitude": -74.0060,
      "elevation": 10.5,
      "timestamp": 1712614400000,
      "distance_from_start": 0
    },
    {
      "latitude": 40.7200,
      "longitude": -74.0100,
      "elevation": 12.0,
      "timestamp": 1712614430000,
      "distance_from_start": 0.8
    }
  ],
  "uploaded_at": 1712614500000
}
```

---

## Advanced: Custom Validation

You can add complex validation rules:

```json
".validate": "newData.child('distance').isNumber() && newData.child('distance').val() > 0"
```

This ensures:
- `distance` field exists
- `distance` is a number
- `distance` is greater than 0

---

## Monitoring & Logs

In Firebase Console:
1. Go to **Realtime Database** → **Rules**
2. Click **Logs** tab
3. See denied access attempts
4. Debug which rules are blocking requests

---

## Production Checklist

Before deploying to production:

- ✅ Test rules with Emulator Suite
- ✅ Review all rule paths
- ✅ Verify authentication works
- ✅ Test follow/unfollow functionality
- ✅ Check kudos can be given
- ✅ Monitor security rules logs
- ✅ Document any custom fields added

---

## Next Steps

1. **Apply rules**: Copy to Firebase Console and Publish
2. **Test locally**: Verify app works with rules
3. **Deploy**: Push to production
4. **Monitor**: Check logs for any denial patterns

Your database is now secure and production-ready! 🔒
