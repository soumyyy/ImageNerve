import uuid
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.database_models import FaceEmbedding, FaceCluster, Photo, User
from app.services.face_detection_service import FaceDetectionService
from typing import List, Optional, Dict, Any
import numpy as np
import cv2

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

    def set_user_profile_face(self, user_id: str, image_data: bytes) -> Dict[str, Any]:
        """Extract a face embedding from an image and store it in the user's settings as profile_face_embedding."""
        import cv2
        # Convert string user_id to UUID if it's not already a UUID
        try:
            user_uuid = uuid.UUID(user_id)
        except ValueError:
            user_uuid = uuid.uuid5(uuid.NAMESPACE_DNS, user_id)

        nparr = np.frombuffer(image_data, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if image is None:
            return {"success": False, "message": "Invalid image data"}

        detection = self.face_detector.detect_faces(image)
        if not detection.get("faces_detected"):
            return {"success": False, "message": "No face detected"}

        first = detection["faces"][0]
        embedding = first.get("embedding")
        if isinstance(embedding, np.ndarray):
            embedding = embedding.tolist()

        # Load user and update settings
        user: User = self.db.query(User).filter(User.id == user_uuid).first()
        if not user:
            # Create if not exists (dev convenience)
            user = User(id=user_uuid, name="User", email="", role="user", created_at=datetime.utcnow(), settings={})
            self.db.add(user)
            self.db.commit()
            self.db.refresh(user)

        settings = user.settings or {}
        settings["profile_face_embedding"] = embedding
        user.settings = settings
        self.db.commit()
        return {"success": True, "message": "Profile face stored", "embedding_dim": len(embedding)}

    def find_photos_matching_profile(self, user_id: str, threshold: float = 0.45, limit: int = 200) -> Dict[str, Any]:
        """Return photos that contain a face similar to the user's stored profile embedding (search across all embeddings)."""
        # Get profile embedding
        try:
            user_uuid = uuid.UUID(user_id)
        except ValueError:
            user_uuid = uuid.uuid5(uuid.NAMESPACE_DNS, user_id)

        user: User = self.db.query(User).filter(User.id == user_uuid).first()
        if not user or not user.settings or not user.settings.get("profile_face_embedding"):
            return {"success": False, "message": "No profile face set", "photos": []}

        profile = np.array(user.settings["profile_face_embedding"])  # type: ignore

        # Search across all embeddings regardless of owner
        all_faces = self.db.query(FaceEmbedding).limit(5000).all()
        matched_photo_ids = set()
        score_by_photo: Dict[str, float] = {}
        for face in all_faces:
            sim = self.face_detector.compute_similarity(profile, np.array(face.embedding))
            if sim >= threshold:
                pid = str(face.photo_id)
                matched_photo_ids.add(pid)
                if pid not in score_by_photo or sim > score_by_photo[pid]:
                    score_by_photo[pid] = sim

        # Fetch photo rows
        if not matched_photo_ids:
            return {"success": True, "photos": []}
        photos = self.db.query(Photo).filter(Photo.id.in_(list(matched_photo_ids))).limit(limit).all()
        # Sort by best similarity desc using recorded scores
        photos.sort(key=lambda p: score_by_photo.get(str(p.id), 0), reverse=True)
        return {
            "success": True,
            "photos": [
                {
                    "id": str(p.id),
                    "user_id": str(p.user_id),
                    "s3_url": p.s3_url,
                    "filename": p.filename,
                    "uploaded_at": p.uploaded_at,
                    "description": p.description,
                    "is_public": p.is_public,
                    "photo_metadata": p.photo_metadata,
                }
                for p in photos
            ],
        }

    # ===== Profile Face - Batch Quality Capture =====
    def _compute_blur_score(self, image) -> float:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        return float(cv2.Laplacian(gray, cv2.CV_64F).var())

    def _compute_brightness(self, image) -> float:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        return float(np.mean(gray))

    def set_user_profile_face_batch(self, user_id: str, images: List[bytes]) -> Dict[str, Any]:
        """Process multiple images, run quality checks, average embeddings, and store.

        Quality gates (defaults; tune as needed):
          - blur variance >= 120
          - brightness between 60 and 200
          - face bbox area >= 20% of image area
        """
        try:
            try:
                user_uuid = uuid.UUID(user_id)
            except ValueError:
                user_uuid = uuid.uuid5(uuid.NAMESPACE_DNS, user_id)

            accepted_embeddings: List[np.ndarray] = []
            diagnostics: List[Dict[str, Any]] = []

            for idx, img_bytes in enumerate(images):
                nparr = np.frombuffer(img_bytes, np.uint8)
                image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                if image is None:
                    diagnostics.append({"index": idx, "accepted": False, "reason": "invalid_image"})
                    continue

                blur = self._compute_blur_score(image)
                bright = self._compute_brightness(image)
                det = self.face_detector.detect_faces(image)
                if not det.get("faces_detected"):
                    diagnostics.append({"index": idx, "accepted": False, "reason": "no_face", "blur": blur, "brightness": bright})
                    continue
                face = det["faces"][0]
                bbox = face.get("bounding_box") or face.get("bbox") or {}
                # bbox may be a list [x1, y1, x2, y2] or a dict
                if isinstance(bbox, list) and len(bbox) >= 4:
                    x1, y1, x2, y2 = bbox[:4]
                    x, y = float(x1), float(y1)
                    w, h = float(x2 - x1), float(y2 - y1)
                else:
                    x = float(bbox.get("x", 0)) if isinstance(bbox, dict) else 0.0
                    y = float(bbox.get("y", 0)) if isinstance(bbox, dict) else 0.0
                    w = float(bbox.get("w", 0)) if isinstance(bbox, dict) else 0.0
                    h = float(bbox.get("h", 0)) if isinstance(bbox, dict) else 0.0
                img_h, img_w = image.shape[:2]
                face_area_ratio = (w * h) / max(1, (img_w * img_h))

                reasons = []
                if blur < 120:
                    reasons.append("blur_low")
                if bright < 60 or bright > 200:
                    reasons.append("illumination")
                if face_area_ratio < 0.20:
                    reasons.append("face_too_small")

                if reasons:
                    diagnostics.append({"index": idx, "accepted": False, "reason": ",".join(reasons), "blur": blur, "brightness": bright, "face_area": face_area_ratio})
                    continue

                emb = face.get("embedding")
                emb_arr = np.array(emb)
                # L2 normalize
                norm = np.linalg.norm(emb_arr)
                if norm > 0:
                    emb_arr = emb_arr / norm
                accepted_embeddings.append(emb_arr)
                diagnostics.append({"index": idx, "accepted": True, "blur": blur, "brightness": bright, "face_area": face_area_ratio})

            if not accepted_embeddings:
                return {"success": False, "message": "No images passed quality gates", "diagnostics": diagnostics}

            # Average embeddings
            mean_embedding = np.mean(np.stack(accepted_embeddings, axis=0), axis=0)
            # Compute intra-variance to suggest threshold
            dists = [float(np.linalg.norm(e - mean_embedding)) for e in accepted_embeddings]
            intra = float(np.mean(dists))
            # Map intra variance to a cosine similarity threshold suggestion
            suggested_threshold = float(max(0.40, min(0.55, 0.45 + (intra - 0.2) * 0.2)))

            # Store on user settings
            user: User = self.db.query(User).filter(User.id == user_uuid).first()
            if not user:
                user = User(id=user_uuid, name="User", email="", role="user", created_at=datetime.utcnow(), settings={})
                self.db.add(user)
                self.db.commit()
                self.db.refresh(user)

            settings = user.settings or {}
            settings["profile_face_embedding"] = mean_embedding.tolist()
            settings["profile_face_threshold"] = suggested_threshold
            user.settings = settings
            self.db.commit()

            return {
                "success": True,
                "accepted": len(accepted_embeddings),
                "rejected": len(images) - len(accepted_embeddings),
                "diagnostics": diagnostics,
                "suggested_threshold": suggested_threshold,
            }
        except Exception as e:
            return {"success": False, "message": str(e)}

    def get_profile_status(self, user_id: str) -> Dict[str, Any]:
        try:
            try:
                user_uuid = uuid.UUID(user_id)
            except ValueError:
                user_uuid = uuid.uuid5(uuid.NAMESPACE_DNS, user_id)
            user: User = self.db.query(User).filter(User.id == user_uuid).first()
            exists = bool(user and user.settings and user.settings.get("profile_face_embedding"))
            thr = (user.settings or {}).get("profile_face_threshold") if user and user.settings else None
            return {"exists": exists, "threshold": thr}
        except Exception as e:
            return {"exists": False, "error": str(e)}

    def delete_profile_face(self, user_id: str) -> Dict[str, Any]:
        try:
            try:
                user_uuid = uuid.UUID(user_id)
            except ValueError:
                user_uuid = uuid.uuid5(uuid.NAMESPACE_DNS, user_id)
            user: User = self.db.query(User).filter(User.id == user_uuid).first()
            if not user or not user.settings:
                return {"success": True}
            settings = user.settings
            settings.pop("profile_face_embedding", None)
            settings.pop("profile_face_threshold", None)
            user.settings = settings
            self.db.commit()
            return {"success": True}
        except Exception as e:
            return {"success": False, "message": str(e)}

    def set_user_profile_from_embeddings(self, user_id: str, embeddings: List[List[float]]) -> Dict[str, Any]:
        """Accept pre-computed embeddings, average and store as profile face embedding."""
        try:
            if not embeddings or not isinstance(embeddings, list):
                return {"success": False, "message": "No embeddings provided"}

            # Normalize and collect
            vecs: List[np.ndarray] = []
            for emb in embeddings:
                arr = np.array(emb, dtype=np.float32)
                if arr.ndim != 1:
                    continue
                n = np.linalg.norm(arr)
                if n > 0:
                    arr = arr / n
                vecs.append(arr)
            if not vecs:
                return {"success": False, "message": "Invalid embeddings"}

            mean_emb = np.mean(np.stack(vecs, axis=0), axis=0)
            # Suggest threshold based on intra-variance
            dists = [float(np.linalg.norm(v - mean_emb)) for v in vecs]
            intra = float(np.mean(dists)) if dists else 0.0
            suggested_threshold = float(max(0.40, min(0.55, 0.45 + (intra - 0.2) * 0.2)))

            try:
                user_uuid = uuid.UUID(user_id)
            except ValueError:
                user_uuid = uuid.uuid5(uuid.NAMESPACE_DNS, user_id)
            user: User = self.db.query(User).filter(User.id == user_uuid).first()
            if not user:
                user = User(id=user_uuid, name="User", email="", role="user", created_at=datetime.utcnow(), settings={})
                self.db.add(user)
                self.db.commit()
                self.db.refresh(user)

            settings = user.settings or {}
            settings["profile_face_embedding"] = mean_emb.tolist()
            settings["profile_face_threshold"] = suggested_threshold
            user.settings = settings
            self.db.commit()

            return {"success": True, "suggested_threshold": suggested_threshold, "accepted": len(vecs)}
        except Exception as e:
            return {"success": False, "message": str(e)}