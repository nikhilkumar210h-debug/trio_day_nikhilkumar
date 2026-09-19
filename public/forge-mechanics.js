export const FORGE_MECHANICS={
 puzzle:[
  {id:'choice',label:'Choose',icon:'◉',desc:'Pick the correct answer.'},
  {id:'order',label:'Arrange',icon:'↕',desc:'Put clues or steps in the right order.'},
  {id:'pattern',label:'Pattern',icon:'⌁',desc:'Find the hidden rule or sequence.'},
  {id:'deduction',label:'Deduce',icon:'◇',desc:'Use clues to reach one solution.'}
 ],
 build:[
  {id:'order',label:'Flow',icon:'→',desc:'Arrange pieces into a working sequence.'},
  {id:'timeline',label:'Timeline',icon:'◷',desc:'Plan steps against limited time.'},
  {id:'grid',label:'Grid',icon:'▦',desc:'Place pieces while respecting constraints.'},
  {id:'allocate',label:'Allocation',icon:'⌘',desc:'Distribute limited resources or budget.'},
  {id:'assign',label:'Roles',icon:'◎',desc:'Match people, roles or resources logically.'}
 ],
 learn:[
  {id:'lesson_quiz',label:'Learn + Check',icon:'◈',desc:'Short lesson followed by a knowledge check.'},
  {id:'teachback',label:'Teach Back',icon:'↗',desc:'Learn an idea and explain it simply.'},
  {id:'case',label:'Case Study',icon:'▤',desc:'Apply the concept to a small real-world case.'}
 ],
 challenge:[
  {id:'timed_score',label:'Timed Score',icon:'⚡',desc:'Earn points before the clock ends.'},
  {id:'sprint',label:'Sprint',icon:'→',desc:'Finish a defined goal as efficiently as possible.'},
  {id:'streak',label:'Streak',icon:'∞',desc:'Keep consecutive correct or successful rounds.'}
 ],
 game:[
  {id:'quick_rounds',label:'Quick Rounds',icon:'✦',desc:'Short rounds with a shared score.'},
  {id:'word_game',label:'Word Game',icon:'Aa',desc:'Play a fast language-based round.'},
  {id:'team_game',label:'Team Game',icon:'◎',desc:'Cooperate around one shared objective.'}
 ]
};
export function mechanicsFor(type){return FORGE_MECHANICS[type]||[]}
export function mechanicInfo(type,id){return mechanicsFor(type).find(x=>x.id===id)||mechanicsFor(type)[0]||null}
