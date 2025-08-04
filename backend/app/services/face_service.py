import uuid
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.database_models import FaceEmbedding, FaceCluster, Photo
from app.services.face_detection_service import FaceDetectionService
from typing import List, Optional, Dict, Any
import numpy as np

class FaceService:
    def __init__(self, db: Session):
        self.db = db
        self.face_detector = FaceDetectionService()

    def store_face_embeddings(self, photo_id: str, user_id: str, face_data: List[Dict[str, Any]]) -> List[FaceEmbedding]:
        """Store face embeddings detected in a photo."""
        face_embeddings = []
        
        # Convert string user_id to UUID if it's not already a UUID
        try:
            user_uuid = uuid.UUID(user_id)
        except ValueError:
            # If not a valid UUID, create a UUID from the string hash
            user_uuid = uuid.uuid5(uuid.NAMESPACE_DNS, user_id)
        
        for face in face_data:
            # Convert embedding to list of floats
            embedding_list = face.get("embedding", [])
            if isinstance(embedding_list, np.ndarray):
                embedding_list = embedding_list.tolist()
            
            embedding = FaceEmbedding(
                id=uuid.uuid4(),
                photo_id=uuid.UUID(photo_id),
                user_id=user_uuid,
                embedding=embedding_list,
                bbox=face.get("bounding_box", {}),
                confidence=face.get("confidence", 0.0),
                created_at=datetime.utcnow()
            )
            self.db.add(embedding)
            face_embeddings.append(embedding)
        
        self.db.commit()
        return face_embeddings

    def get_faces_by_photo(self, photo_id: str) -> List[FaceEmbedding]:
        """Get all face embeddings for a specific photo."""
        return self.db.query(FaceEmbedding).filter(FaceEmbedding.photo_id == uuid.UUID(photo_id)).all()

    def get_faces_by_user(self, user_id: str, limit: int = 100) -> List[FaceEmbedding]:
        """Get all face embeddings for a specific user."""
        # Convert string user_id to UUID if it's not already a UUID
        try:
            user_uuid = uuid.UUID(user_id)
        except ValueError:
            # If not a valid UUID, create a UUID from the string hash
            user_uuid = uuid.uuid5(uuid.NAMESPACE_DNS, user_id)
        
        return self.db.query(FaceEmbedding).filter(FaceEmbedding.user_id == user_uuid).limit(limit).all()

    def get_face_by_id(self, face_id: str) -> Optional[FaceEmbedding]:
        """Get a specific face embedding by ID."""
        return self.db.query(FaceEmbedding).filter(FaceEmbedding.id == uuid.UUID(face_id)).first()

    def delete_face_embedding(self, face_id: str) -> bool:
        """Delete a face embedding from the database."""
        face = self.get_face_by_id(face_id)
        if not face:
            return False
        
        self.db.delete(face)
        self.db.commit()
        return True

    def find_similar_faces(self, embedding: List[float], user_id: str, threshold: float = 0.45, limit: int = 10) -> List[Dict[str, Any]]:
        """Find faces similar to the given embedding."""
        user_faces = self.get_faces_by_user(user_id)
        similar_faces = []
        
        for face in user_faces:
            similarity = self.face_detector.compute_similarity(
                np.array(embedding), 
                np.array(face.embedding)
            )
            
            if similarity >= threshold:
                similar_faces.append({
                    "face_id": str(face.id),
                    "photo_id": str(face.photo_id),
                    "similarity": similarity,
                    "confidence": face.confidence,
                    "bbox": face.bbox
                })
        
        # Sort by similarity (highest first) and limit results
        similar_faces.sort(key=lambda x: x["similarity"], reverse=True)
        return similar_faces[:limit]

    def create_face_cluster(self, user_id: str, face_ids: List[str], label: Optional[str] = None) -> FaceCluster:
        """Create a new face cluster."""
        cluster = FaceCluster(
            id=uuid.uuid4(),
            user_id=uuid.UUID(user_id),
            face_ids=[uuid.UUID(face_id) for face_id in face_ids],
            label=label or f"Cluster {datetime.utcnow().strftime('%Y%m%d_%H%M%S')}",
            created_at=datetime.utcnow()
        )
        self.db.add(cluster)
        self.db.commit()
        self.db.refresh(cluster)
        return cluster

    def get_clusters_by_user(self, user_id: str) -> List[FaceCluster]:
        """Get all face clusters for a user."""
        return self.db.query(FaceCluster).filter(FaceCluster.user_id == uuid.UUID(user_id)).all()

    def get_cluster_by_id(self, cluster_id: str) -> Optional[FaceCluster]:
        """Get a specific face cluster by ID."""
        return self.db.query(FaceCluster).filter(FaceCluster.id == uuid.UUID(cluster_id)).first()

    def update_cluster_label(self, cluster_id: str, label: str) -> Optional[FaceCluster]:
        """Update the label of a face cluster."""
        cluster = self.get_cluster_by_id(cluster_id)
        if not cluster:
            return None
        
        cluster.label = label
        self.db.commit()
        self.db.refresh(cluster)
        return cluster

    def delete_cluster(self, cluster_id: str) -> bool:
        """Delete a face cluster."""
        cluster = self.get_cluster_by_id(cluster_id)
        if not cluster:
            return False
        
        self.db.delete(cluster)
        self.db.commit()
        return True

    def detect_and_store_faces(self, photo_id: str, user_id: str, image_data: bytes) -> Dict[str, Any]:
        """Detect faces in an image and store them in the database."""
        try:
            # Convert bytes to numpy array for face detection
            import cv2
            nparr = np.frombuffer(image_data, np.uint8)
            image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            if image is None:
                return {"error": "Invalid image data", "faces_stored": 0}
            
            # Detect faces
            detection_result = self.face_detector.detect_faces(image)
            
            if not detection_result["faces_detected"]:
                return {
                    "faces_detected": False,
                    "faces_stored": 0,
                    "message": "No faces detected in image"
                }
            
            # Store face embeddings in database
            stored_faces = self.store_face_embeddings(photo_id, user_id, detection_result["faces"])
            
            return {
                "faces_detected": True,
                "faces_stored": len(stored_faces),
                "face_count": detection_result["face_count"],
                "stored_face_ids": [str(face.id) for face in stored_faces],
                "detection_result": detection_result
            }
            
        except Exception as e:
            return {"error": str(e), "faces_stored": 0} 