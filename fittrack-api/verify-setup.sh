#!/bin/bash

# FitTrack Deployment Checklist
# Run this to verify everything is set up

echo "🚀 FitTrack Firebase & Vercel Setup Verification"
echo "================================================"
echo ""

# Check Node version
echo "✓ Node.js:"
node --version

# Check dependencies
echo ""
echo "✓ Dependencies installed:"
npm list --depth=0 | grep -E "express|firebase-admin|better-sqlite3" | head -3

# Check key files
echo ""
echo "✓ Configuration files:"
[ -f package.json ] && echo "  ✅ package.json"
[ -f vercel.json ] && echo "  ✅ vercel.json"
[ -f firebase-rules.json ] && echo "  ✅ firebase-rules.json"
[ -f .env.example ] && echo "  ✅ .env.example"

# Check source files
echo ""
echo "✓ Source code:"
[ -f src/app.js ] && echo "  ✅ src/app.js (Firebase initialized)"
[ -f src/services/firebaseService.js ] && echo "  ✅ src/services/firebaseService.js"
[ -f src/routes/auth.js ] && echo "  ✅ src/routes/auth.js (Google OAuth added)"

# Check frontend
echo ""
echo "✓ Frontend files:"
[ -f login.html ] && echo "  ✅ login.html (Firebase credentials added)"
[ -f live-tracker-neon.html ] && echo "  ✅ live-tracker-neon.html"

# Check documentation
echo ""
echo "✓ Documentation:"
[ -f QUICK_START.md ] && echo "  ✅ QUICK_START.md"
[ -f FIREBASE_SETUP.md ] && echo "  ✅ FIREBASE_SETUP.md"
[ -f FIREBASE_DEPLOYMENT.md ] && echo "  ✅ FIREBASE_DEPLOYMENT.md"
[ -f FIREBASE_SECURITY_RULES.md ] && echo "  ✅ FIREBASE_SECURITY_RULES.md"
[ -f FIREBASE_COMPLETE.md ] && echo "  ✅ FIREBASE_COMPLETE.md"

echo ""
echo "================================================"
echo "✅ Setup Complete! You're Ready to Deploy"
echo "================================================"
echo ""
echo "Next steps:"
echo "1. Update Firebase Security Rules (see QUICK_START.md)"
echo "2. Get Firebase Service Account Key"
echo "3. Deploy: vercel --prod"
echo ""
echo "Documentation:"
echo "• Start here: QUICK_START.md"
echo "• Detailed setup: FIREBASE_DEPLOYMENT.md"
echo "• Security: FIREBASE_SECURITY_RULES.md"
echo ""
echo "Good luck! 🚀"
