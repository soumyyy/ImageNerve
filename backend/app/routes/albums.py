from typing import List, Optional

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.album_service import AlbumService

router = APIRouter()


def _serialize_album(album) -> dict:
    return {
        "id": str(album.id),
        "user_id": str(album.user_id),
        "name": album.name,
        "description": album.description,
        "is_public": album.is_public,
        "photo_ids": [str(pid) for pid in (album.photo_ids or [])],
        "cluster_ids": [str(cid) for cid in (album.cluster_ids or [])],
        "cover_photo_id": str(album.cover_photo_id) if album.cover_photo_id else None,
        "created_at": album.created_at.isoformat() if album.created_at else None,
        "updated_at": album.updated_at.isoformat() if album.updated_at else None,
    }


@router.post("/")
def create_album(
    user_id: str = Query(...),
    name: str = Query(...),
    description: Optional[str] = Query(None),
    is_public: bool = Query(False),
    cover_photo_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Create a new album."""
    svc = AlbumService(db)
    try:
        album = svc.create_album(
            user_id=user_id,
            name=name,
            description=description,
            is_public=is_public,
            cover_photo_id=cover_photo_id,
        )
        return _serialize_album(album)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/")
def list_albums(
    user_id: str = Query(...),
    include_public: bool = Query(False),
    db: Session = Depends(get_db),
):
    """List albums for a user."""
    svc = AlbumService(db)
    albums = svc.get_albums_by_user(user_id, include_public=include_public)
    return [_serialize_album(a) for a in albums]


@router.get("/public")
def list_public_albums(
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """List public albums."""
    svc = AlbumService(db)
    albums = svc.get_public_albums(limit=limit)
    return [_serialize_album(a) for a in albums]


@router.get("/{album_id}")
def get_album(
    album_id: str,
    user_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Get a single album by ID."""
    svc = AlbumService(db)
    album = svc.get_album_by_id(album_id, user_id=user_id)
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")
    return _serialize_album(album)


@router.put("/{album_id}")
def update_album(
    album_id: str,
    user_id: str = Query(...),
    name: Optional[str] = Query(None),
    description: Optional[str] = Query(None),
    is_public: Optional[bool] = Query(None),
    cover_photo_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Update an album."""
    svc = AlbumService(db)
    kwargs = {}
    if name is not None:
        kwargs["name"] = name
    if description is not None:
        kwargs["description"] = description
    if is_public is not None:
        kwargs["is_public"] = is_public
    if cover_photo_id is not None:
        kwargs["cover_photo_id"] = cover_photo_id
    try:
        album = svc.update_album(album_id, user_id, **kwargs)
        if not album:
            raise HTTPException(status_code=404, detail="Album not found")
        return _serialize_album(album)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{album_id}")
def delete_album(
    album_id: str,
    user_id: str = Query(...),
    db: Session = Depends(get_db),
):
    """Delete an album."""
    svc = AlbumService(db)
    ok = svc.delete_album(album_id, user_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Album not found")
    return {"success": True, "album_id": album_id}


@router.post("/{album_id}/photos")
def add_photos_to_album(
    album_id: str,
    user_id: str = Query(...),
    photo_ids: List[str] = Query(...),
    db: Session = Depends(get_db),
):
    """Add photos to an album."""
    svc = AlbumService(db)
    result = svc.add_photos_to_album(album_id, user_id, photo_ids)
    return result


@router.delete("/{album_id}/photos")
def remove_photos_from_album(
    album_id: str,
    user_id: str = Query(...),
    photo_ids: List[str] = Query(...),
    db: Session = Depends(get_db),
):
    """Remove photos from an album."""
    svc = AlbumService(db)
    result = svc.remove_photos_from_album(album_id, user_id, photo_ids)
    return result


@router.get("/{album_id}/photos")
def get_album_photos(
    album_id: str,
    user_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Get all photos in an album."""
    svc = AlbumService(db)
    photos = svc.get_album_photos(album_id, user_id=user_id)
    return {"album_id": album_id, "photos": photos, "photo_count": len(photos)}


@router.post("/{album_id}/clusters")
def add_clusters_to_album(
    album_id: str,
    user_id: str = Query(...),
    cluster_ids: List[str] = Query(...),
    db: Session = Depends(get_db),
):
    """Add face clusters to an album."""
    svc = AlbumService(db)
    result = svc.add_clusters_to_album(album_id, user_id, cluster_ids)
    return result


@router.get("/{album_id}/stats")
def get_album_stats(
    album_id: str,
    user_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Get album statistics."""
    svc = AlbumService(db)
    result = svc.get_album_stats(album_id, user_id=user_id)
    return result
