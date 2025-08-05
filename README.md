# # 📸 ImageNerve - AI-Powered Photo Management

A full-stack photo management application with AI-powered face recognition, built with React Native (Expo) and FastAPI.

## 🏗️ Project Structure

```
image_nerve_app/
├── 📱 ImageNerveExpo/          # React Native Frontend (Expo)
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

## 🚀 Quick Start

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

## ✨ Features

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
- React Native (Expo)
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
- Comprehensive logging system

## 📖 Documentation

- [Backend Logging System](backend/LOGGING.md)
- [Frontend Architecture](ImageNerveExpo/src/README.md)
- [UI Design Guide](ui-plan.md)
- [Project TODO](TODO.md)