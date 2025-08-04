from app.services.face_detection_service import FaceDetectionService
import numpy as np

class FaceDetector:
    def __init__(self):
        self.service = FaceDetectionService()
    
    def detect_faces(self, image: np.ndarray) -> dict:
        """Detect faces in an image using InsightFace."""
        return self.service.detect_faces(image)
    
    def calculate_smile_intensity(self, landmarks) -> float:
        """Calculate smile intensity from facial landmarks."""
        return self.service.calculate_smile_intensity(landmarks)
    
    def calculate_eye_status(self, landmarks) -> dict:
        """Calculate eye status (open/closed) from landmarks."""
        return self.service.calculate_eye_status(landmarks) 