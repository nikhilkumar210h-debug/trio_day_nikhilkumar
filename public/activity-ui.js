import { escapeHtml as esc } from './utils.js';

export const ACTIVITY_TYPES = {
  puzzle: { label:'Puzzle', icon:'🧩', tone:'violet', desc:'Logic, riddles, patterns & brain teasers.' },
  build: { label:'Build', icon:'🛠️', tone:'cyan', desc:'Make something useful, creative or technical.' },
  learn: { label:'Learn', icon:'🧠', tone:'green', desc:'Explore a topic, skill or idea together.' },
  challenge: { label:'Challenge', icon:'⚡', tone:'orange', desc:'Timed, focused challenges with a clear goal.' },
  game: { label:'Game', icon:'🎮', tone:'pink', desc:'Quick social games and playful activities.' }
};

export function normalizeActivityType(task){
  const raw = String(task?.activityType || task?.type || '').toLowerCase().trim();
  if (ACTIVITY_TYPES[raw]) return raw;
  const text = String(task?.title || '') + ' ' + String(task?.description || '');
  if (/puzzle|riddle|logic|brain|pattern|mystery|word/i.test(text)) return 'puzzle';
  if (/build|make|create|design|code|website|project/i.test(text)) return 'build';
  if (/learn|study|science|coding|technology|knowledge|explore/i.test(text)) return 'learn';
  if (task?.kind === 'challenge' || /challenge|timed|speed/i.test(text)) return 'challenge';
  return 'game';
}

export function activityTypeInfo(task){
  return ACTIVITY_TYPES[normalizeActivityType(task)];
}

export function activityCardHtml(task, { compact=false } = {}){
  const type = activityTypeInfo(task);
  const id = encodeURIComponent(task.id || '');
  const title = esc(task.title || 'Untitled activity');
  const desc = esc(task.description || type.desc);
  const creator = esc(task.creatorName || (task.source === 'catalog' ? 'Trio Day' : 'Community'));
  const isCatalog = task.source === 'catalog';
  const viewHref = isCatalog ? 'activity.html?id=' + encodeURIComponent(task.id || '') : 'task-detail.html?id=' + encodeURIComponent(task.id || '');
  const expiry = Number.isFinite(task.expiresInDays) ? task.expiresInDays + 'd left' : (task.endAtMs ? Math.max(0, Math.ceil((task.endAtMs-Date.now())/86400000)) + 'd left' : '30d cycle');
  const duration = Number(task.durationMin) || 0;
  const xp = Number(task.xpReward) || 0;
  const joins = Number(task.joins) || 0;
  const completions = Number(task.completions) || 0;
  const featured = task.featured ? '<span class="activity-chip activity-chip--featured">Featured</span>' : '';
  return `
    <article class="activity-card activity-card--${type.tone}${compact ? ' activity-card--compact' : ''}">
      <div class="activity-card-art" aria-hidden="true">
        <div class="activity-art-grid"></div>
        <span class="activity-art-icon">${type.icon}</span>
        <span class="activity-art-orbit activity-art-orbit--one"></span>
        <span class="activity-art-orbit activity-art-orbit--two"></span>
      </div>
      <div class="activity-card-body">
        <div class="activity-card-top">
          <div class="activity-chips">
            <span class="activity-chip">${type.label}</span>${featured}
          </div>
          <span class="activity-arrow">↗</span>
        </div>
        <h3>${title}</h3>
        <p>${desc}</p>
        <div class="activity-meta">
          <span>${duration ? '⏱ ' + duration + ' min' : '👥 ' + joins + ' joined'}</span>
          <span>${esc(task.difficulty || (isCatalog ? 'Open' : 'Community'))}</span>
          <span>⌛ ${expiry}</span>
        </div>
        <div class="activity-footer">
          <span class="activity-creator">by ${creator}</span>
          <div class="activity-actions">
            <a class="activity-action activity-action--ghost" href="${viewHref}">View</a>
            <a class="activity-action activity-action--primary" href="rooms.html?taskId=${id}${isCatalog ? "&source=catalog" : ""}">Find a room</a>
          </div>
        </div>
      </div>
    </article>`;
}

export function activityCategoryCard(type){
  const info = ACTIVITY_TYPES[type];
  return `
    <button type="button" class="activity-category activity-category--${info.tone}" data-activity-filter="${type}">
      <span class="activity-category-icon">${info.icon}</span>
      <span class="activity-category-copy"><strong>${info.label}</strong><small>${info.desc}</small></span>
      <span class="activity-category-arrow">→</span>
    </button>`;
}

export function roomCardHtml(room){
  const title = esc(room.title || 'Open room');
  const activity = esc(room.activityTitle || 'Open activity');
  const people = Number(room.memberCount) || 0;
  const max = Number(room.maxPlayers) || 6;
  const id = encodeURIComponent(room.id || '');
  return `
    <a class="live-room-card" href="room.html?id=${id}">
      <span class="live-room-pulse"><i></i></span>
      <span class="live-room-copy">
        <strong>${title}</strong>
        <small><span class="live-dot">LIVE</span> ${people}/${max} people · ${activity}</small>
      </span>
      <span class="live-room-arrow">↗</span>
    </a>`;
}
