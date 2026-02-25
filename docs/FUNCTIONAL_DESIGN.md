# ImageNerve — Functional Design Document

## 1. Overview

ImageNerve is a photo management app with AI face recognition. Users upload photos to S3, organize them in albums, and the system detects faces, extracts embeddings, and clusters similar faces for "People" views. Sharing is moving from email-based to link/QR-based.

**Stack:** React Native (Expo) frontend, FastAPI backend, PostgreSQL (Supabase), AWS S3, InsightFace.

---

## 2. Identity & Auth

| Aspect | Current | Planned |
|--------|---------|---------|
| User ID | Hardcoded `testuser` in backend + frontend config | Firebase Auth, JWT |
| Resolution | `user_id` query param or `X-User-Id` header; else test user | Token-based |
| Config | `backend/app/auth/current_user.py`, `frontend/src/config/user.ts` | Auth context / session |

---

## 3. Core Entities

### Users
- `id`, `name`, `email`, `role` (user | photographer), `profile_pic_url`, `settings`
- Created on first photo upload if using test user

### Photos
- Stored in S3; DB record has `s3_url`, `filename`, `tags`, `photo_metadata`, `is_public`, `location` (optional)
- Linked to `face_embeddings` for detected faces

### Albums
- `name`, `description`, `photo_ids[]`, `cluster_ids[]`, `cover_photo_id`, `is_public`
- **My Photos**: System album, auto-populated with photos where the user’s face is detected (not manually editable)
- User-created albums: CRUD, add/remove photos, optional cluster association

### Face Embeddings
- 512-d vector (pgvector), per face per photo
- `bbox`, `confidence`; linked to `photo_id`, `user_id`

### Face Clusters
- Groups of similar faces (DBSCAN on embeddings)
- `face_ids[]`, `label` (e.g. person name)
- Used for People views and album filtering

### QR Links (planned)
- Tokenized share links for albums/photos/clusters
- `resource_type`, `resource_id`, `expires_at`

### Album Shares (email) — Paused
- Email-based sharing with view/edit/admin permissions
- API exists; UI hidden until link/QR replaces it

---

## 4. User Flows

### 4.1 Photo Upload

1. User taps Add → **Add Photo to Album**
2. Image picker opens (pick up to 50 images)
3. Album picker opens; user selects album (or creates new)
4. For each image:
   - Request presigned S3 URL from backend
   - PUT file to S3
   - Create photo record via `POST /photos/`
   - Add photo to selected album
5. If batch ≤ 3: run face detection per photo, store embeddings
6. Debounced face clustering runs after upload

**Alternative:** From inside an album → Add opens picker directly; photos go to that album.

### 4.2 Photo Browsing

- **Photos tab**: Grid of user photos, scope **Me** (own) or **Everyone** (own + public)
- Pagination: 12 initially, 60 per “load more”
- Tap photo → full-screen viewer; swipe between photos, view metadata
- Pinch to change grid columns (3 / 5 / 10)

### 4.3 Albums

- **Albums tab**: List of albums with cover previews
- Tap album → album detail (photo grid)
- Add button in header → add photos to that album
- **My Photos** is excluded from add-target picker (system album)

### 4.4 Face Profile (Settings)

- User captures 3 face shots for profile embedding
- Stored via `POST /faces/detect-and-store` with a dedicated profile photo
- Used to personalize “Me” view and future People features

### 4.5 Sharing (planned)

- Share via link: generate token, show URL + QR
- Recipient opens link → sees album/photo without login
- Revoke: `DELETE /qr/{token}`

---

## 5. API Surface

### Photos
- `POST /photos/s3/upload-url` — Presigned upload URL
- `POST /photos/` — Create photo record (optionally `album_ids`, `skip_default_album`)
- `GET /photos/` — List user photos (paginated, `user_id`, `cursor_before`)
- `GET /photos/public` — Public photos
- `GET /photos/{id}`, `PUT /photos/{id}`, `DELETE /photos/{id}`
- `GET /photos/s3/health`, `/s3/proxy-download`, `/s3/rename`, `DELETE /photos/s3/{key}`
- `POST /photos/s3/extract-metadata` — EXIF etc.

### Albums
- `POST /albums/`, `GET /albums/`, `GET /albums/public`
- `GET /albums/{id}`, `PUT /albums/{id}`, `DELETE /albums/{id}`
- `POST /albums/{id}/photos`, `DELETE /albums/{id}/photos`, `GET /albums/{id}/photos`
- `POST /albums/{id}/clusters`, `GET /albums/{id}/stats`

### Faces
- `POST /faces/detect` — Detect only (no store)
- `POST /faces/detect-and-store` — Detect + store embeddings
- `GET /faces/embeddings`, `GET /faces/embeddings/{photo_id}`
- `GET /faces/clusters`, `GET /faces/clusters/{id}`, `POST /faces/clusters`, `PUT /faces/clusters/{id}`, `DELETE /faces/clusters/{id}`
- `POST /faces/similarity` — Similar faces
- `POST /faces/cluster` — Run DBSCAN clustering
- `GET /faces/cluster/optimize` — Suggest DBSCAN params
- `GET /faces/clusters/{id}/validate` — Cluster quality
- `GET /faces/profile-status` — User profile face exists

### Album Shares (paused)
- Share, accept, decline, update permissions, remove access, list shares

### QR (planned)
- `POST /qr/share`, `GET /qr/resolve/{token}`, `GET /qr/album/{token}/photos`, `DELETE /qr/{token}`

---

## 6. Frontend Structure

### Navigation

- **Stack:** Splash → Login → OTP → MainApp (tabs)
- **Tabs:** Photos (Dashboard) | Settings
- **In-dashboard:** Photos tab (grid + Me/Everyone) | Albums tab (list) | Album detail (full screen)
- **Modals:** Add menu, Album picker, New album, Share album (paused)

### Screens

| Screen | Purpose |
|--------|---------|
| SplashScreen | Launch / branding |
| LoginScreen, OTPScreen | Auth (placeholder for Firebase) |
| DashboardScreen | Photos grid + Albums list (tabbed); Me/Everyone scope; add flow |
| AlbumDetailsScreen | Album photo grid, add to album |
| SettingsScreen | User info, storage stats, Face Profile wizard |
| PhotoViewer | Full-screen photo, swipe, metadata, delete |

### Key Components

- `PhotoImage` — Thumbnail with optional full-res load
- `AlbumCard`, `AlbumPickerModal`, `NewAlbumModal`
- `FaceProfileWizard` — 3-shot face capture
- `LiquidGlassTabBar` — Custom tab bar
- `PhotoViewer` — Swipeable viewer with actions

---

## 7. Data Flows

### Upload Pipeline

```
Picker → S3 (presigned PUT) → POST /photos/ → Add to album
       → (if ≤3 images) POST /faces/detect-and-store
       → scheduleClusterRefresh (debounced)
```

### Face Clustering

- DBSCAN on 512-d embeddings
- Triggered on upload (debounced), or manually
- Results in `face_clusters`; clusters can be labeled and attached to albums

### My Photos Album

- Intended: photos where user’s face appears (from clusters)
- Current: default album receiving new uploads; excluded from manual add-target picker

---

## 8. Config & Environment

**Backend `.env`**
- `DATABASE_URL` — Supabase PostgreSQL
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `S3_BUCKET_NAME`
- `LOG_LEVEL`

**Frontend**
- API base URL (platform-specific: localhost for dev, config for prod)
- `CURRENT_USER_ID` in config (test mode)

---

## 9. Implemented vs Planned

| Feature | Status |
|---------|--------|
| Photo upload (S3, multi-pick) | Done |
| Albums CRUD, add/remove photos | Done |
| Face detection, embeddings, clustering | Done |
| Me/Everyone scope, pagination | Done |
| Face profile capture | Done |
| Delete photo (backend cascade) | Done |
| Download (web proxy) | Done |
| Auth (Firebase, JWT) | Planned |
| QR/link sharing | Planned |
| People tab (clusters UI) | Planned |
| Cluster rename/merge/delete | Planned |
| Photo editing | Future |
| Advanced search | Future |
