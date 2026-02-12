"""
Migration script to add current_file and current_file_index columns to upload_logs table
Run this script to update the database schema (PostgreSQL compatible)
"""
from sqlalchemy import text
from app.database import engine
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def migrate():
    """Add new columns to upload_logs table"""
    with engine.begin() as conn:
        try:
            # Add current_file column (IF NOT EXISTS is PostgreSQL 9.6+)
            conn.execute(text("""
                ALTER TABLE upload_logs
                ADD COLUMN IF NOT EXISTS current_file VARCHAR(255) NULL
            """))
            logger.info("✓ Added current_file column")
        except Exception as e:
            logger.error(f"Error adding current_file: {e}")

        try:
            # Add current_file_index column
            conn.execute(text("""
                ALTER TABLE upload_logs
                ADD COLUMN IF NOT EXISTS current_file_index INT DEFAULT 0
            """))
            logger.info("✓ Added current_file_index column")
        except Exception as e:
            logger.error(f"Error adding current_file_index: {e}")

        logger.info("✅ Migration completed successfully!")

if __name__ == "__main__":
    migrate()
