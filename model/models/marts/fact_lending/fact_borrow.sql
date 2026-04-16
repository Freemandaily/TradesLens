{{
    config(
        materialized='incremental',
        unique_key='id',
        tags=['lending', 'borrow', 'mart'],
        incremental_strategy='merge'
    )
}}

with all_borrow as (
    select * from {{ ref('int_borrow') }}
    {% if is_incremental() %}
        where timestamp > (
            select max(timestamp)  - 7200 from {{this}}
        )
    {% endif %}
)

select * from all_borrow