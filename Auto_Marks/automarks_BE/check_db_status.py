
from app.database import SessionLocal
from app.models import UploadLog, UploadStatus
from sqlalchemy import desc

def check_upload_status():
    db = SessionLocal()
    try:
        logs = db.query(UploadLog).order_by(desc(UploadLog.upload_timestamp)).limit(5).all()
        for log in logs:
            print(f"Batch: {log.batch_id}")
            print(f"  Uploaded: {log.upload_timestamp}")
            print(f"  Status: {log.status}")
            print(f"  Total: {log.total_files}")
            print(f"  Processed: {log.processed_files}")
            print(f"  Failed: {log.failed_files}")
            print(f"  Error Log: {log.error_log}")
            print("-" * 20)
    finally:
        db.close()

if __name__ == "__main__":
    check_upload_status()
