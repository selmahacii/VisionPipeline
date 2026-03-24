# VisionPipeline 

## System Overview

```mermaid
graph TD
    subgraph "External Sources"
        A1[Webcam]
        A2[RTSP Stream]
        A3[Video Files]
        A4[Kafka Topics]
    end

    subgraph "Vision Core"
        B[Bronze Layer: Data Ingestion]
        C[Silver Layer: YOLOv8 + DeepSORT]
        D[Gold Layer: Aggregated Metrics]
    end

    subgraph "MLOps Infrastructure"
        E[MLflow Model Registry]
        F[Airflow Automation]
        G[Evidently Monitoring]
    end

    subgraph "Visualization"
        H[Next.js Dashboard]
        I[Real-time WebSocket]
        J[Grafana / Prometheus]
    end

    A1 & A2 & A3 & A4 --> B
    B --> C
    C --> D
    
    E -.-> C
    G -.-> D
    D -.-> F
    F -.-> E

    C --> I
    I --> H
    D --> J
```

---

##  Data Engineering Pipeline (Medallion Architecture)

```mermaid
flowchart LR
    subgraph Bronze [Bronze Layer - RAW]
        direction TB
        B1[Raw Byte Streams]
        B2[Ingestion Timestamps]
        B3[Source Manifests]
    end

    subgraph Silver [Silver Layer - CLEANED]
        direction TB
        S1[YOLOv8 Objects]
        S2[DeepSORT Tracks]
        S3[Confidence Filtering]
    end

    subgraph Gold [Gold Layer - AGGREGATED]
        direction TB
        G1[Minute-by-minute KPIs]
        G2[PSI Drift Diagnostics]
        G3[Class Distribution]
    end

    Bronze -->|Validation| Silver
    Silver -->|Aggregation| Gold
```

---

##  Drift Detection & Model Lifecycle

```mermaid
sequenceDiagram
    participant S as Silver Frame
    participant P as PSI Engine
    participant G as Gold Registry
    participant A as Airflow Worker

    S->>P: Stream Confidence Distribution
    Note over P: PSI = Σ (act - exp) * ln(act/exp)
    P->>G: Update Drift Score
    
    alt PSI > 0.4 (Critical)
        G->>A: Trigger Retraining DAG
        A->>G: Deploy New Version
    else PSI < 0.2 (Healthy)
        G->>G: Maintain Current Model
    end
```

---

##  Real-time Execution Flow

```mermaid
flowchart TD
    subgraph "Server Side"
        P[Vision Processor] -->|Broadcast Silver| WS[WebSocket Server]
        P -->|Compute Gold| DB[(TimescaleDB)]
    end

    subgraph "Client Side"
        WS -->|Detections| L[Live Stream Canvas]
        DB -->|Metrics| C[Analytics Charts]
        WS -->|Alerts| T[Toast Notifications]
    end
```

---

##  Repository Structure

```mermaid
mindmap
  root((VisionPipeline))
    src
      app :: Dashboard & API
      lib
        cv :: YOLOv8 Wrappers
        pipeline :: Medallion Engine
        mlops :: Drift Control
    mini-services
      cv-service :: WebSocket Bridge
      dags :: Airflow Workflows
      cv_models :: Core AI Models
    monitoring
      prometheus :: Metrics Scraper
      grafana :: Visual Dashboards
    prisma
      schema :: DB Architecture
```

---

##  Quick Start

```bash
# 1. Install dependencies
make install

# 2. Start full stack (Docker)
docker-compose up --build -d

# 3. Access Dashboard
open http://localhost:5173
```

---

## 🏗️ Architecture (ASCII)

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                           VisionPipeline (MLOps Core)                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ [Sources]  ──▶ [BRONZE]  ──▶ [SILVER]  ──▶ [GOLD]  ──▶ [Visuals]            │
│   RTSP/URL       Raw Frame    Detections    Metrics      Grafana            │
│                  Ingestion    Tracking      Drift PSI    Dashboard          │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                             MLOps Lifecycle                                 │
│                                                                             │
│ [Monitoring] ◀─▶ [MLflow Registry] ◀──▶ [Airflow DAG]                       │
│  Evidently         Model Versioning        Retraining Flow                  │
│  (Drift Score)                             (Audit >> Train >> Register)      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📊 Medallion Pipeline Lifecycle

- **BRONZE (Raw)**: Captures the original source-of-truth frame bytes directly from ingestion.
- **SILVER (Cleaned)**: Refines detections through YOLOv8 and correlates IDs with DeepSORT.
- **GOLD (Aggregated)**: Computes high-level KPIs and PSI drift scores for business intelligence.

---

## ⚖️ License

**Copyright © 2025 Selma Haci. All rights reserved.**

This software and its associated documentation files are the proprietary property of **Selma Haci**. 

Unauthorized copying, modification, distribution, or use of this software, via any medium, is strictly prohibited without the express written permission of the copyright holder.
