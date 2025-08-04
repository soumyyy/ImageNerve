import numpy as np
import logging
import cv2
from insightface.app import FaceAnalysis
import os
from pathlib import Path
import warnings
import io
from contextlib import redirect_stdout, redirect_stderr
from PIL import Image as PILImage

warnings.filterwarnings('ignore', category=FutureWarning, module='insightface.utils.transform')
logger = logging.getLogger(__name__)

class FaceDetectionService:
    def __init__(self, model_path: str = "./models/weights/insightface"):
        try:
            with redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
                self.app = FaceAnalysis(
                    name="buffalo_l",
                    root=model_path,
                    providers=['CPUExecutionProvider']
                )
                self.app.prepare(ctx_id=-1, det_size=(640, 640))
            self.similarity_threshold = 0.45
            backend_dir = Path(__file__).resolve().parent.parent.parent
            self.faces_dir = backend_dir / "image" / "faces"
            self.faces_dir.mkdir(exist_ok=True, parents=True)
            logger.info(f"Face detector initialized with faces directory: {self.faces_dir}")
        except Exception as e:
            logger.error(f"Failed to initialize face detector: {str(e)}")
            self.app = None

    def calculate_smile_intensity(self, landmarks) -> float:
        try:
            if landmarks.shape[0] != 5:
                return 0.0
            left_mouth = landmarks[3]
            right_mouth = landmarks[4]
            mouth_width = np.linalg.norm(right_mouth - left_mouth)
            left_eye = landmarks[0]
            right_eye = landmarks[1]
            eye_distance = np.linalg.norm(right_eye - left_eye)
            ratio = mouth_width / (eye_distance + 1e-6)
            norm_ratio = (ratio - 0.8) / 0.4
            nose = landmarks[2]
            mouth_center_y = (left_mouth[1] + right_mouth[1]) / 2
            elevation = (mouth_center_y - nose[1]) / eye_distance
            norm_elevation = (elevation - 0.3) / 0.3
            intensity = 0.4 * norm_ratio + 0.6 * norm_elevation
            return float(np.clip(intensity, 0, 1))
        except Exception as e:
            logger.error(f"Error in smile calculation: {str(e)}")
            return 0.0

    def calculate_eye_status(self, landmarks) -> dict:
        try:
            if landmarks is None or landmarks.shape[0] != 5:
                return {"status": "unknown", "left_ear": 0.0, "right_ear": 0.0}
            left_eye = landmarks[0]
            right_eye = landmarks[1]
            nose = landmarks[2]
            left_eye_nose_dist = np.linalg.norm(left_eye - nose)
            right_eye_nose_dist = np.linalg.norm(right_eye - nose)
            eye_distance = np.linalg.norm(right_eye - left_eye)
            left_ear = left_eye_nose_dist / (eye_distance + 1e-6)
            right_ear = right_eye_nose_dist / (eye_distance + 1e-6)
            avg_ear = (left_ear + right_ear) / 2.0
            if avg_ear > 0.4:
                status = "open"
            elif avg_ear > 0.25:
                status = "partially open"
            else:
                status = "closed"
            return {
                "status": status,
                "left_ear": float(left_ear),
                "right_ear": float(right_ear)
            }
        except Exception as e:
            logger.error(f"Error in eye status calculation: {str(e)}")
            return {"status": "unknown", "left_ear": 0.0, "right_ear": 0.0}

    def detect_faces(self, image: np.ndarray) -> dict:
        try:
            if self.app is None:
                raise ValueError("Face detector not properly initialized")
            if len(image.shape) == 2:
                image = cv2.cvtColor(image, cv2.COLOR_GRAY2BGR)
            elif image.dtype != np.uint8:
                image = (image * 255).astype(np.uint8)
            elif image.ndim != 3 or image.shape[2] != 3:
                raise ValueError(f"Unsupported image format: {image.shape}")
            faces = self.app.get(image)
            if not faces:
                return {
                    "faces_detected": False,
                    "face_count": 0,
                    "faces": []
                }
            results = []
            for face in faces:
                smile_intensity = self.calculate_smile_intensity(face.kps)
                eye_status = self.calculate_eye_status(face.kps)
                results.append({
                    "confidence": float(face.det_score),
                    "embedding": face.embedding.tolist(),
                    "bounding_box": face.bbox.tolist(),
                    "landmarks": face.kps.tolist() if face.kps is not None else None,
                    "attributes": {
                        "smile_intensity": smile_intensity,
                        "eye_status": eye_status
                    }
                })
            return {
                "faces_detected": True,
                "face_count": len(results),
                "faces": results
            }
        except Exception as e:
            logger.error(f"Error in face detection: {e}")
            return {
                "error": str(e),
                "faces_detected": False,
                "face_count": 0,
                "faces": []
            }

    def compute_similarity(self, embedding1: np.ndarray, embedding2: np.ndarray) -> float:
        try:
            if embedding1.shape[0] != 512 or embedding2.shape[0] != 512:
                return 0.0
            norm1 = np.linalg.norm(embedding1)
            norm2 = np.linalg.norm(embedding2)
            if norm1 == 0 or norm2 == 0:
                return 0.0
            return float(np.dot(embedding1, embedding2) / (norm1 * norm2))
        except Exception:
            return 0.0