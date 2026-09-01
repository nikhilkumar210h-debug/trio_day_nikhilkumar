/**
 * Shared bottom nav HTML helper — call from pages or paste the 5-item markup.
 * Posts | Users | Tasks | Chat | Profile
 */
export function navHtml(active = '') {
  const items = [
    { href: 'index.html', icon: '⌂', label: 'Posts', key: 'posts' },
    { href: 'all-users.html', icon: '👥', label: 'Users', key: 'users' },
    { href: 'tasks.html', icon: '⚡', label: 'Tasks', key: 'tasks' },
    { href: 'chat.html', icon: '✉', label: 'Chat', key: 'chat' },
    { href: 'profile.html', icon: '◉', label: 'Profile', key: 'profile' }
  ];
  return `<nav class="bottom-nav" aria-label="Primary navigation"><div class="nav-row">${items.map(i =>
    `<a class="nav-btn${i.key === active ? ' active' : ''}" href="${i.href}"><span class="nav-icon">${i.icon}</span><span>${i.label}</span></a>`
  ).join('')}</div></nav>`;
}
