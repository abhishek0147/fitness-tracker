# FitTrack Undo Changes - Progress Tracker

## Plan Steps (Approved: Undo ALL AI changes - Firebase, Vercel, neon extras)

- [x] 1. Create this TODO.md
- [ ] 2. Backup modified files (package.json, login.html, live-tracker-neon.html, src/app.js)
- [ ] 3. Delete ALL new Firebase/Vercel files (firebase-rules.json, src/services/firebaseService.js, vercel.json, .vercel/, all FIREBASE_*.md, DEPLOYMENT_READY.md, QUICK_START.md, etc.)
- [ ] 4. Revert package.json: remove firebase-admin, vercel scripts, restore original deps/scripts
- [ ] 5. Read and revert src/app.js: remove Firebase initialization
- [ ] 6. Revert login.html: remove Firebase SDK/scripts/config/Google auth, restore simple API-only login
- [ ] 7. Clean HTML CSS if needed (remove excessive neon), check other HTMLs
- [ ] 8. Revert any routes/middleware changes (auth.js, etc.)
- [ ] 9. Clean install: rm -rf node_modules package-lock.json && npm install
- [ ] 10. Test: npm run dev, python3 -m http.server 8080, verify core API/login works without Firebase
- [ ] 11. attempt_completion

