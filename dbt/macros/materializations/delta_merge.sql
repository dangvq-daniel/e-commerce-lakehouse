{% materialization delta_merge, adapter='spark' %}
  {% set unique_key = config.require('unique_key') %}
  {% set target_relation = this.incorporate(type='table') %}
  {% set existing_relation = load_relation(this) %}
  {% set temp_relation = api.Relation.create(
      database=this.database,
      schema=this.schema,
      identifier=this.identifier ~ '__dbt_tmp',
      type='view'
  ) %}

  {% if not adapter.check_schema_exists(model.database, model.schema) %}
    {% do create_schema(model.schema) %}
  {% endif %}

  {% do adapter.drop_relation(temp_relation) %}
  {% call statement('create_temp_view') %}
    create view {{ temp_relation }} as {{ compiled_code }}
  {% endcall %}

  {% if existing_relation is none %}
    {% call statement('create_target') %}
      create table {{ target_relation }}
      like {{ temp_relation }}
      using delta
    {% endcall %}
  {% elif existing_relation.is_view %}
    {% do adapter.drop_relation(existing_relation) %}
    {% call statement('create_target') %}
      create table {{ target_relation }}
      like {{ temp_relation }}
      using delta
    {% endcall %}
  {% endif %}

  {% call statement('main') %}
    merge into {{ target_relation }} as DBT_INTERNAL_DEST
    using {{ temp_relation }} as DBT_INTERNAL_SOURCE
      on DBT_INTERNAL_SOURCE.{{ adapter.quote(unique_key) }}
       = DBT_INTERNAL_DEST.{{ adapter.quote(unique_key) }}
    when matched then update set *
    when not matched then insert *
  {% endcall %}

  {% do adapter.drop_relation(temp_relation) %}
  {{ return({'relations': [target_relation]}) }}
{% endmaterialization %}
