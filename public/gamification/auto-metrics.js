import { bumpProgress } from './progress.js';
import { METRICS } from './constants.js';

/** Fire-and-forget metric bumps after social actions. */
export function bumpMetric(uid, metric, amount = 1) {
  if (!uid || !metric) return Promise.resolve([]);
  return bumpProgress(uid, { metric, amount }).catch(err => {
    console.warn('bumpMetric failed', metric, err);
    return [];
  });
}

export function onPostCreated(uid) {
  return bumpMetric(uid, METRICS.create_post, 1);
}

export function onLikeGiven(uid) {
  return bumpMetric(uid, METRICS.give_likes, 1);
}

export function onLikeReceived(ownerUid) {
  return bumpMetric(ownerUid, METRICS.get_likes, 1);
}

export function onCommentCreated(uid) {
  return bumpMetric(uid, METRICS.comment_posts, 1);
}
