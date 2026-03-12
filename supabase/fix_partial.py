import psycopg2
import io

LOCAL = {'host':'localhost','port':5432,'dbname':'rmpl','user':'postgres','password':r'7vN$F9#2xP&z@qL1'}
CLOUD = {'host':'db.ltlvhmwrrsromwuiybwu.supabase.co','port':5432,'dbname':'postgres','user':'postgres','password':r'7vN$F9#2xP&z@qL1','sslmode':'require','connect_timeout':30,'keepalives':1,'keepalives_idle':30,'keepalives_interval':10,'keepalives_count':5}

NULL_STR = '\\N'

def get_cloud():
    c = psycopg2.connect(**CLOUD)
    c.autocommit = False
    cur = c.cursor()
    cur.execute("SET session_replication_role = 'replica';")
    cur.execute("SET statement_timeout = '600s';")
    c.commit()
    return c

def get_cols(conn, schema, table):
    cur = conn.cursor()
    cur.execute("""SELECT column_name FROM information_schema.columns
        WHERE table_schema=%s AND table_name=%s AND is_generated='NEVER' AND generation_expression IS NULL
        ORDER BY ordinal_position""", (schema, table))
    return [r[0] for r in cur.fetchall()]

local = psycopg2.connect(**LOCAL)

for table in ['demandcom', 'master', 'attendance_records']:
    cols = get_cols(local, 'public', table)
    cq = ', '.join(f'"{c}"' for c in cols)

    # Truncate cloud table first
    cc = get_cloud()
    cur = cc.cursor()
    cur.execute(f'TRUNCATE public."{table}" CASCADE')
    cc.commit()
    cc.close()
    print(f"Truncated {table}")

    # Export from local
    buf = io.BytesIO()
    copy_out = f'COPY (SELECT {cq} FROM public."{table}") TO STDOUT WITH (FORMAT csv, NULL \'{NULL_STR}\')'
    local.cursor().copy_expert(copy_out, buf)
    buf.seek(0)
    data = buf.read()
    lines = [l for l in data.split(b'\n') if l.strip()]
    print(f"  {table}: {len(lines)} rows to import")

    # Import in chunks of 10000
    total = 0
    copy_in = f'COPY public."{table}" ({cq}) FROM STDIN WITH (FORMAT csv, NULL \'{NULL_STR}\')'
    for i in range(0, len(lines), 10000):
        chunk = lines[i:i+10000]
        chunk_data = b'\n'.join(chunk) + b'\n'
        cc = get_cloud()
        try:
            cc.cursor().copy_expert(copy_in, io.BytesIO(chunk_data))
            cc.commit()
            total += len(chunk)
            print(f"    {total}/{len(lines)}...")
        except Exception as e:
            print(f"    ERR at {i}: {str(e).split(chr(10))[0][:100]}")
            try: cc.rollback()
            except: pass
        finally:
            try: cc.close()
            except: pass

    print(f"  {table}: {total} rows imported\n")

local.close()
print("Done!")
