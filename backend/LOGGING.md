# 📊 ImageNerve Backend Logging System

## Overview

The ImageNerve backend now includes a comprehensive logging system that tracks all major operations during photo uploads and other API calls. This helps with debugging, monitoring, and understanding system performance.

## 🎯 What Gets Logged

### **Photo Upload Flow**
1. **Upload URL Generation**: S3 presigned URL requests
2. **Photo Record Creation**: Database operations
3. **S3 Operations**: Upload/download URL generation
4. **Face Detection**: AI processing and face storage
5. **API Requests**: All incoming HTTP requests

### **Log Levels**
- **DEBUG**: Detailed technical information (UUIDs, image shapes, etc.)
- **INFO**: Major operation status and results
- **WARNING**: Non-critical issues (no faces detected, etc.)
- **ERROR**: Failed operations and exceptions
- **CRITICAL**: System-level failures

## 📁 Log Files

Logs are stored in `backend/logs/` directory:

```
backend/logs/
├── imagenerve_20241219.log      # All logs for the day
└── imagenerve_errors_20241219.log  # Error logs only
```

## 🎨 Log Format

### Console Output (Colored)
```
2024-12-19 14:30:25 | INFO     | imagenerve.routes.photos:104 | 🚀 UPLOAD START | User: testuser | File: photo.jpg
2024-12-19 14:30:25 | INFO     | imagenerve.services.s3:26    | ☁️ Generating presigned upload URL | Key: photo.jpg | Expiration: 3600s
2024-12-19 14:30:25 | INFO     | imagenerve.services.photo:61 | ✅ Photo record created successfully | Photo ID: 123e4567-e89b-12d3-a456-426614174000
```

### File Format (Detailed)
```
2024-12-19 14:30:25 | INFO     | imagenerve.routes.photos:104 | handlePhotoUpload | 🚀 UPLOAD START | User: testuser | File: photo.jpg
```

## 🚀 **Complete Photo Upload Logging Flow**

When you upload a photo, here's what gets logged:

### 1. **Frontend Upload Request**
```
📋 S3 Upload URL Request | Filename: IMG_20241219_143025.jpg
☁️ Generating presigned upload URL | Key: IMG_20241219_143025.jpg | Expiration: 3600s
✅ S3 presigned_url SUCCESS | File: IMG_20241219_143025.jpg | Duration: 0.045s
```

### 2. **Photo Record Creation**
```
🚀 UPLOAD START | User: testuser | File: IMG_20241219_143025.jpg
📸 Photo Creation Request | User: testuser | File: IMG_20241219_143025.jpg | S3 URL: https://...
🗄️ Creating photo record | User: testuser | File: IMG_20241219_143025.jpg
🔄 Generated UUID from string: testuser -> 550e8400-e29b-41d4-a716-446655440000
🆔 Generated photo ID: 123e4567-e89b-12d3-a456-426614174000
🗄️ DB insert SUCCESS | Table: photos | ID: 123e4567-e89b-12d3-a456-426614174000 | User: testuser
✅ Photo record created successfully | Photo ID: 123e4567-e89b-12d3-a456-426614174000 | Duration: 0.123s
✅ UPLOAD SUCCESS | User: testuser | File: IMG_20241219_143025.jpg | Photo ID: 123e4567-e89b-12d3-a456-426614174000 | Duration: 0.156s
```

### 3. **Face Detection (Optional)**
```
🤖 Face detect-and-store request | Photo ID: 123e4567-e89b-12d3-a456-426614174000 | User: testuser | File: IMG_20241219_143025.jpg
📥 File read | Size: 2457600 bytes | File: IMG_20241219_143025.jpg
📸 Image loaded | File: IMG_20241219_143025.jpg | Shape: (1920, 1080, 3)
🤖 FACE DETECTION SUCCESS | File: IMG_20241219_143025.jpg | Faces: 2 | Duration: 1.234s
✅ Face detection and storage completed | Photo ID: 123e4567-e89b-12d3-a456-426614174000 | Faces detected: 2 | Faces stored: 2 | Duration: 1.456s
```

### 4. **Photo Retrieval**
```
📋 Fetching photos for user | User: testuser | Limit: 50
🔄 Generated UUID from string: testuser -> 550e8400-e29b-41d4-a716-446655440000
🗄️ DB select SUCCESS | Table: photos | ID: user_testuser | Found 5 photos
✅ Successfully fetched 5 photos for user testuser
📅 Photo range: 2024-12-19 12:30:25 to 2024-12-19 14:30:25
```

## 🔍 **Specialized Loggers**

Different components use specialized loggers:

- `imagenerve.main` - Application startup
- `imagenerve.api` - HTTP request/response logging
- `imagenerve.routes.photos` - Photo endpoints
- `imagenerve.routes.faces` - Face detection endpoints
- `imagenerve.services.photo` - Database operations
- `imagenerve.services.s3` - AWS S3 operations
- `imagenerve.photos` - High-level photo operations
- `imagenerve.faces` - Face detection results
- `imagenerve.database` - Database transactions

## ⚙️ **Configuration**

### Environment Variables
```bash
LOG_LEVEL=INFO  # DEBUG, INFO, WARNING, ERROR, CRITICAL
```

### Programmatic Configuration
```python
from app.utils.logger import setup_logging

# Initialize with custom settings
setup_logging(log_level="DEBUG", log_file=True)
```

## 🐛 **Debugging with Logs**

### **Photo Not Showing Issues**
Look for these log patterns:
```
❌ Image failed to load: filename.jpg Unknown error
❌ Presigned URL failed for: filename.jpg
❌ S3 presigned_download FAILED | File: filename.jpg | Error: ...
```

### **Upload Issues**
```
❌ Failed to generate S3 upload URL | Filename: photo.jpg | Error: ...
❌ Failed to create photo record | User: testuser | Error: ...
❌ UPLOAD FAILED | User: testuser | File: photo.jpg | Error: ... | Duration: 2.34s
```

### **Face Detection Issues**
```
❌ Face detection failed | File: photo.jpg | Error: ... | Duration: 1.23s
⚠️ No faces detected | File: photo.jpg | Duration: 0.45s
```

## 📈 **Performance Monitoring**

All operations include timing information:
- **S3 Operations**: Presigned URL generation time
- **Database Operations**: Query execution time
- **Face Detection**: AI processing time
- **API Requests**: Total request handling time

### Example Performance Log
```
✅ S3 presigned_upload SUCCESS | File: photo.jpg | Duration: 0.045s | Expires: 3600s
✅ DB insert SUCCESS | Table: photos | Duration: 0.089s
🤖 FACE DETECTION SUCCESS | File: photo.jpg | Faces: 1 | Duration: 1.234s
✅ API GET /photos/ | User: testuser | Status: 200 | Duration: 0.156s
```

## 🔧 **Custom Logging Functions**

The system provides helper functions for consistent logging:

```python
from app.utils.logger import (
    log_upload_start, log_upload_success, log_upload_error,
    log_s3_operation, log_face_detection, log_db_operation, log_api_request
)

# Usage examples
log_upload_start("user-123", "photo.jpg")
log_s3_operation("presigned_url", "photo.jpg", True, "Duration: 0.045s")
log_face_detection("photo.jpg", 2, 1.234, True)
log_db_operation("insert", "photos", "photo-id", True, "User: user-123")
```

## 🚨 **Error Tracking**

All errors are logged with:
- **Timestamp**: When the error occurred
- **Context**: User ID, filename, operation type
- **Error Details**: Full exception message
- **Duration**: How long the operation took before failing
- **Stack Trace**: Available in DEBUG mode

This comprehensive logging system makes it easy to:
1. **Debug upload issues** in real-time
2. **Monitor system performance** 
3. **Track user behavior** patterns
4. **Identify bottlenecks** in the upload flow
5. **Audit system operations** for security

## 🎯 **Next Steps**

To see the logging in action:
1. Start the backend: `cd backend && python -m uvicorn app.main:app --reload`
2. Upload a photo through the frontend
3. Check `backend/logs/` for detailed logs
4. Monitor console output for real-time logging

The logging system is now fully operational! 🚀