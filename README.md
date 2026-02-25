# ImageNerve

Photo management app with AI face recognition. React Native (Expo) + FastAPI + PostgreSQL + S3 + InsightFace.

## Quick Start

**Backend** (Python 3.11)
```bash
cd backend
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Frontend**
```bash
cd frontend
npm install
npm start
```

## Project Structure

- `frontend/` – React Native (Expo)
- `backend/` – FastAPI backend, routes, services, face engine
- `TODO.md` – Roadmap

## Config

**Backend `.env`** (copy from `.env.example`):
- `DATABASE_URL` – Supabase PostgreSQL
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `S3_BUCKET_NAME`

**Test user:** `testuser` – defined in `backend/app/auth/current_user.py` and `frontend/src/config/user.ts`. Don't hardcode elsewhere.

## Tech Stack

- Frontend: Expo 54, React Native 0.81, TypeScript
- Backend: FastAPI, SQLAlchemy, PostgreSQL (Supabase), S3, InsightFace

**Frontend:** Do not run `npm audit fix --force` – it breaks Expo 54.

## Troubleshooting

**Expo hangs at "Starting project"** – Wait 60–90s. If still stuck: `rm -rf .expo node_modules/.cache`, `npm config delete devdir`, then `npx expo start -c`.

**Backend slow start** – InsightFace/model load takes 30–60s.

## Docs

- [Functional Design](docs/FUNCTIONAL_DESIGN.md) – Features, flows, API, entities
- [TODO](TODO.md)
- [Backend Logging](backend/LOGGING.md)
- [UI Plan](ui-plan.md)
