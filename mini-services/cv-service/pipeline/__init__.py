"""
Pipeline Module

Data pipeline layers:
- Bronze: Raw data ingestion
- Silver: Cleaned and validated data
- Gold: Aggregated metrics and analytics
"""

from .stream_processor import StreamProcessor

__all__ = ['StreamProcessor']
