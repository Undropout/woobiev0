# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Woobie is a matchmaking web application with a multi-tier interaction system. Users progress through stages (name-picker → interests/dealbreakers → bio → waiting → tier1a → tier1b → tier2 → tier3 → chatroom), with Firebase Cloud Functions handling matchmaking logic based on interests, gender preferences, and dealbreakers.

**Tech Stack:**
- Frontend: Vanilla JavaScript (ES6 modules), Vite for dev/build
- Backend: Firebase (Realtime Database, Auth, Cloud Functions v2, Storage)
- Email: SendGrid
- Deployment: Firebase Hosting for frontend (woobie.fun), Firebase for backend

## Development Commands

### Frontend Development
```bash
# Install dependencies
npm install

# Run dev server (Vite)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Deploy frontend (see "Deployment & Infrastructure Decisions" section below)
npm run build && firebase deploy --only hosting
```

### Firebase Functions Development
```bash
# Navigate to functions directory
cd functions

# Install function dependencies
npm install

# Lint functions code
npm run lint

# Start Firebase emulator for local testing
npm run serve

# Deploy functions to Firebase
npm run deploy

# View function logs
npm run logs
```

### Firebase CLI Commands
```bash
# Login to Firebase
firebase login

# Deploy everything
firebase deploy

# Deploy only functions
firebase deploy --only functions

# Deploy only hosting
firebase deploy --only hosting
```

## Architecture & Data Flow

### State Management & Routing

The application uses **localStorage** and Firebase Realtime Database for state management. The `resume.html` page is the central routing hub that determines where authenticated users should be based on their `currentMatch.stage` value in the database.

**Key localStorage items:**
- `woobieUID`: User's Firebase Auth UID
- `woobieMatchID`: Current match ID (set when matched)
- `woobieUsername`: User's chosen Woobie name
- `woobieBio`, `woobieInterests`, `woobieDealbreakers`: Profile data

**Stage progression mapping** (defined in `resume.html:21-35`):
- `name-picker` → `/name-picker/index.html`
- `interests-dealbreakers` → `/interests-dealbreakers/index.html`
- `waiting_in_queue` → `/interests-dealbreakers/waiting.html`
- `bio` → `/bio/index.html`
- `tier1a` → `/tier1a/index.html`
- `tier1a-bios-revealed` → `/tier1a/reveal-bios.html`
- `tier1b` → `/tier1b/index.html`
- `tier2` → `/tier2/index.html`
- `tier2-complete` → `/tier2/send.html`
- `tier2-reveal` → `/tier2/reveal.html`
- `tier3` → `/tier3/index.html`
- `chatroom` → `/chat/index.html`

### Firebase Database Structure

```
/users/{uid}
  ├── stage: string (user's current progression stage)
  ├── email: string
  ├── lastDailyEmail: string (date in ISO format)
  └── currentMatch
      ├── matchID: string
      ├── stage: string (current match stage)
      └── username: string (user's Woobie name)

/queue/{uid}
  ├── woobieName: string
  ├── gender: string
  ├── lookingForGender: array
  ├── interests: array
  ├── dealbreakers: array
  ├── mode: string
  └── potentialMatchIDForUser: string

/matches/{matchID}
  ├── users: {uid: woobieName, uid: woobieName}
  ├── modes: {uid: {mode: string}}
  ├── profiles/{uid}: {interests, dealbreakers, gender, lookingForGender, woobieName, bio}
  ├── tier1aAnswers/{uid}: array or {answers: array}
  ├── tier1aVotes/{uid}: boolean
  ├── tier1bAnswers/{uid}: array
  ├── tier1bVotes/{uid}: boolean
  ├── tier2/{uid}: {imageUrl, prompt, submittedAt}
  ├── tier3Answers/{uid}: array
  └── createdAt: timestamp
```

### Matchmaking Flow (Cloud Functions)

**advancedMatchmaker** (`functions/index.js:255-466`):
- Triggered when a user is added to `/queue/{uid}`
- Gender matching uses **normalized values** (lowercase, underscores, see `normalizeGender` at line 169)
- Requires at least **1 common interest** between users (line 337)
- Uses the **triggering user's `potentialMatchIDForUser`** as the final matchID
- Sets custom claims (`matchAccess` array) for security rules
- Updates both users' `/users/{uid}/currentMatch` to stage `"bio"`
- Removes matched users from queue

**setMatchClaims** (`functions/index.js:194-249`):
- Triggered when `/matches/{matchID}/users` is written
- Sets Firebase Auth custom claims for security rules
- Appends matchID to user's `matchAccess` array

### Email Notifications

**Match notification** (`sendMatchNotification`, line 27):
- Triggers when `currentMatch.stage` transitions to `'bio'`
- Sends email via SendGrid when users first match

**Chatroom notification** (`sendChatroomNotification`, line 96):
- Triggers when `currentMatch.stage` transitions to `'chatroom'`
- Sends email when users complete all tiers

**Daily nudge emails** (`sendDailyNudgeEmails`, line 477):
- Scheduled function (10 AM UTC daily)
- Uses `DailyNudgeEmailService` from `functions/email/daily-nudge-email.js`
- Tracks `lastDailyEmail` in user's database node to prevent duplicates
- Manual test endpoint: `sendTestNudgeEmail` (callable function)

### Authentication & Security

`router.js` runs on every page and:
- Redirects unauthenticated users to `/auth/login.html`
- Redirects authenticated users on landing/auth pages to `/resume.html`

Firebase security rules rely on **custom claims** (`matchAccess` array) set by Cloud Functions to control read/write access to `/matches/{matchID}/*` paths.

## Deployment & Infrastructure Decisions

### ⚠️ CRITICAL: Frontend Hosting (DO NOT USE GITHUB PAGES)

**Decision Date:** Late 2024/Early 2025

**GitHub Pages has been ABANDONED** due to persistent, unresolvable issues:
- Pages not updating/refreshing after deployments
- Live updates failing consistently
- Domain configuration problems
- Buggy behavior that blocked production releases

**Current Setup:** Firebase Hosting at **woobie.fun**
- Deploy: `npm run build && firebase deploy --only hosting`
- Configuration: `firebase.json` (hosting section)
- Custom domain: Configured via Firebase Console

**IMPORTANT:** The `package.json` still contains an old `npm run deploy` script that uses `gh-pages`. **DO NOT USE IT.** Always use Firebase Hosting for all deployments.

### ⚠️ CRITICAL: Question Pool System (Tier1a/Tier1b)

**NEVER revert to static hardcoded questions.**

**Problem:** During bug fixes and refactoring, the tier question system has reverted to 36 static fixed questions multiple times. This breaks the intended user experience.

**Required behavior:** Questions must be **randomly selected from a question pool** for each match.

**Files to watch:**
- `tier1a/tier1a.js` - Currently has 6 static questions (lines 14-21), should pull from pool
- `tier1b/tier1b.js` - Currently has 6 static questions (lines 13-20), should pull from pool

**When making ANY changes to tier files:**
1. Check that questions are being pulled randomly from a pool
2. Do NOT hardcode question arrays directly in the tier files
3. Verify the randomization logic is intact before committing

If you find static question arrays during development, this is a regression that needs to be fixed immediately.

## Important Development Notes

### Configuration Files

**Firebase config** is in `shared/firebase-config.js`. The `.gitignore` includes `firebase-config.js`, but it's currently committed (contains API keys). The `.env` file should contain SendGrid credentials for Cloud Functions.

**SendGrid setup** (functions):
- API key: Set via `firebase functions:config:set sendgrid.key="YOUR_KEY"`
- From email: Set via `firebase functions:config:set sendgrid.from="noreply@woobie.app"`
- Check with `firebase functions:config:get`

### Working with Tiers

Each tier (tier1a, tier1b, tier2, tier3) has its own:
- Question/prompt system
- Answer storage in `/matches/{matchID}/tier{X}Answers/` or `/matches/{matchID}/tier{X}/`
- Vote/approval system in `/matches/{matchID}/tier{X}Votes/`
- Stage progression logic that updates both users' `currentMatch.stage`

**Tier1a** (`tier1a/tier1a.js`):
- 6 questions (line 14-21)
- Answers stored at `/matches/{matchID}/tier1aAnswers/{uid}`
- Supports both array format and object format with `answers` property (line 52-53)
- Vote system (`tier1aVotes`) determines progression to tier1b

**Tier2** (`tier2/`):
- Image upload (send.html) with emoji overlay system
- Uses Firebase Storage for images
- Reveal system (reveal.html) shows partner's image

**Tier3** (`tier3/tier3.js`):
- Video/audio recording capability
- Final tier before chatroom access

### Common Pitfalls

1. **Gender normalization**: Always use `normalizeGender()` and `normalizeLookingFor()` when working with matchmaking logic. Values must be lowercase with underscores (e.g., `"prefer_not_to_say"`).

2. **Stage updates**: When advancing users to a new stage, update BOTH:
   - `/users/{uid}/currentMatch/stage`
   - Potentially `/users/{uid}/stage` (for non-matched stages)

3. **MatchID propagation**: The matchID comes from the **newly queued user's** `potentialMatchIDForUser`, not generated randomly. This ensures `waiting.html` listeners work correctly.

4. **Custom claims refresh**: After Cloud Functions set custom claims, clients may need to refresh their ID token: `await auth.currentUser.getIdToken(true)`

5. **Firebase Functions environment**: Use Node.js 22 (specified in `functions/package.json:13`). Functions use v2 API (`firebase-functions/v2`).

## Testing

No automated test suite exists. Manual testing workflow:
1. Run `npm run dev` for frontend
2. Run `cd functions && npm run serve` for local Firebase emulators
3. Test matchmaking by creating two accounts in separate browsers/incognito windows
4. Check Cloud Functions logs with `firebase functions:log` or in Firebase Console
