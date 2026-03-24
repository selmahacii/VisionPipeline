"""
Airflow DAG for Data Quality Monitoring

Daily checks on detection data quality:
1. Detection volume anomaly detection
2. Class distribution shift detection
3. Confidence score distribution check
4. Data freshness verification
5. Alert generation for anomalies
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
    "data_quality_check",
    default_args=default_args,
    description="Daily data quality monitoring",
    schedule_interval="0 6 * * *",  # 6AM daily
    catchup=False,
    tags=["data", "quality", "monitoring"],
)


def check_detection_volume(**context):
    """
    Check if detection volume is within expected range.
    
    Anomaly if:
    - Volume < 50% of 7-day average
    - Volume > 200% of 7-day average
    """
    import random
    
    logger.info("Checking detection volume...")
    
    # Mock: Get today's detection count
    today_count = random.randint(5000, 15000)
    
    # Mock: 7-day average
    avg_count = 10000
    
    ratio = today_count / avg_count
    
    if ratio < 0.5:
        status = "LOW_VOLUME_ALERT"
        message = f"Detection volume low: {today_count} (expected ~{avg_count})"
    elif ratio > 2.0:
        status = "HIGH_VOLUME_ALERT"
        message = f"Detection volume high: {today_count} (expected ~{avg_count})"
    else:
        status = "OK"
        message = f"Detection volume normal: {today_count}"
    
    logger.info(message)
    
    context["task_instance"].xcom_push(key="volume_status", value=status)
    context["task_instance"].xcom_push(key="volume_message", value=message)
    
    return status


def check_class_distribution(**context):
    """
    Check for class distribution shifts.
    
    Alert if any class proportion changes significantly.
    """
    import json
    
    logger.info("Checking class distribution...")
    
    # Expected distribution
    expected = {
        "person": 0.40,
        "car": 0.30,
        "truck": 0.15,
        "bicycle": 0.10,
        "motorcycle": 0.05,
    }
    
    # Mock current distribution
    import random
    current = {
        "person": 0.38 + random.random() * 0.05,
        "car": 0.28 + random.random() * 0.05,
        "truck": 0.15 + random.random() * 0.03,
        "bicycle": 0.12 + random.random() * 0.03,
        "motorcycle": 0.04 + random.random() * 0.02,
    }
    
    # Normalize
    total = sum(current.values())
    current = {k: v / total for k, v in current.items()}
    
    # Check for significant shifts
    shifts = {}
    alerts = []
    
    for cls, exp_pct in expected.items():
        cur_pct = current.get(cls, 0)
        shift = abs(cur_pct - exp_pct)
        shifts[cls] = {
            "expected": exp_pct,
            "current": cur_pct,
            "shift": shift,
        }
        
        if shift > 0.10:  # 10% threshold
            alerts.append(f"Class '{cls}' shifted by {shift:.1%}")
    
    if alerts:
        status = "DISTRIBUTION_SHIFT"
        message = "; ".join(alerts)
    else:
        status = "OK"
        message = "Class distribution stable"
    
    logger.info(message)
    
    context["task_instance"].xcom_push(key="dist_status", value=status)
    context["task_instance"].xcom_push(key="dist_shifts", value=json.dumps(shifts))
    
    return status


def check_confidence_distribution(**context):
    """
    Check confidence score distribution.
    
    Alert if:
    - Mean confidence drops significantly
    - Very high proportion of low-confidence detections
    """
    import random
    
    logger.info("Checking confidence distribution...")
    
    # Mock metrics
    mean_confidence = 0.75 + random.random() * 0.1
    low_conf_pct = random.random() * 0.1  # % below 0.5
    
    if mean_confidence < 0.6:
        status = "LOW_CONFIDENCE"
        message = f"Mean confidence low: {mean_confidence:.2f}"
    elif low_conf_pct > 0.2:
        status = "HIGH_LOW_CONFIDENCE"
        message = f"High proportion of low-confidence detections: {low_conf_pct:.1%}"
    else:
        status = "OK"
        message = f"Confidence distribution healthy (mean={mean_confidence:.2f})"
    
    logger.info(message)
    
    context["task_instance"].xcom_push(key="conf_status", value=status)
    
    return status


def check_data_freshness(**context):
    """
    Verify data is being ingested properly.
    
    Alert if:
    - No detections in last hour
    - Significant gap in detection timestamps
    """
    from datetime import datetime, timedelta
    
    logger.info("Checking data freshness...")
    
    # Mock: time since last detection
    minutes_ago = 5  # In production: query DB
    
    if minutes_ago > 60:
        status = "STALE_DATA"
        message = f"Last detection was {minutes_ago} minutes ago"
    else:
        status = "OK"
        message = f"Data fresh (last detection {minutes_ago} min ago)"
    
    logger.info(message)
    
    context["task_instance"].xcom_push(key="freshness_status", value=status)
    
    return status


def generate_quality_report(**context):
    """
    Generate comprehensive data quality report.
    """
    ti = context["task_instance"]
    
    volume_status = ti.xcom_pull(task_ids="check_volume", key="volume_status")
    dist_status = ti.xcom_pull(task_ids="check_distribution", key="dist_status")
    conf_status = ti.xcom_pull(task_ids="check_confidence", key="conf_status")
    fresh_status = ti.xcom_pull(task_ids="check_freshness", key="freshness_status")
    
    report = {
        "timestamp": datetime.now().isoformat(),
        "checks": {
            "volume": volume_status,
            "distribution": dist_status,
            "confidence": conf_status,
            "freshness": fresh_status,
        },
        "overall": "OK",
    }
    
    # Determine overall status
    statuses = [volume_status, dist_status, conf_status, fresh_status]
    if any(s != "OK" for s in statuses):
        report["overall"] = "ISSUES_DETECTED"
    
    logger.info(f"Quality report: {report}")
    
    return report


# Define DAG tasks
t1 = PythonOperator(
    task_id="check_volume",
    python_callable=check_detection_volume,
    dag=dag,
)

t2 = PythonOperator(
    task_id="check_distribution",
    python_callable=check_class_distribution,
    dag=dag,
)

t3 = PythonOperator(
    task_id="check_confidence",
    python_callable=check_confidence_distribution,
    dag=dag,
)

t4 = PythonOperator(
    task_id="check_freshness",
    python_callable=check_data_freshness,
    dag=dag,
)

t5 = PythonOperator(
    task_id="generate_report",
    python_callable=generate_quality_report,
    dag=dag,
)

# All checks in parallel, then report
[t1, t2, t3, t4] >> t5
