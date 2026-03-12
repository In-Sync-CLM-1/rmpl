import psycopg2
from psycopg2.extras import Json
import io
import csv
import json
import sys

LOCAL_CONFIG = {
    'host': 'localhost',
    'port': 5432,
    'dbname': 'rmpl',
    'user': 'postgres',
    'password': r'7vN$F9#2xP&z@qL1'
}

CLOUD_CONFIG = {
    'host': 'db.ltlvhmwrrsromwuiybwu.supabase.co',
    'port': 5432,
    'dbname': 'postgres',
    'user': 'postgres',
    'password': r'7vN$F9#2xP&z@qL1',
    'sslmode': 'require',
    'connect_timeout': 30,
    'keepalives': 1,
    'keepalives_idle': 30,
    'keepalives_interval': 10,
    'keepalives_count': 5
}

def get_cloud_conn():
    conn = psycopg2.connect(**CLOUD_CONFIG)
    conn.autocommit = False
    cur = conn.cursor()
    cur.execute("SET session_replication_role = 'replica';")
    cur.execute("SET statement_timeout = '600s';")
    conn.commit()
    return conn

def get_tables(conn, schema):
    cur = conn.cursor()
    cur.execute("""
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = %s AND table_type = 'BASE TABLE'
        ORDER BY table_name
    """, (schema,))
    return [r[0] for r in cur.fetchall()]

def get_columns(conn, schema, table):
    cur = conn.cursor()
    cur.execute("""
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = %s AND table_name = %s
        AND is_generated = 'NEVER' AND generation_expression IS NULL
        ORDER BY ordinal_position
    """, (schema, table))
    return [r[0] for r in cur.fetchall()]

def cloud_row_count(schema, table):
    try:
        conn = get_cloud_conn()
        cur = conn.cursor()
        cur.execute(f'SELECT count(*) FROM {schema}."{table}"')
        count = cur.fetchone()[0]
        conn.close()
        return count
    except:
        return 0

def copy_table_via_copy(local_conn, schema, table, chunk_size=10000):
    """Use COPY protocol for fast bulk transfer."""
    columns = get_columns(local_conn, schema, table)
    if not columns:
        return 0

    cols_quoted = ', '.join(f'"{c}"' for c in columns)

    # Export from local using COPY TO
    local_cur = local_conn.cursor()
    buf = io.BytesIO()
    copy_sql = f'COPY (SELECT {cols_quoted} FROM {schema}."{table}") TO STDOUT WITH (FORMAT csv, HEADER false, NULL \'\\N\')'
    local_cur.copy_expert(copy_sql, buf)
    buf.seek(0)
    data = buf.read()

    if not data.strip():
        return 0

    total_lines = data.count(b'\n')

    # For small tables, do it in one shot
    if total_lines <= chunk_size:
        cloud_conn = get_cloud_conn()
        cloud_cur = cloud_conn.cursor()
        try:
            copy_in_sql = f'COPY {schema}."{table}" ({cols_quoted}) FROM STDIN WITH (FORMAT csv, HEADER false, NULL \'\\N\')'
            cloud_cur.copy_expert(copy_in_sql, io.BytesIO(data))
            cloud_conn.commit()
            cloud_conn.close()
            return total_lines
        except Exception as e:
            err = str(e).split('\n')[0][:120]
            print(f"\n  WARN COPY failed, falling back to INSERT: {err}")
            try: cloud_conn.close()
            except: pass
            # Fall through to chunked insert below

    # For large tables or COPY failures, split into chunks
    lines = data.split(b'\n')
    lines = [l for l in lines if l.strip()]  # remove empty
    total = 0

    for chunk_start in range(0, len(lines), chunk_size):
        chunk = lines[chunk_start:chunk_start + chunk_size]
        chunk_data = b'\n'.join(chunk) + b'\n'

        cloud_conn = get_cloud_conn()
        cloud_cur = cloud_conn.cursor()
        try:
            copy_in_sql = f'COPY {schema}."{table}" ({cols_quoted}) FROM STDIN WITH (FORMAT csv, HEADER false, NULL \'\\N\')'
            cloud_cur.copy_expert(copy_in_sql, io.BytesIO(chunk_data))
            cloud_conn.commit()
            total += len(chunk)
            if len(lines) > 10000:
                print(f"\r    progress: {total}/{len(lines)} rows...", end='', flush=True)
        except Exception as e:
            err = str(e).split('\n')[0][:120]
            print(f"\n  WARN chunk at {chunk_start}: {err}")
            try: cloud_conn.rollback()
            except: pass
        finally:
            try: cloud_conn.close()
            except: pass

    if len(lines) > 10000:
        print()  # newline after progress

    return total

def main():
    local_conn = psycopg2.connect(**LOCAL_CONFIG)

    # 1. Copy auth.users (exclude generated columns like confirmed_at)
    print("=== Copying auth.users ===")
    existing = cloud_row_count('auth', 'users')
    if existing > 0:
        print(f"  SKIP auth.users: already has {existing} rows")
    else:
        # Get columns that exist in both local and cloud, excluding generated
        cloud_conn_tmp = get_cloud_conn()
        local_cols = set(get_columns(local_conn, 'auth', 'users'))
        cloud_cols = set(get_columns(cloud_conn_tmp, 'auth', 'users'))
        cloud_conn_tmp.close()

        common_cols = sorted(local_cols & cloud_cols)
        # Remove confirmed_at as it's generated in cloud
        for skip_col in ['confirmed_at']:
            if skip_col in common_cols:
                common_cols.remove(skip_col)

        if common_cols:
            cols_quoted = ', '.join(f'"{c}"' for c in common_cols)
            buf = io.BytesIO()
            local_cur = local_conn.cursor()
            copy_sql = f'COPY (SELECT {cols_quoted} FROM auth.users) TO STDOUT WITH (FORMAT csv, HEADER false, NULL \'\\N\')'
            local_cur.copy_expert(copy_sql, buf)
            buf.seek(0)
            data = buf.read()

            if data.strip():
                cloud_conn = get_cloud_conn()
                cloud_cur = cloud_conn.cursor()
                try:
                    copy_in = f'COPY auth.users ({cols_quoted}) FROM STDIN WITH (FORMAT csv, HEADER false, NULL \'\\N\')'
                    cloud_cur.copy_expert(copy_in, io.BytesIO(data))
                    cloud_conn.commit()
                    count = data.count(b'\n')
                    print(f"  auth.users: {count} rows")
                except Exception as e:
                    print(f"  ERR auth.users: {str(e).split(chr(10))[0][:120]}")
                    try: cloud_conn.rollback()
                    except: pass
                finally:
                    try: cloud_conn.close()
                    except: pass

    # 2. Copy public tables
    print("\n=== Copying public tables ===")
    priority = ['profiles', 'user_roles', 'teams', 'designations', 'pipeline_stages',
                 'role_metadata', 'email_templates', 'company_holidays', 'navigation_sections',
                 'navigation_items', 'point_activity_types', 'onboarding_forms', 'onboarding_steps',
                 'onboarding_tours', 'call_dispositions', 'webhook_connectors',
                 'demandcom', 'clients', 'projects', 'vendors', 'master']

    all_local = get_tables(local_conn, 'public')
    cloud_conn_tmp = get_cloud_conn()
    all_cloud = get_tables(cloud_conn_tmp, 'public')
    cloud_conn_tmp.close()

    ordered = []
    remaining = list(all_local)
    for p in priority:
        if p in remaining:
            ordered.append(p)
            remaining.remove(p)
    ordered.extend(sorted(remaining))

    success = 0
    skip = 0
    fail = 0

    for table in ordered:
        if table not in all_cloud:
            skip += 1
            continue

        existing = cloud_row_count('public', table)
        if existing > 0:
            print(f"  SKIP {table}: already has {existing} rows")
            success += 1
            continue

        local_cur = local_conn.cursor()
        local_cur.execute(f'SELECT count(*) FROM public."{table}"')
        local_count = local_cur.fetchone()[0]

        if local_count == 0:
            skip += 1
            continue

        print(f"  ... {table} ({local_count} rows)", end='', flush=True)
        try:
            count = copy_table_via_copy(local_conn, 'public', table)
            print(f"\r  OK   {table}: {count}/{local_count} rows")
            success += 1
        except Exception as e:
            print(f"\r  ERR  {table}: {str(e)[:100]}")
            fail += 1

    print(f"\n{'='*50}")
    print(f"CLOUD IMPORT COMPLETE")
    print(f"  Imported: {success}")
    print(f"  Skipped: {skip}")
    print(f"  Failed: {fail}")
    print(f"{'='*50}")

    local_conn.close()

if __name__ == '__main__':
    main()
