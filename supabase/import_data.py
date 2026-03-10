import csv
import os
import sys
import json
import re
import psycopg2
from psycopg2.extras import execute_values, Json
from collections import defaultdict

# Increase CSV field size limit for large fields
csv.field_size_limit(10 * 1024 * 1024)  # 10MB

DB_CONFIG = {
    'host': 'localhost',
    'port': 5432,
    'dbname': 'rmpl',
    'user': 'postgres',
    'password': '7vN$F9#2xP&z@qL1'
}

DATA_DIR = r'C:\Users\admin\Downloads\rmpl-data'

def get_column_types(conn, schema, table):
    """Get column types for a table."""
    cur = conn.cursor()
    cur.execute("""
        SELECT column_name, data_type, udt_name
        FROM information_schema.columns
        WHERE table_schema = %s AND table_name = %s
        ORDER BY ordinal_position
    """, (schema, table))
    return {row[0]: (row[1], row[2]) for row in cur.fetchall()}

def convert_value(val, data_type, udt_name):
    """Convert CSV string value to proper Python type for PostgreSQL."""
    if val is None or val == '':
        return None

    # Handle array types (CSV exports as JSON arrays)
    if udt_name.startswith('_') or data_type == 'ARRAY':
        if val.startswith('['):
            try:
                parsed = json.loads(val)
                if isinstance(parsed, list):
                    return parsed
            except (json.JSONDecodeError, ValueError):
                pass
        if val.startswith('{'):
            return val  # Already PostgreSQL array format
        return None

    # Handle JSON/JSONB — wrap in psycopg2 Json adapter
    if udt_name in ('json', 'jsonb'):
        if val == '':
            return None
        try:
            parsed = json.loads(val) if isinstance(val, str) else val
            return Json(parsed)
        except (json.JSONDecodeError, ValueError):
            return Json(val)

    # Handle boolean
    if udt_name == 'bool':
        if val.lower() in ('true', 't', '1', 'yes'):
            return True
        if val.lower() in ('false', 'f', '0', 'no'):
            return False
        return None

    # For all other types, return the string and let psycopg2 handle conversion
    return val

def import_csv(conn, schema, table, filepath, is_first_part=True):
    """Import a CSV file into a table. If is_first_part, truncate the table first."""
    col_types = get_column_types(conn, schema, table)
    if not col_types:
        print(f"  SKIP - table {schema}.{table} not found or has no columns")
        return 0

    # Truncate table before importing first part (fresh data)
    if is_first_part:
        cur = conn.cursor()
        cur.execute(f'TRUNCATE {schema}."{table}" CASCADE')
        conn.commit()

    with open(filepath, 'r', encoding='utf-8-sig', errors='replace') as f:
        reader = csv.DictReader(f)
        csv_columns = reader.fieldnames
        if not csv_columns:
            print(f"  SKIP - no headers in CSV")
            return 0

        # Only use columns that exist in both CSV and table
        valid_columns = [c for c in csv_columns if c in col_types]
        if not valid_columns:
            print(f"  SKIP - no matching columns between CSV and table")
            return 0

        rows = []
        for row in reader:
            converted = []
            for col in valid_columns:
                data_type, udt_name = col_types[col]
                val = row.get(col, '')
                converted.append(convert_value(val, data_type, udt_name))
            rows.append(tuple(converted))

    if not rows:
        print(f"  SKIP - no data rows")
        return 0

    cur = conn.cursor()
    cols_quoted = ', '.join(f'"{c}"' for c in valid_columns)
    placeholders = ', '.join(['%s'] * len(valid_columns))

    # Use batch insert with ON CONFLICT DO NOTHING
    insert_sql = f'INSERT INTO {schema}."{table}" ({cols_quoted}) VALUES ({placeholders}) ON CONFLICT DO NOTHING'

    batch_size = 500
    total = 0
    for i in range(0, len(rows), batch_size):
        batch = rows[i:i+batch_size]
        for row in batch:
            try:
                cur.execute(insert_sql, row)
                total += cur.rowcount
            except Exception as e:
                conn.rollback()
                # Re-set replica mode after rollback
                cur = conn.cursor()
                cur.execute("SET session_replication_role = 'replica';")
                conn.commit()
                cur = conn.cursor()
                err_str = str(e).split('\n')[0]
                if 'duplicate key' not in err_str:
                    print(f"  WARN row {i}: {err_str[:120]}")
                continue
        conn.commit()

    return total

def parse_filename(filename):
    """Parse CSV filename to extract table name and part number.
    Formats:
      tablename_YYYYMMDD_HHMMSS.csv
      tablename_YYYYMMDD_HHMMSS_partN.csv
    """
    # Try with part suffix first
    match = re.match(r'^(.+?)_\d{8}_\d{6}_part(\d+)\.csv$', filename)
    if match:
        return match.group(1), int(match.group(2))

    # Without part suffix
    match = re.match(r'^(.+?)_\d{8}_\d{6}\.csv$', filename)
    if match:
        return match.group(1), 1

    return None, None

def main():
    conn = psycopg2.connect(**DB_CONFIG)
    conn.autocommit = False

    # Disable FK checks and triggers
    cur = conn.cursor()
    cur.execute("SET session_replication_role = 'replica';")
    conn.commit()

    # Get all CSV files
    csv_files = sorted([f for f in os.listdir(DATA_DIR) if f.endswith('.csv')])

    # Group files by table name, tracking parts
    table_files = defaultdict(list)
    for f in csv_files:
        table_name, part_num = parse_filename(f)
        if table_name:
            table_files[table_name].append((part_num, f))

    # Sort parts within each table
    for table_name in table_files:
        table_files[table_name].sort(key=lambda x: x[0])

    # Priority order for import
    priority_order = ['auth_users', 'profiles', 'user_roles', 'teams', 'designations',
                       'pipeline_stages', 'demandcom', 'clients', 'projects']

    ordered_tables = []
    remaining_tables = list(table_files.keys())

    for priority_table in priority_order:
        if priority_table in remaining_tables:
            ordered_tables.append(priority_table)
            remaining_tables.remove(priority_table)

    ordered_tables.extend(sorted(remaining_tables))

    success = 0
    fail = 0
    skip = 0

    for table_name in ordered_tables:
        parts = table_files[table_name]

        # Determine schema
        if table_name == 'auth_users':
            schema = 'auth'
            db_table = 'users'
        else:
            schema = 'public'
            db_table = table_name

        total_rows = 0
        table_ok = True

        for idx, (part_num, filename) in enumerate(parts):
            filepath = os.path.join(DATA_DIR, filename)
            filesize = os.path.getsize(filepath)

            if filesize == 0:
                continue

            is_first_part = (idx == 0)
            part_label = f" (part {part_num})" if len(parts) > 1 else ""

            try:
                count = import_csv(conn, schema, db_table, filepath, is_first_part=is_first_part)
                total_rows += count
                if count > 0:
                    print(f"  OK  {schema}.{db_table}{part_label}: {count} rows")
            except Exception as e:
                print(f"  ERR {schema}.{db_table}{part_label}: {str(e)[:150]}")
                conn.rollback()
                # Re-set replica mode after rollback
                cur = conn.cursor()
                cur.execute("SET session_replication_role = 'replica';")
                conn.commit()
                table_ok = False
                break

        if not table_ok:
            fail += 1
        elif total_rows > 0:
            if len(parts) > 1:
                print(f"  TOTAL {schema}.{db_table}: {total_rows} rows ({len(parts)} parts)")
            success += 1
        else:
            # Check if files had data
            has_data = False
            for _, filename in parts:
                filepath = os.path.join(DATA_DIR, filename)
                with open(filepath, encoding='utf-8-sig', errors='replace') as f:
                    lines = sum(1 for _ in f) - 1
                if lines > 0:
                    has_data = True
                    break
            if has_data:
                print(f"  DUP {schema}.{db_table}: all rows duplicates/skipped")
                success += 1
            else:
                skip += 1

    # Re-enable FK checks and triggers
    cur = conn.cursor()
    cur.execute("SET session_replication_role = 'origin';")
    conn.commit()

    print(f"\n{'='*50}")
    print(f"IMPORT COMPLETE")
    print(f"  Imported: {success}")
    print(f"  Skipped (empty): {skip}")
    print(f"  Failed: {fail}")
    print(f"{'='*50}")

    conn.close()

if __name__ == '__main__':
    main()
