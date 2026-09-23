// Trio Day WebMCP — core product paths
// Read-only navigation helpers for in-browser AI agents.
// Human UI remains fully functional when WebMCP is unavailable.
const modelContext = (typeof document !== 'undefined' && document.modelContext)
  || (typeof navigator !== 'undefined' && navigator.modelContext)
  || null;

if (modelContext?.registerTool) {
  const controller = new AbortController();

  const navigate = (url) => {
    location.href = url;
    return { ok: true, url };
  };

  try {
    await modelContext.registerTool({
      name: 'open_today',
      title: 'Open Trio Day Today',
      description: 'Open the Today surface where the signed-in user can answer the daily social challenge.',
      inputSchema: { type: 'object', properties: {} },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute: async () => navigate('index.html')
    }, { signal: controller.signal });

    await modelContext.registerTool({
      name: 'open_challenge',
      title: 'Open a Trio Day challenge',
      description: 'Open the public Challenge surface, optionally targeting a challenge ID.',
      inputSchema: {
        type: 'object',
        properties: { challengeId: { type: 'string', description: 'Optional challenge identifier.' } }
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: async ({ challengeId = '' } = {}) => {
        const id = String(challengeId || '').trim();
        return navigate(id ? 'challenge.html?challenge=' + encodeURIComponent(id) : 'challenge.html');
      }
    }, { signal: controller.signal });

    await modelContext.registerTool({
      name: 'search_challenges',
      title: 'Search Trio Day challenges',
      description: 'Open the Challenge surface for browsing current community prompts.',
      inputSchema: {
        type: 'object',
        properties: { query: { type: 'string', description: 'Optional search phrase for the user interface.' } }
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: async ({ query = '' } = {}) => ({
        ok: true,
        surface: 'challenge.html',
        query: String(query || '').trim(),
        mechanics: ['pick', 'compare', 'discuss']
      })
    }, { signal: controller.signal });

    await modelContext.registerTool({
      name: 'find_people',
      title: 'Find people on Trio Day',
      description: 'Open people search where a user can search by name or Trio UID.',
      inputSchema: {
        type: 'object',
        properties: { query: { type: 'string', description: 'Optional name or Trio UID to search for.' } }
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: async ({ query = '' } = {}) => {
        const q = String(query || '').trim();
        return navigate('search.html' + (q ? '?q=' + encodeURIComponent(q) : ''));
      }
    }, { signal: controller.signal });

    await modelContext.registerTool({
      name: 'open_chat',
      title: 'Open Trio Day chat',
      description: 'Open private messaging. Optionally open a conversation for a specific user.',
      inputSchema: {
        type: 'object',
        properties: { uid: { type: 'string', description: 'Optional Trio Day Firebase user UID.' } }
      },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute: async ({ uid = '' } = {}) => {
        const id = String(uid || '').trim();
        return navigate(id ? 'private-chat.html?uid=' + encodeURIComponent(id) : 'chat.html');
      }
    }, { signal: controller.signal });

    await modelContext.registerTool({
      name: 'open_profile',
      title: 'Open a Trio Day profile',
      description: 'Open a profile page, optionally targeting a Firebase user UID.',
      inputSchema: {
        type: 'object',
        properties: { uid: { type: 'string', description: 'Optional Firebase user UID.' } }
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: async ({ uid = '' } = {}) => {
        const id = String(uid || '').trim();
        return navigate(id ? 'profile.html?uid=' + encodeURIComponent(id) : 'profile.html');
      }
    }, { signal: controller.signal });
  } catch (error) {
    console.warn('[WebMCP] registration skipped:', error);
  }
}
