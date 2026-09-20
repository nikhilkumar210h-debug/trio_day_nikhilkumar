const Q={
p1:{kind:'quiz',question:'Notebook mystery: Ava says Ben took it. Ben says Cara took it. Cara says Ben is lying. Exactly one statement is false. Who took it?',options:['Ava','Ben','Cara','Cannot determine'],correct:2,lesson:'Test each possible culprit against all three statements. Only one choice makes exactly one statement false.'},
p2:{kind:'quiz',question:'You have stops A, B, C and D. The route must start at Home, visit A before C, visit B before D, and end at D. Which route works?',options:['Home → A → B → C → D','Home → B → A → D → C','Home → C → A → B → D','Home → A → C → B → D'],correct:0,lesson:'The route must satisfy both precedence rules and finish at D. Check each candidate rather than choosing by appearance.'},
p3:{kind:'quiz',question:'Which product-review claim is weakest evidence?',options:['“Battery lasted 9 hours in my test.”','“Three days of use included two charges.”','“Everyone will love this battery.”','“I measured 8.7 hours with brightness at 60%.”'],correct:2,lesson:'A measurable observation is evidence; a universal prediction such as “everyone will love it” is not a test result.'},
p4:{kind:'quiz',question:'If each letter is shifted 2 places forward, CAT becomes ECV. What does HOME become?',options:['JQOG','JQOG','FQKC','JQOG'],correct:0,lesson:'Shift each letter by the same amount: H→J, O→Q, M→O, E→G.'},
p5:{kind:'quiz',question:'A ₹5,000 budget needs Venue ≥₹1,000, Food ≥₹1,500, Travel ≥₹500 and Reserve ≥₹300. Which allocation is valid?',options:['1000, 1500, 500, 300','900, 1700, 500, 300','1000, 1500, 600, 400','1200, 1500, 500, 900'],correct:0,lesson:'Add the allocation and check every minimum. The first option uses ₹3,300, leaving ₹1,700 unassigned, so it fits.'},
p6:{kind:'quiz',question:'On a grid, a shortest-path algorithm is comparing two routes. Route A has 8 moves; Route B has 11. Neither crosses a blocked cell. Which is shorter?',options:['Route A','Route B','They are equal','Need the colours'],correct:0,lesson:'When every move has the same cost, the route with fewer moves is shorter.'},
p7:{kind:'quiz',question:'A meeting is fixed on Wednesday. Maths must happen before Coding. Design cannot be Monday. Which schedule works?',options:['Mon Maths, Tue Design, Wed Coding','Mon Design, Tue Maths, Wed Coding','Mon Coding, Tue Maths, Wed Design','Mon Maths, Tue Coding, Wed Design'],correct:0,lesson:'Check the fixed Wednesday event, the Maths-before-Coding dependency and the Design restriction together.'},
p8:{kind:'quiz',question:'You want to test whether a new study playlist improves quiz scores. Which design is fairest?',options:['Change music and study time together','Keep study time fixed and compare with no playlist','Use only the highest scorer','Ask people whether they think music works'],correct:1,lesson:'A controlled comparison changes the variable of interest while keeping the main conditions the same.'},
p9:{kind:'quiz',question:'A fair coin is flipped twice. Which outcome has probability 1/2?',options:['Two heads','At least one head','Exactly one head','Two tails'],correct:2,lesson:'The four equally likely outcomes are HH, HT, TH and TT. Exactly one head occurs in HT and TH: 2 of 4.'},
p10:{kind:'quiz',question:'Workflow: “Send report” requires “Generate report”, but the workflow tries to send first. What should be fixed first?',options:['Colour of the button','The dependency order','The font size','The final message'],correct:1,lesson:'A step cannot use an output that does not exist yet. Fix the dependency order before polishing the interface.'},
p11:{kind:'quiz',question:'A choice must be under ₹2,000, support Python, and have at least 8 GB RAM. Which option meets all hard constraints?',options:['₹1,800, Python, 8 GB','₹1,900, Java, 16 GB','₹2,100, Python, 16 GB','₹1,500, Python, 4 GB'],correct:0,lesson:'Hard constraints are filters. An option that fails even one required condition is out.'},
p12:{kind:'quiz',question:'Code clues: 682 has one digit correct and well placed; 614 has one digit correct but misplaced; 206 has two digits correct but misplaced; 738 has no correct digits. Which is a valid code?',options:['042','024','420','204'],correct:1,lesson:'Eliminate 7,3,8 first. Then keep exact-position and misplaced-digit clues separate while testing the candidates.'}
};

const CHALLENGES={
c1:[
{q:'You have 20 minutes for one task. Which action protects focus?',o:['Open five tabs for unrelated tasks','Define one outcome and silence notifications','Check social media first','Keep switching whenever bored'],a:1},
{q:'A notification arrives during deep work. Best default?',o:['Stop immediately','Read every message','Capture it and return to the task','Start a new task'],a:2},
{q:'Your task is too large. Best first move?',o:['Quit','Define a smaller finish line','Add more tools','Wait for motivation'],a:1},
{q:'Which break is most likely to preserve momentum?',o:['A short planned reset','An hour of random browsing','Starting a different project','Deleting the task'],a:0},
{q:'What should a focus session end with?',o:['No record','A quick note on what was finished','Ten new tasks','More notifications'],a:1}],
c2:[
{q:'Three boxes are labelled Red, Blue, Green. One clue says Red is not first. Which method is safest?',o:['Guess','List possible orders','Ignore the clue','Pick the prettiest order'],a:1},
{q:'If A is before B and B is before C, what must be true?',o:['C is before A','A is before C','B is last','Nothing'],a:1},
{q:'A clue says exactly one statement is false. What should you do?',o:['Assume all are true','Test each possible false statement','Ignore the clue','Pick the longest statement'],a:1},
{q:'Two routes have 7 and 9 equal-cost moves. Which is shorter?',o:['7-move route','9-move route','Same','Cannot compare'],a:0},
{q:'A contradiction appears in your deductions. Best move?',o:['Hide it','Re-check the assumptions that produced it','Add another assumption','Stop checking'],a:1}],
c3:[
{q:'What does [1,2,3].length return?',o:['2','3','4','undefined'],a:1},
{q:'Which value is a string?',o:['42','true','"42"','null'],a:2},
{q:'If x=3 and y=4, x+y is?',o:['7','12','34','1'],a:0},
{q:'Which loop is commonly used to visit array items?',o:['for','if','try','class'],a:0},
{q:'A function returns 5. What does calling it give you?',o:['Its returned value','The function name only','A CSS rule','Nothing always'],a:0}],
c4:[
{q:'Budget ₹1,000. You already spent ₹700. Remaining?',o:['₹200','₹300','₹400','₹700'],a:1},
{q:'Which is an essential before an optional upgrade?',o:['Reserve money for a required cost','Spend everything','Ignore totals','Borrow automatically'],a:0},
{q:'A ₹500 item has a ₹100 discount. Final price?',o:['₹400','₹500','₹600','₹100'],a:0},
{q:'If four equal items cost ₹800 total, one costs?',o:['₹100','₹150','₹200','₹400'],a:2},
{q:'A buffer is useful because it:',o:['Creates room for surprises','Forces extra spending','Removes all constraints','Makes totals irrelevant'],a:0}],
c5:[
{q:'You test whether light affects plant growth. What should stay comparable?',o:['Everything except light','Only the plant name','Nothing','The conclusion'],a:0},
{q:'A control group is useful because it:',o:['Provides a comparison','Guarantees a result','Changes every variable','Removes measurement'],a:0},
{q:'Changing two variables at once makes it:',o:['Easier to identify the cause','Harder to identify the cause','More controlled','Always perfect'],a:1},
{q:'A measurement should ideally be:',o:['Recorded consistently','Changed after seeing the result','Invented','Ignored'],a:0},
{q:'If results conflict, a good next step is:',o:['Repeat and inspect the method','Delete the data','Choose the nicer result','Hide the conflict'],a:0}],
c6:[
{q:'Which is strongest evidence?',o:['“Everyone says it works.”','A measured result with conditions','“It feels amazing.”','A vague rumour'],a:1},
{q:'“This is the best product ever” is mainly:',o:['A measured result','An opinion/marketing claim','A sample size','A control'],a:1},
{q:'A source gives a number but no method. What should you do?',o:['Treat it as unquestionable','Look for how it was measured','Delete all numbers','Assume the method'],a:1},
{q:'Two sources disagree. First useful check?',o:['Compare their methods and dates','Pick your favourite','Ignore both','Average the opinions'],a:0},
{q:'A claim says “always”. What is useful to seek?',o:['Counterexamples and evidence','A bigger font','More emojis','A random guess'],a:0}],
c7:[
{q:'A task depends on another task. What comes first?',o:['The dependent task','Its prerequisite','The last task','Neither'],a:1},
{q:'You have one fixed appointment. Best scheduling move?',o:['Place the fixed event first','Ignore it','Put everything on that time','Delete it'],a:0},
{q:'Two tasks cannot overlap. What should you check?',o:['Their durations and times','Their emojis','Their file names','Nothing'],a:0},
{q:'A 30-minute task starts at 2:00. It ends at:',o:['2:15','2:20','2:30','3:00'],a:2},
{q:'When planning, a buffer helps with:',o:['Unexpected delay','Removing all work','Changing every deadline','Making time infinite'],a:0}],
c8:[
{q:'15% of 200 is:',o:['15','20','30','40'],a:2},
{q:'8×7 is:',o:['48','54','56','64'],a:2},
{q:'2³ is:',o:['6','8','9','12'],a:1},
{q:'Which is prime?',o:['21','27','29','33'],a:2},
{q:'If a value doubles from 12, it becomes:',o:['18','20','24','30'],a:2}],
c9:[
{q:'A model does very well on training data but poorly on new data. This suggests:',o:['Overfitting','Perfect generalisation','No data','Guaranteed success'],a:0},
{q:'A validation set is mainly used to:',o:['Check generalisation during development','Replace all training data','Decorate a chart','Guarantee fairness'],a:0},
{q:'Which metric is common for a balanced binary classification task?',o:['Accuracy','Font size','Screen width','File name'],a:0},
{q:'Feature scaling can be especially useful for:',o:['Some distance/gradient-based methods','HTML headings','Image filenames','Browser tabs'],a:0},
{q:'A test set should ideally be used:',o:['For final evaluation after development','To tune every decision repeatedly','As the UI theme','To replace validation'],a:0}],
c10:[
{q:'Which explanation is clearest?',o:['“Use asynchronous concurrency semantics.”','“await lets you write promise-based waiting in a readable flow.”','“It is a thing.”','A paragraph of unrelated jargon'],a:1},
{q:'A beginner asks why a loop is used. Best response?',o:['Give one simple example','Use ten new terms','Say “obvious”','Change the subject'],a:0},
{q:'A good technical example should:',o:['Match the idea being explained','Add unrelated complexity','Hide the key point','Use random values'],a:0},
{q:'When introducing jargon, you should:',o:['Define it briefly','Never explain it','Use five synonyms','Avoid the topic'],a:0},
{q:'A useful check after explaining is:',o:['Ask the learner to restate the idea','End immediately','Add more jargon','Change the problem'],a:0}],
c11:[
{q:'A bug only appears after a button click. Best first step?',o:['Reproduce it consistently','Rewrite the whole app','Change colours','Delete the button'],a:0},
{q:'After changing code, what verifies the fix?',o:['A relevant test/reproduction','A new logo','A random screenshot','Nothing'],a:0},
{q:'A console error points to a line. Useful next move?',o:['Inspect that line and its inputs','Ignore it','Rename the project','Change the wallpaper'],a:0},
{q:'If a fix creates another bug, you should:',o:['Inspect the new failure and regression','Hide it','Ship immediately','Delete tests'],a:0},
{q:'Why isolate a bug?',o:['To narrow the cause','To make code longer','To avoid evidence','To add uncertainty'],a:0}],
c12:[
{q:'Two options meet all hard requirements. What should you compare next?',o:['Nice-to-have trade-offs','Ignore requirements','Pick randomly','Add new hidden rules'],a:0},
{q:'If time and quality both matter, a trade-off means:',o:['Improving one can cost some of the other','Both are unlimited','Neither matters','Rules disappear'],a:0},
{q:'A hard constraint is:',o:['A requirement that must be satisfied','A preference','A colour','A bonus'],a:0},
{q:'A buffer is valuable when:',o:['Uncertainty exists','Everything is perfectly known','No resources exist','You want zero flexibility'],a:0},
{q:'A transparent decision should record:',o:['Criteria and reasoning','Only the final emoji','Nothing','A secret rule'],a:0}]
};

const GAMES={
g1:{rounds:[{q:'Unscramble: “tac”',o:['cat','act','both cat and act','tca'],a:2},{q:'Unscramble: “top”',o:['pot','opt','top','all are words'],a:3},{q:'Unscramble: “rae”',o:['are','ear','era','all are words'],a:3},{q:'Unscramble: “net”',o:['ten','net','ent','first two'],a:3},{q:'Unscramble: “pan”',o:['nap','pan','both','none'],a:2}]},
g2:{rounds:[{q:'Sequence: A B A B __',o:['A','B','C','D'],a:0},{q:'Sequence: 1 2 1 2 __',o:['1','2','3','4'],a:0},{q:'Sequence: ★ ○ ★ ○ __',o:['★','○','■','▲'],a:0},{q:'Sequence: 2 4 2 4 __',o:['2','4','6','8'],a:0},{q:'Sequence: X Y Y X X __',o:['X','Y','Z','none'],a:1}]},
g3:{rounds:[{q:'Odd one out:',o:['2','4','6','9'],a:3},{q:'Odd one out:',o:['cat','dog','rose','fox'],a:2},{q:'Odd one out:',o:['red','blue','green','circle'],a:3},{q:'Odd one out:',o:['HTML','CSS','JavaScript','JPEG'],a:3},{q:'Odd one out:',o:['8','16','32','45'],a:3}]},
g4:{rounds:[{q:'12 + 8 = ?',o:['18','20','22','24'],a:1},{q:'9 × 6 = ?',o:['45','48','54','56'],a:2},{q:'50 − 17 = ?',o:['23','33','37','43'],a:1},{q:'72 ÷ 8 = ?',o:['7','8','9','10'],a:2},{q:'11 + 19 = ?',o:['28','29','30','31'],a:2}]},
g5:{rounds:[{q:'Which planet is known for its rings?',o:['Mars','Saturn','Venus','Mercury'],a:1},{q:'What does CPU stand for?',o:['Central Processing Unit','Computer Power Utility','Core Program User','Central Print Unit'],a:0},{q:'Which is a renewable energy source?',o:['Coal','Solar','Petrol','Natural gas'],a:1},{q:'Which language runs in the browser?',o:['JavaScript','Python only','SQL only','C only'],a:0},{q:'What does URL identify?',o:['A web resource address','A CPU core','A file colour','A password'],a:0}]},
g6:{rounds:[{q:'3, 6, 9, 12, __',o:['14','15','16','18'],a:1},{q:'2, 4, 8, 16, __',o:['20','24','30','32'],a:3},{q:'5, 10, 15, 20, __',o:['22','24','25','30'],a:2},{q:'1, 4, 9, 16, __',o:['20','24','25','36'],a:2},{q:'10, 8, 6, 4, __',o:['1','2','3','5'],a:1}]},
g7:{rounds:[{q:'A vehicle used for carrying people',o:['bus','banana','button','blue'],a:0},{q:'A place where books are borrowed',o:['library','battery','browser','bridge'],a:0},{q:'Something used to measure temperature',o:['thermometer','keyboard','calendar','speaker'],a:0},{q:'A program that displays web pages',o:['browser','router','battery','printer'],a:0},{q:'A document containing reusable code',o:['module','monitor','mouse','memory'],a:0}]},
g8:{rounds:[{q:'Which cell is directly to the right of cell 5 in a 4×4 grid?',o:['4','6','9','1'],a:1},{q:'Which cell is directly below cell 2?',o:['3','5','6','8'],a:1},{q:'Which pair are adjacent horizontally?',o:['1 & 2','1 & 5','2 & 7','4 & 9'],a:0},{q:'Which pair are adjacent vertically?',o:['2 & 3','2 & 6','6 & 7','1 & 4'],a:3},{q:'Which cell is diagonally down-right from 6?',o:['7','9','10','11'],a:2}]},
g9:{rounds:[{q:'Rule: add 2. 4 → ?',o:['5','6','7','8'],a:1},{q:'Rule: multiply by 2. 5 → ?',o:['7','8','10','12'],a:2},{q:'Rule: subtract 3. 9 → ?',o:['3','6','7','12'],a:1},{q:'Rule: square. 4 → ?',o:['8','12','16','20'],a:2},{q:'Rule: divide by 2. 18 → ?',o:['6','8','9','12'],a:2}]},
g10:{rounds:[{q:'A story says a character is at school. Next line should most naturally:',o:['They enter a classroom','A volcano erupts on Mars','A database crashes','A random password appears'],a:0},{q:'A character loses their key. A coherent next step is:',o:['Look for it','Fly to Jupiter','Change the weather','Ignore every consequence'],a:0},{q:'A shop closes at 8pm. At 9pm the character should:',o:['Find another option','Enter normally','Pretend time stopped','Ignore the closing time'],a:0},{q:'A phone battery reaches 0%. A likely consequence is:',o:['Phone shuts down','Battery gains charge','Screen becomes a book','Wi-Fi becomes food'],a:0},{q:'A rainstorm starts. A coherent choice is:',o:['Take shelter','Wear a submarine indoors','Turn rain into homework','Delete the sky'],a:0}]},
g11:{rounds:[{q:'For a 5-round co-op quiz, what should teammates do after answering?',o:['Compare reasoning','Hide answers','Reset the room','Ignore the round'],a:0},{q:'If teammates disagree, useful first step?',o:['Explain each reason','Argue without evidence','Quit immediately','Change the question'],a:0},{q:'A shared score is most useful when it:',o:['Tracks progress','Replaces all discussion','Hides mistakes','Changes the rules'],a:0},{q:'Good teamwork includes:',o:['Taking turns and listening','One person doing everything','Ignoring others','Changing answers secretly'],a:0},{q:'After the final round, a useful reflection is:',o:['One thing learned','No discussion','Delete the score','Start random rules'],a:0}]},
g12:{rounds:[{q:'Target: ★. Which option is the target?',o:['○','★','▲','■'],a:1},{q:'Target: ●. Which option is the target?',o:['●','○','◆','□'],a:0},{q:'Target: ▲. Which option is the target?',o:['■','◆','▲','●'],a:2},{q:'Target: ◆. Which option is the target?',o:['○','◆','★','▲'],a:1},{q:'Target: ■. Which option is the target?',o:['▲','●','■','◆'],a:2}]}
};

export function getInteractiveConfig(id){return Q[id]||null}
export function getChallengeRounds(seed=0,count=5){return Array.from({length:count},(_,i)=>{const bank=Object.values(CHALLENGES)[seed%Object.keys(CHALLENGES).length];return bank[i%bank.length]})}
export function getGameRounds(id){return GAMES[id]?.rounds||null}
