"""
Airflow DAG for Automated Model Retraining

Why Airflow for retraining?
- Retraining is a complex multi-step process
- Each step can fail independently (data collection, training, evaluation, deploy)
- Airflow provides: retry logic, step-by-step monitoring, email alerts on failure
- DAG = Directed Acyclic Graph — defines the order of steps

Retraining trigger:
- Manual: API call POST /models/retrain
- Scheduled: daily at 2AM (low-traffic period)
- Automatic: when drift_score > 0.40 for > 30 minutes

Pipeline steps:
1. collect_training_data: query DB for recent detections + export as COCO format
2. validate_data_quality: check class balance, bbox validity, min sample count
3. train_model: fine-tune YOLOv8 on collected data + log to MLflow
4. evaluate_model: compute mAP on held-out test set
5. compare_models: is new model better than current production?
6. deploy_model: if yes, update active model in DB + reload in StreamProcessor
7. reset_drift: tell DriftDetector to reset reference distribution
8. notify: send webhook/email with results
"""

from datetime import datetime, timedelta
from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.operators.bash import BashOperator
from airflow.utils.dates import days_ago
import logging

logger = logging.getLogger(__name__)

default_args = {
    "owner": "visionpipeline",
    "depends_on_past": False,
    "start_date": days_ago(1),
    "email_on_failure": False,
    "email_on_retry": False,
    "retries": 1,
    "retry_delay": timedelta(minutes=5),
}

dag = DAG(
    "daily_model_retrain",
    default_args=default_args,
    description="Daily YOLOv8 retraining pipeline",
    schedule_interval="0 2 * * *",  # 2AM daily
    catchup=False,
    tags=["cv", "mlops", "retraining"],
)


def collect_training_data(**context):
    """
    Step 1: Export recent detections from DB in COCO format.
    
    Collects last 7 days of validated detections.
    Splits into train/val (80/20).
    """
    import json
    import random
    from pathlib import Path
    
    logger.info("Collecting training data...")
    
    output_dir = Path("/tmp/training_data")
    output_dir.mkdir(exist_ok=True)
    
    # In production: connect to database and export annotations
    # For demo: generate mock training data
    
    coco_format = {
        "images": [],
        "annotations": [],
        "categories": [
            {"id": 0, "name": "person"},
            {"id": 1, "name": "bicycle"},
            {"id": 2, "name": "car"},
            {"id": 3, "name": "motorcycle"},
            {"id": 7, "name": "truck"},
        ]
    }
    
    # Generate mock data
    num_samples = 1000
    for i in range(num_samples):
        image_id = i + 1
        coco_format["images"].append({
            "id": image_id,
            "file_name": f"frame_{i:06d}.jpg",
            "width": 640,
            "height": 480,
        })
        
        # Random annotations
        num_objects = random.randint(1, 5)
        for j in range(num_objects):
            cat_id = random.choice([0, 2, 7, 1, 3])
            x = random.randint(50, 500)
            y = random.randint(50, 350)
            w = random.randint(60, 150)
            h = random.randint(80, 200)
            
            coco_format["annotations"].append({
                "id": len(coco_format["annotations"]) + 1,
                "image_id": image_id,
                "category_id": cat_id,
                "bbox": [x, y, w, h],
                "area": w * h,
                "iscrowd": 0,
            })
    
    # Save annotations
    annotations_path = output_dir / "annotations.json"
    with open(annotations_path, 'w') as f:
        json.dump(coco_format, f)
    
    logger.info(f"Collected {num_samples} training samples")
    
    # Push to XCom
    context["task_instance"].xcom_push(key="sample_count", value=num_samples)
    context["task_instance"].xcom_push(key="output_dir", value=str(output_dir))
    
    return str(output_dir)


def validate_data_quality(**context):
    """
    Step 2: Validate data quality before training.
    
    Checks:
    - Minimum sample count
    - Class balance
    - Bounding box validity
    """
    output_dir = context["task_instance"].xcom_pull(task_ids="collect_data", key="output_dir")
    sample_count = context["task_instance"].xcom_pull(task_ids="collect_data", key="sample_count")
    
    logger.info(f"Validating data quality: {sample_count} samples from {output_dir}")
    
    # Validation checks
    if sample_count < 500:
        raise ValueError(f"Insufficient training data: {sample_count} samples (min 500)")
    
    # In production: check class balance, bbox validity, etc.
    logger.info("Data quality validation passed")
    
    return True


def train_model(**context):
    """
    Step 3: Fine-tune YOLOv8 on collected data.
    
    Logs everything to MLflow.
    Uses transfer learning — starts from pretrained weights.
    """
    import json
    from datetime import datetime
    
    logger.info("Starting model training...")
    
    data_dir = context["task_instance"].xcom_pull(task_ids="collect_data", key="output_dir")
    
    # Mock training metrics
    metrics = {
        "map50": 0.72 + random.random() * 0.1,
        "map75": 0.58 + random.random() * 0.1,
        "precision": 0.75 + random.random() * 0.1,
        "recall": 0.70 + random.random() * 0.1,
    }
    
    run_id = f"retrain_{datetime.now().strftime('%Y%m%d_%H%M')}"
    
    logger.info(f"Training complete. mAP50={metrics['map50']:.3f}")
    
    context["task_instance"].xcom_push(key="run_id", value=run_id)
    context["task_instance"].xcom_push(key="metrics", value=json.dumps(metrics))
    
    return run_id


def evaluate_model(**context):
    """
    Step 4: Evaluate new model on test set.
    """
    import json
    
    run_id = context["task_instance"].xcom_pull(task_ids="train", key="run_id")
    metrics_str = context["task_instance"].xcom_pull(task_ids="train", key="metrics")
    metrics = json.loads(metrics_str)
    
    logger.info(f"Evaluating model {run_id}...")
    logger.info(f"Metrics: mAP50={metrics['map50']:.3f}, mAP75={metrics['map75']:.3f}")
    
    return metrics


def compare_and_deploy(**context):
    """
    Step 5+6: Compare new model vs production and deploy if better.
    """
    import json
    
    run_id = context["task_instance"].xcom_pull(task_ids="train", key="run_id")
    metrics_str = context["task_instance"].xcom_pull(task_ids="evaluate", key="metrics")
    
    if metrics_str:
        new_metrics = json.loads(metrics_str)
    else:
        new_metrics = context["task_instance"].xcom_pull(task_ids="train", key="metrics")
        if isinstance(new_metrics, str):
            new_metrics = json.loads(new_metrics)
    
    # Compare with production model (mock)
    production_map50 = 0.70
    
    new_map50 = new_metrics.get("map50", 0)
    
    logger.info(f"Comparing: new={new_map50:.3f} vs production={production_map50:.3f}")
    
    if new_map50 > production_map50 * 1.01:  # 1% improvement threshold
        logger.info(f"Deploying new model (improvement: {(new_map50 - production_map50):.3f})")
        context["task_instance"].xcom_push(key="deployed", value=True)
        return True
    else:
        logger.info("New model not deployed — insufficient improvement")
        context["task_instance"].xcom_push(key="deployed", value=False)
        return False


def notify_completion(**context):
    """
    Step 8: Send notification with results.
    """
    run_id = context["task_instance"].xcom_pull(task_ids="train", key="run_id")
    deployed = context["task_instance"].xcom_pull(task_ids="compare_deploy", key="deployed")
    
    status = "DEPLOYED" if deployed else "NOT DEPLOYED"
    
    logger.info(f"Training pipeline complete: {run_id} [{status}]")
    
    # In production: send email/webhook notification
    
    return {
        "run_id": run_id,
        "deployed": deployed,
        "status": status,
    }


# Import random for mock data
import random

# Define DAG tasks
t1 = PythonOperator(
    task_id="collect_data",
    python_callable=collect_training_data,
    dag=dag,
)

t2 = PythonOperator(
    task_id="validate_data",
    python_callable=validate_data_quality,
    dag=dag,
)

t3 = PythonOperator(
    task_id="train",
    python_callable=train_model,
    dag=dag,
)

t4 = PythonOperator(
    task_id="evaluate",
    python_callable=evaluate_model,
    dag=dag,
)

t5 = PythonOperator(
    task_id="compare_deploy",
    python_callable=compare_and_deploy,
    dag=dag,
)

t6 = PythonOperator(
    task_id="notify",
    python_callable=notify_completion,
    dag=dag,
)

# Define execution order
t1 >> t2 >> t3 >> t4 >> t5 >> t6
