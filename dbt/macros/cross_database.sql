{% macro stable_hash(expression) -%}
    md5(cast({{ expression }} as {{ dbt.type_string() }}))
{%- endmacro %}

