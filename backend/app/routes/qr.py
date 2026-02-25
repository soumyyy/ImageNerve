from fastapi import APIRouter

router = APIRouter()


@router.get("/resolve/{token}")
def resolve_qr_token(token: str):
    """Resolve a share token to resource (placeholder)."""
    return {"message": "QR share links not yet implemented", "token": token}
