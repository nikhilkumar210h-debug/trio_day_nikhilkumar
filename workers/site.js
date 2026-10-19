/**
 * Main site Worker — handles static asset serving with extension-less URLs
 * and SPA routing for Trio Day
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    let pathname = url.pathname;

    // Handle extension-less URLs: /login → /login.html, /admin/tasks → /admin-activity.html
    const routeMap = {
      '/login': '/login.html',
      '/admin': '/admin-activity.html',
      '/admin/tasks': '/admin-activity.html',
      '/profile': '/profile.html',
      '/leaderboard': '/leaderboard.html',
      '/chat': '/chat.html',
      '/search': '/search.html',
      '/help': '/help.html',
      '/privacy': '/privacy.html',
      '/terms': '/terms.html',
      '/today': '/index.html',
    };

    // Check if path matches a route without extension
    if (routeMap[pathname]) {
      url.pathname = routeMap[pathname];
      return env.ASSETS.fetch(new Request(url.toString(), request));
    }

    // If path doesn't have an extension and isn't root, try adding .html
    if (pathname !== '/' && !pathname.includes('.') && !pathname.endsWith('/')) {
      const htmlPath = pathname + '.html';
      // Check if the .html file exists by trying to fetch it
      const testUrl = new URL(request.url);
      testUrl.pathname = htmlPath;
      const response = await env.ASSETS.fetch(new Request(testUrl.toString(), request));
      if (response.status !== 404) {
        return response;
      }
    }

    // Default: serve static assets
    return env.ASSETS.fetch(request);
  }
};