from airflow.decorators import dag
# from airflow.operators.bash import BashOperator
# airflow.providers.standard.operators.bash.BashOperator
from airflow.providers.standard.operators.bash import BashOperator
from datetime import datetime, timedelta

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
INDEXERS_DIR = "/opt/airflow/Indexers"

# The DAG definition using TaskFlow API (@dag decorator)
@dag(
    dag_id='dbt_transformation_flow',
    default_args=default_args,
    description='A flow to run dbt transformations for TradesLens',
    schedule=timedelta(minutes=5), # Run every 5 minutes
    start_date=datetime(2024, 1, 1),
    catchup=False,
    tags=['dbt', 'dex'],
)
def dbt_transformation_flow():

    load_to_gcp = BashOperator(
        task_id='load_to_gcp',
        bash_command=f"python {INDEXERS_DIR}/load_to_GCP/load_prod.py"
    )

    dbt_deps = BashOperator(
        task_id='dbt_deps',
        bash_command=f"cd {DBT_PROJECT_DIR} && dbt deps --profiles-dir {DBT_PROFILES_DIR}"
    )

    dbt_run = BashOperator(
        task_id='dbt_run',
        bash_command=f"cd {DBT_PROJECT_DIR} && dbt run --target prod --profiles-dir {DBT_PROFILES_DIR}"
    )

    load_to_gcp >> dbt_deps >> dbt_run

dbt_transformation_flow()
