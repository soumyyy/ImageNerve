# ImageNerve - TODO

Full-stack photo app: React Native (Expo), FastAPI, PostgreSQL, S3, InsightFace.

---

## Completed

- Backend: FastAPI, SQLAlchemy, S3 presigned uploads, CORS, logging
- Database: Users, Photos, Face embeddings/clusters, Albums, Album shares, QR links, Photo feedback
- Photo API: upload-url, create, list, get, update, delete, metadata extraction
- Face API: detect, detect-and-store, embeddings, clusters, similarity, DBSCAN clustering
- Album API: CRUD, add/remove photos, stats
- Album sharing (email): share, accept, decline, permissions — PAUSED (moving to link/QR)
- Frontend: Dashboard, Photos, Albums, Settings, Photo viewer, upload flow, liquid glass UI
- Face clustering auto-pipeline on upload

---

## To Do

### High priority

1. **Authentication**
   - Firebase Auth integration
   - `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, `PUT /auth/profile`
   - Protected routes and user-specific data

2. **Share link / QR-based sharing**
   - Backend:
     - `POST /qr/share` - Create share link (resource_type, resource_id, permissions, expires_at)
     - `GET /qr/resolve/{token}` - Resolve token to resource + permissions
     - `GET /qr/album/{token}/photos` - Get photos via token
     - `DELETE /qr/{token}` - Revoke link
   - Frontend: Share via link action, URL/QR display, copy/share, open-link screen to consume token

3. **Photo management**
   - Wire actual delete (UI exists; backend cascade done)
   - Wire actual download (web proxy done; native save UX)
   - Photo editing, sharing

4. **Face recognition integration**
   - People tab: list clusters with counts/thumbnails, tap to open person detail
   - Cluster management: rename, merge, delete
   - `GET /faces/search` - Search by embedding (currently placeholder)

5. **Album sharing frontend**
   - Wire SharedAlbumsScreen to real API (replace mocks)
   - Wire ShareAlbumModal to share flow
   - Error handling and loading states

### Medium priority

- QR code generation and scanning for albums/photos
- Album Members table API (model exists; not exposed)
- Advanced search: `GET /search/photos`, `/search/faces`, `/search/location`, `/search/date`

### Technical debt

- Error handling: consistent HTTP codes, detailed messages
- Validation: input validation, file type/size checks
- Testing: unit tests for services, integration tests for endpoints
- Performance: image compression, caching, query optimization
- Security: JWT, rate limiting, role-based access

### Future

- Photo editing (filters, crop, rotate)
- Smart organization (auto-tagging, scene detection)
- Face quality assessment, age/gender, emotion
- Analytics: most photographed people, locations, quality metrics
- Photo commenting, collaborative features

---

## Pending endpoints

| Endpoint | Status |
|----------|--------|
| `POST /auth/register`, `/auth/login`, `/auth/logout`, `GET /auth/me`, `PUT /auth/profile` | Not implemented |
| `POST /qr/share`, `GET /qr/resolve/{token}`, `GET /qr/album/{token}/photos`, `DELETE /qr/{token}` | Not implemented |
| `GET /faces/search` | Placeholder |
| `GET /search/photos`, `/search/faces`, `/search/location`, `/search/date` | Not implemented |

---

## Notes

- Email-based album sharing is paused. Link/QR sharing is the new direction.
- Shared albums UI exists but should stay hidden until link/QR lands.
- Album Members table defined in models; API not exposed.
