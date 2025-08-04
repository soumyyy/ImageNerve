import uuid
from sqlalchemy import Column, String, TIMESTAMP, ForeignKey, ARRAY, JSON, Text, CheckConstraint, Boolean, Float
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY as PG_ARRAY
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy.types import Float
from geoalchemy2 import Geography
from pgvector.sqlalchemy import Vector

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String)
    email = Column(String)
    role = Column(String, CheckConstraint("role IN ('user', 'photographer')"))
    profile_pic_url = Column(String)
    created_at = Column(TIMESTAMP)
    last_login = Column(TIMESTAMP)
    settings = Column(JSONB, default={})
    photos = relationship("Photo", back_populates="user")

class Photo(Base):
    __tablename__ = "photos"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    s3_url = Column(String, nullable=False)
    filename = Column(String)
    tags = Column(PG_ARRAY(String))
    uploaded_at = Column(TIMESTAMP)
    photo_metadata = Column(JSONB)  # Renamed from 'metadata' to 'photo_metadata'
    description = Column(String)
    is_public = Column(Boolean, default=False)
    location = Column(Geography(geometry_type='POINT', srid=4326))
    user = relationship("User", back_populates="photos")
    face_embeddings = relationship("FaceEmbedding", back_populates="photo")

class FaceEmbedding(Base):
    __tablename__ = "face_embeddings"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    photo_id = Column(UUID(as_uuid=True), ForeignKey("photos.id"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    embedding = Column(Vector(512))  # Use pgvector Vector type for 512-dimensional embeddings
    bbox = Column(JSONB)  # {x: 123, y: 456, w: 100, h: 100}
    created_at = Column(TIMESTAMP)
    confidence = Column(Float)
    photo = relationship("Photo", back_populates="face_embeddings")

class FaceCluster(Base):
    __tablename__ = "face_clusters"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    face_ids = Column(PG_ARRAY(UUID(as_uuid=True)))
    label = Column(String)
    created_at = Column(TIMESTAMP)

class Album(Base):
    __tablename__ = "albums"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    name = Column(String)
    description = Column(String)
    is_public = Column(Boolean, default=False)
    photo_ids = Column(PG_ARRAY(UUID(as_uuid=True)))
    cluster_ids = Column(PG_ARRAY(UUID(as_uuid=True)))
    cover_photo_id = Column(UUID(as_uuid=True), ForeignKey("photos.id"))
    created_at = Column(TIMESTAMP)
    updated_at = Column(TIMESTAMP)

class QRLink(Base):
    __tablename__ = "qr_links"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    resource_id = Column(UUID(as_uuid=True))
    resource_type = Column(String, CheckConstraint("resource_type IN ('photo', 'album', 'cluster')"))
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    expires_at = Column(TIMESTAMP)
    created_at = Column(TIMESTAMP)

class PhotoFeedback(Base):
    __tablename__ = "photo_feedback"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    photo_id = Column(UUID(as_uuid=True), ForeignKey("photos.id"))
    reason = Column(String)
    created_at = Column(TIMESTAMP)