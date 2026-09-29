# Trio Day — Firestore Cost Audit

## Scope
Phase 9 review of the Challenge-first release. The goal is to stay inside the Firebase free tier while keeping the interaction loop responsive.

## Current budget reference
Firebase's current Firestore Standard no-cost quota is 50,000 document reads/day, 20,000 document writes/day, 20,000 deletes/day, and 1 GiB stored data. Exact billing depends on the Firebase project/region and current pricing terms.

## Main read paths

| Surface | Read pattern | Guardrail |
|---|---|---|
| Challenge feed | communityTasks query with status/kind/order/limit | max 100 fetched, visible list capped, short cache |
| Home active challenges | count aggregation per visible challenge | short cache; no full answer download for the count |
| Challenge result | answer documents for the selected/open result | only hydrated/visible cards are expanded |
| Next Challenge | current user's answer IDs | bounded query; no listener |
| Challenge discussion | realtime messages limited to 30 | profiles/answers are loaded only for visible messages |
| Friend streak | following IDs + user docs in chunks of 10 | max 30 following IDs per Home load |
| Daily question | one config/dailyQuestion document | one-day localStorage cache |
| Temporary chat | realtime temporary message list | room is capped by a 10-minute expiry |

Firestore aggregation queries such as count are billed according to index entries read and return only the aggregate result; this avoids transferring every answer document just to display a total.

## Main write paths

- One challengeAnswers/{uid}_{challengeId} document per user + Challenge; changing an answer updates that document instead of creating another answer.
- challengeStats/{challengeId} is maintained in a Firestore transaction for immediate UI counters.
- Existing server-authoritative XP/streak writes remain behind the Cloudflare gamification Worker.
- Temporary chat creates one room plus message documents; the free-tier deployment cleans them through the existing Cloudflare cron Worker. Firestore TTL is not enabled because TTL deletes currently require billing.
- Admin moderation changes hidden/status only; it does not delete test data.

## Known trade-offs

1. A write-time counter adds a write per answer but avoids repeatedly scanning the answer set for a real-time-looking result.
2. The answer collection remains the recovery/audit source. If challengeStats is missing or a transaction fails, the UI can still fall back to answer documents and count aggregation.
3. Firestore realtime listeners are intentionally limited to Challenge discussion and active temporary chat; the Home/Challenge feed does not create a listener per card.
4. TTL deletion is asynchronous. Access rules use the expiration timestamp directly, so an expired room cannot be used while Firestore is waiting to delete it.

## Release checks

- Search for unbounded getDocs(collection(...)) in user-facing paths.
- Keep limit() on feed/list queries.
- Prefer cursors over offsets for future pagination.
- Recheck Firestore indexes after query changes.
- Monitor the Firebase usage panel before increasing feed limits.
