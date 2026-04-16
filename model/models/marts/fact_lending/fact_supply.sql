{{
    config(
        materialized='incremental',
        unique_key='id',
        tags=['lending', 'supply', 'mart'],
        incremental_strategy='merge'
    )
}}

with all_supply as (
    select * from {{ ref('int_supply') }}
    {% if is_incremental() %}
        where timestamp > (
            select max(timestamp)  - 7200 from {{this}}
        )
    {% endif %}
)

select * from all_supply