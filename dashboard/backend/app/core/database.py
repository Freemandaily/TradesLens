import os
import re
import logging
from google.cloud import bigquery
from google.auth.credentials import AnonymousCredentials
from app.core.config import settings

# Simple logging setup to see logs in Docker
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Row mapping class to mimic SQLAlchemy Row object
class BigQueryRowMapping:
    def __init__(self, data_dict):
        self._data = data_dict

    def __getitem__(self, key):
        return self._data.get(key)
        
    def keys(self):
        return self._data.keys()

class BigQueryRow:
    def __init__(self, row_dict):
        self.__dict__['_data'] = row_dict
        self.__dict__['_mapping'] = BigQueryRowMapping(row_dict)

    def __getattr__(self, name):
        if name in self._data:
            return self._data[name]
        raise AttributeError(f"'BigQueryRow' object has no attribute '{name}'")

    def __getitem__(self, index):
        # Support both integer index (like row[0]) and key-based indexing (like row["field"])
        if isinstance(index, int):
            return list(self._data.values())[index]
        return self._data.get(index)

    def __repr__(self):
        return f"BigQueryRow({self._data})"

class BigQueryResults:
    def __init__(self, rows):
        self._rows = [BigQueryRow(r) for r in rows]

    def all(self):
        return self._rows

    def first(self):
        return self._rows[0] if self._rows else None

    def fetchone(self):
        return self._rows[0] if self._rows else None

    def __iter__(self):
        return iter(self._rows)

class BigQuerySession:
    def __init__(self):
        client_options = {}
        credentials = None
        
        # Check if BIGQUERY_EMULATOR_HOST is defined in settings or env
        endpoint = settings.BIGQUERY_EMULATOR_HOST or os.getenv("BIGQUERY_EMULATOR_HOST")
        if endpoint:
            client_options["api_endpoint"] = endpoint
            credentials = AnonymousCredentials()
            logger.info(f"BigQuery Session using local emulator endpoint: {endpoint}")
        else:
            logger.info("BigQuery Session using standard GCP API client configuration")

        self.client = bigquery.Client(
            project=settings.GCP_PROJECT_ID,
            credentials=credentials,
            client_options=client_options
        )

    def execute(self, query_obj, params=None):
        # Extract the raw SQL string from SQLAlchemy text object
        if hasattr(query_obj, 'text'):
            sql = query_obj.text
        else:
            sql = str(query_obj)

        # 1. Adapt parameter syntax from SQLAlchemy :param to BigQuery @param
        sql = re.sub(r':(\w+)\b', r'@\1', sql)

        # 2. Replace Postgres double quotes around column names (like "amountUSD") to unquoted columns
        sql = re.sub(r'"(\w+)"', r'\1', sql)

        # 3. Handle Postgres specific functions:
        # - DATE_TRUNC('month', TO_TIMESTAMP("timestamp")) -> TIMESTAMP_TRUNC(swap_timestamp, MONTH)
        sql = re.sub(r"(?i)DATE_TRUNC\s*\(\s*'([^']+)'\s*,\s*TO_TIMESTAMP\s*\(\s*\"?timestamp\"?\s*\)\s*\)", r"TIMESTAMP_TRUNC(swap_timestamp, \1)", sql)
        sql = re.sub(r"(?i)TO_TIMESTAMP\s*\(\s*\"?timestamp\"?\s*\)", r"swap_timestamp", sql)
        sql = re.sub(r"(?i)EXTRACT\s*\(\s*(\w+)\s+FROM\s+TO_TIMESTAMP\s*\(\s*\"?timestamp\"?\s*\)\s*\)", r"EXTRACT(\1 FROM swap_timestamp)", sql)

        # 4. Handle Case-insensitive LIKE searches (replace expr ILIKE pattern with LOWER(expr) LIKE LOWER(pattern))
        sql = re.sub(r'(\w+)\s+ILIKE\s+(\S+)', r'LOWER(\1) LIKE LOWER(\2)', sql)

        # 5. Fully qualify table references to GCP project and dataset:
        # fct_dex_swaps -> `project.dataset.fct_dex_swaps`
        # fct_pool_swaps -> `project.dataset.fct_pool_swaps`
        for table in ['fct_dex_swaps', 'fct_pool_swaps']:
            qualified_name = f"`{settings.GCP_PROJECT_ID}.{settings.GCP_DATASET_ID}.{table}`"
            sql = re.sub(rf'\b{table}\b', qualified_name, sql)

        # 6. Resolve grouping alias differences (BigQuery does not support GROUP BY 1 in all contexts,
        # but supports standard column alias references).
        # We also replace double quoted column names.

        logger.info(f"Executing BigQuery Query:\n{sql}\nParameters: {params}")

        # Construct BigQuery Query parameters
        job_config = bigquery.QueryJobConfig()
        if params:
            query_params = []
            for k, v in params.items():
                if isinstance(v, int):
                    param_type = "INT64"
                elif isinstance(v, float):
                    param_type = "FLOAT64"
                elif isinstance(v, bool):
                    param_type = "BOOL"
                else:
                    param_type = "STRING"
                query_params.append(bigquery.ScalarQueryParameter(k, param_type, v))
            job_config.query_parameters = query_params

        try:
            query_job = self.client.query(sql, job_config=job_config)
            results = query_job.result()
            
            rows = []
            for row in results:
                rows.append(dict(row.items()))
                
            return BigQueryResults(rows)
        except Exception as e:
            logger.error(f"BigQuery execution failed: {str(e)}")
            raise e

    def close(self):
        pass

class BigQuerySessionFactory:
    def __call__(self):
        return BigQuerySession()

SessionLocal = BigQuerySessionFactory()

def get_db():
    db = BigQuerySession()
    try:
        yield db
    finally:
        db.close()
