# Functions folder

`signInWithTrioUid` — the server-side Trio UID login callable — lives in `index.js`.

- Client: public/auth.js (calls the `signInWithTrioUid` callable)
- Deployed with: `firebase deploy --only functions`
- The retired OneSignal push Worker (`workers/send-push.js`) has been removed; use workers/send-notification.js.
