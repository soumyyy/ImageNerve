import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, UploadFile, File, HTTPException, Body
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.photo_service import PhotoService
from app.services import s3_service
from app.utils.metadata_extractor import extract_metadata_from_bytes

router = APIRouter()


def _serialize_photo(photo) -> dict:
    return {
        "id": str(photo.id),
        "user_id": str(photo.user_id),
        "s3_url": photo.s3_url,
        "filename": photo.filename,
        "tags": photo.tags or [],
        "uploaded_at": photo.uploaded_at.isoformat() if photo.uploaded_at else None,
        "photo_metadata": photo.photo_metadata or {},
        "description": photo.description,
        "is_public": photo.is_public,
    }


@router.post("/s3/upload-url")
def get_upload_url(
    filename: str = Query(..., description="S3 object key/filename"),
    user_id: str = Query(..., description="User ID"),
    db: Session = Depends(get_db),
):
    """Get a presigned URL to upload a file to S3. Returns upload_url (for PUT) and file_url path (for storing as photo.s3_url)."""
    from urllib.parse import quote
    try:
        s3_service.check_s3_config()
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    key = filename
    url = s3_service.generate_presigned_url(key)
    # Path the client can use to build the stored URL (e.g. baseURL + file_url)
    fileUrlPath = f"/photos/s3/proxy-download?filename={quote(key)}"
    return {
        "url": url,
        "upload_url": url,
        "key": key,
        "filename": filename,
        "file_url": fileUrlPath,
    }


@router.get("/s3/health")
def s3_health():
    """Check if S3 is configured and the bucket is reachable. Returns 200 with bucket info or 503 with error."""
    try:
        result = s3_service.get_bucket_health()
        if result.get("ok"):
            return result
        raise HTTPException(status_code=503, detail=result.get("error", "S3 bucket unreachable"))
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.get("/s3/download-url")
def get_download_url(
    filename: str = Query(...),
    user_id: Optional[str] = Query(None),
    expiration: int = Query(3600, ge=60, le=86400),
):
    """Get a presigned URL to download a file from S3."""
    url = s3_service.generate_presigned_download_url(filename, expiration=expiration)
    return {"url": url, "filename": filename}


@router.get("/s3/proxy-download")
def proxy_download(filename: str = Query(...)):
    """Stream a file from S3 through the backend (for web CORS)."""
    import urllib.request
    from fastapi.responses import Response
    try:
        s3_service.check_s3_config()
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    url = s3_service.generate_presigned_download_url(filename, expiration=300)
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=30) as resp:
            content_type = resp.headers.get("Content-Type", "application/octet-stream")
            data = resp.read()
        return Response(content=data, media_type=content_type)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to stream from S3: {str(e)}")


@router.get("/s3/files")
def list_s3_files():
    """List all keys in the S3 bucket."""
    keys = s3_service.list_files()
    return {"files": keys}


@router.get("/s3/details")
def list_s3_details():
    """List S3 objects with metadata."""
    details = s3_service.list_files_with_metadata()
    return {"files": details}


@router.post("/s3/rename")
def rename_s3_file(old_key: str = Query(...), new_key: str = Query(...)):
    """Rename a file in S3 (copy then delete)."""
    s3_service.rename_file(old_key, new_key)
    return {"success": True, "old_key": old_key, "new_key": new_key}


@router.delete("/s3/{key:path}")
def delete_s3_file(key: str):
    """Delete a file from S3 by key."""
    s3_service.delete_file(key)
    return {"success": True, "key": key}


@router.post("/s3/extract-metadata")
async def extract_metadata(file: UploadFile = File(...)):
    """Extract image metadata from uploaded file."""
    contents = await file.read()
    metadata = extract_metadata_from_bytes(contents, file.filename or "image")
    return metadata


@router.post("/", response_model=dict)
def create_photo(
    body: dict = Body(...),
    db: Session = Depends(get_db),
):
    """Create a photo record in the database."""
    user_id = body.get("user_id")
    s3_url = body.get("s3_url")
    filename = body.get("filename")
    if not user_id or not s3_url or not filename:
        raise HTTPException(status_code=400, detail="user_id, s3_url, and filename are required")
    tags = body.get("tags")
    description = body.get("description")
    is_public = body.get("is_public", False)
    photo_metadata = body.get("photo_metadata")
    svc = PhotoService(db)
    photo = svc.create_photo(
        user_id=user_id,
        s3_url=s3_url,
        filename=filename,
        tags=tags,
        description=description,
        is_public=is_public,
        photo_metadata=photo_metadata,
    )
    return _serialize_photo(photo)


@router.get("/")
def list_photos(
    user_id: str = Query(...),
    limit: int = Query(50, ge=1, le=200),
    before: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """List photos for a user (newest first, optional cursor)."""
    before_dt = None
    if before:
        try:
            before_dt = datetime.fromisoformat(before.replace("Z", "+00:00"))
        except ValueError:
            pass
    svc = PhotoService(db)
    photos = svc.get_photos_by_user(user_id, limit=limit, before=before_dt)
    return [_serialize_photo(p) for p in photos]


@router.get("/public")
def list_public_photos(
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """List public photos."""
    svc = PhotoService(db)
    photos = svc.get_public_photos(limit=limit)
    return [_serialize_photo(p) for p in photos]


# In-memory thumb cache for sub-second repeat loads (key: (filename, w, q), value: jpeg bytes)
_THUMB_CACHE: dict = {}
_THUMB_CACHE_MAX = 200

def _get_cached_thumb(key: tuple) -> Optional[bytes]:
    return _THUMB_CACHE.get(key)

def _set_cached_thumb(key: tuple, value: bytes) -> None:
    while len(_THUMB_CACHE) >= _THUMB_CACHE_MAX and _THUMB_CACHE:
        old_key = next(iter(_THUMB_CACHE))
        del _THUMB_CACHE[old_key]
    _THUMB_CACHE[key] = value


@router.get("/thumb")
def thumb(
    filename: str = Query(..., description="S3 key / filename"),
    w: int = Query(320, ge=1, le=1920, description="Max width"),
    q: int = Query(60, ge=1, le=100, description="JPEG quality"),
):
    """Stream a resized thumbnail from S3. Cached in memory; Cache-Control for client cache."""
    import urllib.request
    from fastapi.responses import Response
    from io import BytesIO
    cache_key = (filename, w, q)
    cached = _get_cached_thumb(cache_key)
    if cached is not None:
        return Response(
            content=cached,
            media_type="image/jpeg",
            headers={"Cache-Control": "public, max-age=3600"},
        )
    try:
        s3_service.check_s3_config()
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    try:
        url = s3_service.generate_presigned_download_url(filename, expiration=300)
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = resp.read()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch from S3: {str(e)}")
    try:
        from PIL import Image
        img = Image.open(BytesIO(data)).convert("RGB")
        ratio = min(w / img.width, 1.0) if img.width else 1.0
        if ratio < 1.0:
            new_size = (int(img.width * ratio), int(img.height * ratio))
            try:
                resample = Image.Resampling.LANCZOS
            except AttributeError:
                resample = Image.LANCZOS
            img = img.resize(new_size, resample)
        buf = BytesIO()
        img.save(buf, format="JPEG", quality=q, optimize=True)
        out = buf.getvalue()
        _set_cached_thumb(cache_key, out)
        return Response(
            content=out,
            media_type="image/jpeg",
            headers={"Cache-Control": "public, max-age=3600"},
        )
    except Exception:
        return Response(
            content=data,
            media_type="image/jpeg",
            headers={"Cache-Control": "public, max-age=3600"},
        )


def _is_valid_uuid(value: str) -> bool:
    try:
        uuid.UUID(value)
        return True
    except (ValueError, TypeError):
        return False


@router.get("/{photo_id}")
def get_photo(
    photo_id: str,
    db: Session = Depends(get_db),
):
    """Get a single photo by ID. Returns 404 for invalid or unknown IDs (e.g. temp IDs)."""
    if not _is_valid_uuid(photo_id):
        raise HTTPException(status_code=404, detail="Photo not found")
    svc = PhotoService(db)
    photo = svc.get_photo_by_id(photo_id)
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    return _serialize_photo(photo)


@router.put("/{photo_id}")
def update_photo(
    photo_id: str,
    body: dict = Body(...),
    db: Session = Depends(get_db),
):
    """Update photo metadata."""
    if not _is_valid_uuid(photo_id):
        raise HTTPException(status_code=404, detail="Photo not found")
    svc = PhotoService(db)
    photo = svc.update_photo(
        photo_id,
        description=body.get("description"),
        tags=body.get("tags"),
        is_public=body.get("is_public"),
        photo_metadata=body.get("photo_metadata"),
    )
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    return _serialize_photo(photo)


@router.delete("/{photo_id}")
def delete_photo(
    photo_id: str,
    user_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Delete a photo (DB and S3)."""
    if not _is_valid_uuid(photo_id):
        raise HTTPException(status_code=404, detail="Photo not found")
    svc = PhotoService(db)
    ok = svc.delete_photo(photo_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Photo not found")
    return {"success": True, "photo_id": photo_id}
