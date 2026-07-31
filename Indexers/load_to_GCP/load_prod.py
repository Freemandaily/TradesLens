
import os
import sys
import logging
from google.cloud import bigquery
from google.api_core.exceptions import Conflict
from pyspark.sql import SparkSession

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    stream=sys.stdout
)
logger = logging.getLogger("postgres_to_gcs_bq_prod")

# Set worker python path to match driver python version
os.environ["PYSPARK_PYTHON"] = sys.executable
os.environ["PYSPARK_DRIVER_PYTHON"] = sys.executable

def get_required_env(var_name):
    """Retrieve environment variable or fail-safe if not set."""
    val = os.getenv(var_name)
    if not val:
        logger.error(f"CRITICAL: Missing required environment variable: {var_name}")
        sys.exit(1)
    return val

# --- Production Configuration ---
# GCP Settings
PROJECT_ID = get_required_env("PROD_GCP_PROJECT_ID")
DATASET_ID = get_required_env("PROD_GCP_DATASET_ID")
GCS_BUCKET = get_required_env("PROD_GCS_BUCKET")

# Database Connection Details
PG_HOST = os.getenv("PROD_PG_HOST", "localhost")
PG_PORT = os.getenv("PROD_PG_PORT", "5432")
PG_USER = get_required_env("PROD_PG_USER")
PG_PASSWORD = get_required_env("PROD_PG_PASSWORD")
PG_DATABASE = get_required_env("PROD_PG_DATABASE")
PG_SCHEMA = os.getenv("PROD_PG_PUBLIC_SCHEMA", "public")

DB_URL = f"jdbc:postgresql://{PG_HOST}:{PG_PORT}/{PG_DATABASE}"
DB_PROPERTIES = {
    "user": PG_USER,
    "password": PG_PASSWORD,
    "driver": "org.postgresql.Driver"
}

# TODO(security): Ensure schema/table names are strictly verified if dynamically configured.
# Here they are defined as static developer configuration.
TABLE_CONFIGS = [
    {
        "name": "Token",
        "base_query": f'SELECT id, symbol, name, CAST(decimals AS INTEGER) AS decimals, "isMetadataFetched", "isWhitelisted", CAST(volume AS NUMERIC) AS volume, CAST("volumeUSD" AS NUMERIC) AS "volumeUSD", CAST("untrackedVolumeUSD" AS NUMERIC) AS "untrackedVolumeUSD", CAST("feesUSD" AS NUMERIC) AS "feesUSD", CAST("txCount" AS BIGINT) AS "txCount", CAST("poolCount" AS BIGINT) AS "poolCount", CAST("totalValueLocked" AS NUMERIC) AS "totalValueLocked", CAST("totalValueLockedUSD" AS NUMERIC) AS "totalValueLockedUSD", CAST("totalValueLockedUSDUntracked" AS NUMERIC) AS "totalValueLockedUSDUntracked", CAST("derivedETH" AS NUMERIC) AS "derivedETH", "whitelistPools" FROM "{PG_SCHEMA}"."Token"',
        "schema": [
            bigquery.SchemaField("id", "STRING"),
            bigquery.SchemaField("symbol", "STRING"),
            bigquery.SchemaField("name", "STRING"),
            bigquery.SchemaField("decimals", "INTEGER"),
            bigquery.SchemaField("isMetadataFetched", "BOOLEAN"),
            bigquery.SchemaField("isWhitelisted", "BOOLEAN"),
            bigquery.SchemaField("volume", "NUMERIC"),
            bigquery.SchemaField("volumeUSD", "NUMERIC"),
            bigquery.SchemaField("untrackedVolumeUSD", "NUMERIC"),
            bigquery.SchemaField("feesUSD", "NUMERIC"),
            bigquery.SchemaField("txCount", "INTEGER"),
            bigquery.SchemaField("poolCount", "INTEGER"),
            bigquery.SchemaField("totalValueLocked", "NUMERIC"),
            bigquery.SchemaField("totalValueLockedUSD", "NUMERIC"),
            bigquery.SchemaField("totalValueLockedUSDUntracked", "NUMERIC"),
            bigquery.SchemaField("derivedETH", "NUMERIC"),
            bigquery.SchemaField("whitelistPools", "STRING", mode="REPEATED"),
        ],
        "watermark_col": None,
        "write_disposition": bigquery.WriteDisposition.WRITE_TRUNCATE
    },
    {
        "name": "Pool",
        "base_query": f'SELECT id, dex, CAST("createdAtTimestamp" AS BIGINT) AS "createdAtTimestamp", CAST("createdAtBlockNumber" AS BIGINT) AS "createdAtBlockNumber", "token0_id", "token1_id", CAST("feeTier" AS BIGINT) AS "feeTier", CAST(liquidity AS NUMERIC(38, 0)) AS liquidity, CAST("sqrtPrice" AS NUMERIC(38, 0)) AS "sqrtPrice", CAST("token0Price" AS NUMERIC) AS "token0Price", CAST("token1Price" AS NUMERIC) AS "token1Price", CAST(tick AS BIGINT) AS tick, CAST("observationIndex" AS BIGINT) AS "observationIndex", CAST("volumeToken0" AS NUMERIC) AS "volumeToken0", CAST("volumeToken1" AS NUMERIC) AS "volumeToken1", CAST("volumeUSD" AS NUMERIC) AS "volumeUSD", CAST("untrackedVolumeUSD" AS NUMERIC) AS "untrackedVolumeUSD", CAST("feesUSD" AS NUMERIC) AS "feesUSD", CAST("txCount" AS BIGINT) AS "txCount", CAST("collectedFeesToken0" AS NUMERIC) AS "collectedFeesToken0", CAST("collectedFeesToken1" AS NUMERIC) AS "collectedFeesToken1", CAST("collectedFeesUSD" AS NUMERIC) AS "collectedFeesUSD", CAST("totalValueLockedToken0" AS NUMERIC) AS "totalValueLockedToken0", CAST("totalValueLockedToken1" AS NUMERIC) AS "totalValueLockedToken1", CAST("totalValueLockedETH" AS NUMERIC) AS "totalValueLockedETH", CAST("totalValueLockedUSD" AS NUMERIC) AS "totalValueLockedUSD", CAST("totalValueLockedUSDUntracked" AS NUMERIC) AS "totalValueLockedUSDUntracked", CAST("liquidityProviderCount" AS BIGINT) AS "liquidityProviderCount" FROM "{PG_SCHEMA}"."Pool"',
        "schema": [
            bigquery.SchemaField("id", "STRING"),
            bigquery.SchemaField("dex", "STRING"),
            bigquery.SchemaField("createdAtTimestamp", "INTEGER"),
            bigquery.SchemaField("createdAtBlockNumber", "INTEGER"),
            bigquery.SchemaField("token0_id", "STRING"),
            bigquery.SchemaField("token1_id", "STRING"),
            bigquery.SchemaField("feeTier", "INTEGER"),
            bigquery.SchemaField("liquidity", "NUMERIC"),
            bigquery.SchemaField("sqrtPrice", "NUMERIC"),
            bigquery.SchemaField("token0Price", "NUMERIC"),
            bigquery.SchemaField("token1Price", "NUMERIC"),
            bigquery.SchemaField("tick", "INTEGER"),
            bigquery.SchemaField("observationIndex", "INTEGER"),
            bigquery.SchemaField("volumeToken0", "NUMERIC"),
            bigquery.SchemaField("volumeToken1", "NUMERIC"),
            bigquery.SchemaField("volumeUSD", "NUMERIC"),
            bigquery.SchemaField("untrackedVolumeUSD", "NUMERIC"),
            bigquery.SchemaField("feesUSD", "NUMERIC"),
            bigquery.SchemaField("txCount", "INTEGER"),
            bigquery.SchemaField("collectedFeesToken0", "NUMERIC"),
            bigquery.SchemaField("collectedFeesToken1", "NUMERIC"),
            bigquery.SchemaField("collectedFeesUSD", "NUMERIC"),
            bigquery.SchemaField("totalValueLockedToken0", "NUMERIC"),
            bigquery.SchemaField("totalValueLockedToken1", "NUMERIC"),
            bigquery.SchemaField("totalValueLockedETH", "NUMERIC"),
            bigquery.SchemaField("totalValueLockedUSD", "NUMERIC"),
            bigquery.SchemaField("totalValueLockedUSDUntracked", "NUMERIC"),
            bigquery.SchemaField("liquidityProviderCount", "INTEGER"),
        ],
        "watermark_col": None,
        "write_disposition": bigquery.WriteDisposition.WRITE_TRUNCATE
    },
    {
        "name": "Transaction",
        "base_query": f'SELECT id, CAST("blockNumber" AS BIGINT) AS "blockNumber", CAST(timestamp AS BIGINT) AS timestamp, CAST("gasUsed" AS BIGINT) AS "gasUsed", CAST("gasPrice" AS BIGINT) AS "gasPrice", "from" AS from_address, "to" AS to_address FROM "{PG_SCHEMA}"."Transaction"',
        "schema": [
            bigquery.SchemaField("id", "STRING"),
            bigquery.SchemaField("blockNumber", "INTEGER"),
            bigquery.SchemaField("timestamp", "INTEGER"),
            bigquery.SchemaField("gasUsed", "INTEGER"),
            bigquery.SchemaField("gasPrice", "INTEGER"),
            bigquery.SchemaField("from_address", "STRING"),
            bigquery.SchemaField("to_address", "STRING"),
        ],
        "watermark_col": "blockNumber",
        "write_disposition": bigquery.WriteDisposition.WRITE_APPEND
    },
    {
        "name": "Swap",
        "base_query": f'SELECT id, dex, "transaction_id", CAST(timestamp AS BIGINT) AS timestamp, "pool_id", "token0_id", "token1_id", sender, recipient, origin, "txFrom" AS txFrom, "txTo" AS txTo, CAST(amount0 AS NUMERIC) AS amount0, CAST(amount1 AS NUMERIC) AS amount1, CAST("amountUSD" AS NUMERIC) AS "amountUSD", CAST("sqrtPriceX96" AS NUMERIC(38, 0)) AS "sqrtPriceX96", CAST(tick AS BIGINT) AS tick, CAST("logIndex" AS BIGINT) AS "logIndex", CAST("gasPrice" AS BIGINT) AS "gasPrice", CAST("gasUsed" AS BIGINT) AS "gasUsed" FROM "{PG_SCHEMA}"."Swap"',
        "schema": [
            bigquery.SchemaField("id", "STRING"),
            bigquery.SchemaField("dex", "STRING"),
            bigquery.SchemaField("transaction_id", "STRING"),
            bigquery.SchemaField("timestamp", "INTEGER"),
            bigquery.SchemaField("pool_id", "STRING"),
            bigquery.SchemaField("token0_id", "STRING"),
            bigquery.SchemaField("token1_id", "STRING"),
            bigquery.SchemaField("sender", "STRING"),
            bigquery.SchemaField("recipient", "STRING"),
            bigquery.SchemaField("origin", "STRING"),
            bigquery.SchemaField("txFrom", "STRING"),
            bigquery.SchemaField("txTo", "STRING"),
            bigquery.SchemaField("amount0", "NUMERIC"),
            bigquery.SchemaField("amount1", "NUMERIC"),
            bigquery.SchemaField("amountUSD", "NUMERIC"),
            bigquery.SchemaField("sqrtPriceX96", "NUMERIC"),
            bigquery.SchemaField("tick", "INTEGER"),
            bigquery.SchemaField("logIndex", "INTEGER"),
            bigquery.SchemaField("gasPrice", "INTEGER"),
            bigquery.SchemaField("gasUsed", "INTEGER"),
        ],
        "watermark_col": "timestamp",
        "write_disposition": bigquery.WriteDisposition.WRITE_APPEND
    }
]

def get_last_processed_watermark(bq_client, full_table_id, watermark_col):
    """Query BigQuery to find the maximum watermark processed."""
    try:
        query = f"SELECT MAX({watermark_col}) as max_watermark FROM `{full_table_id}`"
        query_job = bq_client.query(query)
        results = list(query_job.result())
        if results and results[0]["max_watermark"] is not None:
            return float(results[0]["max_watermark"])
    except Exception as e:
        logger.warning(f"Failed to query watermark via standard query, checking if table exists: {e}")
    return 0

def write_to_bigquery(bq_client, full_table_id, gcs_path, schema, write_disposition):
    """Ensure dataset/table exist in production BigQuery and load Parquet data from GCS."""
    logger.info(f"Preparing BigQuery Dataset and Table for {full_table_id}...")
    full_dataset_id = ".".join(full_table_id.split(".")[:2])
    dataset = bigquery.Dataset(full_dataset_id)
    # Production datasets should specify the exact location/region (e.g. US or EU)
    dataset.location = "US" 
    
    try:
        bq_client.create_dataset(dataset)
        logger.info(f"Created dataset {DATASET_ID}")
    except Conflict:
        pass

    table = bigquery.Table(full_table_id, schema=schema)
    try:
        bq_client.get_table(full_table_id)
    except Exception:
        bq_client.create_table(table)
        logger.info(f"Table successfully created!")

    logger.info("Loading Parquet data from GCS into BigQuery...")
    # Load using Native Parquet Load Job from GCS
    job_config = bigquery.LoadJobConfig(
        source_format=bigquery.SourceFormat.PARQUET,
        write_disposition=write_disposition
    )
    gcs_uri = f"{gcs_path}/*.parquet"
    load_job = bq_client.load_table_from_uri(gcs_uri, full_table_id, job_config=job_config)
    
    # Wait for the load job to complete. Fail if there is any error.
    load_job.result()
    logger.info("GCS to BigQuery Load Job completed successfully!")

def run_pipeline():
    # Initialize BigQuery Client using production ADC credentials
    bq_client = bigquery.Client()

    logger.info("Initializing PySpark Session...")
    # Configure Spark Session for single VM local execution using VM Service Account for GCS auth
    spark = SparkSession.builder \
        .appName("PostgresToGCSProd") \
        .config("spark.jars.packages", "org.postgresql:postgresql:42.7.4,com.google.cloud.bigdataoss:gcs-connector:hadoop3-2.2.22") \
        .config("spark.driver.host", "127.0.0.1") \
        .config("spark.driver.bindAddress", "127.0.0.1") \
        .config("spark.hadoop.fs.gs.impl", "com.google.cloud.hadoop.fs.gcs.GoogleHadoopFileSystem") \
        .config("spark.hadoop.fs.AbstractFileSystem.gs.impl", "com.google.cloud.hadoop.fs.gcs.GoogleHadoopFS") \
        .config("spark.hadoop.fs.gs.auth.service.account.enable", "true") \
        .getOrCreate()

    for config in TABLE_CONFIGS:
        table_name = config["name"]
        full_table_id = f"{PROJECT_ID}.{DATASET_ID}.{table_name}"
        gcs_path = f"gs://{GCS_BUCKET}/{table_name.lower()}"
        watermark_col = config["watermark_col"]

        logger.info(f" Processing Table: {table_name} ")

        if watermark_col:
            last_watermark = get_last_processed_watermark(bq_client, full_table_id, watermark_col)
            logger.info(f"Last processed watermark for {table_name}: {last_watermark}")
            delta_query = f'({config["base_query"]} WHERE "{watermark_col}" > {last_watermark}) t'
        else:
            logger.info(f"No watermark for {table_name}. Doing full refresh.")
            delta_query = f'({config["base_query"]}) t'

        logger.info(f"Reading data from Postgres for {table_name}...")
        try:
            df = spark.read.jdbc(
                url=DB_URL,
                table=delta_query,
                properties=DB_PROPERTIES
            )
            row_count = df.count()
            logger.info(f"Loaded {row_count} rows for {table_name}.")
            
            if row_count > 0:
                logger.info(f"Writing {table_name} data to GCS bucket: {gcs_path}...")
                mode = "overwrite" if config["write_disposition"] == bigquery.WriteDisposition.WRITE_TRUNCATE else "append"
                df.write.mode(mode).parquet(gcs_path)

                # Ingest to BigQuery
                write_to_bigquery(bq_client, full_table_id, gcs_path, config["schema"], config["write_disposition"])
            else:
                logger.info(f"No new data found for {table_name}.")
        except Exception as e:
            logger.error(f"CRITICAL: Failed to process table {table_name}: {e}")
            raise e

    spark.stop()
    logger.info("Pipeline processing completed successfully for all tables.")

if __name__ == "__main__":
    run_pipeline()
