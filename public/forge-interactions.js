const Q={
p1:{kind:'quiz',question:'What comes next: 2, 6, 12, 20, __?',options:['24','30','32','36'],correct:1},
p2:{kind:'quiz',question:'Three switches control three lamps. You may enter once. Which extra clue can help identify a switch before entering?',options:['Lamp heat','Room size','Wall color','Door width'],correct:0},
p3:{kind:'quiz',question:'All Rins are Tals. No Tals are Zems. Can a Rin also be a Zem?',options:['Yes','No','Only sometimes','Not enough information'],correct:1},
p4:{kind:'quiz',question:'A is left of B. F is right of B. Which statement must be true?',options:['F is left of A','A is left of F','B is left of A','F is left of B'],correct:1},
p5:{kind:'quiz',question:'What comes next: 2, 5, 10, 17, 26, __?',options:['31','35','37','42'],correct:1},
p6:{kind:'quiz',question:'Which word can follow COLD and also start a valid two-step word ladder to WARM?',options:['CORD','BOLD','SOLD','TOLD'],correct:0},
p7:{kind:'quiz',question:'In a shortest-path problem, what should you optimize first?',options:['Number of turns only','Total path length','Alphabetical order','Color count'],correct:1},
p8:{kind:'quiz',question:'Using the same Caesar shift as KHOOR → HELLO, what does UHVW decode to?',options:['REST','TEST','BEST','WEST'],correct:0},
p9:{kind:'quiz',question:'Math is before Coding. Coding is not Wednesday. Which can be a valid schedule?',options:['Mon Math, Tue Coding, Wed Design','Mon Design, Tue Math, Wed Coding','Mon Coding, Tue Math, Wed Design','Mon Math, Tue Design, Wed Coding'],correct:0},
p10:{kind:'quiz',question:'A bag has 3 red, 2 blue, 1 green token. Probability of red then blue without replacement?',options:['1/6','1/5','1/4','2/5'],correct:1},
p11:{kind:'quiz',question:'1→3, 2→6, 3→11, 4→18. Using n²+2n, what is 5→?',options:['25','30','35','40'],correct:2},
p12:{kind:'quiz',question:'In deduction puzzles, what is usually strongest?',options:['A random guess','A contradiction that eliminates a case','A colorful clue','The longest sentence'],correct:1},

l1:{kind:'lesson',question:'Which Python structure maps keys to values?',options:['List','Tuple','Dictionary','Set'],correct:2,lesson:'Python dictionaries store data as key → value pairs. They are useful when you need to look something up by a meaningful key.'},
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
l12:{kind:'lesson',question:'What makes a technical explanation easier for a beginner?',options:['More jargon','One clear idea plus a concrete example','Longer sentences','No examples'],correct:1,lesson:'Start with one core idea, then ground it in a familiar example. Add technical vocabulary only when it helps precision.'}
};

const CHALLENGE_BANK=[
 {q:'Which value is prime?',o:['21','27','29','33'],a:2},
 {q:'What is 15% of 200?',o:['15','20','30','45'],a:2},
 {q:'Which comes first in a browser request?',o:['DNS lookup','Page render','CSS paint','User logout'],a:0},
 {q:'What is 8×7?',o:['48','54','56','64'],a:2},
 {q:'Which SQL clause filters grouped results?',o:['WHERE','GROUP','HAVING','ORDER'],a:2},
 {q:'Which is an even number?',o:['37','41','44','53'],a:2},
 {q:'What is 2³?',o:['6','8','9','12'],a:1},
 {q:'Which data structure is key-value based?',o:['Dictionary','Tuple','Array only','String'],a:0},
 {q:'What usually helps reduce overfitting?',o:['Validation','More memorization','Random labels','Removing all data'],a:0},
 {q:'Which direction is opposite to north?',o:['East','West','South','Up'],a:2}
];

export function getInteractiveConfig(id){return Q[id]||null}
export function getChallengeRounds(seed=0,count=5){return Array.from({length:count},(_,i)=>CHALLENGE_BANK[(seed+i)%CHALLENGE_BANK.length])}
