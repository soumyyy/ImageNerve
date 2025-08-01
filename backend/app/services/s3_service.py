from dotenv import load_dotenv
load_dotenv()

import os
import boto3

AWS_ACCESS_KEY_ID = os.environ.get("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.environ.get("AWS_SECRET_ACCESS_KEY")
AWS_REGION = os.environ.get("AWS_REGION")
S3_BUCKET_NAME = os.environ.get("S3_BUCKET_NAME")

s3_client = boto3.client(
    "s3",
    aws_access_key_id=AWS_ACCESS_KEY_ID,
    aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
    region_name=AWS_REGION,
)

def generate_presigned_url(key: str, expiration: int = 3600) -> str:
    """Generate a presigned URL to upload a file to S3."""
    return s3_client.generate_presigned_url(
        "put_object",
        Params={"Bucket": S3_BUCKET_NAME, "Key": key},
        ExpiresIn=expiration,
    )

def generate_presigned_download_url(key: str, expiration: int = 3600) -> str:
    """Generate a presigned URL to download a file from S3."""
    return s3_client.generate_presigned_url(
        "get_object",
        Params={"Bucket": S3_BUCKET_NAME, "Key": key},
        ExpiresIn=expiration,
    )

def list_files() -> list:
    """List all files in the S3 bucket."""
    response = s3_client.list_objects_v2(Bucket=S3_BUCKET_NAME)
    return [obj["Key"] for obj in response.get("Contents", [])]

def list_files_with_metadata() -> list:
    """List all files in the S3 bucket with metadata."""
    response = s3_client.list_objects_v2(Bucket=S3_BUCKET_NAME)
    return response.get("Contents", [])

def rename_file(old_key: str, new_key: str):
    """Rename a file in S3 (copy then delete)."""
    s3_client.copy_object(
        Bucket=S3_BUCKET_NAME,
        CopySource={"Bucket": S3_BUCKET_NAME, "Key": old_key},
        Key=new_key,
    )
    s3_client.delete_object(Bucket=S3_BUCKET_NAME, Key=old_key)

def delete_file(key: str):
    """Delete a file from the S3 bucket."""
    s3_client.delete_object(Bucket=S3_BUCKET_NAME, Key=key) 