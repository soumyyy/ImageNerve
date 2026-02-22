# # ImageNerve - AI-Powered Photo Management

A full-stack photo management application with AI-powered face recognition, built with React Native (Expo) and FastAPI.

## Project Structure

```
image_nerve_app/
├── ImageNerveExpo/          # React Native Frontend (Expo)
│   ├── src/
│   │   ├── components/         # Reusable UI components
│   │   ├── screens/           # Screen components
│   │   ├── navigation/        # Navigation setup
│   │   ├── services/          # API services
│   │   ├── types/             # TypeScript definitions
│   │   └── utils/             # Utility functions
│   ├── assets/                # Images, icons, fonts
│   ├── App.tsx               # Main app entry point (16 lines)
│   └── package.json          # Dependencies
│
├── 🖥️ backend/                 # Python Backend (FastAPI)
│   ├── app/
│   │   ├── routes/           # API endpoints
│   │   ├── services/         # Business logic
│   │   ├── models/           # Database models
│   │   ├── auth/            # Current user / test user (single place for identity)
│   │   ├── face_engine/      # AI face detection
│   │   ├── utils/            # Utilities & logging
│   │   └── main.py          # FastAPI app
│   ├── logs/                # Application logs
│   └── requirements.txt     # Python dependencies
│
├── 📋 TODO.md                 # Project roadmap
├── 🎨 ui-plan.md             # UI/UX design guide
└── 📖 README.md              # This file
```

## Quick Start

### Frontend (React Native)
```bash
cd ImageNerveExpo
npm install
npm start
```

### Backend (FastAPI)
```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
for startup
```bash
cd backend && source .venv/bin/activate && python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Auth & user (test user)

Identity is centralized so real auth can be added later without scattering changes.

**Single source of truth:** The test user ID is **`testuser`**. It must match in both places; do not hardcode it elsewhere.

- **Backend:** `backend/app/auth/current_user.py` defines `TEST_USER_ID = "testuser"` and `get_current_user_id(request)`. User is resolved from query `user_id`, header `X-User-Id`, or `TEST_USER_ID`. Photo service ensures the test user exists in the DB when needed.
- **Frontend:** `ImageNerveExpo/src/config/user.ts` exports `CURRENT_USER_ID = 'testuser'` and `getCurrentUserId()`. All screens and API calls must use `getCurrentUserId()`; no hardcoded user IDs elsewhere.
- To switch to real auth: replace `get_current_user_id` (e.g. with JWT) and the frontend config (e.g. with an auth context) in these two files only.

## Photo uploads & S3

Photo uploads use a presigned S3 URL: the app requests an upload URL from the backend, uploads the file to S3 with `PUT`, then creates a photo record.

- **Env:** Set in `backend/.env`: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` (defaults to `us-east-1` if omitted), and `S3_BUCKET_NAME`.
- **Health check:** `GET /photos/s3/health` returns `200` with `{ "ok": true, "bucket": "...", "region": "..." }` when S3 is configured and the bucket is reachable, or `503` with an error message otherwise.
- **Web:** For browser uploads, the S3 bucket must allow CORS (e.g. allow `PUT` from your app origin).

## Features

- 📸 **Photo Upload & Management** - Seamless photo uploads to AWS S3
- 🤖 **AI Face Recognition** - Powered by InsightFace
- 👥 **Face Clustering** - Automatic face grouping
- 🎨 **Apple Liquid Glass UI** - Beautiful frosted glass aesthetic
- 📱 **Cross-Platform** - iOS & Android support
- ☁️ **Cloud Storage** - AWS S3 integration
- 🗄️ **PostgreSQL Database** - Supabase integration
- 📊 **Comprehensive Logging** - Full operation tracking

## 🛠️ Tech Stack

**Frontend:**
- React Native with Expo SDK 54
- React 19.1 / React Native 0.81
- TypeScript
- React Navigation
- Axios for API calls

**Backend:**
- FastAPI (Python)
- SQLAlchemy ORM
- PostgreSQL (Supabase)
- AWS S3
- InsightFace AI

**Infrastructure:**
- AWS S3 for file storage
- Supabase for database
- Comprehensive logging 

## Dependencies (Expo 54)

The frontend is pinned to **Expo SDK 54** with **React Native 0.81.5** and **React 19.1.0**. Do **not** run `npm audit fix --force`; it will downgrade Expo to 51 and change React Native to 0.84, which breaks the project. Use `npm install` and keep the versions in `package.json`. Remaining audit warnings are from transitive dependencies in the Expo/React Native ecosystem and are not safely fixable without breaking the stack.

## Troubleshooting: Expo / Metro not starting

If `npx expo start` or `npm start` hangs at **"Starting project at ..."** with no QR code or "Metro waiting on" message:

1. **Wait 60–90 seconds** – First start can be slow while Metro builds the cache.
2. **Clear caches and try again:**
   ```bash
   cd ImageNerveExpo
   rm -rf .expo node_modules/.cache
   rm -rf $TMPDIR/metro-cache 2>/dev/null
   npx expo start -c
   ```
3. **Fix npm "devdir" warning** (can cause slowness):
   ```bash
   npm config delete devdir
   ```
4. **If you use a VPN or corporate proxy** – Try disconnecting or run:
   ```bash
   HTTP_PROXY= HTTPS_PROXY= npx expo start -c --localhost
   ```
5. **Full reset** (if it still hangs):
   ```bash
   cd ImageNerveExpo
   rm -rf node_modules .expo
   npm cache clean --force
   npm install
   npx expo start -c
   ```
6. **Check project setup:** `npx expo-doctor` (install with `npm install -g expo-doctor` if needed).

## 📖 Documentation

- [Backend Logging System](backend/LOGGING.md)
- [Frontend Architecture](ImageNerveExpo/src/README.md)
- [UI Design Guide](ui-plan.md)
- [Project TODO](TODO.md)