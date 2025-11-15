# Woobie: Post-Compression Verification Checklist

**Purpose:** When a Claude conversation gets compressed due to context window limits, use this checklist to verify that critical implementations haven't been reverted or lost.

**Instructions:** Run through this checklist at the start of any new conversation continuation to ensure all systems are still functioning correctly.

---

## 🔐 Authentication & User Flow

- [ ] **Firebase Auth is working**
  - Test signup at `/auth/signup.html`
  - Test login at `/auth/login.html`
  - Verify UID stored in localStorage as `woobieUID`

- [ ] **Resume.html routing works**
  - Navigate to `/resume.html` after login
  - Confirm automatic redirect based on `currentMatch.stage`
  - Test with different stage values (name-picker, bio, tier1a, chatroom, etc.)

- [ ] **Logout functionality intact**
  - Click logout button
  - Verify redirect to login page
  - Confirm localStorage cleared

---

## 🎯 Matching System

- [ ] **Queue system operational**
  - Navigate to `/interests-dealbreakers/waiting.html`
  - Verify user added to `/queue/{uid}` in Firebase
  - Confirm queue entry has: interests, gender, lookingForGender, mode, potentialMatchIDForUser

- [ ] **advancedMatchmaker Cloud Function running**
  - Check Firebase Console → Functions
  - Verify function deploys successfully: `firebase deploy --only functions:advancedMatchmaker`
  - Test matching by having 2 users with shared interests enter queue
  - Confirm both users removed from queue when matched
  - Verify `/matches/{matchID}/users` created with both UIDs

- [ ] **Gender normalization working**
  - Test matching with "Woman" ↔ "Women" (should match)
  - Test matching with "Non-binary" ↔ "Non-Binary" (should match)
  - Test matching with gender set to "Prefer not to say" (should skip gender check)

- [ ] **Interest overlap check working**
  - Verify users need ≥1 shared interest to match (configurable)
  - Test with 0 shared interests (should not match)

---

## 📝 Tier System

### Tier 1a
- [ ] **Question randomization works**
  - Enter tier1a (`/tier1a/index.html`)
  - Verify `/matches/{matchID}/tier1Questions` created with 12 questions
  - Confirm first user (lexicographically) generates questions
  - Verify second user retrieves same questions

- [ ] **Answer submission works**
  - Answer all 6 questions
  - Verify answers saved to `/matches/{matchID}/tier1a/{uid}/answers`
  - Check `woobieName` also saved

- [ ] **Draft system works**
  - Start answering, don't finish
  - Refresh page
  - Verify answers restored from `/matches/{matchID}/tier1aDrafts/{uid}`

- [ ] **Voting works**
  - Both users complete tier1a
  - Both vote "yes"
  - Verify redirect to `/tier1a/reveal-bios.html`
  - Verify bios revealed from `/matches/{matchID}/bios/{uid}`

### Tier 1b
- [ ] **Question retrieval works**
  - Verify tier1b uses questions 6-11 from `/matches/{matchID}/tier1Questions`

- [ ] **Optional message works**
  - Test sending optional 250-word message
  - Verify saved to `/matches/{matchID}/tier1bLetters/{uid}`

- [ ] **Voting works**
  - Both users complete tier1b
  - Both vote "yes"
  - Verify redirect to tier2

### Tier 2
- [ ] **12 questions randomized**
  - Verify `/matches/{matchID}/tier2Questions` created with 12 questions

- [ ] **Extra glimpse upload works**
  - Navigate to `/tier2/send.html`
  - Test text-only glimpse
  - Test image upload (verify Firebase Storage path: `/matches/{matchID}/...`)
  - Test voice recording upload
  - Verify all saved to `/matches/{matchID}/tier2Rewards/{uid}`

- [ ] **Image processing works**
  - Upload image at `/tier2/send.html`
  - Verify downscale to 128x128px
  - Test emoji overlay (20+ options)
  - Test contrast adjustment (-100 to +100)
  - Test color tint (green, cyan, orange, magenta)

- [ ] **Reveal works**
  - Both users complete tier2
  - Navigate to `/tier2/reveal.html`
  - Verify partner's glimpse displayed (text, image, audio)

### Tier 3
- [ ] **12 questions randomized**
  - Verify `/matches/{matchID}/tier3Questions` created with 57-question bank

- [ ] **Final voting works**
  - Both users complete tier3
  - Both vote "yes"
  - Verify redirect to `/chat/index.html`

---

## 💬 Chatroom

- [ ] **Chat messages send/receive**
  - Send text message
  - Verify saved to `/matches/{matchID}/chat/{messageId}`
  - Verify `senderUID`, `sender`, `text`, `timestamp` fields

- [ ] **Image upload works**
  - Upload image in chat
  - Verify uploaded to Firebase Storage
  - Verify `imageURL` saved in chat message

- [ ] **Voice message works**
  - Record voice message
  - Verify uploaded to Firebase Storage
  - Verify `audioURL` saved in chat message

- [ ] **"Our Story So Far" modal works**
  - Click "Our Story So Far" button
  - Verify modal displays:
    - Both users' bios
    - All tier1a answers (side-by-side)
    - All tier1b answers
    - All tier2 answers
    - Tier2 extra glimpses

---

## 🎨 Woobiecore Aesthetic

- [ ] **Monochrome emoji rendering**
  - Verify all emojis display as `#ffb000` amber color
  - Check `.woobie-emoji` CSS class applied
  - Test in Firefox and Chrome
  - Verify OpenMoji font loaded from `/shared/OpenMoji-black-glyf.ttf`

- [ ] **Color palette intact**
  - Background: `#000000` (black)
  - Primary: `#33ff33` (green)
  - Secondary: `#00ffff` (cyan)
  - Emoji: `#ffb000` (amber)

- [ ] **Font loading works**
  - Atkinson Hyperlegible for body text
  - OpenMoji for emoji

---

## 📧 Email System

- [ ] **Match notification emails work**
  - User gets matched
  - Verify email sent to both users
  - Check SendGrid dashboard for delivery

- [ ] **Chatroom notification emails work**
  - Users unlock chatroom
  - Verify email sent to both users

- [ ] **Daily nudge emails work**
  - Check `/functions/email/daily-nudge-email.js` deployed
  - Verify scheduled function runs at 10 AM UTC
  - Test with `/email-testing/index.html`
  - Confirm `lastDailyEmail` prevents duplicates

---

## 🔒 Security & Database Rules

- [ ] **Database rules deployed**
  - Run: `firebase deploy --only database`
  - Verify latest rules in Firebase Console

- [ ] **Users can only read/write own data**
  - Test: User A cannot read `/users/{user_B_uid}`
  - Test: User A cannot write to `/users/{user_B_uid}`

- [ ] **Match access enforced**
  - Test: User A with matchID `abc123` can read `/matches/abc123/*`
  - Test: User C with matchID `xyz789` CANNOT read `/matches/abc123/*`

- [ ] **Custom claims working**
  - Check `/functions/index.js` → `setMatchClaims` function deployed
  - Verify `matchAccess` array added to user token when matched
  - Test by checking Firebase Auth console → Users → Custom Claims

- [ ] **Firebase Storage rules enforced**
  - Test: User A can upload to `/matches/{their_matchID}/...`
  - Test: User A CANNOT upload to `/matches/{other_matchID}/...`

---

## 🛠️ Name Picker & Referral System

- [ ] **Woobie name generation works**
  - Navigate to `/name-picker/index.html`
  - Click "Generate" multiple times
  - Verify unique names generated (e.g., "Cheerful Breezy Crab 🦀")

- [ ] **Referral code generation works**
  - Click "Generate Referral Code"
  - Verify code saved to `/referralCodes/{code}`
  - Verify code format: 8-character alphanumeric

- [ ] **Referral code validation works**
  - Enter valid referral code
  - Verify code marked as used in `/referralCodes/{code}/usedBy`
  - Test invalid code (should show error)

---

## 📊 Analytics & Monitoring

- [ ] **Firebase Analytics enabled**
  - Check Firebase Console → Analytics

- [ ] **Cloud Functions logs accessible**
  - Check Firebase Console → Functions → Logs
  - Verify errors logged properly

---

## 🐛 Known Issues Check

Verify these known issues are still tracked and haven't been accidentally "fixed" in a way that breaks other things:

- [ ] **Multi-match NOT supported** (intentional limit)
  - Verify users can only have 1 active match
  - Test: Cannot match with 2nd person while in active match

- [ ] **Referral codes don't affect matching** (future feature)
  - Verify referral codes stored but not used in `advancedMatchmaker`

- [ ] **No rematch prevention** (design decision pending)
  - Verify users CAN match with same person twice (no blocking)

- [ ] **Chatroom media limits not enforced** (known bug)
  - Note: Unlimited image/voice uploads in chat (should be rate-limited)

---

## 🚀 Deployment Verification

**CRITICAL: We use FIREBASE HOSTING ONLY. DO NOT use GitHub Pages or `npm run deploy`.**

- [ ] **Frontend deployed**
  - Run: `npm run build`
  - Run: `firebase deploy --only hosting`
  - Verify site accessible at production URL

- [ ] **Backend deployed**
  - Run: `cd functions && npm run deploy`
  - OR: `firebase deploy --only functions`
  - Verify all functions deployed in Firebase Console

- [ ] **Environment variables set**
  - Run: `firebase functions:config:get`
  - Verify `sendgrid.key` and `sendgrid.from` set

---

## 🧪 End-to-End Test

Run through a complete user journey to ensure nothing broke:

1. [ ] Sign up new user (User A)
2. [ ] Generate Woobie name
3. [ ] Select interests + gender preferences
4. [ ] Write bio
5. [ ] Enter queue
6. [ ] Sign up 2nd user (User B) with shared interest
7. [ ] Verify both users matched
8. [ ] Complete tier1a (both users)
9. [ ] Vote yes (both users)
10. [ ] View bios
11. [ ] Complete tier1b (both users)
12. [ ] Vote yes (both users)
13. [ ] Complete tier2 (both users)
14. [ ] Send extra glimpse (both users)
15. [ ] Vote yes (both users)
16. [ ] Complete tier3 (both users)
17. [ ] Vote yes (both users)
18. [ ] Send chat messages
19. [ ] Upload image in chat
20. [ ] View "Our Story So Far"

---

## 📋 Quick Command Reference

```bash
# Deploy everything to Firebase (CORRECT WAY)
firebase deploy

# Deploy only hosting (frontend) to Firebase
firebase deploy --only hosting

# Deploy only functions to Firebase
firebase deploy --only functions

# Deploy only database rules
firebase deploy --only database

# Check function logs
firebase functions:log

# Get environment config
firebase functions:config:get

# Set SendGrid config
firebase functions:config:set sendgrid.key="SG.xxx"
firebase functions:config:set sendgrid.from="noreply@woobie.app"

# Local development
npm run dev  # Frontend (Vite)
firebase emulators:start  # Backend emulators
```

**DO NOT RUN:**
- ❌ `npm run deploy` (this is for GitHub Pages, which we don't use)
- ❌ `gh-pages -d dist` (we don't use GitHub Pages)

---

## 🆘 What to Do If Something Broke

### If Firebase Functions aren't working:
```bash
cd functions
npm install
firebase deploy --only functions
firebase functions:log  # Check for errors
```

### If database rules broke:
```bash
firebase deploy --only database
# Check Firebase Console → Realtime Database → Rules
```

### If frontend routing broke:
1. Check `/resume.html` logic
2. Verify `currentMatch.stage` values in Firebase match expected stages
3. Test with browser console open to see redirect logs

### If email system broke:
1. Check SendGrid API key: `firebase functions:config:get`
2. Verify Cloud Functions deployed: `firebase deploy --only functions:sendMatchNotification,sendChatroomNotification,sendDailyNudgeEmails`
3. Check SendGrid dashboard for delivery errors

### If matching stopped working:
1. Check Cloud Functions logs: `firebase functions:log`
2. Verify `advancedMatchmaker` deployed: `firebase deploy --only functions:advancedMatchmaker`
3. Check `/queue` in Firebase Console → Realtime Database
4. Verify both users have shared interests

---

## 📝 Notes for New Claude Sessions

When starting a new conversation after compression:

1. **Upload this checklist** to the conversation
2. **Upload the design document** (`DESIGN_DOCUMENT.md`)
3. **Describe the specific issue** you're working on
4. **Run relevant sections** of this checklist to verify baseline functionality
5. **Reference specific line numbers** in code files when discussing bugs

**Example prompt for new session:**
```
I'm working on Woobie (friendship/connection app). The conversation got compressed.

Attached:
1. DESIGN_DOCUMENT.md (full technical spec)
2. VERIFICATION_CHECKLIST.md (this file)

Current issue: [describe problem]

I've verified the following sections work:
- ✅ Authentication & User Flow
- ✅ Matching System
- ❌ Tier 2 image upload (THIS IS THE PROBLEM)

Here's the relevant code: [paste code]
```

---

**Last Updated:** November 15, 2025
**Maintained By:** Woobie Development Team
**Version:** 1.1
