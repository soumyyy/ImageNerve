from app.services.face_detection_service import FaceDetectionService
import numpy as np
import cv2
from typing import List, Dict, Any

class FaceUtils:
    def __init__(self):
        self.service = FaceDetectionService()
    
    def validate_image(self, image: np.ndarray) -> bool:
        """Validate that an image is suitable for face detection."""
        if image is None or image.size == 0:
            return False
        if len(image.shape) < 2 or len(image.shape) > 3:
            return False
        return True
    
    def preprocess_image(self, image: np.ndarray) -> np.ndarray:
        """Preprocess image for face detection."""
        if len(image.shape) == 2:  # Grayscale
            image = cv2.cvtColor(image, cv2.COLOR_GRAY2BGR)
        elif image.dtype != np.uint8:
            image = (image * 255).astype(np.uint8)
        return image
    
    def extract_face_attributes(self, face_data: Dict[str, Any]) -> Dict[str, Any]:
        """Extract and format face attributes from detection result."""
        return {
            "confidence": face_data.get("confidence", 0.0),
            "smile_intensity": face_data.get("attributes", {}).get("smile_intensity", 0.0),
            "eye_status": face_data.get("attributes", {}).get("eye_status", {}),
            "bounding_box": face_data.get("bounding_box", []),
            "landmarks": face_data.get("landmarks", [])
        }
    
    def format_detection_result(self, result: Dict[str, Any]) -> Dict[str, Any]:
        """Format face detection result for API response."""
        return {
            "faces_detected": result.get("faces_detected", False),
            "face_count": result.get("face_count", 0),
            "faces": result.get("faces", []),
            "error": result.get("error")
        } 