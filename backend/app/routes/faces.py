from typing import List, Optional

import cv2
import numpy as np
from fastapi import APIRouter, Depends, Query, UploadFile, File, HTTPException, Body
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.face_service import FaceService
from app.services.face_clustering_service import FaceClusteringService

router = APIRouter()


@router.post("/detect")
async def detect_faces(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Detect faces in an image (no storage)."""
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if image is None:
        try:
            from PIL import Image as PILImage
            import io
            pil_img = PILImage.open(io.BytesIO(contents)).convert("RGB")
            image = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid image data")
    if image is None:
        raise HTTPException(status_code=400, detail="Invalid image data")
    svc = FaceService(db)
    result = svc.face_detector.detect_faces(image)
    return result


@router.post("/detect-and-store")
async def detect_and_store_faces(
    file: UploadFile = File(...),
    photo_id: str = Query(...),
    user_id: str = Query(...),
    db: Session = Depends(get_db),
):
    """Detect faces in an image and store embeddings in the database."""
    contents = await file.read()
    svc = FaceService(db)
    result = svc.detect_and_store_faces(photo_id, user_id, contents)
    return result


@router.get("/embeddings")
def list_embeddings(
    user_id: str = Query(...),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    """List face embeddings for a user."""
    svc = FaceService(db)
    faces = svc.get_faces_by_user(user_id, limit=limit)
    return [
        {
            "id": str(f.id),
            "photo_id": str(f.photo_id),
            "user_id": str(f.user_id),
            "confidence": f.confidence,
            "bbox": f.bbox,
            "created_at": f.created_at.isoformat() if f.created_at else None,
        }
        for f in faces
    ]


@router.get("/embeddings/{photo_id}")
def get_embeddings_by_photo(
    photo_id: str,
    db: Session = Depends(get_db),
):
    """Get face embeddings for a photo."""
    svc = FaceService(db)
    faces = svc.get_faces_by_photo(photo_id)
    return [
        {
            "id": str(f.id),
            "photo_id": str(f.photo_id),
            "confidence": f.confidence,
            "bbox": f.bbox,
        }
        for f in faces
    ]


@router.delete("/embeddings/{face_id}")
def delete_embedding(
    face_id: str,
    db: Session = Depends(get_db),
):
    """Delete a face embedding."""
    svc = FaceService(db)
    ok = svc.delete_face_embedding(face_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Face embedding not found")
    return {"success": True, "face_id": face_id}


@router.post("/similarity")
def find_similar_faces(
    body: dict = Body(...),
    user_id: str = Query(...),
    threshold: float = Query(0.45),
    limit: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Find faces similar to the given embedding."""
    embedding = body.get("embedding")
    if not embedding:
        raise HTTPException(status_code=400, detail="embedding required")
    svc = FaceService(db)
    results = svc.find_similar_faces(embedding, user_id, threshold=threshold, limit=limit)
    return {"similar_faces": results}


@router.get("/clusters")
def list_clusters(
    user_id: str = Query(...),
    db: Session = Depends(get_db),
):
    """List face clusters for a user."""
    svc = FaceService(db)
    clusters = svc.get_clusters_by_user(user_id)
    return [
        {
            "id": str(c.id),
            "user_id": str(c.user_id),
            "face_ids": [str(fid) for fid in (c.face_ids or [])],
            "label": c.label,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        }
        for c in clusters
    ]


@router.get("/clusters/{cluster_id}")
def get_cluster(
    cluster_id: str,
    db: Session = Depends(get_db),
):
    """Get a single face cluster."""
    svc = FaceService(db)
    cluster = svc.get_cluster_by_id(cluster_id)
    if not cluster:
        raise HTTPException(status_code=404, detail="Cluster not found")
    return {
        "id": str(cluster.id),
        "user_id": str(cluster.user_id),
        "face_ids": [str(fid) for fid in (cluster.face_ids or [])],
        "label": cluster.label,
        "created_at": cluster.created_at.isoformat() if cluster.created_at else None,
    }


@router.post("/clusters")
def create_cluster(
    body: dict,
    user_id: str = Query(...),
    db: Session = Depends(get_db),
):
    """Create a face cluster."""
    face_ids = body.get("face_ids", [])
    label = body.get("label")
    if not face_ids:
        raise HTTPException(status_code=400, detail="face_ids required")
    svc = FaceService(db)
    cluster = svc.create_face_cluster(user_id, face_ids, label=label)
    return {
        "id": str(cluster.id),
        "user_id": str(cluster.user_id),
        "face_ids": [str(fid) for fid in (cluster.face_ids or [])],
        "label": cluster.label,
    }


@router.put("/clusters/{cluster_id}")
def update_cluster(
    cluster_id: str,
    label: str = Query(...),
    db: Session = Depends(get_db),
):
    """Update a cluster label."""
    svc = FaceService(db)
    cluster = svc.update_cluster_label(cluster_id, label)
    if not cluster:
        raise HTTPException(status_code=404, detail="Cluster not found")
    return {
        "id": str(cluster.id),
        "label": cluster.label,
    }


@router.delete("/clusters/{cluster_id}")
def delete_cluster(
    cluster_id: str,
    db: Session = Depends(get_db),
):
    """Delete a face cluster."""
    svc = FaceService(db)
    ok = svc.delete_cluster(cluster_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Cluster not found")
    return {"success": True, "cluster_id": cluster_id}


@router.post("/cluster")
def run_clustering(
    user_id: str = Query(...),
    eps: float = Query(0.3),
    min_samples: int = Query(2, ge=1),
    db: Session = Depends(get_db),
):
    """Run DBSCAN face clustering for a user."""
    clustering_svc = FaceClusteringService(db)
    result = clustering_svc.cluster_faces(user_id, eps=eps, min_samples=min_samples)
    return result


@router.post("/profile")
async def set_profile_face(
    file: UploadFile = File(...),
    user_id: str = Query(...),
    db: Session = Depends(get_db),
):
    """Set user profile face from a single image."""
    contents = await file.read()
    svc = FaceService(db)
    result = svc.set_user_profile_face(user_id, contents)
    return result


@router.post("/profile/batch")
async def set_profile_face_batch(
    file: UploadFile = File(None),
    files: List[UploadFile] = File(None),
    user_id: str = Query(...),
    db: Session = Depends(get_db),
):
    """Set user profile face from multiple images (quality-averaged)."""
    images = []
    if files:
        for f in files:
            images.append(await f.read())
    elif file:
        images.append(await file.read())
    if not images:
        raise HTTPException(status_code=400, detail="At least one image required")
    svc = FaceService(db)
    result = svc.set_user_profile_face_batch(user_id, images)
    return result


@router.get("/profile/status")
def get_profile_status(
    user_id: str = Query(...),
    db: Session = Depends(get_db),
):
    """Get whether user has a profile face set."""
    svc = FaceService(db)
    result = svc.get_profile_status(user_id)
    return result


@router.delete("/profile")
def delete_profile_face(
    user_id: str = Query(...),
    db: Session = Depends(get_db),
):
    """Remove user profile face."""
    svc = FaceService(db)
    result = svc.delete_profile_face(user_id)
    return result


@router.get("/me/photos")
def get_my_face_photos(
    user_id: str = Query(...),
    threshold: float = Query(0.45),
    limit: int = Query(200, ge=1, le=500),
    db: Session = Depends(get_db),
):
    """Get photos that contain the user's profile face."""
    svc = FaceService(db)
    result = svc.find_photos_matching_profile(user_id, threshold=threshold, limit=limit)
    return result
