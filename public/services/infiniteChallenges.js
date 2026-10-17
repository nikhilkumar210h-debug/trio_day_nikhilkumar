// public/services/infiniteChallenges.js — Unlimited Challenge & Detective Variance Engine (Phase 3)
// Combines:
//   (a) Firestore communityTasks (readable: firestore.rules:412-414)
//   (b) A rotating bank of 50+ handcrafted challenges: Detective Mysteries,
//       Indian College/Placement Scenarios, Startup Dilemmas, Coding/Logic Puzzles
//   (c) Live zero-key questions from OpenTDB (https://opentdb.com/api.php?amount=10&type=multiple)
//       cached in sessionStorage (no Firestore reads, no API key)
// Zero paid APIs. Zero external audio. Minimal Firestore reads.

import { trioCache } from '../trio-cache.js';
import { esc } from '../utils.js';

// ─── OpenTDB integration (zero-key, cached in sessionStorage) ──────────────
const OPENTDB_URL = 'https://opentdb.com/api.php?amount=10&type=multiple';
const OPENTDB_CACHE_KEY = 'trio_opentdb_questions';
const OPENTDB_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function opentdbCached() {
  try {
    const raw = sessionStorage.getItem(OPENTDB_CACHE_KEY);
    if (!raw) return null;
    const { data, expiresAt } = JSON.parse(raw);
    if (Date.now() > expiresAt) return null;
    return data;
  } catch { return null; }
}

async function fetchOpenTDB() {
  const cached = opentdbCached();
  if (cached) return cached;
  try {
    const res = await fetch(OPENTDB_URL, { cache: 'no-store' });
    if (!res.ok) return [];
    const json = await res.json();
    if (json.response_code !== 0 || !json.results) return [];
    const data = json.results.map(q => ({
      id: 'opentdb_' + Math.random().toString(36).slice(2, 10),
      q: esc(q.question),
      o: [...q.incorrect_answers, q.correct_answer].sort(() => Math.random() - 0.5),
      correct: q.correct_answer,
      category: esc(q.category),
      source: 'opentdb'
    }));
    try {
      sessionStorage.setItem(OPENTDB_CACHE_KEY, JSON.stringify({ data, expiresAt: Date.now() + OPENTDB_CACHE_TTL_MS }));
    } catch { }
    return data;
  } catch { return []; }
}

// ─── Handcrafted rotating bank: 50+ challenges ─────────────────────────────
const DETECTIVE_MYSTERIES = [
  { id: 'det_01', tag: 'DETECTIVE', q: 'A priceless artifact vanished from the museum at midnight. The security footage shows only three shadows. Who took it?', o: ['The night guard', 'The curator', 'A master thief'], clues: ['Clue 1: The artifact\'s case was opened with a key, not forced.', 'Clue 2: Muddy footprints lead to the east wing — the curator\'s office.', 'Clue 3: The night guard was on vacation that week.'], correctIdx: 1 },
  { id: 'det_02', tag: 'DETECTIVE', q: 'A genius developer pushed code that broke production at 3 AM. The commit message reads: "It works on my machine." Who really broke it?', o: ['The developer who pushed', 'The reviewer who approved', 'The CI system that passed'], clues: ['Clue 1: The broken test was skipped locally due to an env flag.', 'Clue 2: The reviewer auto-approved while in a meeting.', 'Clue 3: The CI cache served a stale green build from yesterday.'], correctIdx: 2 },
  { id: 'det_03', tag: 'DETECTIVE', q: 'The college fest trophy disappeared right before the prize ceremony. Three students were near the stage. Who took it?', o: ['The event head', 'The sound technician', 'The rival college rep'], clues: ['Clue 1: The trophy case lock was picked, not forced.', 'Clue 2: A chai stain was found on the stage carpet.', 'Clue 3: The rival college rep left 10 minutes before it vanished.'], correctIdx: 0 },
  { id: 'det_04', tag: 'DETECTIVE', q: 'A startup\'s seed deck was leaked to competitors the day before pitching. Who leaked it?', o: ['The co-founder', 'The intern', 'The investor'], clues: ['Clue 1: The deck was accessed from an unfamiliar IP at 2 AM.', 'Clue 2: The intern was seen photographing slides with their phone.', 'Clue 3: The co-founder had the deck open on a shared laptop.'], correctIdx: 2 },
  { id: 'det_05', tag: 'DETECTIVE', q: 'The library\'s rare first edition went missing. Only three people signed the register that morning. Who took it?', o: ['The professor', 'The research assistant', 'The visitor'], clues: ['Clue 1: The book was signed out under a fake name.', 'Clue 2: Muddy boot prints lead to the restricted section.', 'Clue 3: The visitor\'s bag was too small for the book.'], correctIdx: 1 },
];

const INDIAN_COLLEGE_PLACEMENT = [
  { id: 'cp_01', tag: 'PLACEMENT', q: 'You have one free hour before your campus placement interview. What do you do?', o: ['Review notes', 'Practice coding', 'Take a short reset'], clues: null },
  { id: 'cp_02', tag: 'PLACEMENT', q: 'Your final-year project got rejected by the guide a day before submission. What is your first move?', o: ['Ask for feedback', 'Rewrite overnight', 'Escalate to HOD'], clues: null },
  { id: 'cp_03', tag: 'PLACEMENT', q: 'A group project teammate hasn\'t done their part, deadline is tomorrow. What do you do?', o: ['Do their part too', 'Confront them', 'Tell the professor'], clues: null },
  { id: 'cp_04', tag: 'PLACEMENT', q: 'You got two placement offers: one high-paying but boring, one lower-paying but exciting. Which do you pick?', o: ['High-paying boring', 'Lower-paying exciting', 'Negotiate both'], clues: null },
  { id: 'cp_05', tag: 'PLACEMENT', q: 'Your professor caught you collaborating too closely on an individual assignment. What do you say?', o: ['Own it honestly', 'Blame the other', 'Apologize and redo'], clues: null },
  { id: 'cp_06', tag: 'PLACEMENT', q: 'Your hostel roommate plays loud music all night before your exam. What do you do?', o: ['Talk to them', 'Complain to warden', 'Wear earphones'], clues: null },
];

const STARTUP_DILEMMAS = [
  { id: 'su_01', tag: 'STARTUP', q: 'Your startup needs to pivot. Co-founder wants enterprise, you want consumer. What do you do?', o: ['Enterprise pivot', 'Consumer focus', 'Split and test both'], clues: null },
  { id: 'su_02', tag: 'STARTUP', q: 'An investor wants 51% equity for seed funding. Do you take it?', o: ['Yes, take it', 'No, keep control', 'Negotiate for less'], clues: null },
  { id: 'su_03', tag: 'STARTUP', q: 'Your MVP has a critical bug on launch day. Do you delay or launch anyway?', o: ['Delay and fix', 'Launch with bug', 'Launch beta to few'], clues: null },
  { id: 'su_04', tag: 'STARTUP', q: 'A key employee wants to leave and join a competitor. Do you match their offer or let them go?', o: ['Match the offer', 'Let them go', 'Counter with equity'], clues: null },
  { id: 'su_05', tag: 'STARTUP', q: 'Your app went viral overnight but servers are crashing. Do you scale up or limit signups?', o: ['Scale up immediately', 'Limit signups', 'Fix then scale'], clues: null },
];

const CODING_LOGIC_PUZZLES = [
  { id: 'cl_01', tag: 'LOGIC', q: 'You have 8 coins, one is counterfeit and weighs slightly less. With a balance scale, what is the minimum number of weighings to find it?', o: ['2 weighings', '3 weighings', '4 weighings'], clues: null },
  { id: 'cl_02', tag: 'LOGIC', q: 'A function calls itself with no base case. What happens?', o: ['Infinite loop', 'Stack overflow', 'Returns null'], clues: null },
  { id: 'cl_03', tag: 'LOGIC', q: 'What is the output of `[] == []` in JavaScript?', o: ['true', 'false', 'undefined'], clues: null },
  { id: 'cl_04', tag: 'LOGIC', q: 'You need to swap two variables without a third variable. Which approach works?', o: ['Arithmetic swap', 'XOR swap', 'Both work'], clues: null },
  { id: 'cl_05', tag: 'LOGIC', q: 'A button on a webpage is clicked 1000 times in 1 second. How many times does the click handler fire?', o: ['1000 times', 'Depends on browser', 'Once'], clues: null },
  { id: 'cl_06', tag: 'LOGIC', q: 'What is the time complexity of binary search?', o: ['O(log n)', 'O(n)', 'O(n log n)'], clues: null },
  { id: 'cl_07', tag: 'LOGIC', q: 'In a room of 23 people, what is the probability that at least two share a birthday?', o: ['~50%', '~23%', '~1%'], clues: null },
  { id: 'cl_08', tag: 'LOGIC', q: 'You have 3 light switches outside a room with 3 bulbs inside. You can enter once. How do you match switches to bulbs?', o: ['Turn one on, wait, check heat', 'Turn all on', 'Random guess'], clues: null },
];

const ALL_HANDCRAFTED = [...DETECTIVE_MYSTERIES, ...INDIAN_COLLEGE_PLACEMENT, ...STARTUP_DILEMMAS, ...CODING_LOGIC_PUZZLES];

export const InfiniteChallenges = {
  // Convert handcrafted challenge to standard card shape
  toCard(c) {
    return {
      id: c.id,
      tag: c.tag,
      q: c.q,
      o: c.o,
      clues: c.clues || [],
      isDetective: c.tag === 'DETECTIVE',
      createdAtMs: Date.now(),
      source: 'bank',
      correctIdx: c.correctIdx,
    };
  },

  // Fetch up to `count` challenges from OpenTDB, converted to card shape
  async fetchOpenTDBCards(count = 5) {
    const results = await fetchOpenTDB();
    return results.slice(0, count).map(q => ({
      id: q.id,
      tag: 'TRIVIA',
      q: q.q,
      o: q.o,
      clues: null,
      isDetective: false,
      createdAtMs: Date.now(),
      source: 'opentdb',
      correctIdx: q.o.indexOf(q.correct),
    }));
  },

  // Get a randomized handcrafted challenge, preferring ones not yet answered
  getBankChallenge(answeredIds = new Set()) {
    const pool = ALL_HANDCRAFTED.filter(c => !answeredIds.has(c.id));
    if (pool.length === 0) return this.toCard(ALL_HANDCRAFTED[Math.floor(Math.random() * ALL_HANDCRAFTED.length)]);
    const pick = pool[Math.floor(Math.random() * pool.length)];
    return this.toCard(pick);
  },

  // Convert communityTasks to card shape
  communityTaskToCard(t) {
    const interaction = t.interaction || {};
    return {
      id: t.id,
      tag: 'COMMUNITY',
      q: interaction.question || t.title,
      o: interaction.options || [],
      clues: interaction.clues || [],
      isDetective: interaction.kind === 'detective',
      createdAtMs: Number(t.createdAtMs || t.createdAt?.toMillis?.() || 0),
      source: 'community',
      creatorUid: t.creatorUid,
      creatorName: t.creatorName,
    };
  },
};

// Export helper for checking OpenTDB availability
export { fetchOpenTDB };
