from airflow.decorators import dag,task
# from airflow.operators.bash import BashOperator
# airflow.providers.standard.operators.bash.BashOperator
from airflow.providers.standard.operators.bash import BashOperator
from datetime import datetime, timedelta

from sqlalchemy import text
from database import SessionLocal

# Default arguments for the DAG
default_args = {
    'owner': 'airflow',
    'depends_on_past': False,
    'email_retry': False,
    'retries': 1,
    'retry_delay': timedelta(minutes=5),
}

# Constants for dbt
DBT_PROJECT_DIR = "/opt/airflow/model"
DBT_PROFILES_DIR = "/opt/airflow/model"

# The DAG definition using TaskFlow API (@dag decorator)
@dag(
    dag_id='dbt_transformation_flow',
    default_args=default_args,
    description='A flow to run dbt transformations for TradesLens',
    schedule=timedelta(minutes=5), # Run every 6 hours
    start_date=datetime(2024, 1, 1),
    catchup=False,
    tags=['dbt', 'dex'],
)
def dbt_transformation_flow():

    dbt_deps = BashOperator(
        task_id='dbt_deps',
        bash_command=f"cd {DBT_PROJECT_DIR} && dbt deps --profiles-dir {DBT_PROFILES_DIR}"
    )

    dbt_run = BashOperator(
        task_id='dbt_run',
        bash_command=f"cd {DBT_PROJECT_DIR} && dbt run --target prod --profiles-dir {DBT_PROFILES_DIR}"
    )

    dbt_deps >> dbt_run

dbt_transformation_flow()

@dag(
    dag_id='database-flush',
    description='A flow to flush unanted data from the database',
    schedule="@daily", # Run every daily
    start_date=datetime(2024, 1, 1),
    catchup=False,
    tags=['database', 'flush'],
)
def database_flush():

    @task
    def flush_raw_swaps():
        from sqlalchemy import text
        from database import SessionLocal

        db = SessionLocal()
        try:
            query = text("""
                DELETE FROM envio_v2."Swap"
                WHERE timestamp < EXTRACT(EPOCH FROM now() - interval '7 days')
            """)
            result = db.execute(query)
            db.commit()
            print(f'Flushed {result.rowcount} rows older than 7 days from raw swaps')
        except Exception as e:
            db.rollback()
            raise e
        finally:
            db.close()
    
    @task
    def flush_raw_transactions():
        from sqlalchemy import text
        from database import SessionLocal

        db = SessionLocal()
        try:
            query = text("""
                DELETE FROM envio_v2."Transaction"
                WHERE timestamp < EXTRACT(EPOCH FROM now() - interval '7 days')
            """)
            result = db.execute(query)
            db.commit()
            print(f'Flushed {result.rowcount} rows older than 7 days from raw transactions')
        except Exception as e:
            db.rollback()
            raise e
        finally:
            db.close()
    
    
    @task
    def flush_stg_dex_swaps():
        from sqlalchemy import text
        from database import SessionLocal

        db = SessionLocal()
        try:
            query = text("""
                DELETE FROM envio_prod."stg_dex_swaps"
                WHERE timestamp < EXTRACT(EPOCH FROM now() - interval '7 days')
            """)
            result = db.execute(query)
            db.commit()
            print(f'Flushed {result.rowcount} rows older than 7 days from stg_dex_swaps')
        except Exception as e:
            db.rollback()
            raise e
        finally:
            db.close()
    
     @task
    def flush_pools_swaps():
        from sqlalchemy import text
        from database import SessionLocal

        db = SessionLocal()
        try:
            query = text("""
                DELETE FROM envio_prod."fct_pool_swaps"
                WHERE timestamp < EXTRACT(EPOCH FROM now() - interval '7 days')
            """)
            result = db.execute(query)
            db.commit()
            print(f'Flushed {result.rowcount} rows older than 7 days from fct_pool_swaps')
        except Exception as e:
            db.rollback()
            raise e
        finally:
            db.close()

    flush_raw_swaps()
    flush_modeled_swaps()

database_flush()
