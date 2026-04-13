let firebaseInitialized = false;
let admin = null;

function initializeFirebase() {
  if (firebaseInitialized) return;
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    console.log("Firebase not configured — skipping");
    return;
  }
  try {
    admin = require("firebase-admin");
    const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(sa),
      databaseURL: process.env.FIREBASE_DATABASE_URL ||
        `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`,
    });
    firebaseInitialized = true;
    console.log("✅ Firebase initialized");
  } catch (e) {
    console.warn("Firebase init failed:", e.message);
    admin = null;
  }
}

const noop = async () => ({ success: false, offline: true });

module.exports = {
  initializeFirebase,
  saveUserProfile: noop,
  getUserProfile: async () => null,
  saveActivity: noop,
  saveGPSRoute: noop,
  getUserActivities: async () => [],
  saveFollow: noop,
  removeFollow: noop,
  addKudos: noop,
  getUserFeed: async () => [],
};
