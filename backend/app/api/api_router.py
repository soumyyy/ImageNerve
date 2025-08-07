from fastapi import APIRouter
from app.routes import photos, albums, qr, faces, album_shares

apiRouter = APIRouter()

apiRouter.include_router(photos.router, prefix="/photos", tags=["photos"])
apiRouter.include_router(albums.router, prefix="/albums", tags=["albums"])
apiRouter.include_router(qr.router, prefix="/qr", tags=["qr"])
apiRouter.include_router(faces.router, prefix="/faces", tags=["faces"])
apiRouter.include_router(album_shares.router, prefix="/album-shares", tags=["album-shares"])
# apiRouter.include_router(auth.router, prefix="/auth", tags=["auth"])  # Postponed 