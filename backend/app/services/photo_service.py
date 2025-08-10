import uuid
from datetime import datetime
from sqlalchemy.orm import Session, load_only
from app.models.database_models import Photo, User, Album, FaceEmbedding
from app.services import s3_service
from app.services.album_service import AlbumService
from app.utils.logger import get_logger, log_db_operation
from typing import List, Optional
from sqlalchemy import text

class PhotoService:
    def __init__(self, db: Session):
        self.db = db
        self.logger = get_logger("imagenerve.services.photo")

    def create_photo(
        self,
        user_id: str,
        s3_url: str,
        filename: str,
        tags: Optional[List[str]] = None,
        description: Optional[str] = None,
        is_public: bool = False,
        photo_metadata: Optional[dict] = None
    ) -> Photo:
        """Create a new photo record in the database."""
        self.logger.info(f"🗄️ Creating photo record | User: {user_id} | File: {filename}")
        
        try:
            # Convert string user_id to UUID if it's not already a UUID
            try:
                user_uuid = uuid.UUID(user_id)
                self.logger.debug(f"✅ Valid UUID provided: {user_uuid}")
            except ValueError:
                # If not a valid UUID, create a UUID from the string hash
                user_uuid = uuid.uuid5(uuid.NAMESPACE_DNS, user_id)
                self.logger.debug(f"🔄 Generated UUID from string: {user_id} -> {user_uuid}")
            
            # Ensure test user exists (for development)
            if user_id == 'test-user-001':
                self.logger.debug("👤 Ensuring test user exists")
                self._ensure_test_user_exists(user_uuid)
            
            photo_id = uuid.uuid4()
            self.logger.debug(f"🆔 Generated photo ID: {photo_id}")
            
            photo = Photo(
                id=photo_id,
                user_id=user_uuid,
                s3_url=s3_url,
                filename=filename,
                tags=tags or [],
                uploaded_at=datetime.utcnow(),
                description=description,
                is_public=is_public,
                photo_metadata=photo_metadata or {}
            )
            
            # Add performance logging
            start_time = datetime.utcnow()
            self.logger.debug(f"📝 Adding photo to database session...")
            self.db.add(photo)
            
            self.logger.debug(f"💾 Committing transaction...")
            self.db.commit()
            commit_time = datetime.utcnow()
            commit_duration = (commit_time - start_time).total_seconds()
            self.logger.debug(f"✅ Transaction committed in {commit_duration:.2f}s")
            
            self.logger.debug(f"🔄 Refreshing photo object...")
            self.db.refresh(photo)
            refresh_time = datetime.utcnow()
            refresh_duration = (refresh_time - commit_time).total_seconds()
            self.logger.debug(f"✅ Photo refreshed in {refresh_duration:.2f}s")
            
            log_db_operation("insert", "photos", str(photo_id), True, f"User: {user_id} | File: {filename}")
            self.logger.info(f"✅ Photo record created successfully | Photo ID: {photo_id} | User: {user_id}")
            
            # Ensure photo is part of a default album
            try:
                album_service = AlbumService(self.db)
                default_album = album_service.get_or_create_default_album(user_id)
                photo_ids = set(default_album.photo_ids or [])
                photo_ids.add(photo.id)
                default_album.photo_ids = list(photo_ids)
                self.db.commit()
                self.logger.info(f"📚 Photo {photo_id} added to default album '{default_album.name}'")
            except Exception as e:
                self.logger.warning(f"⚠️ Failed to add photo {photo_id} to default album: {str(e)}")

            return photo
            
        except Exception as e:
            self.logger.error(f"❌ Failed to create photo record | User: {user_id} | File: {filename} | Error: {str(e)}")
            log_db_operation("insert", "photos", "", False, f"User: {user_id} | File: {filename} | Error: {str(e)}")
            self.db.rollback()
            raise

    def get_photo_by_id(self, photo_id: str) -> Optional[Photo]:
        """Get a photo by its ID."""
        return self.db.query(Photo).filter(Photo.id == uuid.UUID(photo_id)).first()

    def get_photos_by_user(self, user_id: str, limit: int = 50, before: Optional[datetime] = None) -> List[Photo]:
        """Get photos for a user ordered by newest first. If 'before' is provided,
        return photos strictly older than that timestamp (cursor pagination)."""
        self.logger.info(f"📋 Fetching photos for user | User: {user_id} | Limit: {limit}")
        
        try:
            # Convert string user_id to UUID if it's not already a UUID
            try:
                user_uuid = uuid.UUID(user_id)
                self.logger.debug(f"✅ Valid UUID provided: {user_uuid}")
            except ValueError:
                # If not a valid UUID, create a UUID from the string hash
                user_uuid = uuid.uuid5(uuid.NAMESPACE_DNS, user_id)
                self.logger.debug(f"🔄 Generated UUID from string: {user_id} -> {user_uuid}")
            
            # Order by newest first so recently uploaded photos appear immediately
            # Use a more efficient query with selected columns
            q = (
                self.db.query(Photo)
                .filter(Photo.user_id == user_uuid)
            )
            if before is not None:
                q = q.filter(Photo.uploaded_at < before)
            photos = (
                q.order_by(Photo.uploaded_at.desc())
                 .options(load_only(Photo.id, Photo.filename, Photo.s3_url, Photo.uploaded_at))
                 .limit(limit)
                 .all()
            )
            
            log_db_operation("select", "photos", f"user_{user_id}", True, f"Found {len(photos)} photos")
            self.logger.info(f"✅ Successfully fetched {len(photos)} photos for user {user_id}")
            
            if photos:
                newest_photo = photos[0]
                oldest_photo = photos[-1]
                self.logger.debug(f"📅 Photo range: {oldest_photo.uploaded_at} to {newest_photo.uploaded_at}")
            
            return photos
            
        except Exception as e:
            self.logger.error(f"❌ Failed to fetch photos | User: {user_id} | Error: {str(e)}")
            log_db_operation("select", "photos", f"user_{user_id}", False, f"Error: {str(e)}")
            raise

    def get_public_photos(self, limit: int = 50) -> List[Photo]:
        """Get all public photos."""
        return self.db.query(Photo).filter(Photo.is_public == True).limit(limit).all()

    def update_photo(
        self,
        photo_id: str,
        description: Optional[str] = None,
        tags: Optional[List[str]] = None,
        is_public: Optional[bool] = None,
        photo_metadata: Optional[dict] = None
    ) -> Optional[Photo]:
        """Update a photo's metadata."""
        photo = self.get_photo_by_id(photo_id)
        if not photo:
            return None
        
        if description is not None:
            photo.description = description
        if tags is not None:
            photo.tags = tags
        if is_public is not None:
            photo.is_public = is_public
        if photo_metadata is not None:
            photo.photo_metadata = photo_metadata
        
        self.db.commit()
        self.db.refresh(photo)
        return photo

    def delete_photo(self, photo_id: str) -> bool:
        """Delete a photo everywhere: DB, S3, remove references in albums and face embeddings."""
        try:
            photo = self.get_photo_by_id(photo_id)
            if not photo:
                return False

            # Attempt to delete from S3 using the filename as the key
            s3_key = None
            if photo.filename:
                s3_key = photo.filename
            elif photo.s3_url:
                # Fallback: derive key from URL path
                try:
                    from urllib.parse import urlparse
                    path = urlparse(photo.s3_url).path
                    s3_key = path.lstrip('/')
                except Exception:
                    s3_key = None

            if s3_key:
                try:
                    self.logger.info(f"🧹 Deleting S3 object | Key: {s3_key}")
                    s3_service.delete_file(s3_key)
                    self.logger.info("✅ S3 object deleted")
                except Exception as e:
                    # Log but continue with DB cleanup
                    self.logger.warning(f"⚠️ Failed to delete S3 object '{s3_key}': {str(e)}")

            # Remove from any albums (photo_ids arrays) and fix cover photos
            try:
                albums_with_photo = (
                    self.db.query(Album)
                    .filter(Album.photo_ids != None)
                    .filter(Album.photo_ids.contains([photo.id]))
                    .all()
                )
                for album in albums_with_photo:
                    album.photo_ids = [pid for pid in (album.photo_ids or []) if pid != photo.id]
                    if album.cover_photo_id == photo.id:
                        album.cover_photo_id = None
                # Also update albums where cover only matches
                albums_with_cover = self.db.query(Album).filter(Album.cover_photo_id == photo.id).all()
                for album in albums_with_cover:
                    album.cover_photo_id = None
            except Exception as e:
                self.logger.warning(f"⚠️ Failed updating album references for photo {photo_id}: {str(e)}")

            # Delete face embeddings referencing this photo
            try:
                self.db.query(FaceEmbedding).filter(FaceEmbedding.photo_id == photo.id).delete(synchronize_session=False)
            except Exception as e:
                self.logger.warning(f"⚠️ Failed deleting face embeddings for photo {photo_id}: {str(e)}")

            # Finally delete the photo record
            self.db.delete(photo)
            self.db.commit()
            self.logger.info(f"🗑️ Deleted photo {photo_id} from DB, removed album refs and face embeddings")
            return True
        except Exception as e:
            self.db.rollback()
            self.logger.error(f"❌ Failed to delete photo {photo_id}: {str(e)}")
            return False
    
    def _ensure_test_user_exists(self, user_uuid: uuid.UUID):
        """Ensure test user exists in database for development."""
        existing_user = self.db.query(User).filter(User.id == user_uuid).first()
        if not existing_user:
            test_user = User(
                id=user_uuid,
                name="Test User",
                email="test@example.com",
                role="user",
                created_at=datetime.utcnow(),
                settings={}
            )
            self.db.add(test_user)
            self.db.commit() 