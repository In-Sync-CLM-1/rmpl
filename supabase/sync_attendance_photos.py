import psycopg2
import requests
import time

OLD_PROJECT = "xbrinligpvtfpqkkllfl"
NEW_PROJECT = "ltlvhmwrrsromwuiybwu"
NEW_URL = f"https://{NEW_PROJECT}.supabase.co"
SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0bHZobXdycnNyb213dWl5Ynd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzA3OTQ5NSwiZXhwIjoyMDg4NjU1NDk1fQ.paF1ggI8OkTCWGMZIE_qB6-c08F7QSDueLIie9yAk98"

UPLOAD_HEADERS = {
    "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
    "apikey": SERVICE_ROLE_KEY,
}

DB_CONFIG = {
    'host': f'db.{NEW_PROJECT}.supabase.co',
    'port': 5432,
    'dbname': 'postgres',
    'user': 'postgres',
    'password': r'7vN$F9#2xP&z@qL1',
    'sslmode': 'require',
    'connect_timeout': 15,
}

session = requests.Session()


def get_all_photo_paths(conn):
    cur = conn.cursor()
    cur.execute("""
        SELECT DISTINCT path FROM (
            SELECT replace(sign_in_photo_url, %s, '') as path
            FROM attendance_records WHERE sign_in_photo_url LIKE %s
            UNION
            SELECT replace(sign_out_photo_url, %s, '') as path
            FROM attendance_records WHERE sign_out_photo_url LIKE %s
        ) t WHERE path IS NOT NULL AND path != ''
    """, (
        f"https://{OLD_PROJECT}.supabase.co/storage/v1/object/public/attendance-photos/",
        f"%{OLD_PROJECT}%",
        f"https://{OLD_PROJECT}.supabase.co/storage/v1/object/public/attendance-photos/",
        f"%{OLD_PROJECT}%",
    ))
    return [r[0] for r in cur.fetchall()]


def get_existing_paths(conn):
    cur = conn.cursor()
    cur.execute("SELECT name FROM storage.objects WHERE bucket_id = 'attendance-photos'")
    return set(r[0] for r in cur.fetchall())


def download_and_upload(path, retries=3):
    old_url = f"https://{OLD_PROJECT}.supabase.co/storage/v1/object/public/attendance-photos/{path}"
    for attempt in range(retries):
        try:
            resp = session.get(old_url, timeout=30)
            if resp.status_code != 200:
                return False, f"download {resp.status_code}"

            content_type = resp.headers.get('Content-Type', 'image/jpeg')
            upload_url = f"{NEW_URL}/storage/v1/object/attendance-photos/{path}"
            upload_resp = session.post(
                upload_url,
                headers={**UPLOAD_HEADERS, "Content-Type": content_type},
                data=resp.content,
                timeout=30,
            )
            if upload_resp.status_code in (200, 201, 409):
                return True, "ok"
            return False, f"upload {upload_resp.status_code}"
        except requests.exceptions.RequestException as e:
            if attempt < retries - 1:
                time.sleep(2 * (attempt + 1))
                continue
            return False, f"error: {str(e)[:60]}"
    return False, "max retries"


def update_urls(conn):
    cur = conn.cursor()
    old_base = f"https://{OLD_PROJECT}.supabase.co"
    new_base = f"https://{NEW_PROJECT}.supabase.co"

    cur.execute("""
        UPDATE attendance_records
        SET sign_in_photo_url = replace(sign_in_photo_url, %s, %s)
        WHERE sign_in_photo_url LIKE %s
    """, (old_base, new_base, f"%{OLD_PROJECT}%"))
    sign_in_updated = cur.rowcount

    cur.execute("""
        UPDATE attendance_records
        SET sign_out_photo_url = replace(sign_out_photo_url, %s, %s)
        WHERE sign_out_photo_url LIKE %s
    """, (old_base, new_base, f"%{OLD_PROJECT}%"))
    sign_out_updated = cur.rowcount

    conn.commit()
    print(f"\nURL updates: sign_in={sign_in_updated}, sign_out={sign_out_updated}")


def main():
    conn = psycopg2.connect(**DB_CONFIG)

    all_paths = get_all_photo_paths(conn)
    print(f"Total unique photo paths in DB: {len(all_paths)}")

    existing = get_existing_paths(conn)
    print(f"Already in storage: {len(existing)}")

    missing = [p for p in all_paths if p not in existing]
    print(f"Missing from storage: {len(missing)}")

    if not missing:
        print("Nothing to sync!")
    else:
        success = 0
        fail = 0
        fail_paths = []
        for i, path in enumerate(missing, 1):
            ok, msg = download_and_upload(path)
            if ok:
                success += 1
            else:
                fail += 1
                if fail <= 20:
                    print(f"  FAIL: {path[:80]} - {msg}")
                fail_paths.append(path)
            if i % 200 == 0 or i == len(missing):
                print(f"  Progress: {i}/{len(missing)} ({success} ok, {fail} fail)", flush=True)

        print(f"\nSync complete: {success} uploaded, {fail} failed out of {len(missing)}")

    print("\nUpdating DB URLs to new project...")
    update_urls(conn)
    conn.close()


if __name__ == "__main__":
    main()
