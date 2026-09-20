# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: qa-audit.spec.js >> Trio Day QA Audit >> Discover page - four lanes only (mobile)
- Location: qa-audit.spec.js:109:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.goto: Test timeout of 30000ms exceeded.
Call log:
  - navigating to "http://localhost:5500/all-users.html", waiting until "networkidle"

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - banner [ref=e2]:
    - generic [ref=e3]:
      - link "☸ trio_day" [ref=e4] [cursor=pointer]:
        - /url: index.html
        - generic [ref=e5]: ☸
        - strong [ref=e7]: trio_day
      - generic [ref=e8]:
        - button "Search" [ref=e9] [cursor=pointer]
        - button "Notifications" [ref=e14] [cursor=pointer]
        - button "Switch to dark mode" [ref=e17] [cursor=pointer]: 🌙
        - link "Chat" [ref=e18] [cursor=pointer]:
          - /url: chat.html
        - link "Login" [ref=e22] [cursor=pointer]:
          - /url: login.html
  - main [ref=e23]:
    - generic [ref=e24]:
      - generic [ref=e25]:
        - generic [ref=e26]: ✦
        - text: FORGE · TRIO DAY
      - heading "What do you want to do?" [level=1] [ref=e27]
      - paragraph [ref=e28]: Pick a lane. Find something worth doing.
      - generic [ref=e29]:
        - generic [ref=e30]: MAKE
        - generic [ref=e31]: SOLVE
        - generic [ref=e32]: LEARN
        - generic [ref=e33]: PLAY TOGETHER
    - generic [ref=e34]:
      - generic [ref=e36]:
        - heading "Choose your lane" [level=2] [ref=e37]
        - paragraph [ref=e38]: Filter fast. Start faster.
      - generic [ref=e39]:
        - link "🛠️ Build Make something small together in 15–30 minutes. ↗" [ref=e40] [cursor=pointer]:
          - /url: build.html
          - generic [ref=e41]: 🛠️
          - generic [ref=e42]:
            - strong [ref=e43]: Build
            - generic [ref=e44]: Make something small together in 15–30 minutes.
          - generic [ref=e45]: ↗
        - link "🧠 Learn Learn by explaining, testing and teaching back. ↗" [ref=e46] [cursor=pointer]:
          - /url: learn.html
          - generic [ref=e47]: 🧠
          - generic [ref=e48]:
            - strong [ref=e49]: Learn
            - generic [ref=e50]: Learn by explaining, testing and teaching back.
          - generic [ref=e51]: ↗
        - link "⚡ Challenge Race the clock, score points and compete live. ↗" [ref=e52] [cursor=pointer]:
          - /url: challenge.html
          - generic [ref=e53]: ⚡
          - generic [ref=e54]:
            - strong [ref=e55]: Challenge
            - generic [ref=e56]: Race the clock, score points and compete live.
          - generic [ref=e57]: ↗
        - link "🧩 Puzzle Split clues, debate deductions and crack it together. ↗" [ref=e58] [cursor=pointer]:
          - /url: puzzle.html
          - generic [ref=e59]: 🧩
          - generic [ref=e60]:
            - strong [ref=e61]: Puzzle
            - generic [ref=e62]: Split clues, debate deductions and crack it together.
          - generic [ref=e63]: ↗
    - generic [ref=e64]:
      - generic [ref=e65]:
        - generic [ref=e66]:
          - heading "Try something now" [level=2] [ref=e67]
          - paragraph [ref=e68]: Built-in + community.
        - textbox "Search activities" [ref=e69]:
          - /placeholder: Search activities…
      - generic "Activity types" [ref=e70]:
        - button "Everything" [ref=e71] [cursor=pointer]
        - button "🛠️ Build" [ref=e72] [cursor=pointer]
        - button "🧠 Learn" [ref=e73] [cursor=pointer]
        - button "⚡ Challenge" [ref=e74] [cursor=pointer]
        - button "🧩 Puzzle" [ref=e75] [cursor=pointer]
      - generic [ref=e76]: 60 activities ready
      - generic [ref=e77]:
        - article [ref=e78]:
          - generic [ref=e81]: 🧩
          - generic [ref=e84]:
            - generic [ref=e85]:
              - generic [ref=e86]:
                - generic [ref=e87]: Puzzle
                - generic [ref=e88]: Mystery
              - generic [ref=e89]: ↗
            - generic [ref=e90]: SOLVE IT
            - heading "The Missing Notebook" [level=3] [ref=e93]
            - paragraph [ref=e94]: Build one suspect theory from separate clues.
            - generic [ref=e95]:
              - generic [ref=e96]: ⏱ 20 min
              - generic [ref=e97]: 👥 2–6
              - generic [ref=e98]: Medium
            - generic [ref=e99]:
              - generic [ref=e100]: by Trio Day
              - generic [ref=e101]:
                - link "View" [ref=e102] [cursor=pointer]:
                  - /url: activity.html?id=p1
                - link "Find a room" [ref=e103] [cursor=pointer]:
                  - /url: rooms.html?taskId=p1&source=catalog
        - article [ref=e104]:
          - generic [ref=e107]: 🧩
          - generic [ref=e110]:
            - generic [ref=e111]:
              - generic [ref=e112]:
                - generic [ref=e113]: Puzzle
                - generic [ref=e114]: Adventure
              - generic [ref=e115]: ↗
            - generic [ref=e116]: SOLVE IT
            - heading "Route Heist" [level=3] [ref=e119]
            - paragraph [ref=e120]: Plan the cleanest city route before the clock runs out.
            - generic [ref=e121]:
              - generic [ref=e122]: ⏱ 20 min
              - generic [ref=e123]: 👥 2–6
              - generic [ref=e124]: Medium
            - generic [ref=e125]:
              - generic [ref=e126]: by Trio Day
              - generic [ref=e127]:
                - link "View" [ref=e128] [cursor=pointer]:
                  - /url: activity.html?id=p2
                - link "Find a room" [ref=e129] [cursor=pointer]:
                  - /url: rooms.html?taskId=p2&source=catalog
        - article [ref=e130]:
          - generic [ref=e133]: 🧩
          - generic [ref=e136]:
            - generic [ref=e137]:
              - generic [ref=e138]:
                - generic [ref=e139]: Puzzle
                - generic [ref=e140]: Media
              - generic [ref=e141]: ↗
            - generic [ref=e142]: SOLVE IT
            - heading "Claim Hunters" [level=3] [ref=e145]
            - paragraph [ref=e146]: Investigate which product claim should survive scrutiny.
            - generic [ref=e147]:
              - generic [ref=e148]: ⏱ 20 min
              - generic [ref=e149]: 👥 2–6
              - generic [ref=e150]: Medium
            - generic [ref=e151]:
              - generic [ref=e152]: by Trio Day
              - generic [ref=e153]:
                - link "View" [ref=e154] [cursor=pointer]:
                  - /url: activity.html?id=p3
                - link "Find a room" [ref=e155] [cursor=pointer]:
                  - /url: rooms.html?taskId=p3&source=catalog
        - article [ref=e156]:
          - generic [ref=e159]: 🧩
          - generic [ref=e162]:
            - generic [ref=e163]:
              - generic [ref=e164]:
                - generic [ref=e165]: Puzzle
                - generic [ref=e166]: Code
              - generic [ref=e167]: ↗
            - generic [ref=e168]: SOLVE IT
            - heading "Cipher Relay" [level=3] [ref=e171]
            - paragraph [ref=e172]: Pass a secret message through the team without showing the whole answer.
            - generic [ref=e173]:
              - generic [ref=e174]: ⏱ 20 min
              - generic [ref=e175]: 👥 2–6
              - generic [ref=e176]: Medium
            - generic [ref=e177]:
              - generic [ref=e178]: by Trio Day
              - generic [ref=e179]:
                - link "View" [ref=e180] [cursor=pointer]:
                  - /url: activity.html?id=p4
                - link "Find a room" [ref=e181] [cursor=pointer]:
                  - /url: rooms.html?taskId=p4&source=catalog
        - article [ref=e182]:
          - generic [ref=e185]: 🧩
          - generic [ref=e188]:
            - generic [ref=e189]:
              - generic [ref=e190]:
                - generic [ref=e191]: Puzzle
                - generic [ref=e192]: Money
              - generic [ref=e193]: ↗
            - generic [ref=e194]: SOLVE IT
            - heading "Pop-up Event Budget" [level=3] [ref=e197]
            - paragraph [ref=e198]: Make a tiny event happen without burning the buffer.
            - generic [ref=e199]:
              - generic [ref=e200]: ⏱ 20 min
              - generic [ref=e201]: 👥 2–6
              - generic [ref=e202]: Medium
            - generic [ref=e203]:
              - generic [ref=e204]: by Trio Day
              - generic [ref=e205]:
                - link "View" [ref=e206] [cursor=pointer]:
                  - /url: activity.html?id=p5
                - link "Find a room" [ref=e207] [cursor=pointer]:
                  - /url: rooms.html?taskId=p5&source=catalog
        - article [ref=e208]:
          - generic [ref=e211]: 🧩
          - generic [ref=e214]:
            - generic [ref=e215]:
              - generic [ref=e216]:
                - generic [ref=e217]: Puzzle
                - generic [ref=e218]: Spatial
              - generic [ref=e219]: ↗
            - generic [ref=e220]: SOLVE IT
            - heading "Rescue Map" [level=3] [ref=e223]
            - paragraph [ref=e224]: Guide a rescue token across a blocked map with shared local knowledge.
            - generic [ref=e225]:
              - generic [ref=e226]: ⏱ 20 min
              - generic [ref=e227]: 👥 2–6
              - generic [ref=e228]: Medium
            - generic [ref=e229]:
              - generic [ref=e230]: by Trio Day
              - generic [ref=e231]:
                - link "View" [ref=e232] [cursor=pointer]:
                  - /url: activity.html?id=p6
                - link "Find a room" [ref=e233] [cursor=pointer]:
                  - /url: rooms.html?taskId=p6&source=catalog
        - article [ref=e234]:
          - generic [ref=e237]: 🧩
          - generic [ref=e240]:
            - generic [ref=e241]:
              - generic [ref=e242]:
                - generic [ref=e243]: Puzzle
                - generic [ref=e244]: Planning
              - generic [ref=e245]: ↗
            - generic [ref=e246]: SOLVE IT
            - heading "Calendar Chaos" [level=3] [ref=e249]
            - paragraph [ref=e250]: Schedule a team with a surprise availability change halfway through.
            - generic [ref=e251]:
              - generic [ref=e252]: ⏱ 20 min
              - generic [ref=e253]: 👥 2–6
              - generic [ref=e254]: Medium
            - generic [ref=e255]:
              - generic [ref=e256]: by Trio Day
              - generic [ref=e257]:
                - link "View" [ref=e258] [cursor=pointer]:
                  - /url: activity.html?id=p7
                - link "Find a room" [ref=e259] [cursor=pointer]:
                  - /url: rooms.html?taskId=p7&source=catalog
        - article [ref=e260]:
          - generic [ref=e263]: 🧩
          - generic [ref=e266]:
            - generic [ref=e267]:
              - generic [ref=e268]:
                - generic [ref=e269]: Puzzle
                - generic [ref=e270]: Science
              - generic [ref=e271]: ↗
            - generic [ref=e272]: SOLVE IT
            - heading "Experiment Lab" [level=3] [ref=e275]
            - paragraph [ref=e276]: Design the fairest test for a claim, then survive a new constraint.
            - generic [ref=e277]:
              - generic [ref=e278]: ⏱ 20 min
              - generic [ref=e279]: 👥 2–6
              - generic [ref=e280]: Medium
            - generic [ref=e281]:
              - generic [ref=e282]: by Trio Day
              - generic [ref=e283]:
                - link "View" [ref=e284] [cursor=pointer]:
                  - /url: activity.html?id=p8
                - link "Find a room" [ref=e285] [cursor=pointer]:
                  - /url: rooms.html?taskId=p8&source=catalog
        - article [ref=e286]:
          - generic [ref=e289]: 🧩
          - generic [ref=e292]:
            - generic [ref=e293]:
              - generic [ref=e294]:
                - generic [ref=e295]: Puzzle
                - generic [ref=e296]: Probability
              - generic [ref=e297]: ↗
            - generic [ref=e298]: SOLVE IT
            - heading "Casino Crew" [level=3] [ref=e301]
            - paragraph [ref=e302]: Choose the better strategy by splitting the probability work.
            - generic [ref=e303]:
              - generic [ref=e304]: ⏱ 18 min
              - generic [ref=e305]: 👥 2–6
              - generic [ref=e306]: Medium
            - generic [ref=e307]:
              - generic [ref=e308]: by Trio Day
              - generic [ref=e309]:
                - link "View" [ref=e310] [cursor=pointer]:
                  - /url: activity.html?id=p9
                - link "Find a room" [ref=e311] [cursor=pointer]:
                  - /url: rooms.html?taskId=p9&source=catalog
        - article [ref=e312]:
          - generic [ref=e315]: 🧩
          - generic [ref=e318]:
            - generic [ref=e319]:
              - generic [ref=e320]:
                - generic [ref=e321]: Puzzle
                - generic [ref=e322]: Systems
              - generic [ref=e323]: ↗
            - generic [ref=e324]: SOLVE IT
            - heading "Workflow Rescue" [level=3] [ref=e327]
            - paragraph [ref=e328]: Trace a broken process and repair it before the imaginary launch.
            - generic [ref=e329]:
              - generic [ref=e330]: ⏱ 18 min
              - generic [ref=e331]: 👥 2–6
              - generic [ref=e332]: Medium
            - generic [ref=e333]:
              - generic [ref=e334]: by Trio Day
              - generic [ref=e335]:
                - link "View" [ref=e336] [cursor=pointer]:
                  - /url: activity.html?id=p10
                - link "Find a room" [ref=e337] [cursor=pointer]:
                  - /url: rooms.html?taskId=p10&source=catalog
        - article [ref=e338]:
          - generic [ref=e341]: 🧩
          - generic [ref=e344]:
            - generic [ref=e345]:
              - generic [ref=e346]:
                - generic [ref=e347]: Puzzle
                - generic [ref=e348]: Decision
              - generic [ref=e349]: ↗
            - generic [ref=e350]: SOLVE IT
            - heading "Decision Auction" [level=3] [ref=e353]
            - paragraph [ref=e354]: Compare four choices, then spend limited points on your priorities.
            - generic [ref=e355]:
              - generic [ref=e356]: ⏱ 20 min
              - generic [ref=e357]: 👥 2–6
              - generic [ref=e358]: Medium
            - generic [ref=e359]:
              - generic [ref=e360]: by Trio Day
              - generic [ref=e361]:
                - link "View" [ref=e362] [cursor=pointer]:
                  - /url: activity.html?id=p11
                - link "Find a room" [ref=e363] [cursor=pointer]:
                  - /url: rooms.html?taskId=p11&source=catalog
        - article [ref=e364]:
          - generic [ref=e367]: 🧩
          - generic [ref=e370]:
            - generic [ref=e371]:
              - generic [ref=e372]:
                - generic [ref=e373]: Puzzle
                - generic [ref=e374]: Logic
              - generic [ref=e375]: ↗
            - generic [ref=e376]: SOLVE IT
            - heading "Four-Key Vault" [level=3] [ref=e379]
            - paragraph [ref=e380]: Break a code by giving each teammate ownership of different clue types.
            - generic [ref=e381]:
              - generic [ref=e382]: ⏱ 22 min
              - generic [ref=e383]: 👥 2–6
              - generic [ref=e384]: Hard
            - generic [ref=e385]:
              - generic [ref=e386]: by Trio Day
              - generic [ref=e387]:
                - link "View" [ref=e388] [cursor=pointer]:
                  - /url: activity.html?id=p12
                - link "Find a room" [ref=e389] [cursor=pointer]:
                  - /url: rooms.html?taskId=p12&source=catalog
        - article [ref=e390]:
          - generic [ref=e393]: 🧩
          - generic [ref=e396]:
            - generic [ref=e397]:
              - generic [ref=e398]:
                - generic [ref=e399]: Puzzle
                - generic [ref=e400]: Time
              - generic [ref=e401]: ↗
            - generic [ref=e402]: SOLVE IT
            - heading "Museum Heist Timeline" [level=3] [ref=e405]
            - paragraph [ref=e406]: Reconstruct the order of a fictional heist from scattered event cards.
            - generic [ref=e407]:
              - generic [ref=e408]: ⏱ 22 min
              - generic [ref=e409]: 👥 2–6
              - generic [ref=e410]: Hard
            - generic [ref=e411]:
              - generic [ref=e412]: by Trio Day
              - generic [ref=e413]:
                - link "View" [ref=e414] [cursor=pointer]:
                  - /url: activity.html?id=p13
                - link "Find a room" [ref=e415] [cursor=pointer]:
                  - /url: rooms.html?taskId=p13&source=catalog
        - article [ref=e416]:
          - generic [ref=e419]: 🧩
          - generic [ref=e422]:
            - generic [ref=e423]:
              - generic [ref=e424]:
                - generic [ref=e425]: Puzzle
                - generic [ref=e426]: Communication
              - generic [ref=e427]: ↗
            - generic [ref=e428]: SOLVE IT
            - heading "Signal Room" [level=3] [ref=e431]
            - paragraph [ref=e432]: Decode a noisy transmission where every player owns a different symbol key.
            - generic [ref=e433]:
              - generic [ref=e434]: ⏱ 20 min
              - generic [ref=e435]: 👥 2–6
              - generic [ref=e436]: Medium
            - generic [ref=e437]:
              - generic [ref=e438]: by Trio Day
              - generic [ref=e439]:
                - link "View" [ref=e440] [cursor=pointer]:
                  - /url: activity.html?id=p14
                - link "Find a room" [ref=e441] [cursor=pointer]:
                  - /url: rooms.html?taskId=p14&source=catalog
        - article [ref=e442]:
          - generic [ref=e445]: 🧩
          - generic [ref=e448]:
            - generic [ref=e449]:
              - generic [ref=e450]:
                - generic [ref=e451]: Puzzle
                - generic [ref=e452]: Escape
              - generic [ref=e453]: ↗
            - generic [ref=e454]: SOLVE IT
            - heading "Locked Lab" [level=3] [ref=e457]
            - paragraph [ref=e458]: Solve three connected mini-clues that unlock one final code.
            - generic [ref=e459]:
              - generic [ref=e460]: ⏱ 24 min
              - generic [ref=e461]: 👥 2–6
              - generic [ref=e462]: Hard
            - generic [ref=e463]:
              - generic [ref=e464]: by Trio Day
              - generic [ref=e465]:
                - link "View" [ref=e466] [cursor=pointer]:
                  - /url: activity.html?id=p15
                - link "Find a room" [ref=e467] [cursor=pointer]:
                  - /url: rooms.html?taskId=p15&source=catalog
        - article [ref=e468]:
          - generic [ref=e471]: 🛠️
          - generic [ref=e474]:
            - generic [ref=e475]:
              - generic [ref=e476]:
                - generic [ref=e477]: Build
                - generic [ref=e478]: Product
              - generic [ref=e479]: ↗
            - generic [ref=e480]: MAKE IT
            - heading "Pitch a Tiny App" [level=3] [ref=e483]
            - paragraph [ref=e484]: Build a one-screen product concept for a very specific user.
            - generic [ref=e485]:
              - generic [ref=e486]: ⏱ 22 min
              - generic [ref=e487]: 👥 2–6
              - generic [ref=e488]: Medium
            - generic [ref=e489]:
              - generic [ref=e490]: by Trio Day
              - generic [ref=e491]:
                - link "View" [ref=e492] [cursor=pointer]:
                  - /url: activity.html?id=b1
                - link "Find a room" [ref=e493] [cursor=pointer]:
                  - /url: rooms.html?taskId=b1&source=catalog
        - article [ref=e494]:
          - generic [ref=e497]: 🛠️
          - generic [ref=e500]:
            - generic [ref=e501]:
              - generic [ref=e502]:
                - generic [ref=e503]: Build
                - generic [ref=e504]: Design
              - generic [ref=e505]: ↗
            - generic [ref=e506]: MAKE IT
            - heading "Poster Sprint" [level=3] [ref=e509]
            - paragraph [ref=e510]: Design a text-only event poster concept that a real person would understand instantly.
            - generic [ref=e511]:
              - generic [ref=e512]: ⏱ 18 min
              - generic [ref=e513]: 👥 2–6
              - generic [ref=e514]: Easy
            - generic [ref=e515]:
              - generic [ref=e516]: by Trio Day
              - generic [ref=e517]:
                - link "View" [ref=e518] [cursor=pointer]:
                  - /url: activity.html?id=b2
                - link "Find a room" [ref=e519] [cursor=pointer]:
                  - /url: rooms.html?taskId=b2&source=catalog
        - article [ref=e520]:
          - generic [ref=e523]: 🛠️
          - generic [ref=e526]:
            - generic [ref=e527]:
              - generic [ref=e528]:
                - generic [ref=e529]: Build
                - generic [ref=e530]: Product
              - generic [ref=e531]: ↗
            - generic [ref=e532]: MAKE IT
            - heading "Three-Feature MVP" [level=3] [ref=e535]
            - paragraph [ref=e536]: Turn a messy idea into a tiny MVP with only three features.
            - generic [ref=e537]:
              - generic [ref=e538]: ⏱ 20 min
              - generic [ref=e539]: 👥 2–6
              - generic [ref=e540]: Medium
            - generic [ref=e541]:
              - generic [ref=e542]: by Trio Day
              - generic [ref=e543]:
                - link "View" [ref=e544] [cursor=pointer]:
                  - /url: activity.html?id=b3
                - link "Find a room" [ref=e545] [cursor=pointer]:
                  - /url: rooms.html?taskId=b3&source=catalog
        - article [ref=e546]:
          - generic [ref=e549]: 🛠️
          - generic [ref=e552]:
            - generic [ref=e553]:
              - generic [ref=e554]:
                - generic [ref=e555]: Build
                - generic [ref=e556]: Game Design
              - generic [ref=e557]: ↗
            - generic [ref=e558]: MAKE IT
            - heading "Mini Party Game" [level=3] [ref=e561]
            - paragraph [ref=e562]: Invent a game that can be played in a chat room in under 10 minutes.
            - generic [ref=e563]:
              - generic [ref=e564]: ⏱ 24 min
              - generic [ref=e565]: 👥 2–6
              - generic [ref=e566]: Medium
            - generic [ref=e567]:
              - generic [ref=e568]: by Trio Day
              - generic [ref=e569]:
                - link "View" [ref=e570] [cursor=pointer]:
                  - /url: activity.html?id=b4
                - link "Find a room" [ref=e571] [cursor=pointer]:
                  - /url: rooms.html?taskId=b4&source=catalog
        - article [ref=e572]:
          - generic [ref=e575]: 🛠️
          - generic [ref=e578]:
            - generic [ref=e579]:
              - generic [ref=e580]:
                - generic [ref=e581]: Build
                - generic [ref=e582]: Planning
              - generic [ref=e583]: ↗
            - generic [ref=e584]: MAKE IT
            - heading "Weekend Plan" [level=3] [ref=e587]
            - paragraph [ref=e588]: Build a realistic weekend plan around three goals and one fixed event.
            - generic [ref=e589]:
              - generic [ref=e590]: ⏱ 18 min
              - generic [ref=e591]: 👥 2–6
              - generic [ref=e592]: Easy
            - generic [ref=e593]:
              - generic [ref=e594]: by Trio Day
              - generic [ref=e595]:
                - link "View" [ref=e596] [cursor=pointer]:
                  - /url: activity.html?id=b5
                - link "Find a room" [ref=e597] [cursor=pointer]:
                  - /url: rooms.html?taskId=b5&source=catalog
        - article [ref=e598]:
          - generic [ref=e601]: 🛠️
          - generic [ref=e604]:
            - generic [ref=e605]:
              - generic [ref=e606]:
                - generic [ref=e607]: Build
                - generic [ref=e608]: Story
              - generic [ref=e609]: ↗
            - generic [ref=e610]: MAKE IT
            - heading "Micro Story" [level=3] [ref=e613]
            - paragraph [ref=e614]: Build a 6-beat story with a surprising but logical ending.
            - generic [ref=e615]:
              - generic [ref=e616]: ⏱ 20 min
              - generic [ref=e617]: 👥 2–6
              - generic [ref=e618]: Easy
            - generic [ref=e619]:
              - generic [ref=e620]: by Trio Day
              - generic [ref=e621]:
                - link "View" [ref=e622] [cursor=pointer]:
                  - /url: activity.html?id=b6
                - link "Find a room" [ref=e623] [cursor=pointer]:
                  - /url: rooms.html?taskId=b6&source=catalog
        - article [ref=e624]:
          - generic [ref=e627]: 🛠️
          - generic [ref=e630]:
            - generic [ref=e631]:
              - generic [ref=e632]:
                - generic [ref=e633]: Build
                - generic [ref=e634]: Tech
              - generic [ref=e635]: ↗
            - generic [ref=e636]: MAKE IT
            - heading "Feature Spec" [level=3] [ref=e639]
            - paragraph [ref=e640]: Write a tiny feature spec another developer could implement.
            - generic [ref=e641]:
              - generic [ref=e642]: ⏱ 24 min
              - generic [ref=e643]: 👥 2–6
              - generic [ref=e644]: Medium
            - generic [ref=e645]:
              - generic [ref=e646]: by Trio Day
              - generic [ref=e647]:
                - link "View" [ref=e648] [cursor=pointer]:
                  - /url: activity.html?id=b7
                - link "Find a room" [ref=e649] [cursor=pointer]:
                  - /url: rooms.html?taskId=b7&source=catalog
        - article [ref=e650]:
          - generic [ref=e653]: 🛠️
          - generic [ref=e656]:
            - generic [ref=e657]:
              - generic [ref=e658]:
                - generic [ref=e659]: Build
                - generic [ref=e660]: Community
              - generic [ref=e661]: ↗
            - generic [ref=e662]: MAKE IT
            - heading "Club Launch Kit" [level=3] [ref=e665]
            - paragraph [ref=e666]: Build the text-only launch plan for a fictional club.
            - generic [ref=e667]:
              - generic [ref=e668]: ⏱ 20 min
              - generic [ref=e669]: 👥 2–6
              - generic [ref=e670]: Easy
            - generic [ref=e671]:
              - generic [ref=e672]: by Trio Day
              - generic [ref=e673]:
                - link "View" [ref=e674] [cursor=pointer]:
                  - /url: activity.html?id=b8
                - link "Find a room" [ref=e675] [cursor=pointer]:
                  - /url: rooms.html?taskId=b8&source=catalog
        - article [ref=e676]:
          - generic [ref=e679]: 🛠️
          - generic [ref=e682]:
            - generic [ref=e683]:
              - generic [ref=e684]:
                - generic [ref=e685]: Build
                - generic [ref=e686]: Decision
              - generic [ref=e687]: ↗
            - generic [ref=e688]: MAKE IT
            - heading "Travel Pack" [level=3] [ref=e691]
            - paragraph [ref=e692]: Build a 10-item travel pack under a strict weight cap.
            - generic [ref=e693]:
              - generic [ref=e694]: ⏱ 20 min
              - generic [ref=e695]: 👥 2–6
              - generic [ref=e696]: Easy
            - generic [ref=e697]:
              - generic [ref=e698]: by Trio Day
              - generic [ref=e699]:
                - link "View" [ref=e700] [cursor=pointer]:
                  - /url: activity.html?id=b9
                - link "Find a room" [ref=e701] [cursor=pointer]:
                  - /url: rooms.html?taskId=b9&source=catalog
        - article [ref=e702]:
          - generic [ref=e705]: 🛠️
          - generic [ref=e708]:
            - generic [ref=e709]:
              - generic [ref=e710]:
                - generic [ref=e711]: Build
                - generic [ref=e712]: Systems
              - generic [ref=e713]: ↗
            - generic [ref=e714]: MAKE IT
            - heading "Support Playbook" [level=3] [ref=e717]
            - paragraph [ref=e718]: Build a four-step response playbook for a fictional app outage.
            - generic [ref=e719]:
              - generic [ref=e720]: ⏱ 22 min
              - generic [ref=e721]: 👥 2–6
              - generic [ref=e722]: Medium
            - generic [ref=e723]:
              - generic [ref=e724]: by Trio Day
              - generic [ref=e725]:
                - link "View" [ref=e726] [cursor=pointer]:
                  - /url: activity.html?id=b10
                - link "Find a room" [ref=e727] [cursor=pointer]:
                  - /url: rooms.html?taskId=b10&source=catalog
        - article [ref=e728]:
          - generic [ref=e731]: 🛠️
          - generic [ref=e734]:
            - generic [ref=e735]:
              - generic [ref=e736]:
                - generic [ref=e737]: Build
                - generic [ref=e738]: Data
              - generic [ref=e739]: ↗
            - generic [ref=e740]: MAKE IT
            - heading "Tiny Dashboard" [level=3] [ref=e743]
            - paragraph [ref=e744]: Design the layout of a dashboard for one decision.
            - generic [ref=e745]:
              - generic [ref=e746]: ⏱ 24 min
              - generic [ref=e747]: 👥 2–6
              - generic [ref=e748]: Medium
            - generic [ref=e749]:
              - generic [ref=e750]: by Trio Day
              - generic [ref=e751]:
                - link "View" [ref=e752] [cursor=pointer]:
                  - /url: activity.html?id=b11
                - link "Find a room" [ref=e753] [cursor=pointer]:
                  - /url: rooms.html?taskId=b11&source=catalog
        - article [ref=e754]:
          - generic [ref=e757]: 🛠️
          - generic [ref=e760]:
            - generic [ref=e761]:
              - generic [ref=e762]:
                - generic [ref=e763]: Build
                - generic [ref=e764]: Team
              - generic [ref=e765]: ↗
            - generic [ref=e766]: MAKE IT
            - heading "Sprint Board" [level=3] [ref=e769]
            - paragraph [ref=e770]: Build a miniature sprint board with four tasks, owners and a finish line.
            - generic [ref=e771]:
              - generic [ref=e772]: ⏱ 20 min
              - generic [ref=e773]: 👥 2–6
              - generic [ref=e774]: Medium
            - generic [ref=e775]:
              - generic [ref=e776]: by Trio Day
              - generic [ref=e777]:
                - link "View" [ref=e778] [cursor=pointer]:
                  - /url: activity.html?id=b12
                - link "Find a room" [ref=e779] [cursor=pointer]:
                  - /url: rooms.html?taskId=b12&source=catalog
        - article [ref=e780]:
          - generic [ref=e783]: 🛠️
          - generic [ref=e786]:
            - generic [ref=e787]:
              - generic [ref=e788]:
                - generic [ref=e789]: Build
                - generic [ref=e790]: Creativity
              - generic [ref=e791]: ↗
            - generic [ref=e792]: MAKE IT
            - heading "Brand in 15" [level=3] [ref=e795]
            - paragraph [ref=e796]: Invent a tiny brand with a name, promise, audience and visual mood.
            - generic [ref=e797]:
              - generic [ref=e798]: ⏱ 20 min
              - generic [ref=e799]: 👥 2–6
              - generic [ref=e800]: Easy
            - generic [ref=e801]:
              - generic [ref=e802]: by Trio Day
              - generic [ref=e803]:
                - link "View" [ref=e804] [cursor=pointer]:
                  - /url: activity.html?id=b13
                - link "Find a room" [ref=e805] [cursor=pointer]:
                  - /url: rooms.html?taskId=b13&source=catalog
        - article [ref=e806]:
          - generic [ref=e809]: 🛠️
          - generic [ref=e812]:
            - generic [ref=e813]:
              - generic [ref=e814]:
                - generic [ref=e815]: Build
                - generic [ref=e816]: Education
              - generic [ref=e817]: ↗
            - generic [ref=e818]: MAKE IT
            - heading "Study Kit" [level=3] [ref=e821]
            - paragraph [ref=e822]: Build a 15-minute study kit for a beginner.
            - generic [ref=e823]:
              - generic [ref=e824]: ⏱ 22 min
              - generic [ref=e825]: 👥 2–6
              - generic [ref=e826]: Medium
            - generic [ref=e827]:
              - generic [ref=e828]: by Trio Day
              - generic [ref=e829]:
                - link "View" [ref=e830] [cursor=pointer]:
                  - /url: activity.html?id=b14
                - link "Find a room" [ref=e831] [cursor=pointer]:
                  - /url: rooms.html?taskId=b14&source=catalog
        - article [ref=e832]:
          - generic [ref=e835]: 🛠️
          - generic [ref=e838]:
            - generic [ref=e839]:
              - generic [ref=e840]:
                - generic [ref=e841]: Build
                - generic [ref=e842]: Adventure
              - generic [ref=e843]: ↗
            - generic [ref=e844]: MAKE IT
            - heading "Escape Route" [level=3] [ref=e847]
            - paragraph [ref=e848]: Build an escape-room plan with clues, order and a final reveal.
            - generic [ref=e849]:
              - generic [ref=e850]: ⏱ 24 min
              - generic [ref=e851]: 👥 2–6
              - generic [ref=e852]: Hard
            - generic [ref=e853]:
              - generic [ref=e854]: by Trio Day
              - generic [ref=e855]:
                - link "View" [ref=e856] [cursor=pointer]:
                  - /url: activity.html?id=b15
                - link "Find a room" [ref=e857] [cursor=pointer]:
                  - /url: rooms.html?taskId=b15&source=catalog
        - article [ref=e858]:
          - generic [ref=e861]: 🧠
          - generic [ref=e864]:
            - generic [ref=e865]:
              - generic [ref=e866]:
                - generic [ref=e867]: Learn
                - generic [ref=e868]: Coding
              - generic [ref=e869]: ↗
            - generic [ref=e870]: LEARN IT
            - heading "Debugging by Debate" [level=3] [ref=e873]
            - paragraph [ref=e874]: Learn debugging through a tiny broken flow.
            - generic [ref=e875]:
              - generic [ref=e876]: ⏱ 25 min
              - generic [ref=e877]: 👥 2–6
              - generic [ref=e878]: Medium
            - generic [ref=e879]:
              - generic [ref=e880]: by Trio Day
              - generic [ref=e881]:
                - link "View" [ref=e882] [cursor=pointer]:
                  - /url: activity.html?id=l1
                - link "Find a room" [ref=e883] [cursor=pointer]:
                  - /url: rooms.html?taskId=l1&source=catalog
        - article [ref=e884]:
          - generic [ref=e887]: 🧠
          - generic [ref=e890]:
            - generic [ref=e891]:
              - generic [ref=e892]:
                - generic [ref=e893]: Learn
                - generic [ref=e894]: AI
              - generic [ref=e895]: ↗
            - generic [ref=e896]: LEARN IT
            - heading "Prompt Lab" [level=3] [ref=e899]
            - paragraph [ref=e900]: Learn how prompt wording changes an AI-style task.
            - generic [ref=e901]:
              - generic [ref=e902]: ⏱ 25 min
              - generic [ref=e903]: 👥 2–6
              - generic [ref=e904]: Easy
            - generic [ref=e905]:
              - generic [ref=e906]: by Trio Day
              - generic [ref=e907]:
                - link "View" [ref=e908] [cursor=pointer]:
                  - /url: activity.html?id=l2
                - link "Find a room" [ref=e909] [cursor=pointer]:
                  - /url: rooms.html?taskId=l2&source=catalog
        - article [ref=e910]:
          - generic [ref=e913]: 🧠
          - generic [ref=e916]:
            - generic [ref=e917]:
              - generic [ref=e918]:
                - generic [ref=e919]: Learn
                - generic [ref=e920]: Data
              - generic [ref=e921]: ↗
            - generic [ref=e922]: LEARN IT
            - heading "Data Detective" [level=3] [ref=e925]
            - paragraph [ref=e926]: Learn how missing values and outliers change a small dataset.
            - generic [ref=e927]:
              - generic [ref=e928]: ⏱ 25 min
              - generic [ref=e929]: 👥 2–6
              - generic [ref=e930]: Easy
            - generic [ref=e931]:
              - generic [ref=e932]: by Trio Day
              - generic [ref=e933]:
                - link "View" [ref=e934] [cursor=pointer]:
                  - /url: activity.html?id=l3
                - link "Find a room" [ref=e935] [cursor=pointer]:
                  - /url: rooms.html?taskId=l3&source=catalog
        - article [ref=e936]:
          - generic [ref=e939]: 🧠
          - generic [ref=e942]:
            - generic [ref=e943]:
              - generic [ref=e944]:
                - generic [ref=e945]: Learn
                - generic [ref=e946]: Web
              - generic [ref=e947]: ↗
            - generic [ref=e948]: LEARN IT
            - heading "Request Journey" [level=3] [ref=e951]
            - paragraph [ref=e952]: Learn what happens when a browser loads a web page.
            - generic [ref=e953]:
              - generic [ref=e954]: ⏱ 22 min
              - generic [ref=e955]: 👥 2–6
              - generic [ref=e956]: Easy
            - generic [ref=e957]:
              - generic [ref=e958]: by Trio Day
              - generic [ref=e959]:
                - link "View" [ref=e960] [cursor=pointer]:
                  - /url: activity.html?id=l4
                - link "Find a room" [ref=e961] [cursor=pointer]:
                  - /url: rooms.html?taskId=l4&source=catalog
        - article [ref=e962]:
          - generic [ref=e965]: 🧠
          - generic [ref=e968]:
            - generic [ref=e969]:
              - generic [ref=e970]:
                - generic [ref=e971]: Learn
                - generic [ref=e972]: ML
              - generic [ref=e973]: ↗
            - generic [ref=e974]: LEARN IT
            - heading "Feature vs Label" [level=3] [ref=e977]
            - paragraph [ref=e978]: Learn the difference between inputs and targets using mini scenarios.
            - generic [ref=e979]:
              - generic [ref=e980]: ⏱ 22 min
              - generic [ref=e981]: 👥 2–6
              - generic [ref=e982]: Easy
            - generic [ref=e983]:
              - generic [ref=e984]: by Trio Day
              - generic [ref=e985]:
                - link "View" [ref=e986] [cursor=pointer]:
                  - /url: activity.html?id=l5
                - link "Find a room" [ref=e987] [cursor=pointer]:
                  - /url: rooms.html?taskId=l5&source=catalog
        - article [ref=e988]:
          - generic [ref=e991]: 🧠
          - generic [ref=e994]:
            - generic [ref=e995]:
              - generic [ref=e996]:
                - generic [ref=e997]: Learn
                - generic [ref=e998]: Math
              - generic [ref=e999]: ↗
            - generic [ref=e1000]: LEARN IT
            - heading "Probability by Story" [level=3] [ref=e1003]
            - paragraph [ref=e1004]: Learn probability through small real-world game situations.
            - generic [ref=e1005]:
              - generic [ref=e1006]: ⏱ 25 min
              - generic [ref=e1007]: 👥 2–6
              - generic [ref=e1008]: Medium
            - generic [ref=e1009]:
              - generic [ref=e1010]: by Trio Day
              - generic [ref=e1011]:
                - link "View" [ref=e1012] [cursor=pointer]:
                  - /url: activity.html?id=l6
                - link "Find a room" [ref=e1013] [cursor=pointer]:
                  - /url: rooms.html?taskId=l6&source=catalog
        - article [ref=e1014]:
          - generic [ref=e1017]: 🧠
          - generic [ref=e1020]:
            - generic [ref=e1021]:
              - generic [ref=e1022]:
                - generic [ref=e1023]: Learn
                - generic [ref=e1024]: Coding
              - generic [ref=e1025]: ↗
            - generic [ref=e1026]: LEARN IT
            - heading "SQL Join Relay" [level=3] [ref=e1029]
            - paragraph [ref=e1030]: Learn joins by predicting which rows survive each join.
            - generic [ref=e1031]:
              - generic [ref=e1032]: ⏱ 28 min
              - generic [ref=e1033]: 👥 2–6
              - generic [ref=e1034]: Medium
            - generic [ref=e1035]:
              - generic [ref=e1036]: by Trio Day
              - generic [ref=e1037]:
                - link "View" [ref=e1038] [cursor=pointer]:
                  - /url: activity.html?id=l7
                - link "Find a room" [ref=e1039] [cursor=pointer]:
                  - /url: rooms.html?taskId=l7&source=catalog
        - article [ref=e1040]:
          - generic [ref=e1043]: 🧠
          - generic [ref=e1046]:
            - generic [ref=e1047]:
              - generic [ref=e1048]:
                - generic [ref=e1049]: Learn
                - generic [ref=e1050]: Science
              - generic [ref=e1051]: ↗
            - generic [ref=e1052]: LEARN IT
            - heading "Myth Testers" [level=3] [ref=e1055]
            - paragraph [ref=e1056]: Learn experimental design by trying to break weak experiments.
            - generic [ref=e1057]:
              - generic [ref=e1058]: ⏱ 24 min
              - generic [ref=e1059]: 👥 2–6
              - generic [ref=e1060]: Medium
            - generic [ref=e1061]:
              - generic [ref=e1062]: by Trio Day
              - generic [ref=e1063]:
                - link "View" [ref=e1064] [cursor=pointer]:
                  - /url: activity.html?id=l8
                - link "Find a room" [ref=e1065] [cursor=pointer]:
                  - /url: rooms.html?taskId=l8&source=catalog
        - article [ref=e1066]:
          - generic [ref=e1069]: 🧠
          - generic [ref=e1072]:
            - generic [ref=e1073]:
              - generic [ref=e1074]:
                - generic [ref=e1075]: Learn
                - generic [ref=e1076]: Communication
              - generic [ref=e1077]: ↗
            - generic [ref=e1078]: LEARN IT
            - heading "Explain It Back" [level=3] [ref=e1081]
            - paragraph [ref=e1082]: Learn a technical idea by teaching it to another person.
            - generic [ref=e1083]:
              - generic [ref=e1084]: ⏱ 24 min
              - generic [ref=e1085]: 👥 2–6
              - generic [ref=e1086]: Easy
            - generic [ref=e1087]:
              - generic [ref=e1088]: by Trio Day
              - generic [ref=e1089]:
                - link "View" [ref=e1090] [cursor=pointer]:
                  - /url: activity.html?id=l9
                - link "Find a room" [ref=e1091] [cursor=pointer]:
                  - /url: rooms.html?taskId=l9&source=catalog
        - article [ref=e1092]:
          - generic [ref=e1095]: 🧠
          - generic [ref=e1098]:
            - generic [ref=e1099]:
              - generic [ref=e1100]:
                - generic [ref=e1101]: Learn
                - generic [ref=e1102]: Git
              - generic [ref=e1103]: ↗
            - generic [ref=e1104]: LEARN IT
            - heading "Branch Escape" [level=3] [ref=e1107]
            - paragraph [ref=e1108]: Learn Git branches through a fictional project timeline.
            - generic [ref=e1109]:
              - generic [ref=e1110]: ⏱ 25 min
              - generic [ref=e1111]: 👥 2–6
              - generic [ref=e1112]: Medium
            - generic [ref=e1113]:
              - generic [ref=e1114]: by Trio Day
              - generic [ref=e1115]:
                - link "View" [ref=e1116] [cursor=pointer]:
                  - /url: activity.html?id=l10
                - link "Find a room" [ref=e1117] [cursor=pointer]:
                  - /url: rooms.html?taskId=l10&source=catalog
        - article [ref=e1118]:
          - generic [ref=e1121]: 🧠
          - generic [ref=e1124]:
            - generic [ref=e1125]:
              - generic [ref=e1126]:
                - generic [ref=e1127]: Learn
                - generic [ref=e1128]: AI
              - generic [ref=e1129]: ↗
            - generic [ref=e1130]: LEARN IT
            - heading "Overfitting Trial" [level=3] [ref=e1133]
            - paragraph [ref=e1134]: Learn overfitting by acting as a model review panel.
            - generic [ref=e1135]:
              - generic [ref=e1136]: ⏱ 25 min
              - generic [ref=e1137]: 👥 2–6
              - generic [ref=e1138]: Medium
            - generic [ref=e1139]:
              - generic [ref=e1140]: by Trio Day
              - generic [ref=e1141]:
                - link "View" [ref=e1142] [cursor=pointer]:
                  - /url: activity.html?id=l11
                - link "Find a room" [ref=e1143] [cursor=pointer]:
                  - /url: rooms.html?taskId=l11&source=catalog
        - article [ref=e1144]:
          - generic [ref=e1147]: 🧠
          - generic [ref=e1150]:
            - generic [ref=e1151]:
              - generic [ref=e1152]:
                - generic [ref=e1153]: Learn
                - generic [ref=e1154]: Networks
              - generic [ref=e1155]: ↗
            - generic [ref=e1156]: LEARN IT
            - heading "DNS Detective" [level=3] [ref=e1159]
            - paragraph [ref=e1160]: Learn DNS through a mystery where a domain resolves incorrectly.
            - generic [ref=e1161]:
              - generic [ref=e1162]: ⏱ 22 min
              - generic [ref=e1163]: 👥 2–6
              - generic [ref=e1164]: Easy
            - generic [ref=e1165]:
              - generic [ref=e1166]: by Trio Day
              - generic [ref=e1167]:
                - link "View" [ref=e1168] [cursor=pointer]:
                  - /url: activity.html?id=l12
                - link "Find a room" [ref=e1169] [cursor=pointer]:
                  - /url: rooms.html?taskId=l12&source=catalog
        - article [ref=e1170]:
          - generic [ref=e1173]: 🧠
          - generic [ref=e1176]:
            - generic [ref=e1177]:
              - generic [ref=e1178]:
                - generic [ref=e1179]: Learn
                - generic [ref=e1180]: Product
              - generic [ref=e1181]: ↗
            - generic [ref=e1182]: LEARN IT
            - heading "UX Test Room" [level=3] [ref=e1185]
            - paragraph [ref=e1186]: Learn basic usability testing by role-playing user, observer and designer.
            - generic [ref=e1187]:
              - generic [ref=e1188]: ⏱ 28 min
              - generic [ref=e1189]: 👥 2–6
              - generic [ref=e1190]: Medium
            - generic [ref=e1191]:
              - generic [ref=e1192]: by Trio Day
              - generic [ref=e1193]:
                - link "View" [ref=e1194] [cursor=pointer]:
                  - /url: activity.html?id=l13
                - link "Find a room" [ref=e1195] [cursor=pointer]:
                  - /url: rooms.html?taskId=l13&source=catalog
        - article [ref=e1196]:
          - generic [ref=e1199]: 🧠
          - generic [ref=e1202]:
            - generic [ref=e1203]:
              - generic [ref=e1204]:
                - generic [ref=e1205]: Learn
                - generic [ref=e1206]: Statistics
              - generic [ref=e1207]: ↗
            - generic [ref=e1208]: LEARN IT
            - heading "Mean vs Median" [level=3] [ref=e1211]
            - paragraph [ref=e1212]: Learn when mean and median tell different stories.
            - generic [ref=e1213]:
              - generic [ref=e1214]: ⏱ 24 min
              - generic [ref=e1215]: 👥 2–6
              - generic [ref=e1216]: Easy
            - generic [ref=e1217]:
              - generic [ref=e1218]: by Trio Day
              - generic [ref=e1219]:
                - link "View" [ref=e1220] [cursor=pointer]:
                  - /url: activity.html?id=l14
                - link "Find a room" [ref=e1221] [cursor=pointer]:
                  - /url: rooms.html?taskId=l14&source=catalog
        - article [ref=e1222]:
          - generic [ref=e1225]: 🧠
          - generic [ref=e1228]:
            - generic [ref=e1229]:
              - generic [ref=e1230]:
                - generic [ref=e1231]: Learn
                - generic [ref=e1232]: Systems
              - generic [ref=e1233]: ↗
            - generic [ref=e1234]: LEARN IT
            - heading "Dependency Thinking" [level=3] [ref=e1237]
            - paragraph [ref=e1238]: Learn why prerequisites matter in projects and software.
            - generic [ref=e1239]:
              - generic [ref=e1240]: ⏱ 25 min
              - generic [ref=e1241]: 👥 2–6
              - generic [ref=e1242]: Medium
            - generic [ref=e1243]:
              - generic [ref=e1244]: by Trio Day
              - generic [ref=e1245]:
                - link "View" [ref=e1246] [cursor=pointer]:
                  - /url: activity.html?id=l15
                - link "Find a room" [ref=e1247] [cursor=pointer]:
                  - /url: rooms.html?taskId=l15&source=catalog
        - article [ref=e1248]:
          - generic [ref=e1251]: ⚡
          - generic [ref=e1254]:
            - generic [ref=e1255]:
              - generic [ref=e1256]:
                - generic [ref=e1257]: Challenge
                - generic [ref=e1258]: Focus
              - generic [ref=e1259]: ↗
            - generic [ref=e1260]: TAKE IT
            - heading "Distraction Duel" [level=3] [ref=e1263]
            - paragraph [ref=e1264]: Race through five live focus scenarios with a friend or room.
            - generic [ref=e1265]:
              - generic [ref=e1266]: ⏱ 15 min
              - generic [ref=e1267]: 👥 2–6
              - generic [ref=e1268]: Easy
            - generic [ref=e1269]:
              - generic [ref=e1270]: by Trio Day
              - generic [ref=e1271]:
                - link "View" [ref=e1272] [cursor=pointer]:
                  - /url: activity.html?id=c1
                - link "Find a room" [ref=e1273] [cursor=pointer]:
                  - /url: rooms.html?taskId=c1&source=catalog
        - article [ref=e1274]:
          - generic [ref=e1277]: ⚡
          - generic [ref=e1280]:
            - generic [ref=e1281]:
              - generic [ref=e1282]:
                - generic [ref=e1283]: Challenge
                - generic [ref=e1284]: Logic
              - generic [ref=e1285]: ↗
            - generic [ref=e1286]: TAKE IT
            - heading "Mystery Sprint" [level=3] [ref=e1289]
            - paragraph [ref=e1290]: Solve five mini-mysteries against other players.
            - generic [ref=e1291]:
              - generic [ref=e1292]: ⏱ 15 min
              - generic [ref=e1293]: 👥 2–6
              - generic [ref=e1294]: Medium
            - generic [ref=e1295]:
              - generic [ref=e1296]: by Trio Day
              - generic [ref=e1297]:
                - link "View" [ref=e1298] [cursor=pointer]:
                  - /url: activity.html?id=c2
                - link "Find a room" [ref=e1299] [cursor=pointer]:
                  - /url: rooms.html?taskId=c2&source=catalog
        - article [ref=e1300]:
          - generic [ref=e1303]: ⚡
          - generic [ref=e1306]:
            - generic [ref=e1307]:
              - generic [ref=e1308]:
                - generic [ref=e1309]: Challenge
                - generic [ref=e1310]: Coding
              - generic [ref=e1311]: ↗
            - generic [ref=e1312]: TAKE IT
            - heading "Code Prediction Race" [level=3] [ref=e1315]
            - paragraph [ref=e1316]: Predict tiny code outputs before the clock hits zero.
            - generic [ref=e1317]:
              - generic [ref=e1318]: ⏱ 15 min
              - generic [ref=e1319]: 👥 2–6
              - generic [ref=e1320]: Medium
            - generic [ref=e1321]:
              - generic [ref=e1322]: by Trio Day
              - generic [ref=e1323]:
                - link "View" [ref=e1324] [cursor=pointer]:
                  - /url: activity.html?id=c3
                - link "Find a room" [ref=e1325] [cursor=pointer]:
                  - /url: rooms.html?taskId=c3&source=catalog
        - article [ref=e1326]:
          - generic [ref=e1329]: ⚡
          - generic [ref=e1332]:
            - generic [ref=e1333]:
              - generic [ref=e1334]:
                - generic [ref=e1335]: Challenge
                - generic [ref=e1336]: Money
              - generic [ref=e1337]: ↗
            - generic [ref=e1338]: TAKE IT
            - heading "Budget Blitz" [level=3] [ref=e1341]
            - paragraph [ref=e1342]: Make five rapid budget calls under pressure.
            - generic [ref=e1343]:
              - generic [ref=e1344]: ⏱ 15 min
              - generic [ref=e1345]: 👥 2–6
              - generic [ref=e1346]: Easy
            - generic [ref=e1347]:
              - generic [ref=e1348]: by Trio Day
              - generic [ref=e1349]:
                - link "View" [ref=e1350] [cursor=pointer]:
                  - /url: activity.html?id=c4
                - link "Find a room" [ref=e1351] [cursor=pointer]:
                  - /url: rooms.html?taskId=c4&source=catalog
        - article [ref=e1352]:
          - generic [ref=e1355]: ⚡
          - generic [ref=e1358]:
            - generic [ref=e1359]:
              - generic [ref=e1360]:
                - generic [ref=e1361]: Challenge
                - generic [ref=e1362]: Science
              - generic [ref=e1363]: ↗
            - generic [ref=e1364]: TAKE IT
            - heading "Experiment Arena" [level=3] [ref=e1367]
            - paragraph [ref=e1368]: Pick the strongest experiment in five live cases.
            - generic [ref=e1369]:
              - generic [ref=e1370]: ⏱ 18 min
              - generic [ref=e1371]: 👥 2–6
              - generic [ref=e1372]: Medium
            - generic [ref=e1373]:
              - generic [ref=e1374]: by Trio Day
              - generic [ref=e1375]:
                - link "View" [ref=e1376] [cursor=pointer]:
                  - /url: activity.html?id=c5
                - link "Find a room" [ref=e1377] [cursor=pointer]:
                  - /url: rooms.html?taskId=c5&source=catalog
        - article [ref=e1378]:
          - generic [ref=e1381]: ⚡
          - generic [ref=e1384]:
            - generic [ref=e1385]:
              - generic [ref=e1386]:
                - generic [ref=e1387]: Challenge
                - generic [ref=e1388]: Media
              - generic [ref=e1389]: ↗
            - generic [ref=e1390]: TAKE IT
            - heading "Fact Check Faceoff" [level=3] [ref=e1393]
            - paragraph [ref=e1394]: Spot the evidence-backed claim before the others do.
            - generic [ref=e1395]:
              - generic [ref=e1396]: ⏱ 15 min
              - generic [ref=e1397]: 👥 2–6
              - generic [ref=e1398]: Medium
            - generic [ref=e1399]:
              - generic [ref=e1400]: by Trio Day
              - generic [ref=e1401]:
                - link "View" [ref=e1402] [cursor=pointer]:
                  - /url: activity.html?id=c6
                - link "Find a room" [ref=e1403] [cursor=pointer]:
                  - /url: rooms.html?taskId=c6&source=catalog
        - article [ref=e1404]:
          - generic [ref=e1407]: ⚡
          - generic [ref=e1410]:
            - generic [ref=e1411]:
              - generic [ref=e1412]:
                - generic [ref=e1413]: Challenge
                - generic [ref=e1414]: Planning
              - generic [ref=e1415]: ↗
            - generic [ref=e1416]: TAKE IT
            - heading "Schedule Showdown" [level=3] [ref=e1419]
            - paragraph [ref=e1420]: Beat other players at quick scheduling cases.
            - generic [ref=e1421]:
              - generic [ref=e1422]: ⏱ 16 min
              - generic [ref=e1423]: 👥 2–6
              - generic [ref=e1424]: Medium
            - generic [ref=e1425]:
              - generic [ref=e1426]: by Trio Day
              - generic [ref=e1427]:
                - link "View" [ref=e1428] [cursor=pointer]:
                  - /url: activity.html?id=c7
                - link "Find a room" [ref=e1429] [cursor=pointer]:
                  - /url: rooms.html?taskId=c7&source=catalog
        - article [ref=e1430]:
          - generic [ref=e1433]: ⚡
          - generic [ref=e1436]:
            - generic [ref=e1437]:
              - generic [ref=e1438]:
                - generic [ref=e1439]: Challenge
                - generic [ref=e1440]: Math
              - generic [ref=e1441]: ↗
            - generic [ref=e1442]: TAKE IT
            - heading "Number Dash" [level=3] [ref=e1445]
            - paragraph [ref=e1446]: Solve five fast calculations against the room.
            - generic [ref=e1447]:
              - generic [ref=e1448]: ⏱ 12 min
              - generic [ref=e1449]: 👥 2–6
              - generic [ref=e1450]: Easy
            - generic [ref=e1451]:
              - generic [ref=e1452]: by Trio Day
              - generic [ref=e1453]:
                - link "View" [ref=e1454] [cursor=pointer]:
                  - /url: activity.html?id=c8
                - link "Find a room" [ref=e1455] [cursor=pointer]:
                  - /url: rooms.html?taskId=c8&source=catalog
        - article [ref=e1456]:
          - generic [ref=e1459]: ⚡
          - generic [ref=e1462]:
            - generic [ref=e1463]:
              - generic [ref=e1464]:
                - generic [ref=e1465]: Challenge
                - generic [ref=e1466]: AI
              - generic [ref=e1467]: ↗
            - generic [ref=e1468]: TAKE IT
            - heading "ML Model Draft" [level=3] [ref=e1471]
            - paragraph [ref=e1472]: Choose the most sensible model decision in practical scenarios.
            - generic [ref=e1473]:
              - generic [ref=e1474]: ⏱ 18 min
              - generic [ref=e1475]: 👥 2–6
              - generic [ref=e1476]: Medium
            - generic [ref=e1477]:
              - generic [ref=e1478]: by Trio Day
              - generic [ref=e1479]:
                - link "View" [ref=e1480] [cursor=pointer]:
                  - /url: activity.html?id=c9
                - link "Find a room" [ref=e1481] [cursor=pointer]:
                  - /url: rooms.html?taskId=c9&source=catalog
        - article [ref=e1482]:
          - generic [ref=e1485]: ⚡
          - generic [ref=e1488]:
            - generic [ref=e1489]:
              - generic [ref=e1490]:
                - generic [ref=e1491]: Challenge
                - generic [ref=e1492]: Communication
              - generic [ref=e1493]: ↗
            - generic [ref=e1494]: TAKE IT
            - heading "Explain Better" [level=3] [ref=e1497]
            - paragraph [ref=e1498]: Choose the clearest response, then defend it in one sentence.
            - generic [ref=e1499]:
              - generic [ref=e1500]: ⏱ 15 min
              - generic [ref=e1501]: 👥 2–6
              - generic [ref=e1502]: Easy
            - generic [ref=e1503]:
              - generic [ref=e1504]: by Trio Day
              - generic [ref=e1505]:
                - link "View" [ref=e1506] [cursor=pointer]:
                  - /url: activity.html?id=c10
                - link "Find a room" [ref=e1507] [cursor=pointer]:
                  - /url: rooms.html?taskId=c10&source=catalog
        - article [ref=e1508]:
          - generic [ref=e1511]: ⚡
          - generic [ref=e1514]:
            - generic [ref=e1515]:
              - generic [ref=e1516]:
                - generic [ref=e1517]: Challenge
                - generic [ref=e1518]: Problem Solving
              - generic [ref=e1519]: ↗
            - generic [ref=e1520]: TAKE IT
            - heading "Fix-It Sprint" [level=3] [ref=e1523]
            - paragraph [ref=e1524]: Race to choose the next debugging move in five cases.
            - generic [ref=e1525]:
              - generic [ref=e1526]: ⏱ 18 min
              - generic [ref=e1527]: 👥 2–6
              - generic [ref=e1528]: Medium
            - generic [ref=e1529]:
              - generic [ref=e1530]: by Trio Day
              - generic [ref=e1531]:
                - link "View" [ref=e1532] [cursor=pointer]:
                  - /url: activity.html?id=c11
                - link "Find a room" [ref=e1533] [cursor=pointer]:
                  - /url: rooms.html?taskId=c11&source=catalog
        - article [ref=e1534]:
          - generic [ref=e1537]: ⚡
          - generic [ref=e1540]:
            - generic [ref=e1541]:
              - generic [ref=e1542]:
                - generic [ref=e1543]: Challenge
                - generic [ref=e1544]: Decision
              - generic [ref=e1545]: ↗
            - generic [ref=e1546]: TAKE IT
            - heading "Trade-Off Trial" [level=3] [ref=e1549]
            - paragraph [ref=e1550]: Make decisions where every option has a cost.
            - generic [ref=e1551]:
              - generic [ref=e1552]: ⏱ 18 min
              - generic [ref=e1553]: 👥 2–6
              - generic [ref=e1554]: Medium
            - generic [ref=e1555]:
              - generic [ref=e1556]: by Trio Day
              - generic [ref=e1557]:
                - link "View" [ref=e1558] [cursor=pointer]:
                  - /url: activity.html?id=c12
                - link "Find a room" [ref=e1559] [cursor=pointer]:
                  - /url: rooms.html?taskId=c12&source=catalog
        - article [ref=e1560]:
          - generic [ref=e1563]: ⚡
          - generic [ref=e1566]:
            - generic [ref=e1567]:
              - generic [ref=e1568]:
                - generic [ref=e1569]: Challenge
                - generic [ref=e1570]: Creativity
              - generic [ref=e1571]: ↗
            - generic [ref=e1572]: TAKE IT
            - heading "Caption Clash" [level=3] [ref=e1575]
            - paragraph [ref=e1576]: Create a one-line caption for a fictional scene.
            - generic [ref=e1577]:
              - generic [ref=e1578]: ⏱ 18 min
              - generic [ref=e1579]: 👥 2–6
              - generic [ref=e1580]: Easy
            - generic [ref=e1581]:
              - generic [ref=e1582]: by Trio Day
              - generic [ref=e1583]:
                - link "View" [ref=e1584] [cursor=pointer]:
                  - /url: activity.html?id=c13
                - link "Find a room" [ref=e1585] [cursor=pointer]:
                  - /url: rooms.html?taskId=c13&source=catalog
        - article [ref=e1586]:
          - generic [ref=e1589]: ⚡
          - generic [ref=e1592]:
            - generic [ref=e1593]:
              - generic [ref=e1594]:
                - generic [ref=e1595]: Challenge
                - generic [ref=e1596]: Words
              - generic [ref=e1597]: ↗
            - generic [ref=e1598]: TAKE IT
            - heading "Word Sprint" [level=3] [ref=e1601]
            - paragraph [ref=e1602]: Beat the room with fast word transformations and clue solving.
            - generic [ref=e1603]:
              - generic [ref=e1604]: ⏱ 12 min
              - generic [ref=e1605]: 👥 2–6
              - generic [ref=e1606]: Easy
            - generic [ref=e1607]:
              - generic [ref=e1608]: by Trio Day
              - generic [ref=e1609]:
                - link "View" [ref=e1610] [cursor=pointer]:
                  - /url: activity.html?id=c14
                - link "Find a room" [ref=e1611] [cursor=pointer]:
                  - /url: rooms.html?taskId=c14&source=catalog
        - article [ref=e1612]:
          - generic [ref=e1615]: ⚡
          - generic [ref=e1618]:
            - generic [ref=e1619]:
              - generic [ref=e1620]:
                - generic [ref=e1621]: Challenge
                - generic [ref=e1622]: Team
              - generic [ref=e1623]: ↗
            - generic [ref=e1624]: TAKE IT
            - heading "Co-op Captain" [level=3] [ref=e1627]
            - paragraph [ref=e1628]: "Compete on team tactics: choose the move that gives the whole room the best chance."
            - generic [ref=e1629]:
              - generic [ref=e1630]: ⏱ 18 min
              - generic [ref=e1631]: 👥 2–6
              - generic [ref=e1632]: Medium
            - generic [ref=e1633]:
              - generic [ref=e1634]: by Trio Day
              - generic [ref=e1635]:
                - link "View" [ref=e1636] [cursor=pointer]:
                  - /url: activity.html?id=c15
                - link "Find a room" [ref=e1637] [cursor=pointer]:
                  - /url: rooms.html?taskId=c15&source=catalog
    - generic [ref=e1638]:
      - generic [ref=e1639]:
        - generic [ref=e1640]:
          - heading "Live rooms" [level=2] [ref=e1641]
          - paragraph [ref=e1642]: Play together.
        - link "See all" [ref=e1643] [cursor=pointer]:
          - /url: rooms.html
      - generic [ref=e1644]: Sign in to see live rooms.
    - generic [ref=e1646]:
      - generic [ref=e1647]:
        - strong [ref=e1648]: Make the next activity
        - generic [ref=e1649]: Start with a template. Make it yours.
      - link "Create activity" [ref=e1650] [cursor=pointer]:
        - /url: task-create.html
  - navigation "Primary navigation" [ref=e1651]:
    - generic [ref=e1652]:
      - link "Today" [ref=e1653] [cursor=pointer]:
        - /url: index.html
      - link "Discover" [ref=e1658] [cursor=pointer]:
        - /url: all-users.html
      - link "Do" [ref=e1664] [cursor=pointer]:
        - /url: tasks.html
      - link "Chat" [ref=e1669] [cursor=pointer]:
        - /url: chat.html
      - link "You" [ref=e1674] [cursor=pointer]:
        - /url: profile.html
  - button "Create" [ref=e1680] [cursor=pointer]
```

# Test source

```ts
  17  |     await page.setViewportSize({ width: 390, height: 844 });
  18  |     await page.goto('http://localhost:5500/', { waitUntil: 'networkidle' });
  19  |     await page.waitForTimeout(3000);
  20  | 
  21  |     console.log('Console errors on index.html:', errors);
  22  |     
  23  |     // Check basic elements - bottom-nav should be visible on mobile
  24  |     await expect(page.locator('.topbar')).toBeVisible();
  25  |     await expect(page.locator('.bottom-nav')).toBeVisible();
  26  |     await expect(page.locator('[data-nav="today"]')).toHaveClass(/active/);
  27  |     
  28  |     // Check for JS module errors (blank page check)
  29  |     const bodyText = await page.locator('body').textContent();
  30  |     expect(bodyText.length).toBeGreaterThan(100);
  31  |   });
  32  | 
  33  |   test('Navigate to all pages via bottom nav (mobile)', async ({ page }) => {
  34  |     const errors = [];
  35  |     page.on('console', msg => {
  36  |       if (msg.type() === 'error') errors.push(msg.text());
  37  |     });
  38  |     page.on('pageerror', err => errors.push(err.message));
  39  | 
  40  |     // Set mobile viewport FIRST
  41  |     await page.setViewportSize({ width: 390, height: 844 });
  42  |     
  43  |     // Today
  44  |     await page.goto('http://localhost:5500/', { waitUntil: 'networkidle' });
  45  |     await page.waitForTimeout(2000);
  46  |     console.log('Today errors:', errors.filter(e => !e.includes('favicon')));
  47  | 
  48  |     // Discover
  49  |     await page.click('[data-nav="discover"]');
  50  |     await page.waitForURL('**/all-users.html');
  51  |     await page.waitForTimeout(2000);
  52  |     console.log('Discover errors:', errors.filter(e => !e.includes('favicon')));
  53  | 
  54  |     // Do
  55  |     await page.click('[data-nav="do"]');
  56  |     await page.waitForURL('**/tasks.html');
  57  |     await page.waitForTimeout(2000);
  58  |     console.log('Do errors:', errors.filter(e => !e.includes('favicon')));
  59  | 
  60  |     // Chat
  61  |     await page.click('[data-nav="chat"]');
  62  |     await page.waitForURL('**/chat.html');
  63  |     await page.waitForTimeout(2000);
  64  |     console.log('Chat errors:', errors.filter(e => !e.includes('favicon')));
  65  | 
  66  |     // You (Profile) - redirects to login since protected
  67  |     await page.waitForSelector('[data-nav="you"]', { state: 'visible', timeout: 10000 });
  68  |     await page.click('[data-nav="you"]');
  69  |     await page.waitForURL('**/login.html**');
  70  |     await page.waitForTimeout(2000);
  71  |     console.log('Profile redirect errors:', errors.filter(e => !e.includes('favicon') && !e.includes('already declared')));
  72  |   });
  73  | 
  74  |   test('Login flow', async ({ page }) => {
  75  |     const errors = [];
  76  |     page.on('console', msg => {
  77  |       if (msg.type() === 'error') errors.push(msg.text());
  78  |     });
  79  |     page.on('pageerror', err => errors.push(err.message));
  80  | 
  81  |     await page.goto('http://localhost:5500/login.html', { waitUntil: 'networkidle' });
  82  |     await page.waitForTimeout(1000);
  83  |     
  84  |     // Check login form elements
  85  |     await expect(page.locator('#emailForm')).toBeVisible();
  86  |     await expect(page.locator('#email')).toBeVisible();
  87  |     await expect(page.locator('#password')).toBeVisible();
  88  |     await expect(page.locator('#googleBtn')).toBeVisible();
  89  |     
  90  |     // Test invalid email
  91  |     await page.fill('#email', 'invalid');
  92  |     await page.fill('#password', 'password');
  93  |     await page.click('#emailSubmitBtn');
  94  |     await page.waitForTimeout(500);
  95  |     const status = await page.locator('#authFormStatus').textContent();
  96  |     console.log('Invalid email status:', status);
  97  |     
  98  |     // Test invalid password (valid email format)
  99  |     await page.fill('#email', 'test@example.com');
  100 |     await page.fill('#password', 'wrong');
  101 |     await page.click('#emailSubmitBtn');
  102 |     await page.waitForTimeout(2000);
  103 |     const status2 = await page.locator('#authFormStatus').textContent();
  104 |     console.log('Wrong password status:', status2);
  105 |     
  106 |     console.log('Login errors:', errors.filter(e => !e.includes('favicon')));
  107 |   });
  108 | 
  109 |   test('Discover page - four lanes only (mobile)', async ({ page }) => {
  110 |     const errors = [];
  111 |     page.on('console', msg => {
  112 |       if (msg.type() === 'error') errors.push(msg.text());
  113 |     });
  114 |     page.on('pageerror', err => errors.push(err.message));
  115 | 
  116 |     await page.setViewportSize({ width: 390, height: 844 });
> 117 |     await page.goto('http://localhost:5500/all-users.html', { waitUntil: 'networkidle' });
      |                ^ Error: page.goto: Test timeout of 30000ms exceeded.
  118 |     await page.waitForTimeout(3000);
  119 | 
  120 |     // Check four lane cards
  121 |     await expect(page.locator('.discover-lane-card')).toHaveCount(4);
  122 |     
  123 |     // Check lane labels
  124 |     const lanes = await page.locator('.lane-copy strong').allTextContents();
  125 |     console.log('Discover lanes:', lanes);
  126 |     
  127 |     // Should be Build, Learn, Challenge, Puzzle (not Game)
  128 |     expect(lanes).toContain('Build');
  129 |     expect(lanes).toContain('Learn');
  130 |     expect(lanes).toContain('Challenge');
  131 |     expect(lanes).toContain('Puzzle');
  132 |     expect(lanes).not.toContain('Game');
  133 |     
  134 |     console.log('Discover errors:', errors.filter(e => !e.includes('favicon')));
  135 |   });
  136 | 
  137 |   test('Activity pages load correctly (mobile)', async ({ page }) => {
  138 |     const errors = [];
  139 |     page.on('console', msg => {
  140 |       if (msg.type() === 'error') errors.push(msg.text());
  141 |     });
  142 |     page.on('pageerror', err => errors.push(err.message));
  143 | 
  144 |     await page.setViewportSize({ width: 390, height: 844 });
  145 | 
  146 |     // Test Build lane
  147 |     await page.goto('http://localhost:5500/build.html', { waitUntil: 'networkidle' });
  148 |     await page.waitForTimeout(3000);
  149 |     await expect(page.locator('#forgeList')).toBeVisible();
  150 |     console.log('Build page errors:', errors.filter(e => !e.includes('favicon')));
  151 | 
  152 |     // Test Learn lane
  153 |     await page.goto('http://localhost:5500/learn.html', { waitUntil: 'networkidle' });
  154 |     await page.waitForTimeout(3000);
  155 |     await expect(page.locator('#forgeList')).toBeVisible();
  156 |     console.log('Learn page errors:', errors.filter(e => !e.includes('favicon')));
  157 | 
  158 |     // Test Challenge lane
  159 |     await page.goto('http://localhost:5500/challenge.html', { waitUntil: 'networkidle' });
  160 |     await page.waitForTimeout(3000);
  161 |     await expect(page.locator('#forgeList')).toBeVisible();
  162 |     console.log('Challenge page errors:', errors.filter(e => !e.includes('favicon')));
  163 |   });
  164 | 
  165 |   test('Activity detail page loads', async ({ page }) => {
  166 |     const errors = [];
  167 |     page.on('console', msg => {
  168 |       if (msg.type() === 'error') errors.push(msg.text());
  169 |     });
  170 |     page.on('pageerror', err => errors.push(err.message));
  171 | 
  172 |     await page.setViewportSize({ width: 390, height: 844 });
  173 | 
  174 |     // Try loading a puzzle activity
  175 |     await page.goto('http://localhost:5500/activity.html?id=p1', { waitUntil: 'networkidle' });
  176 |     await page.waitForTimeout(5000);
  177 |     
  178 |     const url = page.url();
  179 |     console.log('Activity page URL:', url);
  180 |     
  181 |     // Check if it's login or activity page
  182 |     if (url.includes('login')) {
  183 |       console.log('Redirected to login as expected');
  184 |     } else {
  185 |       await expect(page.locator('#activityTitle')).toBeVisible();
  186 |       const title = await page.locator('#activityTitle').textContent();
  187 |       console.log('Activity title:', title);
  188 |     }
  189 |     
  190 |     console.log('Activity detail errors:', errors.filter(e => !e.includes('favicon')));
  191 |   });
  192 | 
  193 |   test('Rooms page loads (mobile)', async ({ page }) => {
  194 |     const errors = [];
  195 |     page.on('console', msg => {
  196 |       if (msg.type() === 'error') errors.push(msg.text());
  197 |     });
  198 |     page.on('pageerror', err => errors.push(err.message));
  199 | 
  200 |     await page.setViewportSize({ width: 390, height: 844 });
  201 |     await page.goto('http://localhost:5500/rooms.html', { waitUntil: 'networkidle' });
  202 |     await page.waitForTimeout(3000);
  203 |     
  204 |     const url = page.url();
  205 |     console.log('Rooms page URL:', url);
  206 |     
  207 |     console.log('Rooms errors:', errors.filter(e => !e.includes('favicon')));
  208 |   });
  209 | 
  210 |   test('Theme toggle works (mobile)', async ({ page }) => {
  211 |     const errors = [];
  212 |     page.on('console', msg => {
  213 |       if (msg.type() === 'error') errors.push(msg.text());
  214 |     });
  215 |     page.on('pageerror', err => errors.push(err.message));
  216 | 
  217 |     await page.setViewportSize({ width: 390, height: 844 });
```