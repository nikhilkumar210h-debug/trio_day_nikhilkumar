const Q={
p1:{kind:'quiz',question:'Notebook mystery: Ava says Ben took it. Ben says “I did not take it.” Exactly one statement is true. Who took it?',options:['Ava','Ben','Cara','Cannot determine'],correct:0,lesson:'If Ava took it, Ava’s claim is false and Ben’s denial is true; if Ben took it, both statements become false. The clue therefore selects Ava.'},
p2:{kind:'quiz',question:'You have stops A, B, C and D. Start at Home, end at D, visit A before C, and visit C immediately before D. Which route works?',options:['Home → A → B → C → D','Home → B → A → D → C','Home → C → A → B → D','Home → A → C → B → D'],correct:0,lesson:'Check every constraint: the route must end at D, A must precede C, and C must be directly followed by D.'},
p3:{kind:'quiz',question:'Which product-review claim is weakest evidence?',options:['“Battery lasted 9 hours in my test.”','“Three days of use included two charges.”','“Everyone will love this battery.”','“I measured 8.7 hours with brightness at 60%.”'],correct:2,lesson:'A measurable observation is evidence; a universal prediction such as “everyone will love it” is not a test result.'},
p4:{kind:'quiz',question:'If each letter is shifted 2 places forward, CAT becomes ECV. What does HOME become?',options:['JQOG','IPNF','GMLC','KROH'],correct:0,lesson:'Shift each letter by the same amount: H→J, O→Q, M→O, E→G.'},
p5:{kind:'quiz',question:'A ₹5,000 budget needs Venue ≥₹1,000, Food ≥₹1,500, Travel ≥₹500 and Reserve ≥₹300. Which allocation uses exactly ₹5,000 and meets every minimum?',options:['1000, 1500, 500, 2000','900, 1700, 500, 1900','1200, 1400, 500, 1900','1200, 1500, 400, 1900'],correct:0,lesson:'Add each option to ₹5,000 and check the minimums. Only the first meets all four minimums while using the full budget.'},
p6:{kind:'quiz',question:'On a grid, a shortest-path algorithm is comparing two routes. Route A has 8 moves; Route B has 11. Neither crosses a blocked cell. Which is shorter?',options:['Route A','Route B','They are equal','Need the colours'],correct:0,lesson:'When every move has the same cost, the route with fewer moves is shorter.'},
p7:{kind:'quiz',question:'A meeting is fixed on Wednesday. Maths must happen before Coding, and Design must be Tuesday. Which schedule works?',options:['Mon Maths, Tue Design, Wed Coding','Mon Design, Tue Maths, Wed Coding','Mon Coding, Tue Design, Wed Maths','Mon Maths, Tue Coding, Wed Design'],correct:0,lesson:'The fixed Wednesday event plus Tuesday Design and Maths-before-Coding leave only the first schedule.'},
p8:{kind:'quiz',question:'You want to test whether a new study playlist improves quiz scores. Which design is fairest?',options:['Change music and study time together','Keep study time fixed and compare with no playlist','Use only the highest scorer','Ask people whether they think music works'],correct:1,lesson:'A controlled comparison changes the variable of interest while keeping the main conditions the same.'},
p9:{kind:'quiz',question:'A fair coin is flipped twice. Which outcome has probability 1/2?',options:['Two heads','At least one head','Exactly one head','Two tails'],correct:2,lesson:'The four equally likely outcomes are HH, HT, TH and TT. Exactly one head occurs in HT and TH: 2 of 4.'},
p10:{kind:'quiz',question:'Workflow: “Send report” requires “Generate report”, but the workflow tries to send first. What should be fixed first?',options:['Colour of the button','The dependency order','The font size','The final message'],correct:1,lesson:'A step cannot use an output that does not exist yet. Fix the dependency order before polishing the interface.'},
p11:{kind:'quiz',question:'A choice must be under ₹2,000, support Python, and have at least 8 GB RAM. Which option meets all hard constraints?',options:['₹1,800, Python, 8 GB','₹1,900, Java, 16 GB','₹2,100, Python, 16 GB','₹1,500, Python, 4 GB'],correct:0,lesson:'Hard constraints are filters. An option that fails even one required condition is out.'},
p12:{kind:'quiz',question:'Code clues: 682 has one digit correct and well placed; 614 has one digit correct but misplaced; 206 has two digits correct but misplaced; 738 has no correct digits. Which is a valid code?',options:['042','024','420','204'],correct:0,lesson:'Eliminate 7,3,8 first. Then keep exact-position and misplaced-digit clues separate. The remaining constraints select 042.'}
,l1:{kind:'lesson',question:'Which Python structure maps keys to values?',options:['List','Tuple','Dictionary','Set'],correct:2,lesson:'Python dictionaries store data as key → value pairs. They are useful when you need to look something up by a meaningful key.'},
l2:{kind:'lesson',question:'What does an INNER JOIN return?',options:['Every row from both tables','Only rows matching the join condition','Only rows from the left table','Only rows from the right table'],correct:1,lesson:'An INNER JOIN keeps rows where the join condition matches in both tables. Think of it as the intersection of the two datasets.'},
l3:{kind:'lesson',question:'Which measure is least affected by a single extreme outlier?',options:['Mean','Median','Sum','Range'],correct:1,lesson:'The median depends on the middle position after sorting, so one unusually high or low value usually changes it much less than the mean.'},
l4:{kind:'lesson',question:'A vector has which two basic properties?',options:['Color and shape','Magnitude and direction','Weight and speed','Length and age'],correct:1,lesson:'A vector represents both how much and which way. That makes vectors useful for movement, forces and many machine-learning calculations.'},
l5:{kind:'lesson',question:'In Bayes-style reasoning, what does new evidence do?',options:['Always proves the claim','Updates the probability of the claim','Deletes the prior','Guarantees certainty'],correct:1,lesson:'Bayesian reasoning updates a prior belief when new evidence arrives. The update depends on how expected that evidence was under each possibility.'},
l6:{kind:'lesson',question:'If net force is zero, an object can still be moving. What happens?',options:['It must stop immediately','It continues at constant velocity','It must accelerate','It disappears'],correct:1,lesson:'Zero net force means zero acceleration. An object already moving can continue at constant velocity when forces balance.'},
l7:{kind:'lesson',question:'Which system typically translates a domain name into an IP address?',options:['DNS','HTML','CSS','GPU'],correct:0,lesson:'DNS acts like the web’s naming system. A browser can ask DNS for the address associated with a domain before connecting to the server.'},
l8:{kind:'lesson',question:'Why use async/await in JavaScript?',options:['To make CSS faster','To write asynchronous code in a clearer flow','To remove all errors','To replace HTML'],correct:1,lesson:'async/await provides readable syntax for waiting on promises. It does not make work magically synchronous; it makes asynchronous control flow easier to follow.'},
l9:{kind:'lesson',question:'What does a Git branch represent?',options:['A separate line of development','A backup of the laptop','A file type','A package manager'],correct:0,lesson:'A Git branch is a movable pointer to a line of commits. It lets you work on changes without immediately mixing them into another branch.'},
l10:{kind:'lesson',question:'What is overfitting?',options:['A model that learns only the training examples too closely','A model that has no parameters','A model that never trains','A model with perfect generalization'],correct:0,lesson:'Overfitting happens when a model fits training data too specifically and performs worse on new data. Validation data helps reveal this gap.'},
l11:{kind:'lesson',question:'What is a neural-network weight?',options:['A parameter learned during training','A dataset row','A UI theme','A browser tab'],correct:0,lesson:'Weights are numerical parameters that influence how signals are transformed through a neural network. Training adjusts them to reduce the model’s error.'},
l12:{kind:'lesson',question:'What makes a technical explanation easier for a beginner?',options:['More jargon','One clear idea plus a concrete example','Longer sentences','No examples'],correct:1,lesson:'Start with one core idea, then ground it in a familiar example. Add technical vocabulary only when it helps precision.'},
l13:{kind:'lesson',question:'What is a user story mainly used for?',options:['Describe a user goal and value','Pick a colour palette','Store a database password','Measure CPU temperature'],correct:0,lesson:'A user story frames who needs something, what they need, and why. It helps the team focus on user value before implementation details.'},
l14:{kind:'lesson',question:'Which habit is most useful when testing a product idea?',options:['Run a small test with a real task','Change five variables at once','Only ask whether people like the logo','Skip the observation'],correct:0,lesson:'A small task-based test exposes real friction. Observing what someone does is usually more useful than asking only for opinions.'},
l15:{kind:'lesson',question:'What does a dependency mean in project work?',options:['One task needs another task first','Two tasks have the same colour','A task has no deadline','A feature has more buttons'],correct:0,lesson:'A dependency means one piece of work relies on another being ready first. Mapping dependencies helps a team find the critical path.'},
p13:{kind:'quiz',question:'Museum timeline: A happens before B, B happens before C, and D happens after A but before C. Which ordering works?',options:['A → D → B → C','B → A → D → C','D → A → C → B','A → C → D → B'],correct:0,lesson:'Anchor the dependency chain first, then place D between A and C.'},
p14:{kind:'quiz',question:'Signal room: every letter shifts +1. What does B-I-G become?',options:['C-J-H','A-H-F','C-I-G','D-K-I'],correct:0,lesson:'Apply the same shift to every character: B→C, I→J, G→H.'},
p15:{kind:'quiz',question:'Locked lab: start with 4, add 6, then double. What is the final code?',options:['14','18','20','24'],correct:2,lesson:'4 + 6 = 10, then double it: 20.'}
};

const CHALLENGES={
c1:[
{q:'You have 10 minutes and three things shouting for attention. What is the team move?',o:['Pick one finish line and mute the rest','Open everything at once','Wait for motivation','Start with the easiest distraction'],a:0},
{q:'Your teammate is stuck and the clock is running. Best move?',o:['Give the whole answer','Ask for their current idea and add one hint','Ignore them','Restart the task'],a:1},
{q:'A plan keeps growing. What makes it playable now?',o:['Add more steps','Cut it to one clear outcome','Add more tools','Make the deadline longer'],a:1},
{q:'A five-minute break should help the team:',o:['Reset without losing the goal','Forget the task','Start a new project','Turn notifications back on'],a:0},
{q:'Best final 30-second check?',o:['What did we actually finish?','What else can we start?','Who was busiest?','Can we add one more feature?'],a:0}],
c2:[
{q:'Four clues point to different suspects. Safest first move?',o:['Pick the funniest suspect','List what each clue rules out','Ignore the clues','Choose the first name'],a:1},
{q:'A teammate claims A must be before B, but the note says B before A. What next?',o:['Choose your favourite rule','Check the source and keep the contradiction visible','Delete both rules','Guess'],a:1},
{q:'Two solutions both satisfy every hard clue. What should the team compare next?',o:['Randomness','Soft preferences and trade-offs','A new hidden rule','Nothing'],a:1},
{q:'You find one clue that breaks the current theory. That means:',o:['The clue is probably wrong','Re-check the theory','Hide the clue','Finish anyway'],a:1},
{q:'What makes a logic room more fun?',o:['Everyone can explain one deduction','One person solves silently','No feedback','Random rules'],a:0}],
c3:[
{q:'A teammate predicts a loop output. Best way to compare?',o:['Run it and argue','Trace the values together first','Delete the code','Change the question'],a:1},
{q:'Your code works once but fails on a second input. Best next move?',o:['Test the second input carefully','Celebrate and stop','Change the colours','Rewrite every file'],a:0},
{q:'Two bugs appear. Which should you inspect first?',o:['The one blocking the rest of the flow','The one with the nicer message','Both randomly','Neither'],a:0},
{q:'A good pair-programming handoff should include:',o:['What changed and what still fails','Only the final screenshot','A secret trick','No context'],a:0},
{q:'When teammates disagree about output, useful evidence is:',o:['A reproducible example','A louder voice','A guess','A new font'],a:0}],
c4:[
{q:'You have ₹1,000 and four possible upgrades. Team rule: protect essentials first. What next?',o:['Spend all ₹1,000','Reserve essentials, then use the remainder','Ignore the total','Choose the flashiest item'],a:1},
{q:'A ₹600 item gets 25% off. Final price?',o:['₹450','₹475','₹500','₹525'],a:0},
{q:'Three equal snacks cost ₹270. One snack costs:',o:['₹60','₹80','₹90','₹120'],a:2},
{q:'A surprise expense appears. Which resource helps most?',o:['Buffer','More tabs','A longer title','A second scoreboard'],a:0},
{q:'Best team budgeting habit?',o:['Say what is fixed and what is flexible','Hide the remaining amount','Round every number randomly','Spend before checking'],a:0}],
c5:[
{q:'Your team tests whether light changes plant growth. What should stay the same?',o:['Everything except the light condition','The conclusion only','Nothing','The data after the test'],a:0},
{q:'Which result is easiest to trust?',o:['A repeatable measurement with the method recorded','A confident opinion','A single dramatic photo','A guess'],a:0},
{q:'Two variables changed and the result improved. Can you say which caused it?',o:['Yes, definitely','Not cleanly without isolating variables','Only if the chart is pretty','Only after deleting outliers'],a:1},
{q:'A control condition gives the team:',o:['A comparison point','A guaranteed answer','Extra variables','A shortcut around measurement'],a:0},
{q:'Results surprise you. Best next move?',o:['Inspect the method and repeat carefully','Pick the result you like','Hide the data','Change the question'],a:0}],
c6:[
{q:'A viral post says a product lasts forever. First question?',o:['What was actually measured?','How many likes?','What colour is the logo?','Who shared it first?'],a:0},
{q:'Two sources disagree. What should the team compare?',o:['Methods, dates and evidence','Follower counts','Headlines only','Font sizes'],a:0},
{q:'Which claim is an opinion?',o:['Battery lasted 8 hours in my test','It is the most beautiful phone','Weight is 180 g','I measured 20 photos'],a:1},
{q:'A number appears without a method. Treat it as:',o:['Final proof','A claim that needs more evidence','A guaranteed fact','A control group'],a:1},
{q:'What is a fun fact-check rule for a team?',o:['Find one claim and chase its evidence','Believe the first result','Only read comments','Ignore sources'],a:0}],
c7:[
{q:'A fixed appointment is at 3 pm. What goes on the board first?',o:['The fixed event','The optional task','The longest title','The final reflection'],a:0},
{q:'Task B depends on A. Starting B first causes:',o:['A clean dependency','A missing prerequisite','More free time','A completed B'],a:1},
{q:'Two tasks cannot overlap. What matters?',o:['Duration and time window','Emoji count','Colour','File name'],a:0},
{q:'You have a 20-minute task, starting at 4:10. It ends at:',o:['4:20','4:25','4:30','4:40'],a:2},
{q:'A team schedule is most playable when it leaves:',o:['Some buffer','Zero gaps','Three extra meetings','A secret slot'],a:0}],
c8:[
{q:'What is 15% of 200?',o:['20','25','30','35'],a:2},
{q:'A score rises from 40 to 50. Increase?',o:['5','10','15','20'],a:1},
{q:'Which number is prime?',o:['21','27','29','33'],a:2},
{q:'A fair die has 6 sides. Chance of rolling 6?',o:['1/2','1/3','1/6','1/12'],a:2},
{q:'A team splits 84 points equally across 4 players. Each gets:',o:['18','20','21','24'],a:2}],
c9:[
{q:'A model is great on training data and weak on new data. Likely issue?',o:['Overfitting','Perfect generalisation','No features','Guaranteed fairness'],a:0},
{q:'What does a validation set help you decide?',o:['How the model behaves during development','The UI font','The folder name','The Wi-Fi password'],a:0},
{q:'Which change is most likely to test whether a model generalises?',o:['Evaluate on unseen examples','Train on the same rows forever','Rename columns','Add emojis'],a:0},
{q:'A model gets 99% accuracy on a very imbalanced dataset. What should the team ask?',o:['Is accuracy hiding the minority-class errors?','Can we make the logo bigger?','Should we delete the test set?','Is 99 always perfect?'],a:0},
{q:'Good ML teamwork includes:',o:['Sharing assumptions and checking results','Hiding failed runs','Changing the metric after seeing the answer','Only showing the best chart'],a:0}],
c10:[
{q:'A friend asks what async/await does. Clearest answer?',o:['It helps write promise waiting in a readable flow','It makes JavaScript instant','It removes all errors','It replaces HTML'],a:0},
{q:'A beginner looks confused. Best explanation move?',o:['One example, then the rule','More jargon','Faster speech','A random analogy'],a:0},
{q:'Which example is easiest to teach?',o:['A tiny case that matches the idea','A giant unrelated project','A secret trick','A paragraph of jargon'],a:0},
{q:'Good teamwork when explaining means:',o:['Letting the other person restate the idea','Talking continuously','Correcting every word instantly','Skipping questions'],a:0},
{q:'Best way to make a concept memorable?',o:['Connect it to a concrete example','Add five new terms','Hide the key idea','Use the longest sentence'],a:0}],
c11:[
{q:'A bug appears only after clicking Save. First move?',o:['Reproduce the exact sequence','Rewrite the app','Change the logo','Delete Save'],a:0},
{q:'The error disappears when one input changes. What did you learn?',o:['That input may be part of the cause','The bug is gone forever','The database is broken','Nothing'],a:0},
{q:'A fix works locally. What is the team check?',o:['Repeat the original failure and nearby cases','Ship immediately','Delete the old test','Rename the branch'],a:0},
{q:'Two fixes are possible. What should decide?',o:['Evidence, risk and reversibility','Which sounds cooler','Which has more code','Which took longer'],a:0},
{q:'Best debugging room rule?',o:['Make small changes and verify each one','Change five things at once','Skip reproduction','Hide regressions'],a:0}],
c12:[
{q:'Two plans satisfy every hard requirement. Next comparison?',o:['Trade-offs and nice-to-haves','Invent a new rule','Pick randomly','Ignore the constraints'],a:0},
{q:'A hard constraint is something that:',o:['Must be satisfied','Would be nice','Changes with mood','Only matters visually'],a:0},
{q:'A buffer is most useful when:',o:['The outcome has uncertainty','Everything is guaranteed','You want zero flexibility','No resources exist'],a:0},
{q:'A transparent decision log should capture:',o:['Criteria, evidence and reasoning','Only the winner','A secret score','Nothing'],a:0},
{q:'Best team decision habit?',o:['Say what would change your mind','Defend the first idea forever','Hide uncertainty','Skip evidence'],a:0}]
,
c13:[
{q:'Heist timeline: which move should happen first?',o:['Place the fixed anchor event','Choose a random middle step','Ignore dependencies','Pick the shortest word'],a:0},
{q:'A teammate owns two clues. Best competitive move?',o:['Share the key deduction before the timer ends','Hide every clue','Change the rules','Stop answering'],a:0},
{q:'Two players have equal scores. Best tie-break?',o:['A correct one-sentence justification','Who typed more emojis','Who joined first','Random choice'],a:0},
{q:'A clue contradicts your current answer. What should you do?',o:['Re-check the deduction','Ignore the clue','Lock the answer faster','Delete the chat'],a:0},
{q:'Final round: what wins a team-friendly challenge?',o:['Correctness plus a clear reason','Volume of messages','Longest answer','Most tabs'],a:0}],
c14:[
{q:'Signal race: you receive a partial code. Best move?',o:['Compare it with another player’s chunk','Guess the rest instantly','Ignore your chunk','Restart the room'],a:0},
{q:'A symbol key is ambiguous. What helps?',o:['Cross-check against another occurrence','Pick a meaning randomly','Delete the symbol','Wait for the timer'],a:0},
{q:'Two decodings are possible. What should decide?',o:['The full-message consistency','Who spoke first','The louder player','The shortest guess'],a:0},
{q:'A teammate spots a mismatch. Best move?',o:['Pause and verify the shared rule','Hide the mismatch','Change every symbol','Ignore it'],a:0},
{q:'Final signal is correct when:',o:['Every chunk agrees with the reconstructed message','One player feels confident','The message is longest','The timer is still running'],a:0}],
c15:[
{q:'Escape lab: which layer should be solved first?',o:['The prerequisite clue','The final code','A random optional clue','The room title'],a:0},
{q:'A teammate solved layer 1. Best handoff?',o:['Explain the rule and the result to the next solver','Just type “done”','Hide the method','Reset the puzzle'],a:0},
{q:'Two possible codes remain. Best move?',o:['Use the next clue to eliminate one','Guess immediately','Average the codes','Ask the title'],a:0},
{q:'The final clue changes a rule. What now?',o:['Re-run the affected deduction','Ignore the new rule','Keep the old result','Stop checking'],a:0},
{q:'The room escapes when:',o:['All three layers agree and the final code is valid','One person guesses correctly','The timer reaches zero','Everyone sends a message'],a:0}]
};

const GAMES={
g1:{rounds:[
{q:'Quick pick: which action gives the team a new clue?',o:['Ask a teammate to explain their reasoning','Refresh the page','Ignore the clue','Rename the room'],a:0},
{q:'Quick pick: the timer is low. What helps most?',o:['Choose one clear next move','Open three new tasks','Argue about the title','Wait silently'],a:0},
{q:'Quick pick: a teammate has a different answer. Best move?',o:['Hear their reason before deciding','Dismiss it','Hide both answers','Change the question'],a:0},
{q:'Quick pick: you find a useful shortcut. What should you do?',o:['Share it with the room','Keep it secret','Reset the game','Delete the chat'],a:0},
{q:'Final pick: the team finishes early. Best ending?',o:['Compare strategies and celebrate','Add random penalties','Erase the score','Restart automatically'],a:0}]},
g2:{rounds:[
{q:'Pattern: 2, 4, 2, 4, __',o:['2','3','4','6'],a:0},
{q:'Pattern: ▲ ○ ▲ ○ __',o:['○','▲','■','□'],a:1},
{q:'Pattern: 1, 1, 2, 2, 3, 3, __',o:['3','4','5','6'],a:1},
{q:'Pattern: A, C, A, C, __',o:['A','B','C','D'],a:0},
{q:'Pattern: 5, 10, 5, 10, __',o:['5','10','15','20'],a:0}]},
g3:{rounds:[
{q:'Odd one out: apple, mango, carrot, banana',o:['apple','mango','carrot','banana'],a:2},
{q:'Odd one out: HTML, CSS, JavaScript, PNG',o:['HTML','CSS','JavaScript','PNG'],a:3},
{q:'Odd one out: 12, 18, 24, 31',o:['12','18','24','31'],a:3},
{q:'Odd one out: bus, train, bicycle, keyboard',o:['bus','train','bicycle','keyboard'],a:3},
{q:'Odd one out: red, blue, green, triangle',o:['red','blue','green','triangle'],a:3}]},
g4:{rounds:[
{q:'Lightning: 17 + 8 = ?',o:['23','24','25','26'],a:2},
{q:'Lightning: 12 × 7 = ?',o:['72','84','96','108'],a:1},
{q:'Lightning: 90 − 37 = ?',o:['43','53','57','63'],a:1},
{q:'Lightning: 144 ÷ 12 = ?',o:['10','11','12','14'],a:2},
{q:'Lightning: 19 + 26 = ?',o:['35','45','46','55'],a:1}]},
g5:{rounds:[
{q:'Which planet is famous for its rings?',o:['Mars','Saturn','Venus','Mercury'],a:1},
{q:'What does CPU stand for?',o:['Central Processing Unit','Computer Power Utility','Core Program User','Central Print Unit'],a:0},
{q:'Which is renewable?',o:['Coal','Solar','Petrol','Natural gas'],a:1},
{q:'Which runs directly in browsers?',o:['JavaScript','Python only','SQL only','C only'],a:0},
{q:'A URL mainly identifies:',o:['A web resource address','A CPU core','A colour palette','A password'],a:0}]},
g6:{rounds:[
{q:'Number sprint: 3, 6, 9, 12, __',o:['14','15','16','18'],a:1},
{q:'Number sprint: 2, 4, 8, 16, __',o:['24','28','30','32'],a:3},
{q:'Number sprint: 1, 4, 9, 16, __',o:['20','24','25','36'],a:2},
{q:'Number sprint: 10, 8, 6, 4, __',o:['1','2','3','5'],a:1},
{q:'Number sprint: 6, 12, 18, 24, __',o:['28','30','32','36'],a:1}]},
g7:{rounds:[
{q:'Riddle: I carry people but never walk. What am I?',o:['Bus','Banana','Button','Blanket'],a:0},
{q:'Riddle: I have pages but I am not a tree. What am I?',o:['Book','Bottle','Battery','Browser'],a:0},
{q:'Riddle: I tell temperature but cannot feel cold. What am I?',o:['Thermometer','Keyboard','Calendar','Speaker'],a:0},
{q:'Riddle: I open websites for you. What am I?',o:['Browser','Router','Battery','Printer'],a:0},
{q:'Riddle: I hold reusable code in one file. What am I?',o:['Module','Monitor','Mouse','Memory'],a:0}]},
g8:{rounds:[
{q:'Grid dash: right of cell 5 in a 4×4 board?',o:['4','6','9','1'],a:1},
{q:'Grid dash: below cell 2?',o:['3','5','6','8'],a:2},
{q:'Grid dash: horizontal neighbours?',o:['1 & 2','1 & 5','2 & 7','4 & 9'],a:0},
{q:'Grid dash: vertical neighbours?',o:['2 & 3','2 & 6','6 & 7','1 & 4'],a:3},
{q:'Grid dash: diagonal down-right from 6?',o:['7','9','10','11'],a:3}]},
g9:{rounds:[
{q:'Rule race: add 5. 7 → ?',o:['10','11','12','13'],a:2},
{q:'Rule race: multiply by 3. 4 → ?',o:['7','10','12','14'],a:2},
{q:'Rule race: subtract 4. 13 → ?',o:['7','8','9','10'],a:2},
{q:'Rule race: square. 5 → ?',o:['10','20','25','30'],a:2},
{q:'Rule race: halve 18 → ?',o:['6','8','9','12'],a:2}]},
g10:{rounds:[
{q:'Story choice: the team is late for a train. Best next move?',o:['Check the next available train','Teleport randomly','Ignore the clock','Delete the station'],a:0},
{q:'Story choice: the map shows a closed bridge. Best move?',o:['Take the marked alternative route','Drive through the barrier','Ignore the map','Wait without checking'],a:0},
{q:'Story choice: the battery hits 5% before the final task. Best move?',o:['Save power for the final task','Open every app','Turn brightness to maximum','Ignore the warning'],a:0},
{q:'Story choice: rain starts during a picnic. Best move?',o:['Move to shelter','Leave all supplies outside','Delete the weather','Keep going without checking'],a:0},
{q:'Story choice: the clue says the key is blue. What should the team inspect first?',o:['Blue keys','Every object equally','Only red objects','Nothing'],a:0}]},
g11:{rounds:[
{q:'Co-op rule: one player has an idea. Best team move?',o:['Let them explain it','Interrupt immediately','Hide it','Change the rules'],a:0},
{q:'Co-op rule: teammates disagree. Best first step?',o:['Compare their reasons','Vote instantly','Quit','Pick the louder person'],a:0},
{q:'Co-op rule: a shared score is useful because it:',o:['Shows progress across rounds','Replaces discussion','Hides mistakes','Changes the question'],a:0},
{q:'Co-op rule: someone misses a round. Best move?',o:['Keep the next round open and encourage them','End the game','Reset everyone silently','Remove the player'],a:0},
{q:'Co-op rule: final round ends. Best finish?',o:['Celebrate, compare strategies and check the score','Hide the score','Delete the game','Start a random rule'],a:0}]},
g12:{rounds:[
{q:'Target hunt: which symbol matches ★?',o:['○','★','▲','■'],a:1},
{q:'Target hunt: which symbol matches ●?',o:['●','○','◆','□'],a:0},
{q:'Target hunt: which symbol matches ▲?',o:['■','◆','▲','●'],a:2},
{q:'Target hunt: which symbol matches ◆?',o:['○','◆','★','▲'],a:1},
{q:'Target hunt: which symbol matches ■?',o:['▲','●','■','◆'],a:2}]}
};
export function getInteractiveConfig(id){return Q[id]||null}
const CHALLENGE_IDS=Object.keys(CHALLENGES);
export function getChallengeRounds(seed=0,count=5){const key=String(seed||'');const idx=/^c(\\d+)$/.test(key)?Math.max(0,Number(key.slice(1))-1)%CHALLENGE_IDS.length:Math.abs(Number(seed)||0)%CHALLENGE_IDS.length;const bank=CHALLENGES[CHALLENGE_IDS[idx]]||CHALLENGES.c1;return Array.from({length:count},(_,i)=>bank[i%bank.length])}
export function getGameRounds(id){return GAMES[id]?.rounds||null}
