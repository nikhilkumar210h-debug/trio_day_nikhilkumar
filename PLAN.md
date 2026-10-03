# Trio Day — 8-Stage Product Master Plan

> **Source of truth:** This file is the canonical product roadmap and change-control plan for Trio Day.
>
> **Core principle:** AI agents implement only the explicitly authorized stage/task. They do not independently pivot the product, delete existing systems, or deploy to production.
>
> **Product north star:** “One small meaningful thing I do every day with a few people.”

---

# STAGE 1 — Stabilize the existing app

### Goal

Pehle ye prove karna hai ki jo currently important loop hai woh reliable hai.

Order:

**Auth**
 → **Today**
 → **Daily Question**
 → **Challenge**
 → **XP/Streak**
 → **Discover**
 → **Navigation/mobile**

Browser QA already humein kuch issues de chuka hai, lekin OpenCode ko **localhost + actual production** par reproduce karke root cause establish karna hai.

### Is stage mein kya hoga

**1. Firebase auth error**

`onAuthStateChanged` problem ko reproduce → exact import/version issue find → minimal fix.

**2. XP/Streak**

Ye specially carefully test hoga:

Fresh account:

`0 XP → answer challenge → reward → reload`

Existing test account:

`existing XP → answer → reload`

Aur localhost CORS bhi.

Tumhara **550 XP observation preserve** rehna chahiye. Fresh account zero hona automatically “XP system totally broken” nahi maana jayega.

**3. Daily Question**

Abhi:

> Question dikhta hai → answer action missing.

Isko later hum simple:

> Question → answer → feedback → continue

banayenge.

**4. Discover**

Cold account ko dead end nahi banana.

**5. Navigation**

`CHALLE…`, headings, responsive issues.

### Exit condition

Jab tak:

- important console errors clear nahi
- critical flow reliable nahi
- mobile usable nahi

tab tak **Study Rooms build nahi karna**.

---

# STAGE 2 — Product simplification

Ye **Stage 1 ke baad**, aur tumhari approval ke baad.

Current philosophy:

### Keep

**Challenges**

Core interaction.

### Keep

**Daily Question**

Entry hook.

### Keep

**You/Profile**

Progress identity.

### Keep

**Chat**

But supporting feature.

### Defer/remove from active product

**Stories**

**10-min Opposite Chat**

**Heavy leaderboard emphasis**

Reason ye nahi ki features “bad” hain. Reason hai ki abhi user ko too many disconnected surfaces mil rahe hain aur low-user state mein ye value create nahi kar rahe.

### Important

Yahan bhi **pehle archive/reference check, phir deletion**.

OpenCode ko kabhi:

> “delete all old stuff”

nahi bolna.

Usko:

> “prepare removal plan, list dependencies, wait”

bolna hai.

---

# STAGE 3 — UI/UX redesign

**Ye bahut important hai aur abhi tak properly hua hi nahi hai.**

Main nahi chahta ki OpenCode ko:

> “Make UI premium.”

bol diya jaye.

Usse wahi patchwork hoga.

### Pehle ek Design System Lock hoga

Ek common system:

**Typography**

Inter + Space Grotesk.

**Buttons**

Primary
 Secondary
 Ghost

Bas.

**Cards**

Content
 Action
 Progress

Bas.

**Spacing**

4px scale.

**Radius**

small controls / normal cards / hero ke fixed values.

**Motion**

subtle.

**Themes**

Light + Dark same design language.

**Mobile**

390px ko first-class viewport.

---

## Uske baad page order

### 1. Today

Ye sabse important screen hai.

Desired hierarchy:

**Aaj ka sawal**

↓

**Aaj ka Challenge**

↓

**Tumhari progress**

↓

**Study Room**

Today ko giant dashboard nahi banana.

---

### 2. Challenge

Desired flow:

**Question**

↓

**Choose**

↓

**Result**

↓

**Discuss**

↓

**Next**

Current card mein bahut actions ek saath aa jaate hain. Isko simplify karenge.

---

### 3. You

Show:

**XP**
 **Streak**
 **Recent activity**
 **Room progress**

Not 15 competing metrics.

---

### 4. Discover

People directory ki jagah:

**Things worth joining**

Examples:

> Today's Challenge
> Active Study Room
> People answering same topic

Yaani activity first.

---

### 5. Create

Current large builder ko simplify:

**Question → Format → Choices → Publish**

Optional stuff secondary.

---

### 6. Chat

Existing relationship/conversation ke context mein useful.

Zero users mein blank page ko main product loop nahi banayenge.

---

# STAGE 4 — Study Streak Rooms

Ab actual pivot experiment.

**Challenges delete nahi honge.**

New tab:

**Rooms**

Feature flag ke peeche.

### Room

3–6 people.

Har person:

> Today's Goal: Maths — 30 min

Complete:

✅

Room:

`3/5 completed`

Shared streak:

🔥 12 days

Lekin user alone bhi:

> goal set → timer → complete

kar sake.

Ye **solo-first** rule bahut important hai.

---

# STAGE 5 — Daily loop

Yahan actual product identity banegi.

Morning:

**“Aaj kya karoge?”**

User chooses goal.

↓

Study.

↓

Complete.

↓

**+XP**

**🔥 streak**

**Room progress**

↓

Optional:

**Share weekly recap**

↓

Next day.

Matlab:

**Trigger → Action → Reward → Investment → Return**

---

# STAGE 6 — WhatsApp growth

Tumhara audience India mein hai aur zero ad budget hai.

Isliye growth mechanism:

**Product result → share**

not:

**“Invite all contacts.”**

Example weekly card:

> **My Study Week**
>
> 5/7 days completed
> 3.5 hours focused
> Room streak: 14 days

User manually WhatsApp par share kare.

Friend joins.

Friend creates/joins room.

Loop repeat.

---

# STAGE 7 — Real-user pilot

Yahan AI guessing band.

20–30 genuine users.

7 days.

Har user ke liye:

`signup`

→ `first goal`

→ `D1`

→ `D7`

→ `room activation`

→ `invite`

→ `XP/streak success`

record hoga.

### Sabse important metric

**Kitne users bina tumhare manually remind kiye next day wapas aaye?**

Feature count irrelevant.

---

# STAGE 8 — Product decision

7-day data ke baad teen possibilities hain.

### Case A

Rooms mein users repeatedly return karte hain.

→ Rooms ko main product banaya ja sakta hai.

### Case B

Challenges work better, Rooms weak.

→ Challenge-first continue.

### Case C

Dono weak.

→ Problem product concept ke deeper level par hai; phir onboarding/audience/value proposition rethink.

Hum pehle se winner decide nahi karenge.

---

# Ab kaun kya karega?

| Kaam | Main | OpenCode | Browser Use |
| --- | --- | --- | --- |
| Product strategy | ✅ | | |
| UX architecture | ✅ | | |
| Design rules | ✅ | | |
| Code implementation | | ✅ | |
| Refactoring | | ✅ | |
| Local tests | | ✅ | |
| Production browser QA | | | ✅ |
| Mobile visual verification | | | ✅ |
| Final product decision | ✅ + data | | evidence |
| Delete anything | approval required | ❌ by default | inspect only |
| Production deploy | approval required | ❌ by default | verify |

Yaani **main brain/architect**, OpenCode **builder**, Browser Use **real-user tester**.

---

# AI agents ko future mein kaise use karna hai

Ek giant prompt:

> “Audit, redesign, pivot, fix, deploy everything.”

**Kabhi nahi.**

Instead:

### Task 1

Audit.

### Task 2

Fix Stage 1.

### Task 3

Browser verify.

### Task 4

Design system.

### Task 5

Today redesign.

### Task 6

Challenge redesign.

### Task 7

Rooms.

### Task 8

Pilot.

Har task ke baad:

**diff → browser → approve**

---

# Sabse important rule

### `PLAN.md` = source of truth

Har future OpenCode session ke start mein:

> Read `PLAN.md` and `README.md` first.

Phir:

> “Which stage are you implementing?”

Aur agent ko exact stage ke bahar **kuch nahi karna**.

Isse woh kal ko ye nahi bolega:

> “I found 58 unused files, so I deleted them.”

😄

---

# Current execution rule

**Aaj sirf Stage 1.**

Stage 1 ke exit condition pass hone se pehle:

- Study Rooms build nahi karna.
- Product pivot implement nahi karna.
- Stage 2 deletions/simplifications nahi karna.
- Stage 3 visual redesign start nahi karna.

Har Stage 1 change ke baad:

**diff → tests → production/browser evidence → approve**

---

# Production / architecture guardrails

Current deployment architecture ko bina explicit approval change nahi karna:

- **Frontend / canonical production:** Cloudflare Workers
- **Backend/API:** Render-hosted Flask backend
- **Auth + database:** Firebase Authentication + Firestore
- **Media:** Cloudinary where configured
- **Notifications:** Existing OneSignal/notification Worker where configured

Canonical production URL:

`https://trio-day.trioday-nikhil.workers.dev/`

Legacy Firebase Hosting URL `https://nkm-ind.web.app/` current production nahi hai.

### No silent deletion rule

Koi existing feature, file, Firestore collection/data, Worker, backend component, deployment configuration, Firebase rule, ya production configuration bina **specific approval** ke delete, disable, rename, replace, ya migrate nahi karna.

Pehle:

**inspect → dependency/reference check → removal plan → approval → removal**

---

# README alignment

`README.md` ko architecture aur current implementation reference ke liye maintain kiya jayega.

Koi roadmap conflict aaye to:

**PLAN.md product/stage decision control karta hai.**

README ko implementation/deployment documentation ke roop mein aligned rakha jayega.

---

# Current Stage Status

**Stage 1 — In progress**

Verified/passing work so far includes the major Auth observer issue, XP/streak reward flow, Daily Question persistence/auth refresh, text-only Story permission flow, 390px navigation, Notifications heading, and Opposite Chat initial room access/creation.

Production Discover/cold-start verification now passes: Challenges/Connect/Create are understandable, read-only people search shows an explicit empty state, and 390px Discover has no horizontal overflow. The remaining Stage 1 gate is the final localhost/OpenCode verification plus consolidation of the production exit matrix before Stage 1 is marked complete.

**Stage 2 — Locked until Stage 1 exit + explicit approval.**

**Stage 3 — Locked until Stage 2 decision/approval.**

**Stage 4 — Locked until Stage 3 design/build decision.**

**Stage 5–8 — Locked until real-user evidence makes them appropriate.**
