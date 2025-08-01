import uuid
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.database_models import Photo, User
from typing import List, Optional

class PhotoService:
    def __init__(self, db: Session):
        self.db = db

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
        # Convert string user_id to UUID if it's not already a UUID
        try:
            user_uuid = uuid.UUID(user_id)
        except ValueError:
            # If not a valid UUID, create a UUID from the string hash
            user_uuid = uuid.uuid5(uuid.NAMESPACE_DNS, user_id)
        
        photo = Photo(
            id=uuid.uuid4(),
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
        return photo

    def get_photo_by_id(self, photo_id: str) -> Optional[Photo]:
        """Get a photo by its ID."""
        return self.db.query(Photo).filter(Photo.id == uuid.UUID(photo_id)).first()

    def get_photos_by_user(self, user_id: str, limit: int = 50) -> List[Photo]:
        """Get all photos for a specific user."""
        # Convert string user_id to UUID if it's not already a UUID
        try:
            user_uuid = uuid.UUID(user_id)
        except ValueError:
            # If not a valid UUID, create a UUID from the string hash
            user_uuid = uuid.uuid5(uuid.NAMESPACE_DNS, user_id)
        
        return self.db.query(Photo).filter(Photo.user_id == user_uuid).limit(limit).all()

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