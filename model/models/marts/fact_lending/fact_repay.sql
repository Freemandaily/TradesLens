{{
    config(
        materialized='incremental',
        unique_key='id',
        tags=['lending', 'repay', 'mart'],
        incremental_strategy='merge'
    )
}}

with all_repay as (
    select * from {{ ref('int_repay') }}
    {% if is_incremental() %}
        where timestamp > (
            select max(timestamp)  - 7200 from {{this}}
        )
    {% endif %}
)

select * from all_repay