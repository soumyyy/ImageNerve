#!/usr/bin/env python3
"""
Safe script to extract metadata for existing photos in the database.
Only processes photos with correct S3 URLs and handles errors gracefully.
"""

import sys
import os
import requests
import time
import json

# Add the parent directory to the path so we can import our modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models.database_models import Photo
from app.utils.metadata_extractor import extract_metadata_from_bytes
from app.services import s3_service
from app.utils.logger import get_logger

logger = get_logger("safe_metadata_extraction")

def is_valid_s3_url(url: str) -> bool:
    """Check if S3 URL is valid and includes region."""
    return ('ap-south-1' in url or 's3.amazonaws.com' in url) and 'imagenervetesting' in url

def clean_metadata_for_json(metadata: dict) -> dict:
    """Clean metadata to ensure it's JSON serializable."""
    cleaned = {}
    for key, value in metadata.items():
        if isinstance(value, bytes):
            try:
                cleaned[key] = value.decode('utf-8', errors='ignore')
            except:
                cleaned[key] = str(value)
        elif isinstance(value, (dict, list)):
            cleaned[key] = json.dumps(value, default=str)
        else:
            cleaned[key] = str(value)
    return cleaned

def extract_metadata_safe():
    """Safely extract metadata for existing photos."""
    
    db = SessionLocal()
    try:
        photos = db.query(Photo).all()
        
        print(f"📊 Found {len(photos)} photos in database")
        print("=" * 60)
        
        success_count = 0
        error_count = 0
        skipped_count = 0
        
        for i, photo in enumerate(photos, 1):
            print(f"Processing {i}/{len(photos)}: {photo.filename}")
            
            try:
                # Check if photo already has comprehensive metadata
                existing_metadata = photo.photo_metadata or {}
                has_comprehensive_metadata = (
                    existing_metadata.get('dimensions') and 
                    existing_metadata.get('format') and
                    existing_metadata.get('camera') is not None
                )
                
                if has_comprehensive_metadata:
                    print(f"⏭️ Skipping {photo.filename} - already has comprehensive metadata")
                    skipped_count += 1
                    continue
                
                # Check if S3 URL is valid
                if not is_valid_s3_url(photo.s3_url):
                    print(f"⚠️ Skipping {photo.filename} - invalid S3 URL: {photo.s3_url}")
                    error_count += 1
                    continue
                
                # Generate download URL
                download_url = s3_service.generate_presigned_download_url(photo.filename)
                
                # Download and extract metadata
                response = requests.get(download_url, timeout=30)
                response.raise_for_status()
                
                # Extract metadata
                extracted_metadata = extract_metadata_from_bytes(response.content, photo.filename)
                
                # Clean metadata for JSON serialization
                cleaned_metadata = clean_metadata_for_json(extracted_metadata)
                
                # Merge with existing metadata
                if existing_metadata:
                    existing_metadata.update(cleaned_metadata)
                    final_metadata = existing_metadata
                else:
                    final_metadata = cleaned_metadata
                
                # Update the photo record
                photo.photo_metadata = final_metadata
                db.commit()
                
                print(f"✅ Successfully extracted metadata for {photo.filename}: {len(cleaned_metadata)} fields")
                success_count += 1
                
                # Small delay
                time.sleep(0.5)
                
            except Exception as e:
                print(f"❌ Failed to process {photo.filename}: {str(e)}")
                error_count += 1
                db.rollback()
                continue
        
        print("\n" + "=" * 60)
        print("🎉 Metadata extraction completed!")
        print(f"✅ Successfully processed: {success_count} photos")
        print(f"⏭️ Skipped (already had metadata): {skipped_count} photos")
        print(f"❌ Failed to process: {error_count} photos")
        
    except Exception as e:
        print(f"❌ Script failed: {str(e)}")
        raise
    finally:
        db.close()

def main():
    """Main function."""
    print("🔍 Starting safe metadata extraction for existing photos...")
    print("=" * 60)
    
    try:
        extract_metadata_safe()
        print("✅ Safe metadata extraction completed successfully!")
    except Exception as e:
        print(f"❌ Script failed: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main() 