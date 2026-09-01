# Base64 → Cloudinary migration

Moves images that were saved as `data:image/...;base64,...` inside Firestore
into Cloudinary, then stores only `secure_url` in Firestore.

Uses the same **unsigned** upload preset as the web app:
- Cloud name: `vyhglthg`
- Upload preset: `trio_uploads`

## What gets migrated

| Collection | Field | Cloudinary folder |
|---|---|---|
| `users` | `photoURL` | `trio/profiles` |
| `posts` | `mediaUrl` | `trio/posts` |
| `posts` | `photoURL` (if still data URL) | `trio/posts` |

Note: this project never had a separate `base64` field — the data URL **was**
`mediaUrl` / `photoURL`. Migration replaces that value with a Cloudinary URL.

## Setup

1. Firebase Console → Project settings → Service accounts → **Generate new private key**
   (only needed to read/update Firestore; uploads go to Cloudinary)
2. Save the JSON as `scripts/serviceAccountKey.json` (gitignored)
3. Install + run:

```bash
cd scripts
npm install
npm run migrate:dry
npm run migrate
```

## Flags

- `--dry-run` — scan only, no Cloudinary/Firestore writes
- `--posts-only` — only posts
- `--users-only` — only users

Optional env:

- `GOOGLE_APPLICATION_CREDENTIALS` — path to service account JSON
- `CLOUDINARY_CLOUD_NAME` — default `vyhglthg`
- `CLOUDINARY_UPLOAD_PRESET` — default `trio_uploads`
