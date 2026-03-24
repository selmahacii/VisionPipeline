from datetime import datetime, timedelta
from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.operators.bash import BashOperator
import requests
import os

# Configuration (defaults)
API_BASE_URL = os.getenv("API_BASE_URL", "http://backend:8000/api/v1")

default_args = {
    'owner': 'SelmaHaci',
    'depends_on_past': False,
    'start_date': datetime(2025, 1, 1),
    'email_on_failure': False,
    'email_on_retry': False,
    'retries': 1,
    'retry_delay': timedelta(minutes=5),
}

def check_drift_status(**kwargs):
    """
    Check latest PSI score from the Gold layer.
    Return 0 if stable, 1 if drift detected.
    """
    try:
        # Querying latest metrics from our API
        # response = requests.get(f"{API_BASE_URL}/metrics/summary?stream_id=DEFAULT")
        # For simulation, we'll log it
        print("Checking drift PSI score...")
        return "DRIFT_STABLE"
    except Exception as e:
        print(f"Failed to check drift: {e}")
        return "ERROR"

def prepare_training_dataset(**kwargs):
    print("Extracting Silver layer detections from TimescaleDB for fine-tuning...")
    # SQL query: SELECT * FROM detection_events WHERE timestamp > NOW() - INTERVAL '7 days'
    return "dataset_v1.zip"

with DAG(
    'yolov8_retraining_automation',
    default_args=default_args,
    description='Automated CV model retraining based on PSI drift scores',
    schedule_interval=timedelta(days=7),
    catchup=False,
    tags=['mlops', 'vision', 'selma_haci'],
) as dag:

    # 1. Audit Phase
    t1 = PythonOperator(
        task_id='audit_model_drift',
        python_callable=check_drift_status,
    )

    # 2. Data Preparation
    t2 = PythonOperator(
        task_id='extract_medallion_data',
        python_callable=prepare_training_dataset,
    )

    # 3. Training Phase (Mocked)
    t3 = BashOperator(
        task_id='train_yolo_weights',
        bash_command='echo "Running: yolo task=detect mode=train model=yolov8n.pt data=data.yaml epochs=10"',
    )

    # 4. Registry & Versioning
    t4 = BashOperator(
        task_id='register_mlflow_model',
        bash_command='echo "MLflow: registering version v2.0.1 for production"',
    )

    # 5. Pipeline Refresh
    t5 = BashOperator(
        task_id='notify_active_streams',
        bash_command='echo "Reloading new weights in Vision Core..."',
    )

    # TASK DEPENDENCIES (AS REQUESTED: using >>)
    t1 >> t2 >> t3 >> t4 >> t5
