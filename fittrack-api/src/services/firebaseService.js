/**
 * Firebase Realtime Database Service
 * Handles all interactions with Firebase for user profiles, activities, and social data
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin SDK
let firebaseInitialized = false;

function initializeFirebase() {
  if (firebaseInitialized) return;

  // Try to initialize with service account (for server-side operations)
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: process.env.FIREBASE_DATABASE_URL || `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`
      });
      firebaseInitialized = true;
      console.log('✅ Firebase initialized with service account');
    } catch (err) {
      console.warn('⚠️  Firebase initialization failed:', err.message);
    }
  }
}

/**
 * Save user profile to Firebase Realtime Database
 */
async function saveUserProfile(userId, userData) {
  try {
    if (!firebaseInitialized) {
      console.warn('Firebase not initialized, skipping cloud sync');
      return { success: false, offline: true };
    }

    const db = admin.database();
    const userRef = db.ref(`users/${userId}`);

    const profileData = {
      id: userId,
      name: userData.name,
      email: userData.email,
      bio: userData.bio || '',
      avatar_url: userData.avatar_url || '',
      updated_at: admin.database.ServerValue.TIMESTAMP,
      created_at: userData.created_at || admin.database.ServerValue.TIMESTAMP
    };

    await userRef.set(profileData);
    return { success: true, data: profileData };
  } catch (error) {
    console.error('Error saving user profile to Firebase:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get user profile from Firebase
 */
async function getUserProfile(userId) {
  try {
    if (!firebaseInitialized) return null;

    const db = admin.database();
    const snapshot = await db.ref(`users/${userId}`).once('value');
    return snapshot.val();
  } catch (error) {
    console.error('Error retrieving user profile from Firebase:', error);
    return null;
  }
}

/**
 * Save activity to Firebase Realtime Database
 */
async function saveActivity(userId, activityData) {
  try {
    if (!firebaseInitialized) {
      console.warn('Firebase not initialized, skipping activity sync');
      return { success: false, offline: true };
    }

    const db = admin.database();
    const activityRef = db.ref(`activities/${userId}/${activityData.id}`);

    const activity = {
      id: activityData.id,
      name: activityData.name,
      type: activityData.type,
      distance: activityData.distance,
      duration: activityData.duration,
      calories: activityData.calories,
      start_time: activityData.start_time,
      end_time: activityData.end_time,
      description: activityData.description,
      uploaded_at: admin.database.ServerValue.TIMESTAMP
    };

    await activityRef.set(activity);
    return { success: true, data: activity };
  } catch (error) {
    console.error('Error saving activity to Firebase:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Save GPS route points to Firebase
 */
async function saveGPSRoute(userId, activityId, routePoints) {
  try {
    if (!firebaseInitialized) {
      console.warn('Firebase not initialized, skipping GPS sync');
      return { success: false, offline: true };
    }

    const db = admin.database();
    const routeRef = db.ref(`routes/${userId}/${activityId}`);

    const route = {
      activity_id: activityId,
      points: routePoints,
      uploaded_at: admin.database.ServerValue.TIMESTAMP
    };

    await routeRef.set(route);
    return { success: true, pointsCount: routePoints.length };
  } catch (error) {
    console.error('Error saving GPS route to Firebase:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get user's activities from Firebase
 */
async function getUserActivities(userId, limit = 50) {
  try {
    if (!firebaseInitialized) return [];

    const db = admin.database();
    const snapshot = await db.ref(`activities/${userId}`)
      .orderByChild('start_time')
      .limitToLast(limit)
      .once('value');

    const activities = [];
    snapshot.forEach(child => {
      activities.push(child.val());
    });

    return activities.reverse();
  } catch (error) {
    console.error('Error retrieving activities from Firebase:', error);
    return [];
  }
}

/**
 * Save follow relationship to Firebase
 */
async function saveFollow(followerId, followingId) {
  try {
    if (!firebaseInitialized) {
      console.warn('Firebase not initialized, skipping follow sync');
      return { success: false, offline: true };
    }

    const db = admin.database();
    await db.ref(`follows/${followerId}/${followingId}`).set(true);
    return { success: true };
  } catch (error) {
    console.error('Error saving follow to Firebase:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Remove follow relationship from Firebase
 */
async function removeFollow(followerId, followingId) {
  try {
    if (!firebaseInitialized) {
      console.warn('Firebase not initialized, skipping unfollow sync');
      return { success: false, offline: true };
    }

    const db = admin.database();
    await db.ref(`follows/${followerId}/${followingId}`).remove();
    return { success: true };
  } catch (error) {
    console.error('Error removing follow from Firebase:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Add kudos (like) to Firebase
 */
async function addKudos(activityId, userId) {
  try {
    if (!firebaseInitialized) {
      console.warn('Firebase not initialized, skipping kudos sync');
      return { success: false, offline: true };
    }

    const db = admin.database();
    await db.ref(`kudos/${activityId}/${userId}`).set(admin.database.ServerValue.TIMESTAMP);
    return { success: true };
  } catch (error) {
    console.error('Error adding kudos to Firebase:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get user's feed from Firebase
 */
async function getUserFeed(userId, limit = 20) {
  try {
    if (!firebaseInitialized) return [];

    const db = admin.database();
    // Get all activities from users being followed
    const followSnapshot = await db.ref(`follows/${userId}`).once('value');
    const following = followSnapshot.val() || {};

    const feedActivities = [];

    for (const followingId of Object.keys(following)) {
      const snapshot = await db.ref(`activities/${followingId}`)
        .orderByChild('start_time')
        .limitToLast(limit)
        .once('value');

      snapshot.forEach(child => {
        feedActivities.push({
          ...child.val(),
          user_id: followingId
        });
      });
    }

    // Sort by timestamp and limit
    feedActivities.sort((a, b) => b.start_time - a.start_time);
    return feedActivities.slice(0, limit);
  } catch (error) {
    console.error('Error retrieving feed from Firebase:', error);
    return [];
  }
}

module.exports = {
  initializeFirebase,
  saveUserProfile,
  getUserProfile,
  saveActivity,
  saveGPSRoute,
  getUserActivities,
  saveFollow,
  removeFollow,
  addKudos,
  getUserFeed
};
