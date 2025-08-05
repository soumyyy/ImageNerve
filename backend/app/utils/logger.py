"""
Logging configuration for ImageNerve backend
"""
import logging
import sys
from pathlib import Path
from datetime import datetime
import os


class ColoredFormatter(logging.Formatter):
    """Custom formatter to add colors to log levels"""
    
    # ANSI color codes
    COLORS = {
        'DEBUG': '\033[36m',    # Cyan
        'INFO': '\033[32m',     # Green
        'WARNING': '\033[33m',  # Yellow
        'ERROR': '\033[31m',    # Red
        'CRITICAL': '\033[35m', # Magenta
    }
    RESET = '\033[0m'
    
    def format(self, record):
        # Add color to the level name
        if record.levelname in self.COLORS:
            record.levelname = f"{self.COLORS[record.levelname]}{record.levelname}{self.RESET}"
        
        return super().format(record)


def setup_logging(log_level: str = "INFO", log_file: bool = True):
    """
    Set up logging configuration for the application
    
    Args:
        log_level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        log_file: Whether to also log to file
    """
    
    # Create logs directory if it doesn't exist
    log_dir = Path("logs")
    log_dir.mkdir(exist_ok=True)
    
    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, log_level.upper()))
    
    # Clear existing handlers
    root_logger.handlers.clear()
    
    # Console handler with colors
    console_handler = logging.StreamHandler(sys.stdout)
    console_formatter = ColoredFormatter(
        fmt='%(asctime)s | %(levelname)-8s | %(name)s:%(lineno)d | %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    console_handler.setFormatter(console_formatter)
    root_logger.addHandler(console_handler)
    
    # File handler (if enabled)
    if log_file:
        # Main log file
        file_handler = logging.FileHandler(
            log_dir / f"imagenerve_{datetime.now().strftime('%Y%m%d')}.log"
        )
        file_formatter = logging.Formatter(
            fmt='%(asctime)s | %(levelname)-8s | %(name)s:%(lineno)d | %(funcName)s | %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        file_handler.setFormatter(file_formatter)
        root_logger.addHandler(file_handler)
        
        # Error log file (only errors and above)
        error_handler = logging.FileHandler(
            log_dir / f"imagenerve_errors_{datetime.now().strftime('%Y%m%d')}.log"
        )
        error_handler.setLevel(logging.ERROR)
        error_handler.setFormatter(file_formatter)
        root_logger.addHandler(error_handler)
    
    # Set specific logger levels
    logging.getLogger("uvicorn").setLevel(logging.INFO)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
    
    return root_logger


def get_logger(name: str) -> logging.Logger:
    """Get a logger with the specified name"""
    return logging.getLogger(name)


# Photo upload specific loggers
photo_logger = get_logger("imagenerve.photos")
s3_logger = get_logger("imagenerve.s3")
face_logger = get_logger("imagenerve.faces")
db_logger = get_logger("imagenerve.database")
api_logger = get_logger("imagenerve.api")


def log_upload_start(user_id: str, filename: str):
    """Log the start of a photo upload process"""
    photo_logger.info(f"🚀 UPLOAD START | User: {user_id} | File: {filename}")


def log_upload_success(user_id: str, filename: str, photo_id: str, duration: float):
    """Log successful photo upload"""
    photo_logger.info(f"✅ UPLOAD SUCCESS | User: {user_id} | File: {filename} | Photo ID: {photo_id} | Duration: {duration:.2f}s")


def log_upload_error(user_id: str, filename: str, error: str, duration: float):
    """Log failed photo upload"""
    photo_logger.error(f"❌ UPLOAD FAILED | User: {user_id} | File: {filename} | Error: {error} | Duration: {duration:.2f}s")


def log_s3_operation(operation: str, filename: str, success: bool, details: str = ""):
    """Log S3 operations"""
    if success:
        s3_logger.info(f"☁️ S3 {operation.upper()} SUCCESS | File: {filename} | {details}")
    else:
        s3_logger.error(f"☁️ S3 {operation.upper()} FAILED | File: {filename} | {details}")


def log_face_detection(filename: str, face_count: int, duration: float, success: bool):
    """Log face detection results"""
    if success:
        face_logger.info(f"🤖 FACE DETECTION SUCCESS | File: {filename} | Faces: {face_count} | Duration: {duration:.2f}s")
    else:
        face_logger.error(f"🤖 FACE DETECTION FAILED | File: {filename} | Duration: {duration:.2f}s")


def log_db_operation(operation: str, table: str, record_id: str = "", success: bool = True, details: str = ""):
    """Log database operations"""
    if success:
        db_logger.info(f"🗄️ DB {operation.upper()} SUCCESS | Table: {table} | ID: {record_id} | {details}")
    else:
        db_logger.error(f"🗄️ DB {operation.upper()} FAILED | Table: {table} | ID: {record_id} | {details}")


def log_api_request(method: str, endpoint: str, user_id: str = "", status_code: int = 200, duration: float = 0):
    """Log API requests"""
    status_emoji = "✅" if status_code < 400 else "⚠️" if status_code < 500 else "❌"
    api_logger.info(f"{status_emoji} {method} {endpoint} | User: {user_id} | Status: {status_code} | Duration: {duration:.3f}s")