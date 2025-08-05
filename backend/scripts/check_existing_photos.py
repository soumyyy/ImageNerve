#!/usr/bin/env python3
"""
Script to check existing photos in the database and verify their S3 URLs.
"""

import sys
import os

# Add the parent directory to the path so we can import our modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models.database_models import Photo
from app.utils.logger import get_logger

logger = get_logger("check_existing_photos")

def check_existing_photos():
    """Check what photos exist in the database."""
    
    db = SessionLocal()
    try:
        photos = db.query(Photo).all()
        
        print(f"📊 Found {len(photos)} photos in database:")
        print("=" * 60)
        
        for i, photo in enumerate(photos, 1):
            print(f"{i}. ID: {photo.id}")
            print(f"   Filename: {photo.filename}")
            print(f"   S3 URL: {photo.s3_url}")
            print(f"   User ID: {photo.user_id}")
            print(f"   Uploaded: {photo.uploaded_at}")
            print(f"   Has Metadata: {bool(photo.photo_metadata)}")
            if photo.photo_metadata:
                print(f"   Metadata Keys: {list(photo.photo_metadata.keys())}")
            print("-" * 40)
        
    except Exception as e:
        logger.error(f"❌ Script failed: {str(e)}")
        raise
    finally:
        db.close()

def main():
    """Main function to run the photo check script."""
    print("🔍 Checking existing photos in database...")
    print("=" * 60)
    
    try:
        check_existing_photos()
        print("✅ Photo check completed successfully!")
    except Exception as e:
        print(f"❌ Script failed: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main() 