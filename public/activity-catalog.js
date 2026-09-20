const DETAILS={
p1:'A team mystery where each person checks a different clue and the room builds one final suspect theory.',
p2:'Design a weekend route together by splitting stops, trade-offs and the final route vote.',
p3:'Investigate a suspicious product claim and build a tiny evidence board before choosing a verdict.',
p4:'Decode a short message as a team, then create the best counter-message using the same rule.',
p5:'Run a mini event budget where each person owns one spending category and the team must save a buffer.',
p6:'Solve a map-style path by sharing local moves instead of letting one person see the whole route.',
p7:'Fit a team around calendars, dependencies and one surprise change in the middle.',
p8:'Design a fair experiment together, then defend the design against a twist introduced by the room.',
p9:'Choose between two game strategies by splitting the probability work and combining the result.',
p10:'Repair a broken workflow by tracing each dependency and identifying the first failure together.',
p11:'Compare options using must-have constraints, then negotiate the best tie-breaker as a team.',
p12:'Crack a code by dividing clue ownership so nobody can solve the whole puzzle alone.',
p13:'Rebuild a museum heist timeline from fragments distributed across the room.',
p14:'Solve a signal-room puzzle where teammates decode different parts of the same transmission.',
p15:'Escape a locked lab by combining three small deductions into one final code.'
};
const dayMs=86400000;
const C=(id,type,category,title,description,goal,instructions,durationMin,difficulty,cycleDays,icon,extra={})=>({id,type,category,title,description,goal,instructions,durationMin,difficulty,cycleDays,icon,source:'catalog',...extra});

const P=[
['p1','Mystery','The Missing Notebook','Build one suspect theory from separate clues.','Each teammate owns clues that another teammate cannot see at a glance.','Share deductions, challenge weak assumptions and submit one agreed solution.','Split clue groups; compare deductions; resolve contradictions; submit the final theory.',20,'Medium',14,'🕵️'],
['p2','Adventure','Route Heist','Plan the cleanest city route before the clock runs out.','Each player proposes a section of the route and one trade-off.','Combine the best pieces into one route with no duplicate stop.','Pick a route captain; everyone proposes one segment; merge and defend the final route.',20,'Medium',21,'🗺️'],
['p3','Media','Claim Hunters','Investigate which product claim should survive scrutiny.','Players collect evidence, objections and missing information in chat.','Reach a team verdict and name the strongest evidence.','One player is Evidence, one Counterpoint, one Judge, then swap after each clue.',20,'Medium',14,'🔎'],
['p4','Code','Cipher Relay','Pass a secret message through the team without showing the whole answer.','Each player decodes one chunk and the room reconstructs the message.','Rebuild the message and correctly encode a short reply.','Split the cipher; decode in parallel; compare chunks; make the final reply.',20,'Medium',21,'🔐'],
['p5','Money','Pop-up Event Budget','Make a tiny event happen without burning the buffer.','Each teammate owns a cost and can negotiate trades with others.','Hit every minimum, stay under budget and keep reserve money.','Assign budget owners; negotiate changes; lock the final allocation; reveal the buffer.',20,'Medium',30,'💰'],
['p6','Spatial','Rescue Map','Guide a rescue token across a blocked map with shared local knowledge.','Each player gets a route segment to reason about and reports safe moves.','Produce one valid shortest route.','Split the board into zones; call safe moves; merge into the final route.',20,'Medium',21,'🧭'],
['p7','Planning','Calendar Chaos','Schedule a team with a surprise availability change halfway through.','Everyone owns one person’s constraints and must negotiate a final schedule.','Produce a conflict-free schedule after the twist.','Build the first schedule; host reveals the twist; renegotiate and lock it.',20,'Medium',30,'📅'],
['p8','Science','Experiment Lab','Design the fairest test for a claim, then survive a new constraint.','Players propose variables, controls and measurements in chat.','Choose a test with one changing variable and a clear comparison.','Draft the experiment; add the twist; revise; defend why the design still works.',20,'Medium',30,'🧪'],
['p9','Probability','Casino Crew','Choose the better strategy by splitting the probability work.','Different players count different outcomes before the team commits.','Correctly justify the higher-probability strategy.','Assign outcome counters; compare counts; debate assumptions; lock the strategy.',18,'Medium',21,'🎲'],
['p10','Systems','Workflow Rescue','Trace a broken process and repair it before the imaginary launch.','Each teammate owns one stage and reports its inputs and outputs.','Create a dependency chain with no impossible step.','Map stages; find the first broken dependency; reorder and verify the flow.',18,'Medium',21,'🔧'],
['p11','Decision','Decision Auction','Compare four choices, then spend limited points on your priorities.','Every player privately picks must-haves and argues one trade-off.','Reach a choice that satisfies all hard constraints.','List hard constraints; reveal picks; negotiate tie-breakers; final vote.',20,'Medium',30,'⚖️'],
['p12','Logic','Four-Key Vault','Break a code by giving each teammate ownership of different clue types.','No player sees the whole reasoning chain until the final merge.','Submit the valid code and explain the decisive clue.','Split exact-position, misplaced and elimination clues; merge only after each report.',22,'Hard',40,'🔐'],
['p13','Time','Museum Heist Timeline','Reconstruct the order of a fictional heist from scattered event cards.','Each player owns two timeline fragments and must justify where they fit.','Produce one contradiction-free timeline.','Distribute fragments; place anchors; challenge overlaps; lock the final sequence.',22,'Hard',30,'🏛️',{}],
['p14','Communication','Signal Room','Decode a noisy transmission where every player owns a different symbol key.','Players report only what their key reveals, then the team reconstructs the signal.','Recover the full message with no conflicting symbols.','Assign symbol keys; decode; cross-check; submit the reconstructed message.',20,'Medium',21,'📡',{}],
['p15','Escape','Locked Lab','Solve three connected mini-clues that unlock one final code.','Each teammate solves one layer and must teach the next player their deduction.','Unlock all layers and enter the final code before time ends.','Split layers; pass deductions; verify dependencies; enter the final code.',24,'Hard',40,'🧪',{}]
];

const B=[
['Product','Pitch a Tiny App','Build a one-screen product concept for a very specific user.','Everyone owns one piece: problem, feature, UI and pitch.','Combine the pieces into one coherent 60-second pitch.',22,'Medium',21,'💡'],
['Design','Poster Sprint','Design a text-only event poster concept that a real person would understand instantly.','Split headline, hook, schedule and call-to-action.','Present one final poster draft with no conflicting information.',18,'Easy',14,'🎨'],
['Product','Three-Feature MVP','Turn a messy idea into a tiny MVP with only three features.','Each player proposes one feature; the team cuts to the strongest three.','Deliver a final feature list and user flow.',20,'Medium',30,'🚀'],
['Game Design','Mini Party Game','Invent a game that can be played in a chat room in under 10 minutes.','Players own rules, scoring, twist and onboarding.','Run one test round in the room without explaining extra rules halfway through.',24,'Medium',30,'🎮'],
['Planning','Weekend Plan','Build a realistic weekend plan around three goals and one fixed event.','Split goal ownership, then merge timings and trade-offs.','Produce a plan everyone can follow.',18,'Easy',14,'🗓️'],
['Story','Micro Story','Build a 6-beat story with a surprising but logical ending.','Each player writes one beat; the team stitches them together.','Read the final story and show the cause-and-effect chain.',20,'Easy',21,'📖'],
['Tech','Feature Spec','Write a tiny feature spec another developer could implement.','Split user story, behaviour, edge case and acceptance check.','Merge into one unambiguous spec.',24,'Medium',30,'💻'],
['Community','Club Launch Kit','Build the text-only launch plan for a fictional club.','Divide name, hook, first event and invitation.','Present a launch kit with one clear next action.',20,'Easy',21,'📣'],
['Decision','Travel Pack','Build a 10-item travel pack under a strict weight cap.','Each player owns an item category and negotiates trade-offs.','Meet every essential requirement without exceeding the cap.',20,'Easy',14,'🎒'],
['Systems','Support Playbook','Build a four-step response playbook for a fictional app outage.','Split diagnosis, message, workaround and follow-up.','Produce a sequence another team could follow.',22,'Medium',21,'🛠️'],
['Data','Tiny Dashboard','Design the layout of a dashboard for one decision.','Assign metric choice, hierarchy, warning and final summary.','Present the dashboard hierarchy and explain one design choice.',24,'Medium',30,'📊'],
['Team','Sprint Board','Build a miniature sprint board with four tasks, owners and a finish line.','Each player owns one task and its dependency.','No blocked task should appear before its prerequisite.',20,'Medium',21,'📋'],
['Creativity','Brand in 15','Invent a tiny brand with a name, promise, audience and visual mood.','Each teammate owns one brand piece, then the room votes on coherence.','Produce one unified brand card.',20,'Easy',21,'✨'],
['Education','Study Kit','Build a 15-minute study kit for a beginner.','Split explanation, example, mini-test and memory trick.','Run the kit on one teammate and get them through the mini-test.',22,'Medium',30,'📚'],
['Adventure','Escape Route','Build an escape-room plan with clues, order and a final reveal.','Split clue order, bottleneck, hint and final reveal.','The team can explain how a player would progress without getting stuck.',24,'Hard',40,'🚪']
];

const L=[
['Coding','Debugging by Debate','Learn debugging through a tiny broken flow.','One player explains the symptom, others propose tests and counterexamples.','Produce a minimal fix and explain why it works.','Observe; form hypotheses; run text-based checks; explain the final fix.',25,'Medium',21,'🐞'],
['AI','Prompt Lab','Learn how prompt wording changes an AI-style task.','Teams create two prompts, predict differences, then critique outputs conceptually.','Explain which prompt is clearer and why.',25,'Easy',21,'🤖'],
['Data','Data Detective','Learn how missing values and outliers change a small dataset.','Split calculations, inspect the suspicious row and teach the effect.','Each player states one data-quality rule with an example.',25,'Easy',30,'📈'],
['Web','Request Journey','Learn what happens when a browser loads a web page.','Build the request story together from DNS to response.','Recreate the journey from memory in the correct order.',22,'Easy',21,'🌐'],
['ML','Feature vs Label','Learn the difference between inputs and targets using mini scenarios.','Players bring examples, challenge each other and classify new cases.','Correctly classify a new scenario and explain the distinction.',22,'Easy',21,'🏷️'],
['Math','Probability by Story','Learn probability through small real-world game situations.','Each person computes a different part, then the room compares assumptions.','Solve a fresh probability case without hints.',25,'Medium',30,'🎲'],
['Coding','SQL Join Relay','Learn joins by predicting which rows survive each join.','Players own tables, predict matches and challenge missing rows.','Explain one INNER and one LEFT JOIN in plain language.',28,'Medium',21,'🗃️'],
['Science','Myth Testers','Learn experimental design by trying to break weak experiments.','One person proposes a test; the others hunt confounders.','Repair one flawed design and defend the fix.',24,'Medium',21,'🧪'],
['Communication','Explain It Back','Learn a technical idea by teaching it to another person.','Round 1 teaches; round 2 quizzes; round 3 swaps roles.','Every player gives a correct 20-second explanation or example.',24,'Easy',14,'🎤'],
['Git','Branch Escape','Learn Git branches through a fictional project timeline.','Players reconstruct the commit story and decide where changes belong.','Draw the correct branch/merge sequence in chat.',25,'Medium',30,'🌿'],
['AI','Overfitting Trial','Learn overfitting by acting as a model review panel.','Players inspect training vs new examples and argue whether memorisation happened.','Give a correct diagnosis and one remedy.',25,'Medium',40,'🧠'],
['Networks','DNS Detective','Learn DNS through a mystery where a domain resolves incorrectly.','Each player owns one layer and reports what can go wrong there.','Trace one request from domain name to server IP correctly.',22,'Easy',21,'🔍'],
['Product','UX Test Room','Learn basic usability testing by role-playing user, observer and designer.','Run a tiny task; observer notes friction; designer proposes one change.','Identify one concrete usability problem and a testable fix.',28,'Medium',30,'🧑‍💻'],
['Statistics','Mean vs Median','Learn when mean and median tell different stories.','Teams alter a small dataset and predict which measure changes.','Explain which measure they would use for a skewed dataset and why.',24,'Easy',21,'📐'],
['Systems','Dependency Thinking','Learn why prerequisites matter in projects and software.','Build chains, insert a broken dependency and repair it together.','Create one valid dependency chain and explain the critical path.',25,'Medium',30,'🔗']
];

const Cg=[
['Focus','Distraction Duel','Race through five live focus scenarios with a friend or room.','Both players answer before the timer; fastest correct answer scores.','Correct answers + speed decide each round.','Five rounds; simultaneous answers; points for correctness with a speed bonus.',15,'Easy',14,'🎯'],
['Logic','Mystery Sprint','Solve five mini-mysteries against other players.','Everyone gets the same case and races to lock an answer.','Most points after five rounds wins.',15,'Medium',21,'🕵️'],
['Coding','Code Prediction Race','Predict tiny code outputs before the clock hits zero.','Answers lock per round; fastest correct response earns the bonus.','Highest score after five rounds wins.',15,'Medium',21,'💻'],
['Money','Budget Blitz','Make five rapid budget calls under pressure.','Each round shows a trade-off; players answer simultaneously.','Correct decision plus speed determines the round winner.',15,'Easy',14,'💰'],
['Science','Experiment Arena','Pick the strongest experiment in five live cases.','Players answer simultaneously, then defend one choice in chat.','Score from correct design + one clear justification.',18,'Medium',30,'🧪'],
['Media','Fact Check Faceoff','Spot the evidence-backed claim before the others do.','Fast answers; bonus point for naming the evidence clue in chat.','Highest score wins.',15,'Medium',21,'📰'],
['Planning','Schedule Showdown','Beat other players at quick scheduling cases.','Race to satisfy every dependency and time constraint.','Most correct rounds wins.',16,'Medium',21,'⏱️'],
['Math','Number Dash','Solve five fast calculations against the room.','Each round is simultaneous; speed matters only after correctness.','Highest score wins.',12,'Easy',14,'🔢'],
['AI','ML Model Draft','Choose the most sensible model decision in practical scenarios.','Each player locks an answer, then reveals reasoning.','Points reward correctness and useful justification.',18,'Medium',30,'🤖'],
['Communication','Explain Better','Choose the clearest response, then defend it in one sentence.','Players answer simultaneously; chat defence earns a bonus.','Most points after five rounds wins.',15,'Easy',14,'🎤'],
['Problem Solving','Fix-It Sprint','Race to choose the next debugging move in five cases.','Wrong answers lose the speed bonus; correct explanations can tie-break.','Highest score wins.',18,'Medium',21,'🛠️'],
['Decision','Trade-Off Trial','Make decisions where every option has a cost.','Players lock their choice, then explain one trade-off.','Judge awards the round point for the best constraint-aware choice.',18,'Medium',30,'⚖️'],
['Creativity','Caption Clash','Create a one-line caption for a fictional scene.','Everyone submits privately; room votes for clarity + creativity.','Most votes across five rounds wins.',18,'Easy',14,'✍️'],
['Words','Word Sprint','Beat the room with fast word transformations and clue solving.','Simultaneous answers; bonus for streaks.','Highest score after five rounds wins.',12,'Easy',14,'🔤'],
['Team','Co-op Captain','Compete on team tactics: choose the move that gives the whole room the best chance.','Everyone answers; then the fastest player explains the winning tactic.','Score follows both correct choice and explanation quality.',18,'Medium',21,'🤝']
];

const BUILD_CONFIG={
 b1:{mechanic:'order',items:['Trigger','Condition','Action','Feedback'],target:['Trigger','Condition','Action','Feedback']},
 b2:{mechanic:'order',items:['Choose outcome','Set timer','Focus','Short reset','Review result'],target:['Choose outcome','Set timer','Focus','Short reset','Review result']},
 b3:{mechanic:'order',items:['Start','Cafe','Park','Museum','Destination'],target:['Start','Cafe','Park','Museum','Destination']},
 b4:{mechanic:'allocate',budget:5000,items:[['Venue',1000],['Food',1500],['Travel',500],['Reserve',300]],mins:[1000,1500,500,300]},
 b5:{mechanic:'grid',size:4,required:['Desk','Lamp','Notebook'],blocked:[5,6,9,10],adjacentPairs:[['Lamp','Desk'],['Notebook','Desk']]},
 b6:{mechanic:'order',items:['Reproduce','Describe','Fix','Test','Close'],target:['Reproduce','Describe','Fix','Test','Close']},
 b7:{mechanic:'order',items:['Question','Key metric','Trend','Breakdown','Detail'],target:['Question','Key metric','Trend','Breakdown','Detail']},
 b8:{mechanic:'order',items:['Foundation','Core skill','Mini project','Practice','Review'],target:['Foundation','Core skill','Mini project','Practice','Review']},
 b9:{mechanic:'allocate',budget:12,items:[['Water',2],['Food',3],['Navigation',2],['First aid',1]],mins:[2,3,2,1]},
 b10:{mechanic:'order',items:['Understand','Stabilize','Choose fix','Apply','Verify'],target:['Understand','Stabilize','Choose fix','Apply','Verify']},
 b11:{mechanic:'grid',size:4,required:['Focus','Reference','Write','Tools'],blocked:[3,7,12],adjacentPairs:[['Focus','Write'],['Reference','Tools']]},
 b12:{mechanic:'assign',people:['Ava','Ben','Cara','Dev'],roles:['Planner','Builder','Checker','Presenter'],forbidden:{Ava:['Checker'],Ben:['Presenter'],Cara:['Builder'],Dev:['Planner']}},
 b13:{mechanic:'order',items:['Find anchor','Place early event','Place middle event','Check conflict','Reveal timeline'],target:['Find anchor','Place early event','Place middle event','Check conflict','Reveal timeline']},
 b14:{mechanic:'grid',size:4,required:['Signal','Decoder','Key'],blocked:[2,7,10],adjacentPairs:[['Signal','Decoder'],['Decoder','Key']]},
 b15:{mechanic:'assign',people:['Layer 1','Layer 2','Layer 3','Final caller'],roles:['Clue solver','Rule solver','Verifier','Presenter'],correct:{'Layer 1':'Clue solver','Layer 2':'Rule solver','Layer 3':'Verifier','Final caller':'Presenter'}}
};
export function getBuildConfig(id){return BUILD_CONFIG[id]||null}

// 15 catalog items per lane. Game-type catalogue entries are intentionally not published;
// the four user-facing lanes are Build, Learn, Challenge and Puzzle.
const BUILD15=B.map((x,i)=>C('b'+(i+1),'build',x[0],x[1],x[2],x[3],x[4],x[5],x[6],x[7],x[8],{lane:'build',roles:['Planner','Maker','Reviewer'],flow:['Split the work live','Build your piece','Merge and review','Present the result'],win:x[3],fun:'A visible team result appears at the end.',premise:x[2]}));
const LEARN15=L.map((x,i)=>C('l'+(i+1),'learn',x[0],x[1],x[2],x[3],x[4],x[5],x[6],x[7],x[8],{lane:'learn',roles:['Explainer','Tester','Sceptic','Summariser'],flow:['Pick roles','Try the idea','Challenge it','Teach it back'],win:x[3],fun:'Everyone has to contribute an explanation, not just listen.',premise:x[2]}));
const CHALLENGE15=Cg.map((x,i)=>C('c'+(i+1),'challenge',x[0],x[1],x[2],x[3],x[4],x[5],x[6],x[7],x[8],{lane:'challenge',roles:['Player 1','Player 2','Judge'],flow:['Start round','Lock answer','Reveal score','Defend one choice'],win:x[3],fun:'Fast decisions, live reveals and a visible score chase.',premise:x[2]}));
const PUZZLE15=P.map((x,i)=>C('p'+(i+1),'puzzle',x[1],x[2],x[3],x[5],x[6],x[7],x[8],x[9],x[10],{lane:'puzzle',roles:(x[4]||'Clue Keeper, Sceptic, Mapper, Final Caller').split(/\s*,\s*/),flow:['Split clues','Share deductions','Challenge the theory','Lock the solution'],win:x[5],fun:'No single player gets the whole picture.',premise:x[3]}));
export const ACTIVITY_CATALOG=[...PUZZLE15,...BUILD15,...LEARN15,...CHALLENGE15];

export function getCatalogActivity(id){
 const item=ACTIVITY_CATALOG.find(x=>x.id===id);
 if(!item)return null;
 const now=Date.now(),cycle=Math.max(7,item.cycleDays||30),epoch=Date.UTC(2026,0,1);
 const index=Math.max(0,Math.floor((now-epoch)/(cycle*dayMs)));
 const startMs=epoch+index*cycle*dayMs,endAtMs=startMs+cycle*dayMs;
 return {...item,challengeBrief:DETAILS[item.id]||null,startAtMs:startMs,endAtMs,expiresInDays:Math.max(0,Math.ceil((endAtMs-now)/dayMs))};
}
export function activeCatalogActivities(){return ACTIVITY_CATALOG.map(x=>getCatalogActivity(x.id)).filter(Boolean)}
