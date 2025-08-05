#!/usr/bin/env python3
"""
Script to extract metadata for all existing photos in the database.
This will update the photo_metadata field for all photos that don't have it.
"""

import sys
import os
import requests
import time
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base

# Add the parent directory to the path so we can import our modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models.database_models import Photo
from app.utils.metadata_extractor import extract_metadata_from_bytes
from app.services import s3_service
from app.utils.logger import get_logger

logger = get_logger("metadata_extraction_script")

def fix_s3_url(url: str) -> str:
    """Fix S3 URL to include region if missing."""
    if 'ap-south-1' not in url and 's3.amazonaws.com' in url:
        # Replace s3.amazonaws.com with s3.ap-south-1.amazonaws.com
        return url.replace('s3.amazonaws.com', 's3.ap-south-1.amazonaws.com')
    return url

def extract_metadata_for_existing_photos():
    """Extract metadata for all existing photos in the database."""
    
    db = SessionLocal()
    try:
        # Get all photos that don't have comprehensive metadata
        photos = db.query(Photo).all()
        
        logger.info(f"Found {len(photos)} photos in database")
        
        success_count = 0
        error_count = 0
        skipped_count = 0
        
        for i, photo in enumerate(photos, 1):
            try:
                logger.info(f"Processing photo {i}/{len(photos)}: {photo.filename}")
                
                # Check if photo already has comprehensive metadata
                existing_metadata = photo.photo_metadata or {}
                has_comprehensive_metadata = (
                    existing_metadata.get('dimensions') and 
                    existing_metadata.get('format') and
                    existing_metadata.get('camera') is not None
                )
                
                if has_comprehensive_metadata:
                    logger.info(f"Skipping {photo.filename} - already has comprehensive metadata")
                    skipped_count += 1
                    continue
                
                # Fix S3 URL if needed
                fixed_url = fix_s3_url(photo.s3_url)
                if fixed_url != photo.s3_url:
                    logger.info(f"Fixed S3 URL for {photo.filename}: {photo.s3_url} -> {fixed_url}")
                    photo.s3_url = fixed_url
                    db.commit()
                
                # Get presigned download URL
                download_url = s3_service.generate_presigned_download_url(photo.filename)
                
                # Download the file
                response = requests.get(download_url, timeout=30)
                response.raise_for_status()
                
                # Extract metadata from the downloaded bytes
                extracted_metadata = extract_metadata_from_bytes(response.content, photo.filename)
                
                # Merge with existing metadata
                if existing_metadata:
                    existing_metadata.update(extracted_metadata)
                    final_metadata = existing_metadata
                else:
                    final_metadata = extracted_metadata
                
                # Update the photo record
                photo.photo_metadata = final_metadata
                db.commit()
                
                logger.info(f"✅ Successfully extracted metadata for {photo.filename}: {len(extracted_metadata)} fields")
                success_count += 1
                
                # Add a small delay to avoid overwhelming the system
                time.sleep(0.5)
                
            except Exception as e:
                logger.error(f"❌ Failed to extract metadata for {photo.filename}: {str(e)}")
                error_count += 1
                db.rollback()
                continue
        
        logger.info(f"🎉 Metadata extraction completed!")
        logger.info(f"✅ Successfully processed: {success_count} photos")
        logger.info(f"⏭️ Skipped (already had metadata): {skipped_count} photos")
        logger.info(f"❌ Failed to process: {error_count} photos")
        
    except Exception as e:
        logger.error(f"❌ Script failed: {str(e)}")
        raise
    finally:
        db.close()

def main():
    """Main function to run the metadata extraction script."""
    print("🔍 Starting metadata extraction for existing photos...")
    print("=" * 60)
    
    try:
        extract_metadata_for_existing_photos()
        print("✅ Metadata extraction completed successfully!")
    except Exception as e:
        print(f"❌ Script failed: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main() 