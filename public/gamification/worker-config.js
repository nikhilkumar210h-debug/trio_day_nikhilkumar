/**
 * Gamification Worker URL.
 *
 * After deploying workers/gamification.js with:
 *   npx wrangler deploy --name trio-gamification
 *
 * Replace the placeholder below with the actual Workers.dev URL shown in the
 * deploy output, e.g.:
 *   https://trio-gamification.<your-subdomain>.workers.dev
 *
 * This is the ONLY file that needs to change when the Worker URL changes.
 * It contains no secrets — the URL is public (auth is via Firebase ID tokens).
 */
export const GAMIFICATION_WORKER_URL =
  'https://trio-gamification.trioday-nikhil.workers.dev';

/**
 * POST to the gamification Worker with the current user's Firebase ID token.
 * @param {string} path  – e.g. '/gamification/award-xp'
 * @param {object} body  – JSON-serialisable request body
 * @param {import('firebase/auth').User} user – Firebase Auth user object
 */
export async function workerPost(path, body, user) {
  if (!user) throw new Error('Not authenticated');

  // getIdToken(false) returns cached token; pass true to force refresh if needed
  const idToken = await user.getIdToken(false);

  const res = await fetch(`${GAMIFICATION_WORKER_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`
    },
    body: JSON.stringify(body)
  });

  let data;
  try {
    data = await res.json();
  } catch (_) {
    throw new Error(`Worker ${path} returned non-JSON (status ${res.status})`);
  }

  if (!res.ok) {
    // On 401 try once with a fresh token, then fail
    if (res.status === 401) {
      const freshToken = await user.getIdToken(true);
      const retry = await fetch(`${GAMIFICATION_WORKER_URL}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${freshToken}`
        },
        body: JSON.stringify(body)
      });
      const retryData = await retry.json().catch(() => ({}));
      if (!retry.ok) throw new Error(retryData.error || `Worker ${path} failed (${retry.status})`);
      return retryData;
    }
    throw new Error(data.error || `Worker ${path} failed (${res.status})`);
  }

  return data;
}
