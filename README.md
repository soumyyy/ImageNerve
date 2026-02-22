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

Identity is centralized so real auth can be added later without scattering changes:

- **Backend:** `app/auth/` defines `TEST_USER_ID` and `get_current_user_id(request)`. User is resolved from query `user_id`, header `X-User-Id`, or the test user. Photo service ensures the test user exists in the DB when needed; request logging uses the resolved user.
- **Frontend:** `src/config/user.ts` exports `CURRENT_USER_ID` and `getCurrentUserId()`. All screens and API calls use this; no hardcoded user ids elsewhere.
- To switch to real auth: replace `get_current_user_id` (e.g. with JWT) and the frontend config (e.g. with an auth context) in these two places.

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

## 📖 Documentation

- [Backend Logging System](backend/LOGGING.md)
- [Frontend Architecture](ImageNerveExpo/src/README.md)
- [UI Design Guide](ui-plan.md)
- [Project TODO](TODO.md)