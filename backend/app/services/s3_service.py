from dotenv import load_dotenv
load_dotenv()

import os
import boto3
from app.utils.logger import get_logger, log_s3_operation
import time

AWS_ACCESS_KEY_ID = os.environ.get("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.environ.get("AWS_SECRET_ACCESS_KEY")
AWS_REGION = os.environ.get("AWS_REGION") or "us-east-1"
S3_BUCKET_NAME = os.environ.get("S3_BUCKET_NAME")

s3_client = boto3.client(
    "s3",
    aws_access_key_id=AWS_ACCESS_KEY_ID,
    aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
    region_name=AWS_REGION,
)

logger = get_logger("imagenerve.services.s3")


def check_s3_config() -> None:
    """Raise RuntimeError with a clear message if S3 is not configured."""
    missing = []
    if not AWS_ACCESS_KEY_ID:
        missing.append("AWS_ACCESS_KEY_ID")
    if not AWS_SECRET_ACCESS_KEY:
        missing.append("AWS_SECRET_ACCESS_KEY")
    if not S3_BUCKET_NAME:
        missing.append("S3_BUCKET_NAME")
    if missing:
        raise RuntimeError(
            "S3 is not configured. Set in .env: " + ", ".join(missing)
        )


def get_bucket_health() -> dict:
    """
    Verify the bucket exists and is reachable. Returns {"ok": True} or {"ok": False, "error": "..."}.
    """
    check_s3_config()
    try:
        s3_client.head_bucket(Bucket=S3_BUCKET_NAME)
        return {"ok": True, "bucket": S3_BUCKET_NAME, "region": AWS_REGION}
    except Exception as e:
        return {"ok": False, "error": str(e), "bucket": S3_BUCKET_NAME}


def generate_presigned_url(key: str, expiration: int = 3600) -> str:
    """Generate a presigned URL to upload a file to S3."""
    check_s3_config()
    start_time = time.time()
    logger.info(f"☁️ Generating presigned upload URL | Key: {key} | Expiration: {expiration}s")
    
    try:
        # Create a dict of parameters that will be used to create the signed URL
        params = {
            "Bucket": S3_BUCKET_NAME,
            "Key": key,
        }
        
        # Generate the URL with specific conditions
        url = s3_client.generate_presigned_url(
            ClientMethod="put_object",
            Params=params,
            ExpiresIn=expiration,
            HttpMethod="PUT"
        )
        duration = time.time() - start_time
        log_s3_operation("presigned_upload", key, True, f"Duration: {duration:.3f}s | Expires: {expiration}s")
        logger.debug(f"✅ Presigned upload URL generated | Key: {key} | Duration: {duration:.3f}s")
        return url
    except Exception as e:
        duration = time.time() - start_time
        log_s3_operation("presigned_upload", key, False, f"Error: {str(e)} | Duration: {duration:.3f}s")
        logger.error(f"❌ Failed to generate presigned upload URL | Key: {key} | Error: {str(e)}")
        raise

def generate_presigned_download_url(key: str, expiration: int = 3600) -> str:
    """Generate a presigned URL to download a file from S3."""
    check_s3_config()
    start_time = time.time()
    logger.info(f"📥 Generating presigned download URL | Key: {key} | Expiration: {expiration}s")
    
    try:
        url = s3_client.generate_presigned_url(
            "get_object",
            Params={"Bucket": S3_BUCKET_NAME, "Key": key},
            ExpiresIn=expiration,
        )
        duration = time.time() - start_time
        log_s3_operation("presigned_download", key, True, f"Duration: {duration:.3f}s | Expires: {expiration}s")
        logger.debug(f"✅ Presigned download URL generated | Key: {key} | Duration: {duration:.3f}s")
        return url
    except Exception as e:
        duration = time.time() - start_time
        log_s3_operation("presigned_download", key, False, f"Error: {str(e)} | Duration: {duration:.3f}s")
        logger.error(f"❌ Failed to generate presigned download URL | Key: {key} | Error: {str(e)}")
        raise

def list_files() -> list:
    """List all files in the S3 bucket."""
    check_s3_config()
    response = s3_client.list_objects_v2(Bucket=S3_BUCKET_NAME)
    return [obj["Key"] for obj in response.get("Contents", [])]

def list_files_with_metadata() -> list:
    """List all files in the S3 bucket with metadata."""
    check_s3_config()
    response = s3_client.list_objects_v2(Bucket=S3_BUCKET_NAME)
    return response.get("Contents", [])

def rename_file(old_key: str, new_key: str):
    """Rename a file in S3 (copy then delete)."""
    check_s3_config()
    s3_client.copy_object(
        Bucket=S3_BUCKET_NAME,
        CopySource={"Bucket": S3_BUCKET_NAME, "Key": old_key},
        Key=new_key,
    )
    s3_client.delete_object(Bucket=S3_BUCKET_NAME, Key=old_key)

def delete_file(key: str):
    """Delete a file from the S3 bucket."""
    check_s3_config()
    s3_client.delete_object(Bucket=S3_BUCKET_NAME, Key=key) 