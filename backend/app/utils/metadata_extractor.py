import os
import json
from typing import Dict, Any, Optional
from PIL import Image
from PIL.ExifTags import TAGS, GPSTAGS
import logging

logger = logging.getLogger(__name__)

def extract_image_metadata(image_path: str) -> Dict[str, Any]:
    """
    Extract comprehensive metadata from an image file.
    
    Args:
        image_path: Path to the image file
        
    Returns:
        Dictionary containing extracted metadata
    """
    metadata = {}
    
    try:
        with Image.open(image_path) as img:
            # Basic image information
            metadata.update({
                'dimensions': f"{img.width} x {img.height}",
                'format': img.format,
                'mode': img.mode,
                'color_space': 'Unknown',  # Don't store bytes objects
            })
            
            # Extract EXIF data
            exif_data = extract_exif_data(img)
            if exif_data:
                metadata.update(exif_data)
                
            # Extract GPS data
            gps_data = extract_gps_data(img)
            if gps_data:
                metadata.update(gps_data)
                
    except Exception as e:
        logger.error(f"Failed to extract metadata from {image_path}: {str(e)}")
        metadata = {
            'error': f"Failed to extract metadata: {str(e)}",
            'dimensions': 'Unknown',
            'format': 'Unknown',
            'mode': 'Unknown',
        }
    
    return metadata

def extract_exif_data(img: Image.Image) -> Dict[str, Any]:
    """Extract EXIF metadata from image."""
    exif_data = {}
    
    try:
        exif = img._getexif()
        if exif is None:
            return exif_data
            
        for tag_id, value in exif.items():
            tag = TAGS.get(tag_id, tag_id)
            
            # Convert bytes to string if needed
            if isinstance(value, bytes):
                try:
                    value = value.decode('utf-8', errors='ignore')
                except:
                    value = str(value)
            
            # Map common EXIF tags to our metadata fields
            if tag == 'Make':
                exif_data['camera'] = str(value)
            elif tag == 'Model':
                camera = exif_data.get('camera', '')
                exif_data['camera'] = f"{camera} {str(value)}".strip()
            elif tag == 'LensModel':
                exif_data['lens'] = str(value)
            elif tag == 'FocalLength':
                exif_data['focal_length'] = str(value)
            elif tag == 'FNumber':
                exif_data['aperture'] = f"f/{value}"
            elif tag == 'ExposureTime':
                exif_data['shutter_speed'] = f"{value}s"
            elif tag == 'ISOSpeedRatings':
                exif_data['iso'] = str(value)
            elif tag == 'Software':
                exif_data['software'] = str(value)
            elif tag == 'Artist':
                exif_data['artist'] = str(value)
            elif tag == 'Copyright':
                exif_data['copyright'] = str(value)
            elif tag == 'Orientation':
                exif_data['orientation'] = str(value)
            elif tag == 'XResolution':
                exif_data['dpi'] = f"{value} DPI"
            elif tag == 'YResolution':
                # Combine with XResolution if needed
                pass
            else:
                # Store other EXIF tags as custom fields
                exif_data[f'exif_{tag.lower()}'] = str(value)
                
    except Exception as e:
        logger.error(f"Failed to extract EXIF data: {str(e)}")
    
    return exif_data

def extract_gps_data(img: Image.Image) -> Dict[str, Any]:
    """Extract GPS metadata from image."""
    gps_data = {}
    
    try:
        exif = img._getexif()
        if exif is None:
            return gps_data
            
        # Find GPS info
        for tag_id, value in exif.items():
            tag = TAGS.get(tag_id, tag_id)
            if tag == 'GPSInfo':
                gps_info = {}
                for gps_tag_id, gps_value in value.items():
                    gps_tag = GPSTAGS.get(gps_tag_id, gps_tag_id)
                    gps_info[gps_tag] = gps_value
                
                # Extract GPS coordinates
                if 'GPSLatitude' in gps_info and 'GPSLongitude' in gps_info:
                    lat = convert_to_degrees(gps_info['GPSLatitude'])
                    lon = convert_to_degrees(gps_info['GPSLongitude'])
                    
                    # Apply hemisphere
                    if 'GPSLatitudeRef' in gps_info and gps_info['GPSLatitudeRef'] == 'S':
                        lat = -lat
                    if 'GPSLongitudeRef' in gps_info and gps_info['GPSLongitudeRef'] == 'W':
                        lon = -lon
                    
                    gps_data['gps_latitude'] = lat
                    gps_data['gps_longitude'] = lon
                
                # Extract altitude
                if 'GPSAltitude' in gps_info:
                    alt = gps_info['GPSAltitude']
                    if isinstance(alt, tuple):
                        alt = alt[0] / alt[1] if alt[1] != 0 else 0
                    gps_data['gps_altitude'] = alt
                    
    except Exception as e:
        logger.error(f"Failed to extract GPS data: {str(e)}")
    
    return gps_data

def convert_to_degrees(value):
    """Convert GPS coordinates from DMS (degrees, minutes, seconds) to decimal degrees."""
    if isinstance(value, tuple):
        degrees = value[0]
        minutes = value[1]
        seconds = value[2]
        
        return degrees + (minutes / 60.0) + (seconds / 3600.0)
    return value

def extract_metadata_from_bytes(image_bytes: bytes, filename: str) -> Dict[str, Any]:
    """
    Extract metadata from image bytes (for uploaded files).
    
    Args:
        image_bytes: Raw image data
        filename: Original filename
        
    Returns:
        Dictionary containing extracted metadata
    """
    import tempfile
    
    metadata = {}
    
    try:
        # Create temporary file to extract metadata
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(filename)[1]) as temp_file:
            temp_file.write(image_bytes)
            temp_file.flush()
            
            # Extract metadata from temporary file
            metadata = extract_image_metadata(temp_file.name)
            
    except Exception as e:
        logger.error(f"Failed to extract metadata from bytes: {str(e)}")
        metadata = {
            'error': f"Failed to extract metadata: {str(e)}",
            'dimensions': 'Unknown',
            'format': 'Unknown',
        }
    finally:
        # Clean up temporary file
        try:
            os.unlink(temp_file.name)
        except:
            pass
    
    return metadata

def format_metadata_for_display(metadata: Dict[str, Any]) -> Dict[str, Any]:
    """
    Format metadata for display in the frontend.
    
    Args:
        metadata: Raw metadata dictionary
        
    Returns:
        Formatted metadata dictionary
    """
    formatted = {}
    
    # Format file size
    if 'file_size' in metadata:
        formatted['file_size'] = format_file_size(metadata['file_size'])
    
    # Format dimensions
    if 'dimensions' in metadata:
        formatted['dimensions'] = metadata['dimensions']
    
    # Format camera info
    if 'camera' in metadata:
        formatted['camera'] = metadata['camera']
    
    # Format GPS coordinates
    if 'gps_latitude' in metadata and 'gps_longitude' in metadata:
        formatted['gps_latitude'] = f"{metadata['gps_latitude']:.6f}"
        formatted['gps_longitude'] = f"{metadata['gps_longitude']:.6f}"
    
    # Keep all other fields as-is
    for key, value in metadata.items():
        if key not in formatted:
            formatted[key] = value
    
    return formatted

def format_file_size(bytes_size: int) -> str:
    """Format file size in human readable format."""
    if bytes_size == 0:
        return "0 Bytes"
    
    size_names = ["Bytes", "KB", "MB", "GB"]
    i = 0
    while bytes_size >= 1024 and i < len(size_names) - 1:
        bytes_size /= 1024.0
        i += 1
    
    return f"{bytes_size:.1f} {size_names[i]}" 