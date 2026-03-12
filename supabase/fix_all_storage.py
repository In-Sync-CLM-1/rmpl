import psycopg2
import requests
import time

OLD_PROJECT = "xbrinligpvtfpqkkllfl"
NEW_PROJECT = "ltlvhmwrrsromwuiybwu"
OLD_BASE = f"https://{OLD_PROJECT}.supabase.co/storage/v1/object/public"
NEW_URL = f"https://{NEW_PROJECT}.supabase.co"
SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0bHZobXdycnNyb213dWl5Ynd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzA3OTQ5NSwiZXhwIjoyMDg4NjU1NDk1fQ.paF1ggI8OkTCWGMZIE_qB6-c08F7QSDueLIie9yAk98"

HEADERS = {
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


def get_existing(bucket):
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    cur.execute("SELECT name FROM storage.objects WHERE bucket_id = %s", (bucket,))
    result = set(r[0] for r in cur.fetchall())
    conn.close()
    return result


def sync_file(bucket, path, is_public=True, retries=3):
    """Download from old project storage and upload to new."""
    if is_public:
        old_url = f"{OLD_BASE}/{bucket}/{path}"
    else:
        # For private buckets, try authenticated download from old project
        old_url = f"{OLD_BASE}/{bucket}/{path}"

    for attempt in range(retries):
        try:
            resp = session.get(old_url, timeout=30)
            if resp.status_code != 200:
                if attempt < retries - 1:
                    time.sleep(1)
                    continue
                return False, f"download {resp.status_code}"

            content_type = resp.headers.get('Content-Type', 'application/octet-stream')
            upload_url = f"{NEW_URL}/storage/v1/object/{bucket}/{path}"
            upload_resp = session.post(
                upload_url,
                headers={**HEADERS, "Content-Type": content_type},
                data=resp.content,
                timeout=30,
            )
            if upload_resp.status_code in (200, 201, 409):
                return True, "ok"
            return False, f"upload {upload_resp.status_code}"
        except Exception as e:
            if attempt < retries - 1:
                time.sleep(2)
                continue
            return False, str(e)[:50]

    return False, "max retries"


def fix_bucket(bucket, db_paths, is_public=True):
    existing = get_existing(bucket)
    missing = [p for p in db_paths if p not in existing]

    print(f"\n=== {bucket} ===")
    print(f"  DB refs: {len(db_paths)}, In storage: {len(existing)}, Missing: {len(missing)}")

    if not missing:
        print("  All good!")
        return 0, 0

    success = 0
    fail = 0
    fail_samples = []
    for i, path in enumerate(missing, 1):
        ok, msg = sync_file(bucket, path, is_public)
        if ok:
            success += 1
        else:
            fail += 1
            if len(fail_samples) < 5:
                fail_samples.append(f"{path[:60]} - {msg}")
        if i % 50 == 0 or i == len(missing):
            print(f"  Progress: {i}/{len(missing)} ({success} ok, {fail} fail)", flush=True)

    for fs in fail_samples:
        print(f"  FAIL: {fs}")

    return success, fail


def main():
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()

    total_s = 0
    total_f = 0

    # project-quotations (public bucket)
    cur.execute("SELECT DISTINCT file_path FROM project_quotations WHERE file_path IS NOT NULL AND file_path != ''")
    s, f = fix_bucket("project-quotations", [r[0] for r in cur.fetchall()], is_public=True)
    total_s += s; total_f += f

    # project-files (private bucket)
    cur.execute("SELECT DISTINCT file_path FROM project_files WHERE file_path IS NOT NULL AND file_path != ''")
    s, f = fix_bucket("project-files", [r[0] for r in cur.fetchall()], is_public=False)
    total_s += s; total_f += f

    # hr-policy-documents (private bucket)
    cur.execute("SELECT DISTINCT file_path FROM hr_policy_documents WHERE file_path IS NOT NULL AND file_path != ''")
    s, f = fix_bucket("hr-policy-documents", [r[0] for r in cur.fetchall()], is_public=False)
    total_s += s; total_f += f

    # employee-documents (private bucket)
    cur.execute("SELECT DISTINCT file_path FROM employee_documents WHERE file_path IS NOT NULL AND file_path != ''")
    s, f = fix_bucket("employee-documents", [r[0] for r in cur.fetchall()], is_public=False)
    total_s += s; total_f += f

    # task-completion-files (public bucket)
    cur.execute("""
        SELECT DISTINCT completion_file_path FROM general_tasks WHERE completion_file_path IS NOT NULL AND completion_file_path != ''
        UNION
        SELECT DISTINCT completion_file_path FROM project_tasks WHERE completion_file_path IS NOT NULL AND completion_file_path != ''
    """)
    s, f = fix_bucket("task-completion-files", [r[0] for r in cur.fetchall()], is_public=True)
    total_s += s; total_f += f

    conn.close()

    print(f"\n{'='*50}")
    print(f"TOTAL: {total_s} synced, {total_f} failed")
    print(f"{'='*50}")


if __name__ == "__main__":
    main()
