# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: qa-audit.spec.js >> Trio Day QA Audit >> Activity pages load correctly (mobile)
- Location: qa-audit.spec.js:137:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.goto: Test timeout of 30000ms exceeded.
Call log:
  - navigating to "http://localhost:5500/build.html", waiting until "networkidle"

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - banner [ref=e2]:
    - generic [ref=e3]:
      - link "☸ trio_day" [ref=e4] [cursor=pointer]:
        - /url: all-users.html
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
        - generic [ref=e26]: FORGE · BUILD
        - heading "Build something." [level=1] [ref=e27]
        - paragraph [ref=e28]: Arrange, connect and make it work.
        - generic [ref=e29]:
          - generic [ref=e30]: 15 ready
          - generic [ref=e31]: No-code builds
          - link "LIVE ROOMS ↗" [ref=e32] [cursor=pointer]:
            - /url: rooms.html
      - generic [ref=e33]: 🛠️
    - generic [ref=e35]:
      - heading "Choose a category" [level=2] [ref=e38]
      - generic [ref=e39]:
        - button "Everything" [ref=e40] [cursor=pointer]
        - button "Adventure" [ref=e41] [cursor=pointer]
        - button "Community" [ref=e42] [cursor=pointer]
        - button "Creativity" [ref=e43] [cursor=pointer]
        - button "Data" [ref=e44] [cursor=pointer]
        - button "Decision" [ref=e45] [cursor=pointer]
        - button "Design" [ref=e46] [cursor=pointer]
        - button "Education" [ref=e47] [cursor=pointer]
        - button "Game Design" [ref=e48] [cursor=pointer]
        - button "Planning" [ref=e49] [cursor=pointer]
        - button "Product" [ref=e50] [cursor=pointer]
        - button "Story" [ref=e51] [cursor=pointer]
        - button "Systems" [ref=e52] [cursor=pointer]
        - button "Team" [ref=e53] [cursor=pointer]
        - button "Tech" [ref=e54] [cursor=pointer]
    - generic [ref=e55]:
      - generic [ref=e56]:
        - heading "Pick something to do" [level=2] [ref=e58]
        - textbox "Search this lane" [ref=e59]:
          - /placeholder: Search this lane…
      - generic [ref=e61]:
        - article [ref=e62]:
          - generic [ref=e65]: 🛠️
          - generic [ref=e68]:
            - generic [ref=e69]:
              - generic [ref=e70]:
                - generic [ref=e71]: Build
                - generic [ref=e72]: Product
              - generic [ref=e73]: ↗
            - generic [ref=e74]: MAKE IT
            - heading "Pitch a Tiny App" [level=3] [ref=e77]
            - paragraph [ref=e78]: Build a one-screen product concept for a very specific user.
            - generic [ref=e79]:
              - generic [ref=e80]: ⏱ 22 min
              - generic [ref=e81]: 👥 2–6
              - generic [ref=e82]: Medium
            - generic [ref=e83]:
              - generic [ref=e84]: by Trio Day
              - generic [ref=e85]:
                - link "View" [ref=e86] [cursor=pointer]:
                  - /url: activity.html?id=b1
                - link "Find a room" [ref=e87] [cursor=pointer]:
                  - /url: rooms.html?taskId=b1&source=catalog
        - article [ref=e88]:
          - generic [ref=e91]: 🛠️
          - generic [ref=e94]:
            - generic [ref=e95]:
              - generic [ref=e96]:
                - generic [ref=e97]: Build
                - generic [ref=e98]: Design
              - generic [ref=e99]: ↗
            - generic [ref=e100]: MAKE IT
            - heading "Poster Sprint" [level=3] [ref=e103]
            - paragraph [ref=e104]: Design a text-only event poster concept that a real person would understand instantly.
            - generic [ref=e105]:
              - generic [ref=e106]: ⏱ 18 min
              - generic [ref=e107]: 👥 2–6
              - generic [ref=e108]: Easy
            - generic [ref=e109]:
              - generic [ref=e110]: by Trio Day
              - generic [ref=e111]:
                - link "View" [ref=e112] [cursor=pointer]:
                  - /url: activity.html?id=b2
                - link "Find a room" [ref=e113] [cursor=pointer]:
                  - /url: rooms.html?taskId=b2&source=catalog
        - article [ref=e114]:
          - generic [ref=e117]: 🛠️
          - generic [ref=e120]:
            - generic [ref=e121]:
              - generic [ref=e122]:
                - generic [ref=e123]: Build
                - generic [ref=e124]: Product
              - generic [ref=e125]: ↗
            - generic [ref=e126]: MAKE IT
            - heading "Three-Feature MVP" [level=3] [ref=e129]
            - paragraph [ref=e130]: Turn a messy idea into a tiny MVP with only three features.
            - generic [ref=e131]:
              - generic [ref=e132]: ⏱ 20 min
              - generic [ref=e133]: 👥 2–6
              - generic [ref=e134]: Medium
            - generic [ref=e135]:
              - generic [ref=e136]: by Trio Day
              - generic [ref=e137]:
                - link "View" [ref=e138] [cursor=pointer]:
                  - /url: activity.html?id=b3
                - link "Find a room" [ref=e139] [cursor=pointer]:
                  - /url: rooms.html?taskId=b3&source=catalog
        - article [ref=e140]:
          - generic [ref=e143]: 🛠️
          - generic [ref=e146]:
            - generic [ref=e147]:
              - generic [ref=e148]:
                - generic [ref=e149]: Build
                - generic [ref=e150]: Game Design
              - generic [ref=e151]: ↗
            - generic [ref=e152]: MAKE IT
            - heading "Mini Party Game" [level=3] [ref=e155]
            - paragraph [ref=e156]: Invent a game that can be played in a chat room in under 10 minutes.
            - generic [ref=e157]:
              - generic [ref=e158]: ⏱ 24 min
              - generic [ref=e159]: 👥 2–6
              - generic [ref=e160]: Medium
            - generic [ref=e161]:
              - generic [ref=e162]: by Trio Day
              - generic [ref=e163]:
                - link "View" [ref=e164] [cursor=pointer]:
                  - /url: activity.html?id=b4
                - link "Find a room" [ref=e165] [cursor=pointer]:
                  - /url: rooms.html?taskId=b4&source=catalog
        - article [ref=e166]:
          - generic [ref=e169]: 🛠️
          - generic [ref=e172]:
            - generic [ref=e173]:
              - generic [ref=e174]:
                - generic [ref=e175]: Build
                - generic [ref=e176]: Planning
              - generic [ref=e177]: ↗
            - generic [ref=e178]: MAKE IT
            - heading "Weekend Plan" [level=3] [ref=e181]
            - paragraph [ref=e182]: Build a realistic weekend plan around three goals and one fixed event.
            - generic [ref=e183]:
              - generic [ref=e184]: ⏱ 18 min
              - generic [ref=e185]: 👥 2–6
              - generic [ref=e186]: Easy
            - generic [ref=e187]:
              - generic [ref=e188]: by Trio Day
              - generic [ref=e189]:
                - link "View" [ref=e190] [cursor=pointer]:
                  - /url: activity.html?id=b5
                - link "Find a room" [ref=e191] [cursor=pointer]:
                  - /url: rooms.html?taskId=b5&source=catalog
        - article [ref=e192]:
          - generic [ref=e195]: 🛠️
          - generic [ref=e198]:
            - generic [ref=e199]:
              - generic [ref=e200]:
                - generic [ref=e201]: Build
                - generic [ref=e202]: Story
              - generic [ref=e203]: ↗
            - generic [ref=e204]: MAKE IT
            - heading "Micro Story" [level=3] [ref=e207]
            - paragraph [ref=e208]: Build a 6-beat story with a surprising but logical ending.
            - generic [ref=e209]:
              - generic [ref=e210]: ⏱ 20 min
              - generic [ref=e211]: 👥 2–6
              - generic [ref=e212]: Easy
            - generic [ref=e213]:
              - generic [ref=e214]: by Trio Day
              - generic [ref=e215]:
                - link "View" [ref=e216] [cursor=pointer]:
                  - /url: activity.html?id=b6
                - link "Find a room" [ref=e217] [cursor=pointer]:
                  - /url: rooms.html?taskId=b6&source=catalog
        - article [ref=e218]:
          - generic [ref=e221]: 🛠️
          - generic [ref=e224]:
            - generic [ref=e225]:
              - generic [ref=e226]:
                - generic [ref=e227]: Build
                - generic [ref=e228]: Tech
              - generic [ref=e229]: ↗
            - generic [ref=e230]: MAKE IT
            - heading "Feature Spec" [level=3] [ref=e233]
            - paragraph [ref=e234]: Write a tiny feature spec another developer could implement.
            - generic [ref=e235]:
              - generic [ref=e236]: ⏱ 24 min
              - generic [ref=e237]: 👥 2–6
              - generic [ref=e238]: Medium
            - generic [ref=e239]:
              - generic [ref=e240]: by Trio Day
              - generic [ref=e241]:
                - link "View" [ref=e242] [cursor=pointer]:
                  - /url: activity.html?id=b7
                - link "Find a room" [ref=e243] [cursor=pointer]:
                  - /url: rooms.html?taskId=b7&source=catalog
        - article [ref=e244]:
          - generic [ref=e247]: 🛠️
          - generic [ref=e250]:
            - generic [ref=e251]:
              - generic [ref=e252]:
                - generic [ref=e253]: Build
                - generic [ref=e254]: Community
              - generic [ref=e255]: ↗
            - generic [ref=e256]: MAKE IT
            - heading "Club Launch Kit" [level=3] [ref=e259]
            - paragraph [ref=e260]: Build the text-only launch plan for a fictional club.
            - generic [ref=e261]:
              - generic [ref=e262]: ⏱ 20 min
              - generic [ref=e263]: 👥 2–6
              - generic [ref=e264]: Easy
            - generic [ref=e265]:
              - generic [ref=e266]: by Trio Day
              - generic [ref=e267]:
                - link "View" [ref=e268] [cursor=pointer]:
                  - /url: activity.html?id=b8
                - link "Find a room" [ref=e269] [cursor=pointer]:
                  - /url: rooms.html?taskId=b8&source=catalog
        - article [ref=e270]:
          - generic [ref=e273]: 🛠️
          - generic [ref=e276]:
            - generic [ref=e277]:
              - generic [ref=e278]:
                - generic [ref=e279]: Build
                - generic [ref=e280]: Decision
              - generic [ref=e281]: ↗
            - generic [ref=e282]: MAKE IT
            - heading "Travel Pack" [level=3] [ref=e285]
            - paragraph [ref=e286]: Build a 10-item travel pack under a strict weight cap.
            - generic [ref=e287]:
              - generic [ref=e288]: ⏱ 20 min
              - generic [ref=e289]: 👥 2–6
              - generic [ref=e290]: Easy
            - generic [ref=e291]:
              - generic [ref=e292]: by Trio Day
              - generic [ref=e293]:
                - link "View" [ref=e294] [cursor=pointer]:
                  - /url: activity.html?id=b9
                - link "Find a room" [ref=e295] [cursor=pointer]:
                  - /url: rooms.html?taskId=b9&source=catalog
        - article [ref=e296]:
          - generic [ref=e299]: 🛠️
          - generic [ref=e302]:
            - generic [ref=e303]:
              - generic [ref=e304]:
                - generic [ref=e305]: Build
                - generic [ref=e306]: Systems
              - generic [ref=e307]: ↗
            - generic [ref=e308]: MAKE IT
            - heading "Support Playbook" [level=3] [ref=e311]
            - paragraph [ref=e312]: Build a four-step response playbook for a fictional app outage.
            - generic [ref=e313]:
              - generic [ref=e314]: ⏱ 22 min
              - generic [ref=e315]: 👥 2–6
              - generic [ref=e316]: Medium
            - generic [ref=e317]:
              - generic [ref=e318]: by Trio Day
              - generic [ref=e319]:
                - link "View" [ref=e320] [cursor=pointer]:
                  - /url: activity.html?id=b10
                - link "Find a room" [ref=e321] [cursor=pointer]:
                  - /url: rooms.html?taskId=b10&source=catalog
        - article [ref=e322]:
          - generic [ref=e325]: 🛠️
          - generic [ref=e328]:
            - generic [ref=e329]:
              - generic [ref=e330]:
                - generic [ref=e331]: Build
                - generic [ref=e332]: Data
              - generic [ref=e333]: ↗
            - generic [ref=e334]: MAKE IT
            - heading "Tiny Dashboard" [level=3] [ref=e337]
            - paragraph [ref=e338]: Design the layout of a dashboard for one decision.
            - generic [ref=e339]:
              - generic [ref=e340]: ⏱ 24 min
              - generic [ref=e341]: 👥 2–6
              - generic [ref=e342]: Medium
            - generic [ref=e343]:
              - generic [ref=e344]: by Trio Day
              - generic [ref=e345]:
                - link "View" [ref=e346] [cursor=pointer]:
                  - /url: activity.html?id=b11
                - link "Find a room" [ref=e347] [cursor=pointer]:
                  - /url: rooms.html?taskId=b11&source=catalog
        - article [ref=e348]:
          - generic [ref=e351]: 🛠️
          - generic [ref=e354]:
            - generic [ref=e355]:
              - generic [ref=e356]:
                - generic [ref=e357]: Build
                - generic [ref=e358]: Team
              - generic [ref=e359]: ↗
            - generic [ref=e360]: MAKE IT
            - heading "Sprint Board" [level=3] [ref=e363]
            - paragraph [ref=e364]: Build a miniature sprint board with four tasks, owners and a finish line.
            - generic [ref=e365]:
              - generic [ref=e366]: ⏱ 20 min
              - generic [ref=e367]: 👥 2–6
              - generic [ref=e368]: Medium
            - generic [ref=e369]:
              - generic [ref=e370]: by Trio Day
              - generic [ref=e371]:
                - link "View" [ref=e372] [cursor=pointer]:
                  - /url: activity.html?id=b12
                - link "Find a room" [ref=e373] [cursor=pointer]:
                  - /url: rooms.html?taskId=b12&source=catalog
        - article [ref=e374]:
          - generic [ref=e377]: 🛠️
          - generic [ref=e380]:
            - generic [ref=e381]:
              - generic [ref=e382]:
                - generic [ref=e383]: Build
                - generic [ref=e384]: Creativity
              - generic [ref=e385]: ↗
            - generic [ref=e386]: MAKE IT
            - heading "Brand in 15" [level=3] [ref=e389]
            - paragraph [ref=e390]: Invent a tiny brand with a name, promise, audience and visual mood.
            - generic [ref=e391]:
              - generic [ref=e392]: ⏱ 20 min
              - generic [ref=e393]: 👥 2–6
              - generic [ref=e394]: Easy
            - generic [ref=e395]:
              - generic [ref=e396]: by Trio Day
              - generic [ref=e397]:
                - link "View" [ref=e398] [cursor=pointer]:
                  - /url: activity.html?id=b13
                - link "Find a room" [ref=e399] [cursor=pointer]:
                  - /url: rooms.html?taskId=b13&source=catalog
        - article [ref=e400]:
          - generic [ref=e403]: 🛠️
          - generic [ref=e406]:
            - generic [ref=e407]:
              - generic [ref=e408]:
                - generic [ref=e409]: Build
                - generic [ref=e410]: Education
              - generic [ref=e411]: ↗
            - generic [ref=e412]: MAKE IT
            - heading "Study Kit" [level=3] [ref=e415]
            - paragraph [ref=e416]: Build a 15-minute study kit for a beginner.
            - generic [ref=e417]:
              - generic [ref=e418]: ⏱ 22 min
              - generic [ref=e419]: 👥 2–6
              - generic [ref=e420]: Medium
            - generic [ref=e421]:
              - generic [ref=e422]: by Trio Day
              - generic [ref=e423]:
                - link "View" [ref=e424] [cursor=pointer]:
                  - /url: activity.html?id=b14
                - link "Find a room" [ref=e425] [cursor=pointer]:
                  - /url: rooms.html?taskId=b14&source=catalog
        - article [ref=e426]:
          - generic [ref=e429]: 🛠️
          - generic [ref=e432]:
            - generic [ref=e433]:
              - generic [ref=e434]:
                - generic [ref=e435]: Build
                - generic [ref=e436]: Adventure
              - generic [ref=e437]: ↗
            - generic [ref=e438]: MAKE IT
            - heading "Escape Route" [level=3] [ref=e441]
            - paragraph [ref=e442]: Build an escape-room plan with clues, order and a final reveal.
            - generic [ref=e443]:
              - generic [ref=e444]: ⏱ 24 min
              - generic [ref=e445]: 👥 2–6
              - generic [ref=e446]: Hard
            - generic [ref=e447]:
              - generic [ref=e448]: by Trio Day
              - generic [ref=e449]:
                - link "View" [ref=e450] [cursor=pointer]:
                  - /url: activity.html?id=b15
                - link "Find a room" [ref=e451] [cursor=pointer]:
                  - /url: rooms.html?taskId=b15&source=catalog
    - generic [ref=e452]:
      - generic [ref=e453]:
        - strong [ref=e454]: Make the next one
        - generic [ref=e455]: Start from a Forge template or create your own activity for the community.
      - link "Create build" [ref=e456] [cursor=pointer]:
        - /url: task-create.html?activity=build
  - navigation "Primary navigation" [ref=e457]:
    - generic [ref=e458]:
      - link "Today" [ref=e459] [cursor=pointer]:
        - /url: index.html
      - link "Discover" [ref=e464] [cursor=pointer]:
        - /url: all-users.html
      - link "Do" [ref=e470] [cursor=pointer]:
        - /url: tasks.html
      - link "Chat" [ref=e475] [cursor=pointer]:
        - /url: chat.html
      - link "You" [ref=e480] [cursor=pointer]:
        - /url: profile.html
  - button "Create" [ref=e486] [cursor=pointer]
```

# Test source

```ts
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
  117 |     await page.goto('http://localhost:5500/all-users.html', { waitUntil: 'networkidle' });
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
> 147 |     await page.goto('http://localhost:5500/build.html', { waitUntil: 'networkidle' });
      |                ^ Error: page.goto: Test timeout of 30000ms exceeded.
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
  218 |     await page.goto('http://localhost:5500/', { waitUntil: 'networkidle' });
  219 |     await page.waitForTimeout(2000);
  220 | 
  221 |     // Check initial theme
  222 |     const initialTheme = await page.getAttribute('html', 'data-theme');
  223 |     console.log('Initial theme:', initialTheme);
  224 | 
  225 |     // Find and click theme toggle in header
  226 |     const themeBtn = page.locator('#headerThemeBtn');
  227 |     if (await themeBtn.count() > 0) {
  228 |       await themeBtn.click();
  229 |       await page.waitForTimeout(500);
  230 |       const newTheme = await page.getAttribute('html', 'data-theme');
  231 |       console.log('New theme:', newTheme);
  232 |       expect(newTheme).not.toBe(initialTheme);
  233 |     } else {
  234 |       console.log('Theme button not found in header');
  235 |       // Check if theme toggle exists in rail (desktop only)
  236 |     }
  237 | 
  238 |     console.log('Theme errors:', errors.filter(e => !e.includes('favicon')));
  239 |   });
  240 | 
  241 |   test('Mobile responsive - 390px width', async ({ page }) => {
  242 |     const errors = [];
  243 |     page.on('console', msg => {
  244 |       if (msg.type() === 'error') errors.push(msg.text());
  245 |     });
  246 |     page.on('pageerror', err => errors.push(err.message));
  247 | 
```