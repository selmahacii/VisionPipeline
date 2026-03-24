"""
Airflow DAG for Data Export Pipeline

Daily export of detection data for:
1. Offline analysis
2. Model training datasets
3. Compliance/archival
4. External integrations

Export formats:
- COCO JSON (for training)
- Parquet (for analytics)
- CSV (for reporting)
"""

from datetime import datetime, timedelta
from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.utils.dates import days_ago
import logging

logger = logging.getLogger(__name__)

default_args = {
    "owner": "visionpipeline",
    "depends_on_past": False,
    "start_date": days_ago(1),
    "email_on_failure": False,
    "retries": 1,
    "retry_delay": timedelta(minutes=5),
}

dag = DAG(
    "data_export_pipeline",
    default_args=default_args,
    description="Daily data export pipeline",
    schedule_interval="0 3 * * *",  # 3AM daily
    catchup=False,
    tags=["data", "export", "pipeline"],
)


def export_coco_format(**context):
    """
    Export detections in COCO format for ML training.
    """
    import json
    from pathlib import Path
    
    logger.info("Exporting COCO format...")
    
    output_dir = Path("/tmp/exports/coco")
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Mock COCO export
    coco = {
        "info": {
            "description": "VisionPipeline Detection Dataset",
            "version": "1.0",
            "date_created": datetime.now().isoformat(),
        },
        "licenses": [],
        "images": [],
        "annotations": [],
        "categories": [
            {"id": 0, "name": "person", "supercategory": "person"},
            {"id": 1, "name": "bicycle", "supercategory": "vehicle"},
            {"id": 2, "name": "car", "supercategory": "vehicle"},
            {"id": 3, "name": "motorcycle", "supercategory": "vehicle"},
            {"id": 7, "name": "truck", "supercategory": "vehicle"},
        ],
    }
    
    # Mock: Add images and annotations
    import random
    for i in range(100):
        image_id = i + 1
        coco["images"].append({
            "id": image_id,
            "file_name": f"frame_{i:06d}.jpg",
            "width": 640,
            "height": 480,
        })
        
        for j in range(random.randint(1, 5)):
            coco["annotations"].append({
                "id": len(coco["annotations"]) + 1,
                "image_id": image_id,
                "category_id": random.choice([0, 2, 7, 1, 3]),
                "bbox": [random.randint(50, 500), random.randint(50, 350), 
                        random.randint(60, 150), random.randint(80, 200)],
                "area": random.randint(5000, 30000),
                "iscrowd": 0,
            })
    
    output_path = output_dir / f"detections_{datetime.now().strftime('%Y%m%d')}.json"
    with open(output_path, 'w') as f:
        json.dump(coco, f)
    
    logger.info(f"Exported {len(coco['images'])} images to {output_path}")
    
    context["task_instance"].xcom_push(key="coco_path", value=str(output_path))
    
    return str(output_path)


def export_parquet_format(**context):
    """
    Export metrics and detections to Parquet for analytics.
    """
    from pathlib import Path
    
    logger.info("Exporting Parquet format...")
    
    output_dir = Path("/tmp/exports/parquet")
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Mock Parquet export
    # In production: use pandas/pyarrow to export from database
    
    output_path = output_dir / f"detections_{datetime.now().strftime('%Y%m%d')}.parquet"
    
    # Create mock parquet file
    try:
        import pandas as pd
        import random
        
        data = []
        for i in range(1000):
            data.append({
                "id": i,
                "stream_id": f"stream_{random.randint(1, 3)}",
                "class_name": random.choice(["person", "car", "truck", "bicycle"]),
                "confidence": random.uniform(0.5, 0.95),
                "x1": random.randint(50, 400),
                "y1": random.randint(50, 300),
                "x2": random.randint(450, 600),
                "y2": random.randint(350, 450),
                "detected_at": datetime.now() - timedelta(minutes=random.randint(0, 1440)),
            })
        
        df = pd.DataFrame(data)
        df.to_parquet(output_path)
        
        logger.info(f"Exported {len(df)} records to {output_path}")
    except ImportError:
        logger.warning("pandas not available, creating empty file")
        with open(output_path, 'w') as f:
            f.write("")
    
    context["task_instance"].xcom_push(key="parquet_path", value=str(output_path))
    
    return str(output_path)


def export_csv_report(**context):
    """
    Export summary report in CSV format.
    """
    import csv
    from pathlib import Path
    
    logger.info("Exporting CSV report...")
    
    output_dir = Path("/tmp/exports/csv")
    output_dir.mkdir(parents=True, exist_ok=True)
    
    output_path = output_dir / f"daily_report_{datetime.now().strftime('%Y%m%d')}.csv"
    
    # Mock report
    import random
    
    with open(output_path, 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(["stream_id", "total_detections", "unique_tracks", 
                        "avg_confidence", "top_class", "top_class_count"])
        
        for stream_id in ["stream_1", "stream_2", "stream_3"]:
            writer.writerow([
                stream_id,
                random.randint(5000, 15000),
                random.randint(50, 200),
                round(random.uniform(0.7, 0.9), 2),
                random.choice(["person", "car"]),
                random.randint(2000, 8000),
            ])
    
    logger.info(f"Exported report to {output_path}")
    
    return str(output_path)


def cleanup_old_exports(**context):
    """
    Remove exports older than retention period.
    """
    from pathlib import Path
    
    logger.info("Cleaning up old exports...")
    
    retention_days = 30
    cutoff = datetime.now() - timedelta(days=retention_days)
    
    export_dirs = [
        Path("/tmp/exports/coco"),
        Path("/tmp/exports/parquet"),
        Path("/tmp/exports/csv"),
    ]
    
    deleted_count = 0
    
    for export_dir in export_dirs:
        if not export_dir.exists():
            continue
        
        for file in export_dir.iterdir():
            if file.is_file():
                # Check file modification time
                mtime = datetime.fromtimestamp(file.stat().st_mtime)
                if mtime < cutoff:
                    file.unlink()
                    deleted_count += 1
    
    logger.info(f"Deleted {deleted_count} old export files")
    
    return deleted_count


def notify_export_complete(**context):
    """
    Send notification about completed exports.
    """
    ti = context["task_instance"]
    
    coco_path = ti.xcom_pull(task_ids="export_coco", key="coco_path")
    parquet_path = ti.xcom_pull(task_ids="export_parquet", key="parquet_path")
    
    message = f"""
    Export pipeline completed:
    - COCO: {coco_path}
    - Parquet: {parquet_path}
    - Time: {datetime.now().isoformat()}
    """
    
    logger.info(message)
    
    return {
        "coco_path": coco_path,
        "parquet_path": parquet_path,
        "timestamp": datetime.now().isoformat(),
    }


# Define DAG tasks
t1 = PythonOperator(
    task_id="export_coco",
    python_callable=export_coco_format,
    dag=dag,
)

t2 = PythonOperator(
    task_id="export_parquet",
    python_callable=export_parquet_format,
    dag=dag,
)

t3 = PythonOperator(
    task_id="export_csv",
    python_callable=export_csv_report,
    dag=dag,
)

t4 = PythonOperator(
    task_id="cleanup_exports",
    python_callable=cleanup_old_exports,
    dag=dag,
)

t5 = PythonOperator(
    task_id="notify_complete",
    python_callable=notify_export_complete,
    dag=dag,
)

# Export in parallel, then cleanup and notify
[t1, t2, t3] >> t4 >> t5
