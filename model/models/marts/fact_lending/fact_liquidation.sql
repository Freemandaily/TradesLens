{{
    config(
        materialized='incremental',
        unique_key='id',
        tags=['lending', 'liquidation', 'mart'],
        incremental_strategy='merge'
    )
}}

with all_liquidation as (
    select * from {{ ref('int_liquidation') }}
    {% if is_incremental() %}
        where timestamp > (
            select max(timestamp)  - 7200 from {{this}}
        )
    {% endif %}
)

select * from all_liquidation