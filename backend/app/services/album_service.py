import uuid
from datetime import datetime
from typing import List, Dict, Optional
from sqlalchemy.orm import Session
from app.models.database_models import Album, Photo, User
import logging

logger = logging.getLogger(__name__)

class AlbumService:
    def __init__(self, db: Session):
        self.db = db
    
    def _convert_user_id_to_uuid(self, user_id: str) -> uuid.UUID:
        """Convert string user_id to UUID."""
        try:
            return uuid.UUID(user_id)
        except ValueError:
            # If not a valid UUID, create a UUID from the string hash
            return uuid.uuid5(uuid.NAMESPACE_DNS, user_id)
    
    def create_album(self, user_id: str, name: str, description: Optional[str] = None, 
                    is_public: bool = False, cover_photo_id: Optional[str] = None) -> Album:
        """Create a new album."""
        try:
            user_uuid = self._convert_user_id_to_uuid(user_id)
            
            # Validate cover photo if provided
            if cover_photo_id:
                try:
                    cover_photo_uuid = uuid.UUID(cover_photo_id)
                    photo = self.db.query(Photo).filter(
                        Photo.id == cover_photo_uuid,
                        Photo.user_id == user_uuid
                    ).first()
                    if not photo:
                        raise ValueError("Cover photo not found or not owned by user")
                except ValueError:
                    raise ValueError("Invalid cover photo ID")
            
            album = Album(
                id=uuid.uuid4(),
                user_id=user_uuid,
                name=name,
                description=description,
                is_public=is_public,
                photo_ids=[],
                cluster_ids=[],
                cover_photo_id=cover_photo_id,
                created_at=datetime.utcnow()
            )
            
            self.db.add(album)
            self.db.commit()
            self.db.refresh(album)
            
            return album
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error creating album: {str(e)}")
            raise
    
    def get_album_by_id(self, album_id: str, user_id: Optional[str] = None) -> Optional[Album]:
        """Get a specific album by ID."""
        try:
            album_uuid = uuid.UUID(album_id)
            
            query = self.db.query(Album).filter(Album.id == album_uuid)
            
            # If user_id provided, ensure user owns the album or album is public
            if user_id:
                user_uuid = self._convert_user_id_to_uuid(user_id)
                query = query.filter(
                    (Album.user_id == user_uuid) | (Album.is_public == True)
                )
            
            return query.first()
            
        except ValueError:
            return None
    
    def get_albums_by_user(self, user_id: str, include_public: bool = False) -> List[Album]:
        """Get all albums for a user."""
        try:
            user_uuid = self._convert_user_id_to_uuid(user_id)
            
            query = self.db.query(Album).filter(Album.user_id == user_uuid)
            
            if include_public:
                # Also include public albums from other users
                public_albums = self.db.query(Album).filter(
                    Album.is_public == True,
                    Album.user_id != user_uuid
                ).all()
                user_albums = query.all()
                return user_albums + public_albums
            
            return query.all()
            
        except Exception as e:
            logger.error(f"Error getting albums for user: {str(e)}")
            return []
    
    def get_public_albums(self, limit: int = 50) -> List[Album]:
        """Get public albums."""
        try:
            return self.db.query(Album).filter(
                Album.is_public == True
            ).limit(limit).all()
        except Exception as e:
            logger.error(f"Error getting public albums: {str(e)}")
            return []
    
    def update_album(self, album_id: str, user_id: str, **kwargs) -> Optional[Album]:
        """Update an album."""
        try:
            album_uuid = uuid.UUID(album_id)
            user_uuid = self._convert_user_id_to_uuid(user_id)
            
            album = self.db.query(Album).filter(
                Album.id == album_uuid,
                Album.user_id == user_uuid
            ).first()
            
            if not album:
                return None
            
            # Update allowed fields
            allowed_fields = ['name', 'description', 'is_public', 'cover_photo_id']
            for field, value in kwargs.items():
                if field in allowed_fields and value is not None:
                    if field == 'cover_photo_id' and value:
                        # Validate cover photo
                        try:
                            cover_photo_uuid = uuid.UUID(value)
                            photo = self.db.query(Photo).filter(
                                Photo.id == cover_photo_uuid,
                                Photo.user_id == user_uuid
                            ).first()
                            if not photo:
                                raise ValueError("Cover photo not found or not owned by user")
                        except ValueError:
                            raise ValueError("Invalid cover photo ID")
                    
                    setattr(album, field, value)
            
            album.updated_at = datetime.utcnow()
            self.db.commit()
            self.db.refresh(album)
            
            return album
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error updating album: {str(e)}")
            raise
    
    def delete_album(self, album_id: str, user_id: str) -> bool:
        """Delete an album."""
        try:
            album_uuid = uuid.UUID(album_id)
            user_uuid = self._convert_user_id_to_uuid(user_id)
            
            album = self.db.query(Album).filter(
                Album.id == album_uuid,
                Album.user_id == user_uuid
            ).first()
            
            if not album:
                return False
            
            self.db.delete(album)
            self.db.commit()
            
            return True
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error deleting album: {str(e)}")
            return False
    
    def add_photos_to_album(self, album_id: str, user_id: str, photo_ids: List[str]) -> Dict:
        """Add photos to an album."""
        try:
            album_uuid = uuid.UUID(album_id)
            user_uuid = self._convert_user_id_to_uuid(user_id)
            
            # Get album
            album = self.db.query(Album).filter(
                Album.id == album_uuid,
                Album.user_id == user_uuid
            ).first()
            
            if not album:
                return {
                    "success": False,
                    "message": "Album not found or not owned by user"
                }
            
            # Validate photo IDs
            valid_photo_ids = []
            for photo_id in photo_ids:
                try:
                    photo_uuid = uuid.UUID(photo_id)
                    photo = self.db.query(Photo).filter(
                        Photo.id == photo_uuid,
                        Photo.user_id == user_uuid
                    ).first()
                    if photo:
                        valid_photo_ids.append(photo_uuid)
                except ValueError:
                    continue
            
            # Add photos to album
            current_photo_ids = set(album.photo_ids or [])
            new_photo_ids = current_photo_ids.union(valid_photo_ids)
            album.photo_ids = list(new_photo_ids)
            
            album.updated_at = datetime.utcnow()
            self.db.commit()
            
            return {
                "success": True,
                "message": f"Added {len(valid_photo_ids)} photos to album",
                "photos_added": len(valid_photo_ids),
                "total_photos": len(album.photo_ids)
            }
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error adding photos to album: {str(e)}")
            return {
                "success": False,
                "message": f"Failed to add photos: {str(e)}"
            }
    
    def remove_photos_from_album(self, album_id: str, user_id: str, photo_ids: List[str]) -> Dict:
        """Remove photos from an album."""
        try:
            album_uuid = uuid.UUID(album_id)
            user_uuid = self._convert_user_id_to_uuid(user_id)
            
            # Get album
            album = self.db.query(Album).filter(
                Album.id == album_uuid,
                Album.user_id == user_uuid
            ).first()
            
            if not album:
                return {
                    "success": False,
                    "message": "Album not found or not owned by user"
                }
            
            # Convert photo IDs to UUIDs
            photo_uuids_to_remove = set()
            for photo_id in photo_ids:
                try:
                    photo_uuids_to_remove.add(uuid.UUID(photo_id))
                except ValueError:
                    continue
            
            # Remove photos from album
            current_photo_ids = set(album.photo_ids or [])
            remaining_photo_ids = current_photo_ids - photo_uuids_to_remove
            album.photo_ids = list(remaining_photo_ids)
            
            # Update cover photo if it was removed
            if album.cover_photo_id and uuid.UUID(album.cover_photo_id) in photo_uuids_to_remove:
                album.cover_photo_id = None
            
            album.updated_at = datetime.utcnow()
            self.db.commit()
            
            return {
                "success": True,
                "message": f"Removed {len(photo_uuids_to_remove)} photos from album",
                "photos_removed": len(photo_uuids_to_remove),
                "total_photos": len(album.photo_ids)
            }
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error removing photos from album: {str(e)}")
            return {
                "success": False,
                "message": f"Failed to remove photos: {str(e)}"
            }
    
    def get_album_photos(self, album_id: str, user_id: Optional[str] = None) -> List[Dict]:
        """Get all photos in an album."""
        try:
            album = self.get_album_by_id(album_id, user_id)
            if not album:
                return []
            
            if not album.photo_ids:
                return []
            
            # Get photos
            photos = self.db.query(Photo).filter(
                Photo.id.in_(album.photo_ids)
            ).all()
            
            return [
                {
                    "id": str(photo.id),
                    "filename": photo.filename,
                    "s3_url": photo.s3_url,
                    "tags": photo.tags,
                    "description": photo.description,
                    "is_public": photo.is_public,
                    "uploaded_at": photo.uploaded_at,
                    "photo_metadata": photo.photo_metadata
                }
                for photo in photos
            ]
            
        except Exception as e:
            logger.error(f"Error getting album photos: {str(e)}")
            return []
    
    def add_clusters_to_album(self, album_id: str, user_id: str, cluster_ids: List[str]) -> Dict:
        """Add face clusters to an album."""
        try:
            album_uuid = uuid.UUID(album_id)
            user_uuid = self._convert_user_id_to_uuid(user_id)
            
            # Get album
            album = self.db.query(Album).filter(
                Album.id == album_uuid,
                Album.user_id == user_uuid
            ).first()
            
            if not album:
                return {
                    "success": False,
                    "message": "Album not found or not owned by user"
                }
            
            # Validate cluster IDs
            valid_cluster_ids = []
            for cluster_id in cluster_ids:
                try:
                    cluster_uuid = uuid.UUID(cluster_id)
                    # Note: We'll need to import FaceCluster here if we want to validate
                    valid_cluster_ids.append(cluster_uuid)
                except ValueError:
                    continue
            
            # Add clusters to album
            current_cluster_ids = set(album.cluster_ids or [])
            new_cluster_ids = current_cluster_ids.union(valid_cluster_ids)
            album.cluster_ids = list(new_cluster_ids)
            
            album.updated_at = datetime.utcnow()
            self.db.commit()
            
            return {
                "success": True,
                "message": f"Added {len(valid_cluster_ids)} clusters to album",
                "clusters_added": len(valid_cluster_ids),
                "total_clusters": len(album.cluster_ids)
            }
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error adding clusters to album: {str(e)}")
            return {
                "success": False,
                "message": f"Failed to add clusters: {str(e)}"
            }
    
    def get_album_stats(self, album_id: str, user_id: Optional[str] = None) -> Dict:
        """Get album statistics."""
        try:
            album = self.get_album_by_id(album_id, user_id)
            if not album:
                return {
                    "success": False,
                    "message": "Album not found"
                }
            
            # Get photo count
            photo_count = len(album.photo_ids) if album.photo_ids else 0
            
            # Get cluster count
            cluster_count = len(album.cluster_ids) if album.cluster_ids else 0
            
            # Get face count (if we have face embeddings)
            face_count = 0
            if album.photo_ids:
                from app.models.database_models import FaceEmbedding
                face_count = self.db.query(FaceEmbedding).filter(
                    FaceEmbedding.photo_id.in_(album.photo_ids)
                ).count()
            
            return {
                "success": True,
                "album_id": str(album.id),
                "name": album.name,
                "photo_count": photo_count,
                "cluster_count": cluster_count,
                "face_count": face_count,
                "is_public": album.is_public,
                "created_at": album.created_at,
                "updated_at": album.updated_at
            }
            
        except Exception as e:
            logger.error(f"Error getting album stats: {str(e)}")
            return {
                "success": False,
                "message": f"Failed to get album stats: {str(e)}"
            }