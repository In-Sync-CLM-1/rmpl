import os
import requests
import psycopg2
import time
import re

NEW_PROJECT = "ltlvhmwrrsromwuiybwu"
OLD_PROJECT = "xbrinligpvtfpqkkllfl"
SUPABASE_URL = f"https://{NEW_PROJECT}.supabase.co"
SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0bHZobXdycnNyb213dWl5Ynd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzA3OTQ5NSwiZXhwIjoyMDg4NjU1NDk1fQ.paF1ggI8OkTCWGMZIE_qB6-c08F7QSDueLIie9yAk98"

HEADERS = {
    "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
    "apikey": SERVICE_ROLE_KEY,
}

BASE_DIR = "C:/Users/admin/Downloads/attendance-photos"

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

# UUID pattern to find start of storage path
UUID_RE = re.compile(r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}')


def get_existing_paths():
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    cur.execute("SELECT name FROM storage.objects WHERE bucket_id = 'attendance-photos'")
    paths = set(r[0] for r in cur.fetchall())
    conn.close()
    return paths


def extract_storage_path(local_path):
    """Extract uuid/date/filename from the full local path."""
    normalized = local_path.replace("\\", "/")
    match = UUID_RE.search(normalized)
    if match:
        return normalized[match.start():]
    return None


def upload_file(storage_path, local_path, retries=3):
    url = f"{SUPABASE_URL}/storage/v1/object/attendance-photos/{storage_path}"
    for attempt in range(retries):
        try:
            with open(local_path, "rb") as f:
                resp = session.post(
                    url,
                    headers={**HEADERS, "Content-Type": "image/jpeg"},
                    data=f,
                    timeout=30,
                )
            if resp.status_code in (200, 201, 409):
                return True
            if attempt < retries - 1:
                time.sleep(2)
                continue
            return False
        except Exception:
            if attempt < retries - 1:
                time.sleep(2)
                continue
            return False
    return False


def update_urls():
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    old_base = f"https://{OLD_PROJECT}.supabase.co"
    new_base = f"https://{NEW_PROJECT}.supabase.co"

    cur.execute("""
        UPDATE attendance_records
        SET sign_in_photo_url = replace(sign_in_photo_url, %s, %s)
        WHERE sign_in_photo_url LIKE %s
    """, (old_base, new_base, f"%{OLD_PROJECT}%"))
    sign_in = cur.rowcount

    cur.execute("""
        UPDATE attendance_records
        SET sign_out_photo_url = replace(sign_out_photo_url, %s, %s)
        WHERE sign_out_photo_url LIKE %s
    """, (old_base, new_base, f"%{OLD_PROJECT}%"))
    sign_out = cur.rowcount

    conn.commit()
    conn.close()
    print(f"\nDB URL updates: sign_in={sign_in}, sign_out={sign_out}")


def main():
    # Collect all local files
    print("Scanning local files...")
    files = []
    for root, dirs, filenames in os.walk(BASE_DIR):
        for fname in filenames:
            local_path = os.path.join(root, fname)
            storage_path = extract_storage_path(local_path)
            if storage_path:
                files.append((storage_path, local_path))

    print(f"Total local files: {len(files)}")

    # Get existing
    print("Checking existing storage objects...")
    existing = get_existing_paths()
    print(f"Already in storage: {len(existing)}")

    missing = [(sp, lp) for sp, lp in files if sp not in existing]
    print(f"To upload: {len(missing)}")

    success = 0
    fail = 0
    for i, (storage_path, local_path) in enumerate(missing, 1):
        if upload_file(storage_path, local_path):
            success += 1
        else:
            fail += 1
        if i % 200 == 0 or i == len(missing):
            print(f"  Progress: {i}/{len(missing)} ({success} ok, {fail} fail)", flush=True)

    print(f"\nUpload complete: {success} ok, {fail} fail")

    # Update URLs
    print("\nUpdating DB URLs...")
    update_urls()
    print("Done!")


if __name__ == "__main__":
    main()
