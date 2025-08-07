from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from app.models.database_models import AlbumShare, Album, User
from app.database import get_db
import uuid
from datetime import datetime


class AlbumShareService:
    
    @staticmethod
    def share_album(
        db: Session,
        album_id: str,
        shared_by_user_id: str,
        shared_with_email: str,
        permissions: str = "view"
    ) -> AlbumShare:
        """Share an album with another user via email"""
        
        # Convert string IDs to UUIDs
        album_uuid = uuid.UUID(album_id)
        shared_by_uuid = uuid.UUID(shared_by_user_id)
        
        # Check if album exists and user owns it
        album = db.query(Album).filter(Album.id == album_uuid).first()
        if not album:
            raise ValueError("Album not found")
        
        if album.user_id != shared_by_uuid:
            raise ValueError("You can only share albums you own")
        
        # Check if already shared with this email
        existing_share = db.query(AlbumShare).filter(
            and_(
                AlbumShare.album_id == album_uuid,
                AlbumShare.shared_with_email == shared_with_email
            )
        ).first()
        
        if existing_share:
            raise ValueError("Album already shared with this email")
        
        # Create new share
        share = AlbumShare(
            album_id=album_uuid,
            shared_by=shared_by_uuid,
            shared_with_email=shared_with_email,
            permissions=permissions
        )
        
        db.add(share)
        db.commit()
        db.refresh(share)
        
        return share
    
    @staticmethod
    def get_shared_albums_for_user(
        db: Session,
        user_email: str,
        user_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get all albums shared with a user (by email or user_id)"""
        
        query = db.query(AlbumShare).join(Album)
        
        if user_id:
            user_uuid = uuid.UUID(user_id)
            query = query.filter(
                and_(
                    AlbumShare.shared_with_user_id == user_uuid,
                    AlbumShare.accepted_at.isnot(None)
                )
            )
        else:
            query = query.filter(
                and_(
                    AlbumShare.shared_with_email == user_email,
                    AlbumShare.accepted_at.isnot(None)
                )
            )
        
        shares = query.all()
        
        result = []
        for share in shares:
            result.append({
                "share_id": str(share.id),
                "album_id": str(share.album_id),
                "album_name": share.album.name,
                "album_description": share.album.description,
                "shared_by": str(share.shared_by),
                "shared_by_name": share.shared_by_user.name if share.shared_by_user else "Unknown",
                "permissions": share.permissions,
                "shared_at": share.created_at.isoformat() if share.created_at else None,
                "accepted_at": share.accepted_at.isoformat() if share.accepted_at else None,
                "photo_count": len(share.album.photo_ids) if share.album.photo_ids else 0,
                "cover_photo_url": share.album.cover_photo.s3_url if share.album.cover_photo else None
            })
        
        return result
    
    @staticmethod
    def get_pending_shares_for_user(
        db: Session,
        user_email: str
    ) -> List[Dict[str, Any]]:
        """Get pending album share invitations for a user"""
        
        shares = db.query(AlbumShare).join(Album).filter(
            and_(
                AlbumShare.shared_with_email == user_email,
                AlbumShare.accepted_at.is_(None)
            )
        ).all()
        
        result = []
        for share in shares:
            result.append({
                "share_id": str(share.id),
                "album_id": str(share.album_id),
                "album_name": share.album.name,
                "album_description": share.album.description,
                "shared_by": str(share.shared_by),
                "shared_by_name": share.shared_by_user.name if share.shared_by_user else "Unknown",
                "permissions": share.permissions,
                "shared_at": share.created_at.isoformat() if share.created_at else None,
                "photo_count": len(share.album.photo_ids) if share.album.photo_ids else 0
            })
        
        return result
    
    @staticmethod
    def accept_share(
        db: Session,
        share_id: str,
        user_id: str
    ) -> AlbumShare:
        """Accept a shared album invitation"""
        
        share_uuid = uuid.UUID(share_id)
        user_uuid = uuid.UUID(user_id)
        
        share = db.query(AlbumShare).filter(AlbumShare.id == share_uuid).first()
        if not share:
            raise ValueError("Share invitation not found")
        
        if share.accepted_at:
            raise ValueError("Share invitation already accepted")
        
        # Update share with user_id and accepted timestamp
        share.shared_with_user_id = user_uuid
        share.accepted_at = datetime.utcnow()
        
        db.commit()
        db.refresh(share)
        
        return share
    
    @staticmethod
    def decline_share(
        db: Session,
        share_id: str
    ) -> bool:
        """Decline a shared album invitation"""
        
        share_uuid = uuid.UUID(share_id)
        
        share = db.query(AlbumShare).filter(AlbumShare.id == share_uuid).first()
        if not share:
            raise ValueError("Share invitation not found")
        
        db.delete(share)
        db.commit()
        
        return True
    
    @staticmethod
    def update_share_permissions(
        db: Session,
        share_id: str,
        permissions: str,
        updated_by_user_id: str
    ) -> AlbumShare:
        """Update permissions for a shared album"""
        
        share_uuid = uuid.UUID(share_id)
        updated_by_uuid = uuid.UUID(updated_by_user_id)
        
        share = db.query(AlbumShare).filter(AlbumShare.id == share_uuid).first()
        if not share:
            raise ValueError("Share not found")
        
        # Check if user has permission to update (album owner or admin)
        if share.album.user_id != updated_by_uuid and share.permissions != "admin":
            raise ValueError("You don't have permission to update this share")
        
        if permissions not in ["view", "edit", "admin"]:
            raise ValueError("Invalid permissions")
        
        share.permissions = permissions
        db.commit()
        db.refresh(share)
        
        return share
    
    @staticmethod
    def remove_share(
        db: Session,
        share_id: str,
        removed_by_user_id: str
    ) -> bool:
        """Remove a shared album access"""
        
        share_uuid = uuid.UUID(share_id)
        removed_by_uuid = uuid.UUID(removed_by_user_id)
        
        share = db.query(AlbumShare).filter(AlbumShare.id == share_uuid).first()
        if not share:
            raise ValueError("Share not found")
        
        # Check if user has permission to remove (album owner or admin)
        if share.album.user_id != removed_by_uuid and share.permissions != "admin":
            raise ValueError("You don't have permission to remove this share")
        
        db.delete(share)
        db.commit()
        
        return True
    
    @staticmethod
    def get_album_shares(
        db: Session,
        album_id: str,
        user_id: str
    ) -> List[Dict[str, Any]]:
        """Get all shares for an album (album owner only)"""
        
        album_uuid = uuid.UUID(album_id)
        user_uuid = uuid.UUID(user_id)
        
        # Check if user owns the album
        album = db.query(Album).filter(Album.id == album_uuid).first()
        if not album or album.user_id != user_uuid:
            raise ValueError("You can only view shares for albums you own")
        
        shares = db.query(AlbumShare).filter(AlbumShare.album_id == album_uuid).all()
        
        result = []
        for share in shares:
            result.append({
                "share_id": str(share.id),
                "shared_with_email": share.shared_with_email,
                "shared_with_user_id": str(share.shared_with_user_id) if share.shared_with_user_id else None,
                "shared_with_name": share.shared_with_user.name if share.shared_with_user else None,
                "permissions": share.permissions,
                "shared_at": share.created_at.isoformat() if share.created_at else None,
                "accepted_at": share.accepted_at.isoformat() if share.accepted_at else None,
                "status": "accepted" if share.accepted_at else "pending"
            })
        
        return result 