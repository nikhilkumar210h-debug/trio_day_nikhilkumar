const DETAILS={
p1:'Solve a tiny mystery: work out who moved the missing notebook from three truthful clues.',
p2:'Plan a one-screen emergency-free travel route: choose the order that avoids backtracking.',
p3:'Spot the fake product review by comparing claims, evidence and contradictions.',
p4:'Decode a message from a simple letter-shift and then make your own.',
p5:'Beat the budget: distribute a fixed amount across essentials without wasting the buffer.',
p6:'Find the fastest way through a blocked grid and explain why the route is shortest.',
p7:'Schedule three people around availability, dependencies and one fixed appointment.',
p8:'Choose the best experiment for testing a claim while changing only one variable.',
p9:'Use probability to decide between two fair-looking game strategies.',
p10:'Repair a broken workflow by identifying the first step that can never happen.',
p11:'Rank a set of options using explicit constraints rather than a gut feeling.',
p12:'Crack a four-digit code using position and inclusion clues, then explain the deductions.'
};
const dayMs=86400000;
const C=(id,type,category,title,description,goal,instructions,durationMin,difficulty,cycleDays,icon)=>({id,type,category,title,description,goal,instructions,durationMin,difficulty,cycleDays,icon,source:'catalog'});

const P=[
['p1','Logic','Notebook Mystery','Find the only suspect consistent with every clue.','Compare three short statements and catch the contradiction.','Test each suspect against every clue instead of guessing.',15,'Easy',14,'🕵️'],
['p2','Planning','Route Optimiser','Choose an efficient order for five stops.','Build a route with no duplicate stop and minimal backtracking.','Compare total distance and make the final stop matter.',15,'Easy',21,'🗺️'],
['p3','Media','Review Reality Check','Spot which review claim is unsupported.','Separate evidence from hype in a mini review set.','Look for specific evidence, contradictions and absolute claims.',15,'Medium',14,'🔎'],
['p4','Code','Message Decoder','Decode a short message and identify the transformation.','Find the shift and use it on a second word.','Compare each letter position before choosing the rule.',15,'Easy',21,'🔐'],
['p5','Money','Budget Battle','Make a small event fit a fixed budget.','Choose the allocation that covers essentials and keeps a buffer.','Protect essentials first and reject allocations over budget.',18,'Medium',30,'💰'],
['p6','Spatial','Shortest Path','Choose the shortest valid route through a grid.','Find the route with the fewest moves.','Count moves and reject paths that cross blocked cells.',18,'Medium',21,'🧭'],
['p7','Planning','Calendar Puzzle','Build a three-person schedule from availability clues.','Choose the schedule that satisfies every constraint.','Start with fixed events, then eliminate impossible slots.',18,'Medium',30,'📅'],
['p8','Science','Fair Test','Pick the experiment that actually tests the claim.','Identify the controlled comparison.','Change one variable and keep the comparison group meaningful.',18,'Medium',30,'🧪'],
['p9','Probability','Game Odds','Compare two simple probability strategies.','Choose the mathematically justified option.','Count equally likely outcomes before deciding.',15,'Medium',21,'🎲'],
['p10','Systems','Workflow Rescue','Find the impossible step in a broken process.','Identify the first dependency that fails.','Trace inputs and outputs one step at a time.',15,'Medium',21,'🔧'],
['p11','Decision','Constraint Sort','Choose an option using explicit requirements.','Find the only option meeting all hard constraints.','Separate must-haves from nice-to-haves.',15,'Medium',30,'📋'],
['p12','Logic','Four-Digit Crack','Use exact and misplaced clues to narrow a code.','Find a valid code from the clues.','Keep exact-position and misplaced-digit information separate.',20,'Hard',40,'🧩']
];

const B=[
['Systems','Build a Reminder Flow','Arrange a notification flow from trigger to feedback.','Create a complete flow with every stage in the right order.','Start with the trigger, then condition, action and feedback.',20,'Easy',21,'🔔'],
['Planning','Build a Focus Session','Arrange a realistic 30-minute focus routine.','Create a sequence that protects focus and includes a finish step.','Put setup before focus, recovery after focus and reflection last.',20,'Easy',14,'🎯'],
['Routes','Build a City Hop','Arrange five stops without repeating one.','Create a complete route ending at the destination.','Use the destination clue before arranging the middle stops.',20,'Medium',21,'🗺️'],
['Budget','Build a Mini Event','Allocate a fixed budget across essentials and reserve.','Cover all required costs without exceeding the budget.','Meet minimums first, then keep any remaining money as reserve.',20,'Medium',30,'💸'],
['Space','Build a Desk Zone','Place work zones on a grid with useful neighbours.','Use every zone once and satisfy adjacency rules.','Place the main work zone first, then nearby support zones.',20,'Easy',21,'🖥️'],
['Workflow','Build a Bug Triage','Arrange a bug report from reproduction to verification.','Create a workflow that never skips verification.','Reproduce before fixing and verify after changing.',20,'Medium',30,'🐞'],
['Dashboard','Build a Decision Board','Arrange information so the key decision is visible first.','Put the decision-critical block at the top of the hierarchy.','Question first, evidence second, detail last.',20,'Medium',30,'📊'],
['Strategy','Build a Learning Path','Arrange topics around prerequisites and practice.','Create a sequence that respects dependencies.','Learn foundations before dependent skills.',20,'Medium',21,'🧠'],
['Resources','Build a Day Pack','Allocate limited weight to practical essentials.','Meet every minimum without crossing the weight limit.','Choose essentials before optional extras.',18,'Easy',14,'🎒'],
['Decision','Build a Recovery Plan','Arrange safe steps for an everyday project failure.','Create a complete response from diagnosis to verification.','Understand the problem, choose a fix, then verify it.',20,'Medium',21,'🧭'],
['Grid','Build a Creator Desk','Place four zones on a grid while keeping related zones close.','Use every zone once and satisfy all adjacency rules.','Place constrained zones first.',22,'Hard',30,'▦'],
['Team','Build a Team Sprint','Assign people to roles using strengths and exclusions.','Produce a valid assignment with every role used once.','Apply exclusions first, then fill the remaining roles.',22,'Medium',21,'🤝']
];

const L=[
['Coding','Python Foundations','Practice lists, dictionaries, functions and clean data flow.','Pass the knowledge check and explain the concept.','Code first, then rewrite one solution with clearer names and functions.',35,'Easy',30,'🐍'],
['Coding','SQL Joins','Learn INNER, LEFT and multi-table joins through a tiny dataset.','Pass the knowledge check and explain the concept.','Predict the row count before running each query.',40,'Medium',21,'🗃️'],
['Math','Statistics Basics','Explore mean, median, range and outliers using a small dataset.','Pass the knowledge check and explain the concept.','Calculate by hand once, then verify with a tool.',30,'Easy',21,'📐'],
['Math','Vectors Intuition','Learn vectors through movement, direction and simple operations.','Pass the knowledge check and explain the concept.','Think of a vector as a direction plus magnitude before using formulas.',30,'Medium',30,'➡️'],
['Math','Bayes Intuition','Understand conditional probability with everyday examples.','Pass the knowledge check and explain the concept.','Separate the prior, evidence and updated belief.',35,'Medium',30,'🎯'],
['Science','Energy & Motion','Review force, energy and motion using simple everyday cases.','Pass the knowledge check and explain the concept.','Tie each idea to a concrete object or movement.',30,'Easy',21,'⚙️'],
['Technology','How the Web Works','Trace a URL from browser to server and back.','Pass the knowledge check and explain the concept.','Include DNS, HTTP, server processing and response.',30,'Easy',30,'🌐'],
['Coding','Async JavaScript','Understand promises, async/await and waiting for data.','Pass the knowledge check and explain the concept.','Predict execution order before reading the output.',35,'Medium',30,'⚡'],
['Developer','Git Branching','Practice branch, merge, rebase concepts safely with examples.','Pass the knowledge check and explain the concept.','Map each action to a commit graph rather than memorizing commands.',30,'Medium',21,'🌿'],
['ML','Overfitting Intuition','Learn why a model can memorize training data and fail on new data.','Pass the knowledge check and explain the concept.','Compare a simple model with an overly flexible one.',35,'Medium',40,'🧠'],
['AI','Neural Network Basics','Understand layers, weights, activation and training at a conceptual level.','Pass the knowledge check and explain the concept.','Use a tiny toy example and focus on the data flow.',40,'Medium',40,'🕸️'],
['Communication','Explain It Simply','Learn to explain a complex idea to a beginner.','Pass the knowledge check and explain the concept.','Remove jargon, then add only terms that are genuinely useful.',20,'Easy',14,'🎤']
];

const Cg=[
['Focus','Distraction Dodge','Beat a set of quick focus decisions.','Score at least 3 of 5 and explain your strategy.','Choose the action that protects the current goal.',15,'Easy',14,'🎯'],
['Logic','Mystery Sprint','Solve five tiny logic cases.','Score at least 3 of 5 and explain one deduction.','Use clues rather than intuition.',20,'Medium',21,'🕵️'],
['Coding','Code Sense Sprint','Predict small pieces of code before running them.','Score at least 3 of 5 and explain one prediction.','Trace values line by line.',20,'Medium',21,'💻'],
['Money','Budget Sprint','Make five quick spending decisions.','Score at least 3 of 5 and explain one trade-off.','Check totals and priorities.',15,'Easy',14,'💰'],
['Science','Experiment Sprint','Choose the soundest experimental design in five rounds.','Score at least 3 of 5 and explain one control.',20,'Medium',30,'🧪'],
['Media','Fact or Hype','Separate evidence-backed claims from unsupported claims.','Score at least 3 of 5 and explain one clue.',15,'Medium',21,'📰'],
['Planning','Time Attack','Solve five scheduling decisions under constraints.','Score at least 3 of 5 and explain one ordering choice.',18,'Medium',21,'⏱️'],
['Math','Number Dash','Solve five quick number problems.','Score at least 3 of 5 and show one calculation.',15,'Easy',14,'🔢'],
['AI','ML Mini-Quiz','Make five practical model-selection decisions.','Score at least 3 of 5 and explain one choice.',20,'Medium',30,'🤖'],
['Communication','Explain Better','Pick the clearest explanation in five situations.','Score at least 3 of 5 and explain one choice.',15,'Easy',14,'🎤'],
['Problem Solving','Fix-It Sprint','Choose the next useful debugging step in five cases.','Score at least 3 of 5 and explain one fix.',20,'Medium',21,'🛠️'],
['Decision','Trade-off Sprint','Choose actions under competing constraints.','Score at least 3 of 5 and explain one trade-off.',18,'Medium',30,'⚖️']
];

const G=[
['Words','Word Shuffle','Unscramble short words against the clock.','Solve 5 rounds correctly.','Rearrange letters mentally before committing.',15,'Easy',14,'🔤'],
['Memory','Pattern Memory','Remember short symbol sequences and reproduce them.','Pass 4 rounds.','Chunk the sequence into small groups.',15,'Easy',14,'🧠'],
['Observation','Odd One Out','Spot the item that breaks the rule in each round.','Solve 5 rounds.','Find the shared rule before looking for the odd item.',15,'Easy',14,'👀'],
['Speed','Quick Maths','Solve rapid arithmetic rounds.','Get 4 of 5 correct.','Estimate first, then calculate.',12,'Easy',14,'⚡'],
['Trivia','Curiosity Quiz','Answer a mixed set of practical trivia.','Get 4 of 5 correct.','Use elimination when you are unsure.',15,'Easy',14,'❓'],
['Patterns','Sequence Snap','Pick the next item in changing sequences.','Solve 4 of 5.','Check differences, ratios and alternating rules.',15,'Medium',21,'🧩'],
['Language','Alias Rush','Choose the word that best matches a description.','Solve 4 of 5.','Think of meaning, not spelling alone.',15,'Easy',14,'🎙️'],
['Spatial','Grid Memory','Remember where targets appeared on a small grid.','Pass 4 rounds.','Mentally group nearby cells.',15,'Medium',21,'▦'],
['Logic','Rule Switch','Notice when the rule changes between rounds.','Solve 4 of 5.','Do not assume the previous rule still applies.',15,'Medium',21,'🔄'],
['Creativity','Story Choice','Choose the next sentence that keeps a story coherent.','Complete 5 rounds.','Track characters, cause and effect.',15,'Easy',14,'📖'],
['Team','Co-op Quiz','Play a short quiz with a friend or room.','Finish all 5 rounds and record your score.','Compare answers after each round.',15,'Easy',14,'🤝'],
['Reflex','Focus Tap','Choose the target symbol among decoys.','Clear 5 rounds without a wrong target.',12,'Easy',14,'🎯']
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
 b12:{mechanic:'assign',people:['Ava','Ben','Cara','Dev'],roles:['Planner','Builder','Checker','Presenter'],correct:{Ava:'Planner',Ben:'Builder',Cara:'Checker',Dev:'Presenter'}}
};
export function getBuildConfig(id){return BUILD_CONFIG[id]||null}

export const ACTIVITY_CATALOG=[
 ...P.map((x,i)=>C('p'+(i+1),'puzzle',...x)),
 ...B.map((x,i)=>C('b'+(i+1),'build',...x)),
 ...L.map((x,i)=>C('l'+(i+1),'learn',...x)),
 ...Cg.map((x,i)=>C('c'+(i+1),'challenge',...x)),
 ...G.map((x,i)=>C('g'+(i+1),'game',...x))
];

export function getCatalogActivity(id){
 const item=ACTIVITY_CATALOG.find(x=>x.id===id);
 if(!item)return null;
 const now=Date.now(),cycle=Math.max(7,item.cycleDays||30),epoch=Date.UTC(2026,0,1);
 const index=Math.max(0,Math.floor((now-epoch)/(cycle*dayMs)));
 const startMs=epoch+index*cycle*dayMs,endAtMs=startMs+cycle*dayMs;
 return {...item,challengeBrief:DETAILS[item.id]||null,startAtMs:startMs,endAtMs,expiresInDays:Math.max(0,Math.ceil((endAtMs-now)/dayMs))};
}
export function activeCatalogActivities(){return ACTIVITY_CATALOG.map(x=>getCatalogActivity(x.id)).filter(Boolean)}
