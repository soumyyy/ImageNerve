import uuid
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.database_models import Photo, User
from app.utils.logger import get_logger, log_db_operation
from typing import List, Optional

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
            
            self.db.add(photo)
            self.db.commit()
            self.db.refresh(photo)
            
            log_db_operation("insert", "photos", str(photo_id), True, f"User: {user_id} | File: {filename}")
            self.logger.info(f"✅ Photo record created successfully | Photo ID: {photo_id} | User: {user_id}")
            
            return photo
            
        except Exception as e:
            self.logger.error(f"❌ Failed to create photo record | User: {user_id} | File: {filename} | Error: {str(e)}")
            log_db_operation("insert", "photos", "", False, f"User: {user_id} | File: {filename} | Error: {str(e)}")
            self.db.rollback()
            raise

    def get_photo_by_id(self, photo_id: str) -> Optional[Photo]:
        """Get a photo by its ID."""
        return self.db.query(Photo).filter(Photo.id == uuid.UUID(photo_id)).first()

    def get_photos_by_user(self, user_id: str, limit: int = 50) -> List[Photo]:
        """Get all photos for a specific user."""
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
            photos = (
                self.db.query(Photo)
                .filter(Photo.user_id == user_uuid)
                .order_by(Photo.uploaded_at.desc())
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
        """Delete a photo from the database."""
        photo = self.get_photo_by_id(photo_id)
        if not photo:
            return False
        
        self.db.delete(photo)
        self.db.commit()
        return True
    
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