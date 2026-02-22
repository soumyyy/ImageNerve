"""
Single source of truth for current user identity.

- TEST_USER_ID: used when no real auth; all flows use this one user.
- get_current_user_id(request): resolves user from request (query, header, or test user).
  Use this in routes/dependencies so auth logic stays here.
"""
from fastapi import Request

# One test user for development; must match frontend CURRENT_USER_ID (config/user.ts).
TEST_USER_ID = "testuser"


def get_current_user_id(request: Request) -> str:
    """
    Resolve current user id from request.
    Priority: query param user_id -> header X-User-Id -> TEST_USER_ID.
    """
    user_id = request.query_params.get("user_id")
    if user_id:
        return user_id
    user_id = request.headers.get("X-User-Id")
    if user_id:
        return user_id
    return TEST_USER_ID


def get_current_user_id_dep(request: Request) -> str:
    """FastAPI dependency: use in route params for resolved current user id."""
    return get_current_user_id(request)
