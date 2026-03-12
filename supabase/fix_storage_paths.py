import psycopg2
import requests
import time
import mimetypes

NEW_PROJECT = "ltlvhmwrrsromwuiybwu"
SUPABASE_URL = f"https://{NEW_PROJECT}.supabase.co"
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


def get_storage_objects(bucket):
    """Get all objects in a bucket from storage.objects table."""
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    cur.execute("SELECT name FROM storage.objects WHERE bucket_id = %s", (bucket,))
    objects = {r[0] for r in cur.fetchall()}
    conn.close()
    return objects


def download_from_storage(bucket, path):
    """Download a file from current storage using service role."""
    url = f"{SUPABASE_URL}/storage/v1/object/{bucket}/{path}"
    resp = session.get(url, headers=HEADERS, timeout=30)
    if resp.status_code == 200:
        return resp.content, resp.headers.get('Content-Type', 'application/octet-stream')
    return None, None


def upload_to_storage(bucket, path, data, content_type):
    """Upload file to storage with the correct path."""
    url = f"{SUPABASE_URL}/storage/v1/object/{bucket}/{path}"
    resp = session.post(
        url,
        headers={**HEADERS, "Content-Type": content_type},
        data=data,
        timeout=30,
    )
    return resp.status_code in (200, 201, 409)


def build_filename_index(bucket):
    """Build filename -> storage_path index from existing objects."""
    objects = get_storage_objects(bucket)
    index = {}
    for obj_path in objects:
        filename = obj_path.split("/")[-1]
        index[filename] = obj_path
    return index


def fix_bucket(bucket, db_paths):
    """For each DB path, find the file in storage by filename, download it, and re-upload with correct path."""
    existing = get_storage_objects(bucket)
    filename_index = build_filename_index(bucket)

    already_correct = [p for p in db_paths if p in existing]
    need_fix = [p for p in db_paths if p not in existing]

    print(f"\n=== {bucket} ===")
    print(f"  DB refs: {len(db_paths)}, Already correct: {len(already_correct)}, Need fix: {len(need_fix)}")

    success = 0
    fail = 0
    not_found = 0

    for db_path in need_fix:
        filename = db_path.split("/")[-1]

        # Find in storage by filename
        source_path = filename_index.get(filename)
        if not source_path:
            # Try partial match - filename might have timestamp prefix in DB but not in storage
            for stored_name, stored_path in filename_index.items():
                if filename.endswith(stored_name) or stored_name.endswith(filename):
                    source_path = stored_path
                    break

        if not source_path:
            not_found += 1
            if not_found <= 5:
                print(f"  NOT FOUND: {filename[:70]}")
            continue

        # Download from current storage
        data, content_type = download_from_storage(bucket, source_path)
        if not data:
            fail += 1
            continue

        # Upload with correct DB path
        if upload_to_storage(bucket, db_path, data, content_type):
            success += 1
        else:
            fail += 1

    print(f"  Result: {success} fixed, {fail} failed, {not_found} not found in storage")
    return success, fail, not_found


def main():
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()

    total_success = 0
    total_fail = 0
    total_missing = 0

    # project-files
    cur.execute("SELECT DISTINCT file_path FROM project_files WHERE file_path IS NOT NULL AND file_path != ''")
    s, f, m = fix_bucket("project-files", [r[0] for r in cur.fetchall()])
    total_success += s; total_fail += f; total_missing += m

    # project-quotations
    cur.execute("SELECT DISTINCT file_path FROM project_quotations WHERE file_path IS NOT NULL AND file_path != ''")
    s, f, m = fix_bucket("project-quotations", [r[0] for r in cur.fetchall()])
    total_success += s; total_fail += f; total_missing += m

    # hr-policy-documents
    cur.execute("SELECT DISTINCT file_path FROM hr_policy_documents WHERE file_path IS NOT NULL AND file_path != ''")
    s, f, m = fix_bucket("hr-policy-documents", [r[0] for r in cur.fetchall()])
    total_success += s; total_fail += f; total_missing += m

    # employee-documents
    cur.execute("SELECT DISTINCT file_path FROM employee_documents WHERE file_path IS NOT NULL AND file_path != ''")
    s, f, m = fix_bucket("employee-documents", [r[0] for r in cur.fetchall()])
    total_success += s; total_fail += f; total_missing += m

    # task-completion-files
    cur.execute("""
        SELECT DISTINCT completion_file_path FROM general_tasks WHERE completion_file_path IS NOT NULL AND completion_file_path != ''
        UNION
        SELECT DISTINCT completion_file_path FROM project_tasks WHERE completion_file_path IS NOT NULL AND completion_file_path != ''
    """)
    s, f, m = fix_bucket("task-completion-files", [r[0] for r in cur.fetchall()])
    total_success += s; total_fail += f; total_missing += m

    conn.close()

    print(f"\n{'='*50}")
    print(f"TOTAL: {total_success} fixed, {total_fail} failed, {total_missing} not found")
    print(f"{'='*50}")


if __name__ == "__main__":
    main()
