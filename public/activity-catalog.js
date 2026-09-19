const dayMs=86400000;
const C=(id,type,category,title,description,goal,instructions,durationMin,difficulty,cycleDays,icon)=>({id,type,category,title,description,goal,instructions,durationMin,difficulty,cycleDays,icon,source:'catalog'});

const P=[
['p1','Logic','Pattern Breaker','Find the missing item in 8 number or visual patterns.','Solve at least 6 of 8.','Check differences, ratios, position, repetition and alternating rules before choosing.',15,'Easy',14,'🔢'],
['p2','Logic','Three Switch Mystery','Work out which switch controls each lamp using one visit.','Give the full mapping and reasoning.','Create extra information before entering; use heat, light state and elimination.',12,'Medium',21,'💡'],
['p3','Logic','Truth & Lie Cases','Solve short statements where exactly one clue is false.','Solve 8 of 10 cases.','Test every statement against the others and eliminate contradictions.',18,'Medium',14,'🕵️'],
['p4','Logic','Seat the Team','Place six people using ordering and adjacency clues.','Find one valid arrangement with reasoning.','Translate clues into before, after, next-to and position constraints.',20,'Medium',30,'🪑'],
['p5','Math Logic','Missing Number Lab','Complete mixed number sequences with different hidden rules.','Solve 9 of 12 sequences.','Try differences, ratios, alternating rules and digit operations.',20,'Easy',14,'🧠'],
['p6','Word','Word Ladder Sprint','Transform a start word into a target by changing one letter at a time.','Complete 5 ladders.','Every step must be a valid word; change one letter only.',15,'Easy',14,'🔤'],
['p7','Spatial','Grid Escape','Find the shortest route through blocked grids.','Solve 3 grids and give move counts.','Mark dead ends, count moves and compare candidate paths.',18,'Medium',21,'🗺️'],
['p8','Logic','Crack the Tiny Code','Infer the rule behind five encoded messages.','Crack 4 of 5.','Compare repeated symbols, positions, shifts and word lengths.',20,'Medium',30,'🔐'],
['p9','Logic','Calendar Detective','Solve scheduling puzzles from dates and ordering clues.','Solve 6 cases.','Build a small calendar table and eliminate impossible dates first.',20,'Medium',30,'📅'],
['p10','Probability','Chance or Choice?','Compare the odds of two strategies across short scenarios.','Justify 6 of 8.','List possible outcomes, count equally likely cases and compare ratios.',15,'Medium',21,'🎲'],
['p11','Logic','Spot the Rule','Find transformations hidden in small input/output tables.','Find 5 rules.','Compare rows, columns and changes between input and output.',18,'Medium',14,'🔍'],
['p12','Logic','Codebreaker Mini','Deduce a four-symbol secret code from feedback clues.','Solve 3 codes within 8 guesses each.','Separate exact-position clues from correct-symbol clues and keep candidates.',25,'Hard',40,'🧩']
];
const B=[
['Web','One-Page Landing','Build a polished responsive landing page for an imaginary product.','Ship a working one-page layout with hero, value, CTA and footer.','Start with structure, then spacing, type and one visual accent.','45','Medium',30,'🖥️'],
['UI','Study Dashboard','Design a dashboard that makes a student’s week easy to understand.','Create four useful cards and one progress visual.','Prioritize hierarchy and useful information over decoration.','40','Medium',21,'📊'],
['Web','Mini Expense UI','Build a clean expense-tracker interface with categories and totals.','Show add, list, filter and total states.','Use realistic sample data and make mobile layout intentional.','45','Medium',30,'💳'],
['Creative','CSS Poster','Create a poster using only HTML and CSS.','Produce a visual composition with a clear hierarchy.','Experiment with grids, typography, gradients and geometric shapes.',30,'Easy',14,'🎨'],
['Web','Quiz Interface','Build a quiz screen with question, options, progress and result states.','Prototype the full user flow.','Design both correct and incorrect states before polishing.',40,'Medium',30,'❓'],
['Product','Pomodoro Workspace','Build a focused timer workspace with task and session areas.','Create a calm desktop and mobile layout.','Think about what should remain visible while the timer is running.',35,'Medium',21,'⏱️'],
['Portfolio','Hero Section','Build a memorable portfolio hero for a creator or engineer.','Create hero, proof points and a strong primary action.','Use visual hierarchy to communicate identity in seconds.',30,'Easy',14,'🚀'],
['Product','Study Planner','Design a weekly study planner with subject filters.','Make it easy to see what to do next.','Use categories, priority and time estimates rather than decoration.',40,'Medium',30,'📚'],
['Data','Data Story Card','Turn a small dataset into a visual story card.','Create one chart and three useful findings.','Lead with the insight; show supporting numbers second.',35,'Medium',21,'📈'],
['Utility','CLI Tool Plan','Design a useful command-line tool for an everyday problem.','Define commands, inputs, outputs and 5 edge cases.','Write the interface first, implementation plan second.',25,'Easy',14,'⌨️'],
['Mobile','App Wireframe','Wireframe a mobile app that solves one clear problem.','Create 5 connected screens.','Start with user flow and reduce every screen to one job.',40,'Medium',30,'📱'],
['AI','Prompt Playground','Build a small interface for testing structured AI prompts.','Create input, prompt-template and result sections.','Make the controls understandable to a first-time user.',40,'Medium',40,'🤖']
];
const L=[
['Coding','Python Foundations','Practice lists, dictionaries, functions and clean data flow.','Solve 6 small tasks and explain one solution.','Code first, then rewrite one solution with clearer names and functions.',35,'Easy',30,'🐍'],
['Coding','SQL Joins','Learn INNER, LEFT and multi-table joins through a tiny dataset.','Write 8 correct join queries.','Predict the row count before running each query.',40,'Medium',21,'🗃️'],
['Math','Statistics Basics','Explore mean, median, range and outliers using a small dataset.','Explain which measure fits 4 scenarios.','Calculate by hand once, then verify with a tool.',30,'Easy',21,'📐'],
['Math','Vectors Intuition','Learn vectors through movement, direction and simple operations.','Solve 8 vector questions and explain 2 visually.','Think of a vector as a direction plus magnitude before using formulas.',30,'Medium',30,'➡️'],
['Math','Bayes Intuition','Understand conditional probability with everyday examples.','Explain 3 Bayes-style cases without memorizing a formula.','Separate the prior, evidence and updated belief.',35,'Medium',30,'🎯'],
['Science','Energy & Motion','Review force, energy and motion using simple everyday cases.','Explain 5 examples correctly.','Tie each idea to a concrete object or movement.',30,'Easy',21,'⚙️'],
['Technology','How the Web Works','Trace a URL from browser to server and back.','Draw the request path with 7 key steps.','Include DNS, HTTP, server processing and response.',30,'Easy',30,'🌐'],
['Coding','Async JavaScript','Understand promises, async/await and waiting for data.','Explain and fix 5 async examples.','Predict execution order before reading the output.',35,'Medium',30,'⚡'],
['Developer','Git Branching','Practice branch, merge, rebase concepts safely with examples.','Complete 8 scenario questions.','Map each action to a commit graph rather than memorizing commands.',30,'Medium',21,'🌿'],
['ML','Overfitting Intuition','Learn why a model can memorize training data and fail on new data.','Explain overfitting, validation and regularization.','Compare a simple model with an overly flexible one.',35,'Medium',40,'🧠'],
['AI','Neural Network Basics','Understand layers, weights, activation and training at a conceptual level.','Explain the flow from input to prediction.','Use a tiny toy example and focus on the data flow.',40,'Medium',40,'🕸️'],
['Communication','Explain It Simply','Learn to explain a complex idea to a beginner.','Give a 2-minute explanation and one analogy.','Remove jargon, then add only terms that are genuinely useful.',20,'Easy',14,'🎤']
];
const Cg=[
['Focus','20-Minute Deep Work','Choose one meaningful task and work without switching context.','Complete one defined piece of work in 20 focused minutes.','Write the exact outcome first, start a timer, then stop at 20 minutes.',20,'Easy',14,'🎯'],
['Problem Solving','Five-Problem Sprint','Solve five short problems from a subject you know.','Finish all five with written reasoning.','Do not search for solutions until you have tried each problem.',30,'Medium',21,'⚡'],
['Learning','Teach Back','Learn one concept, then teach it in a 90-second explanation.','Explain it clearly enough for a beginner.','Use one example and one common mistake.',25,'Easy',14,'🗣️'],
['Coding','Fix One Bug','Take an old project and resolve one real bug cleanly.','Document cause, fix and test.','Reproduce first, change second, verify last.',30,'Medium',30,'🐞'],
['Build','No-Tutorial Build','Create a small feature without copying a tutorial.','Ship one working feature.','Use documentation only for specific API facts you need.',45,'Medium',30,'🛠️'],
['Design','No-Copy Redesign','Redesign one familiar interface from memory.','Create a distinct useful layout and explain two choices.','Avoid tracing an existing screen; solve the same user problem differently.',35,'Medium',21,'✨'],
['Memory','Recall 20','Study a short page, hide it, then recall 20 facts.','Reach 15 correct recalls.','Write from memory before checking the original.',20,'Easy',14,'🧩'],
['Observation','Detail Hunt','Inspect a scene, page or object and record specific details.','Find 15 verifiable details.','Separate what you saw from what you assumed.',20,'Easy',14,'🔎'],
['Research','30-Minute Mini Research','Answer one real question using multiple reliable sources.','Write a 5-point evidence summary.','Record source names and distinguish facts from interpretations.',30,'Medium',21,'📖'],
['Refactor','Make It Cleaner','Take one messy piece of code and improve readability.','Reduce duplication or complexity in one area.','Keep behavior the same and describe what improved.',30,'Medium',30,'🧹'],
['Reading','Read & Synthesize','Read one focused article or chapter section.','Write the main idea plus three supporting points.','End with one question the reading created for you.',25,'Easy',14,'📘'],
['Collaboration','Solve Together','Pair up on one logic or coding problem and compare approaches.','Reach one shared solution and explain the trade-offs.','Let each person propose an approach before combining them.',30,'Medium',21,'🤝']
];
const G=[
['Word','Word Chain','Build a chain where each new word connects to the previous one.','Reach 20 connected words.','Choose a clear category or relation and keep the chain understandable.',10,'Easy',14,'🔗'],
['Social','20 Questions','Guess a secret object using yes/no questions.','Guess within 20 questions.','Ask broad category questions before narrowing down.',15,'Easy',14,'❔'],
['Creative','Emoji Story','Create a short story using 8 chosen emojis.','Tell a coherent beginning, middle and end.','Use emojis as constraints, not just decoration.',15,'Easy',21,'😀'],
['Drawing','Draw & Guess','One person draws a simple concept while others guess it.','Complete 8 rounds.','Keep drawings quick; focus on communication.',20,'Easy',14,'✏️'],
['Words','Category Chain','Take turns naming items in one category without repeats.','Reach 25 unique items.','Pick a category large enough for the group and track repeats.',15,'Easy',14,'📚'],
['Memory','Sequence Recall','Watch a short sequence and reproduce it from memory.','Complete 6 rounds.','Repeat the sequence mentally in chunks before entering it.',15,'Medium',21,'🧠'],
['Social','Two Facts & A Trick','Share three statements and let the group identify the invented one.','Play 5 rounds.','Keep statements light and based on ordinary experiences.',15,'Easy',14,'🎭'],
['Logic','Reverse Definition','Give a definition without saying the target word.','Get 12 words guessed.','Describe meaning, use or example while avoiding obvious fragments.',15,'Medium',21,'🔤'],
['Trivia','Speed Trivia','Answer a mixed set of quick knowledge questions.','Get 15 correct answers.','Mark uncertain answers and review the ones you missed.',15,'Easy',14,'⚡'],
['Language','Alias Round','Describe a target word using related ideas under time pressure.','Complete 10 successful guesses.','Use examples, contrasts and categories instead of the word itself.',15,'Medium',21,'🎙️'],
['Patterns','Visual Sequence','Identify the next item in quick visual sequences.','Solve 10 rounds.','Look for rotation, count, position and color changes.',15,'Medium',14,'🟣'],
['Team','Build-a-Story','Each person adds one sentence to create a shared story.','Complete a 12-sentence story.','Keep continuity while adding one surprising but safe detail.',15,'Easy',21,'📖']
];

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
  const now=Date.now(), cycle=Math.max(7,item.cycleDays||30), epoch=Date.UTC(2026,0,1);
  const index=Math.max(0,Math.floor((now-epoch)/(cycle*dayMs)));
  const startMs=epoch+index*cycle*dayMs;
  const endAtMs=startMs+cycle*dayMs;
  return {...item,startAtMs, endAtMs, expiresInDays:Math.max(0,Math.ceil((endAtMs-now)/dayMs))};
}

export function activeCatalogActivities(){
  return ACTIVITY_CATALOG.map(x=>getCatalogActivity(x.id)).filter(Boolean);
}