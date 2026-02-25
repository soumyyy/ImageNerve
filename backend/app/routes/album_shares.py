from typing import Optional

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.album_share_service import AlbumShareService

router = APIRouter()


@router.post("/share")
def share_album(
    album_id: str = Query(...),
    shared_by_user_id: str = Query(...),
    shared_with_email: str = Query(...),
    permissions: str = Query("view"),
    db: Session = Depends(get_db),
):
    """Share an album with another user via email."""
    try:
        share = AlbumShareService.share_album(
            db, album_id, shared_by_user_id, shared_with_email, permissions
        )
        return {
            "share_id": str(share.id),
            "album_id": str(share.album_id),
            "shared_with_email": share.shared_with_email,
            "permissions": share.permissions,
            "created_at": share.created_at.isoformat() if share.created_at else None,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/shared-with-me")
def get_shared_with_me(
    user_email: Optional[str] = Query(None),
    user_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Get albums shared with the current user."""
    if not user_email and not user_id:
        raise HTTPException(status_code=400, detail="user_email or user_id required")
    result = AlbumShareService.get_shared_albums_for_user(db, user_email or "", user_id)
    return result


@router.get("/pending-invitations")
def get_pending_invitations(
    user_email: str = Query(...),
    db: Session = Depends(get_db),
):
    """Get pending album share invitations for a user."""
    result = AlbumShareService.get_pending_shares_for_user(db, user_email)
    return result


@router.post("/accept")
def accept_share(
    share_id: str = Query(...),
    user_id: str = Query(...),
    db: Session = Depends(get_db),
):
    """Accept a shared album invitation."""
    try:
        share = AlbumShareService.accept_share(db, share_id, user_id)
        return {
            "share_id": str(share.id),
            "accepted_at": share.accepted_at.isoformat() if share.accepted_at else None,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/decline/{share_id}")
def decline_share(
    share_id: str,
    db: Session = Depends(get_db),
):
    """Decline a shared album invitation."""
    try:
        AlbumShareService.decline_share(db, share_id)
        return {"success": True}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.put("/permissions")
def update_permissions(
    share_id: str = Query(...),
    permissions: str = Query(...),
    updated_by_user_id: str = Query(...),
    db: Session = Depends(get_db),
):
    """Update permissions for a shared album."""
    try:
        share = AlbumShareService.update_share_permissions(
            db, share_id, permissions, updated_by_user_id
        )
        return {
            "share_id": str(share.id),
            "permissions": share.permissions,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/remove/{share_id}")
def remove_share(
    share_id: str,
    removed_by_user_id: str = Query(...),
    db: Session = Depends(get_db),
):
    """Remove shared album access."""
    try:
        AlbumShareService.remove_share(db, share_id, removed_by_user_id)
        return {"success": True}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/album/{album_id}/shares")
def get_album_shares(
    album_id: str,
    user_id: str = Query(...),
    db: Session = Depends(get_db),
):
    """Get all shares for an album (album owner only)."""
    try:
        result = AlbumShareService.get_album_shares(db, album_id, user_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))


@router.get("/album/{album_id}/shared-photos")
def get_album_shared_photos(
    album_id: str,
    db: Session = Depends(get_db),
):
    """Get photos in a shared album (for shared link consumers). Placeholder."""
    from app.services.album_service import AlbumService
    album = AlbumService(db).get_album_by_id(album_id, user_id=None)
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")
    photos = AlbumService(db).get_album_photos(album_id, user_id=None)
    return {"album_id": album_id, "photos": photos, "photo_count": len(photos)}
