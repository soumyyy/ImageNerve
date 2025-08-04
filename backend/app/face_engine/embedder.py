from app.services.face_detection_service import FaceDetectionService
import numpy as np

class FaceEmbedder:
    def __init__(self):
        self.service = FaceDetectionService()
    
    def extract_embedding(self, image: np.ndarray) -> np.ndarray:
        """Extract face embedding from an image."""
        result = self.service.detect_faces(image)
        if result["faces_detected"] and result["faces"]:
            # Return the first face's embedding
            return np.array(result["faces"][0]["embedding"])
        return None
    
    def compute_similarity(self, embedding1: np.ndarray, embedding2: np.ndarray) -> float:
        """Compute similarity between two face embeddings."""
        return self.service.compute_similarity(embedding1, embedding2)
    
    def extract_multiple_embeddings(self, image: np.ndarray) -> list:
        """Extract embeddings for all faces in an image."""
        result = self.service.detect_faces(image)
        if result["faces_detected"]:
            return [np.array(face["embedding"]) for face in result["faces"]]
        return [] 