import numpy as np
from sklearn.cluster import DBSCAN
from sklearn.metrics.pairwise import cosine_similarity
from typing import List, Dict, Tuple, Optional
from sqlalchemy.orm import Session
from app.models.database_models import FaceEmbedding, FaceCluster
import uuid
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class FaceClusteringService:
    def __init__(self, db: Session):
        self.db = db
        self.eps = 0.3  # Distance threshold for DBSCAN (cosine similarity)
        self.min_samples = 2  # Minimum samples to form a cluster
        
    def _convert_embedding_to_array(self, embedding) -> np.ndarray:
        """Convert embedding to numpy array."""
        if hasattr(embedding, 'tolist'):
            return np.array(embedding.tolist())
        elif isinstance(embedding, list):
            return np.array(embedding)
        elif isinstance(embedding, np.ndarray):
            return embedding
        else:
            # Handle pgvector Vector type
            return np.array(embedding)
    
    def _normalize_embeddings(self, embeddings: List[np.ndarray]) -> np.ndarray:
        """Normalize embeddings for cosine similarity."""
        embeddings_array = np.array(embeddings)
        # L2 normalization for cosine similarity
        norms = np.linalg.norm(embeddings_array, axis=1, keepdims=True)
        norms[norms == 0] = 1  # Avoid division by zero
        return embeddings_array / norms
    
    def _compute_similarity_matrix(self, embeddings: List[np.ndarray]) -> np.ndarray:
        """Compute cosine similarity matrix between all embeddings."""
        normalized_embeddings = self._normalize_embeddings(embeddings)
        similarity_matrix = cosine_similarity(normalized_embeddings)
        return similarity_matrix
    
    def _compute_distance_matrix(self, similarity_matrix: np.ndarray) -> np.ndarray:
        """Convert similarity matrix to distance matrix for DBSCAN."""
        # Convert similarity to distance: distance = 1 - similarity
        distance_matrix = 1 - similarity_matrix
        # Ensure diagonal is 0
        np.fill_diagonal(distance_matrix, 0)
        return distance_matrix
    
    def cluster_faces(self, user_id: str, eps: float = 0.3, min_samples: int = 2) -> Dict:
        """
        Cluster faces for a user using DBSCAN algorithm.
        
        Args:
            user_id: User ID to cluster faces for
            eps: Distance threshold for DBSCAN (0.3 = 70% similarity)
            min_samples: Minimum samples to form a cluster
            
        Returns:
            Dict with clustering results
        """
        try:
            # Convert string user_id to UUID
            try:
                user_uuid = uuid.UUID(user_id)
            except ValueError:
                user_uuid = uuid.uuid5(uuid.NAMESPACE_DNS, user_id)
            
            # Get all face embeddings for the user
            face_embeddings = self.db.query(FaceEmbedding).filter(
                FaceEmbedding.user_id == user_uuid
            ).all()
            
            if len(face_embeddings) < 2:
                return {
                    "success": False,
                    "message": "Need at least 2 faces to perform clustering",
                    "clusters_created": 0,
                    "total_faces": len(face_embeddings)
                }
            
            # Extract embeddings and face IDs
            embeddings = []
            face_ids = []
            
            for face in face_embeddings:
                embedding_array = self._convert_embedding_to_array(face.embedding)
                embeddings.append(embedding_array)
                face_ids.append(face.id)
            
            # Compute similarity matrix
            similarity_matrix = self._compute_similarity_matrix(embeddings)
            distance_matrix = self._compute_distance_matrix(similarity_matrix)
            
            # Apply DBSCAN clustering
            clustering = DBSCAN(
                eps=eps,
                min_samples=min_samples,
                metric='precomputed'
            )
            
            cluster_labels = clustering.fit_predict(distance_matrix)
            
            # Process clustering results
            unique_labels = set(cluster_labels)
            clusters_created = 0
            
            # Delete existing clusters for this user
            self.db.query(FaceCluster).filter(
                FaceCluster.user_id == user_uuid
            ).delete()
            
            # Create new clusters
            for label in unique_labels:
                if label == -1:  # Noise points (faces that don't belong to any cluster)
                    continue
                
                # Get faces in this cluster
                cluster_face_ids = [
                    face_ids[i] for i in range(len(face_ids)) 
                    if cluster_labels[i] == label
                ]
                
                if len(cluster_face_ids) < min_samples:
                    continue
                
                # Create cluster
                cluster = FaceCluster(
                    id=uuid.uuid4(),
                    user_id=user_uuid,
                    face_ids=cluster_face_ids,
                    label=f"Person {label + 1}",
                    created_at=datetime.utcnow()
                )
                
                self.db.add(cluster)
                clusters_created += 1
            
            self.db.commit()
            
            # Calculate clustering statistics
            total_faces = len(face_embeddings)
            clustered_faces = sum(1 for label in cluster_labels if label != -1)
            noise_faces = total_faces - clustered_faces
            
            # Get cluster details
            clusters = self.db.query(FaceCluster).filter(
                FaceCluster.user_id == user_uuid
            ).all()
            
            cluster_details = []
            for cluster in clusters:
                cluster_details.append({
                    "cluster_id": str(cluster.id),
                    "label": cluster.label,
                    "face_count": len(cluster.face_ids),
                    "face_ids": [str(face_id) for face_id in cluster.face_ids]
                })
            
            return {
                "success": True,
                "message": f"Successfully created {clusters_created} clusters",
                "clusters_created": clusters_created,
                "total_faces": total_faces,
                "clustered_faces": clustered_faces,
                "noise_faces": noise_faces,
                "clusters": cluster_details,
                "eps": eps,
                "min_samples": min_samples
            }
            
        except Exception as e:
            logger.error(f"Error in face clustering: {str(e)}")
            self.db.rollback()
            return {
                "success": False,
                "message": f"Clustering failed: {str(e)}",
                "clusters_created": 0
            }
    
    def find_optimal_parameters(self, user_id: str) -> Dict:
        """
        Find optimal DBSCAN parameters for a user's face dataset.
        
        Args:
            user_id: User ID to analyze
            
        Returns:
            Dict with optimal parameters
        """
        try:
            # Convert string user_id to UUID
            try:
                user_uuid = uuid.UUID(user_id)
            except ValueError:
                user_uuid = uuid.uuid5(uuid.NAMESPACE_DNS, user_id)
            
            # Get all face embeddings for the user
            face_embeddings = self.db.query(FaceEmbedding).filter(
                FaceEmbedding.user_id == user_uuid
            ).all()
            
            if len(face_embeddings) < 3:
                return {
                    "success": False,
                    "message": "Need at least 3 faces to find optimal parameters"
                }
            
            # Extract embeddings
            embeddings = []
            for face in face_embeddings:
                embedding_array = self._convert_embedding_to_array(face.embedding)
                embeddings.append(embedding_array)
            
            # Compute similarity matrix
            similarity_matrix = self._compute_similarity_matrix(embeddings)
            
            # Analyze similarity distribution
            similarities = []
            for i in range(len(similarity_matrix)):
                for j in range(i + 1, len(similarity_matrix)):
                    similarities.append(similarity_matrix[i][j])
            
            similarities = np.array(similarities)
            
            # Find optimal eps based on similarity distribution
            # Use 95th percentile of similarities as eps threshold
            optimal_eps = 1 - np.percentile(similarities, 95)
            
            # Ensure eps is within reasonable bounds
            optimal_eps = max(0.1, min(0.5, optimal_eps))
            
            # Calculate optimal min_samples
            optimal_min_samples = max(2, min(5, len(embeddings) // 4))
            
            return {
                "success": True,
                "optimal_eps": float(optimal_eps),
                "optimal_min_samples": optimal_min_samples,
                "similarity_stats": {
                    "mean": float(np.mean(similarities)),
                    "median": float(np.median(similarities)),
                    "std": float(np.std(similarities)),
                    "min": float(np.min(similarities)),
                    "max": float(np.max(similarities)),
                    "percentile_95": float(np.percentile(similarities, 95))
                },
                "total_faces": len(face_embeddings)
            }
            
        except Exception as e:
            logger.error(f"Error finding optimal parameters: {str(e)}")
            return {
                "success": False,
                "message": f"Parameter optimization failed: {str(e)}"
            }
    
    def validate_clustering(self, user_id: str, cluster_id: str) -> Dict:
        """
        Validate the quality of a specific cluster.
        
        Args:
            user_id: User ID
            cluster_id: Cluster ID to validate
            
        Returns:
            Dict with validation results
        """
        try:
            # Convert string user_id to UUID
            try:
                user_uuid = uuid.UUID(user_id)
            except ValueError:
                user_uuid = uuid.uuid5(uuid.NAMESPACE_DNS, user_id)
            
            cluster_uuid = uuid.UUID(cluster_id)
            
            # Get cluster
            cluster = self.db.query(FaceCluster).filter(
                FaceCluster.id == cluster_uuid,
                FaceCluster.user_id == user_uuid
            ).first()
            
            if not cluster:
                return {
                    "success": False,
                    "message": "Cluster not found"
                }
            
            # Get face embeddings for this cluster
            face_embeddings = self.db.query(FaceEmbedding).filter(
                FaceEmbedding.id.in_(cluster.face_ids)
            ).all()
            
            if len(face_embeddings) < 2:
                return {
                    "success": False,
                    "message": "Cluster has less than 2 faces"
                }
            
            # Extract embeddings
            embeddings = []
            for face in face_embeddings:
                embedding_array = self._convert_embedding_to_array(face.embedding)
                embeddings.append(embedding_array)
            
            # Compute similarity matrix
            similarity_matrix = self._compute_similarity_matrix(embeddings)
            
            # Calculate cluster quality metrics
            similarities = []
            for i in range(len(similarity_matrix)):
                for j in range(i + 1, len(similarity_matrix)):
                    similarities.append(similarity_matrix[i][j])
            
            similarities = np.array(similarities)
            
            # Quality metrics
            mean_similarity = np.mean(similarities)
            min_similarity = np.min(similarities)
            max_similarity = np.max(similarities)
            std_similarity = np.std(similarities)
            
            # Determine quality score (0-100)
            quality_score = min(100, max(0, mean_similarity * 100))
            
            # Quality assessment
            if quality_score >= 90:
                quality_assessment = "Excellent"
            elif quality_score >= 80:
                quality_assessment = "Good"
            elif quality_score >= 70:
                quality_assessment = "Fair"
            else:
                quality_assessment = "Poor"
            
            return {
                "success": True,
                "cluster_id": cluster_id,
                "face_count": len(face_embeddings),
                "quality_score": float(quality_score),
                "quality_assessment": quality_assessment,
                "mean_similarity": float(mean_similarity),
                "min_similarity": float(min_similarity),
                "max_similarity": float(max_similarity),
                "std_similarity": float(std_similarity),
                "face_ids": [str(face.id) for face in face_embeddings]
            }
            
        except Exception as e:
            logger.error(f"Error validating cluster: {str(e)}")
            return {
                "success": False,
                "message": f"Validation failed: {str(e)}"
            } 