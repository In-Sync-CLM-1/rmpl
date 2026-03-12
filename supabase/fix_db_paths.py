import psycopg2
import re
from difflib import SequenceMatcher

NEW_PROJECT = "ltlvhmwrrsromwuiybwu"

DB_CONFIG = {
    'host': f'db.{NEW_PROJECT}.supabase.co',
    'port': 5432,
    'dbname': 'postgres',
    'user': 'postgres',
    'password': r'7vN$F9#2xP&z@qL1',
    'sslmode': 'require',
    'connect_timeout': 15,
}

# Pattern: QT-1765264082905_RMPL003 -> QT-RMPL003
TIMESTAMP_RE = re.compile(r'(QT-)\d{10,15}_')


def normalize_filename(name):
    """Strip timestamp from filename and normalize spaces."""
    name = TIMESTAMP_RE.sub(r'\1', name)
    name = re.sub(r'\s+', ' ', name).strip()
    return name


def get_storage_objects(conn, bucket):
    cur = conn.cursor()
    cur.execute("SELECT name FROM storage.objects WHERE bucket_id = %s", (bucket,))
    return {r[0] for r in cur.fetchall()}


def build_filename_index(objects):
    """Map normalized filename -> list of (original_filename, full_path)."""
    index = {}
    for obj_path in objects:
        filename = obj_path.split("/")[-1]
        norm = normalize_filename(filename)
        if norm not in index:
            index[norm] = []
        index[norm].append((filename, obj_path))
    return index


def find_match(db_path, storage_objects, filename_index):
    """Try to match a DB path to an actual storage object."""
    # Already correct
    if db_path in storage_objects:
        return None  # No fix needed

    db_filename = db_path.split("/")[-1]
    db_norm = normalize_filename(db_filename)

    # Exact normalized match
    if db_norm in filename_index:
        candidates = filename_index[db_norm]
        if len(candidates) == 1:
            return candidates[0][1]  # Return full storage path
        # Multiple matches - pick the one with most similar full path
        best = max(candidates, key=lambda c: SequenceMatcher(None, db_path, c[1]).ratio())
        return best[1]

    # Collapsed spaces match
    db_collapsed = db_norm.replace(" ", "")
    for norm_key, candidates in filename_index.items():
        if norm_key.replace(" ", "") == db_collapsed:
            if len(candidates) == 1:
                return candidates[0][1]
            best = max(candidates, key=lambda c: SequenceMatcher(None, db_path, c[1]).ratio())
            return best[1]

    # Fuzzy match on normalized filename
    best_ratio = 0
    best_path = None
    for norm_key, candidates in filename_index.items():
        ratio = SequenceMatcher(None, db_norm, norm_key).ratio()
        if ratio > best_ratio:
            best_ratio = ratio
            for _, full_path in candidates:
                best_path = full_path
                best_ratio = ratio

    if best_ratio >= 0.85:
        return best_path

    return None


def fix_project_quotations(conn):
    """Fix project_quotations.file_path to match storage objects."""
    storage_objects = get_storage_objects(conn, "project-quotations")
    filename_index = build_filename_index(storage_objects)

    cur = conn.cursor()
    cur.execute("SELECT id, file_path FROM project_quotations WHERE file_path IS NOT NULL AND file_path != ''")
    rows = cur.fetchall()

    print(f"\n=== project-quotations ===")
    print(f"  DB rows: {len(rows)}, Storage objects: {len(storage_objects)}")

    fixed = 0
    no_match = 0
    already_ok = 0
    no_match_samples = []

    for row_id, db_path in rows:
        if db_path in storage_objects:
            already_ok += 1
            continue

        match = find_match(db_path, storage_objects, filename_index)
        if match:
            cur.execute("UPDATE project_quotations SET file_path = %s WHERE id = %s", (match, row_id))
            fixed += 1
        else:
            no_match += 1
            if len(no_match_samples) < 10:
                no_match_samples.append(db_path[:80])

    conn.commit()
    print(f"  Already OK: {already_ok}, Fixed: {fixed}, No match: {no_match}")
    for s in no_match_samples:
        print(f"  NO MATCH: {s}")
    return fixed, no_match


def fix_generic_bucket(conn, bucket, table, column="file_path"):
    """Fix a generic table's file_path to match storage objects."""
    storage_objects = get_storage_objects(conn, bucket)
    filename_index = build_filename_index(storage_objects)

    cur = conn.cursor()
    cur.execute(f"SELECT id, {column} FROM {table} WHERE {column} IS NOT NULL AND {column} != ''")
    rows = cur.fetchall()

    print(f"\n=== {bucket} ({table}.{column}) ===")
    print(f"  DB rows: {len(rows)}, Storage objects: {len(storage_objects)}")

    fixed = 0
    no_match = 0
    already_ok = 0
    no_match_samples = []

    for row_id, db_path in rows:
        if db_path in storage_objects:
            already_ok += 1
            continue

        match = find_match(db_path, storage_objects, filename_index)
        if match:
            cur.execute(f"UPDATE {table} SET {column} = %s WHERE id = %s", (match, row_id))
            fixed += 1
        else:
            no_match += 1
            if len(no_match_samples) < 5:
                no_match_samples.append(db_path[:80])

    conn.commit()
    print(f"  Already OK: {already_ok}, Fixed: {fixed}, No match: {no_match}")
    for s in no_match_samples:
        print(f"  NO MATCH: {s}")
    return fixed, no_match


def main():
    conn = psycopg2.connect(**DB_CONFIG)
    total_fixed = 0
    total_no_match = 0

    # project-quotations (the main problem - 250 mismatches)
    f, n = fix_project_quotations(conn)
    total_fixed += f
    total_no_match += n

    # project-files
    f, n = fix_generic_bucket(conn, "project-files", "project_files")
    total_fixed += f
    total_no_match += n

    # hr-policy-documents
    f, n = fix_generic_bucket(conn, "hr-policy-documents", "hr_policy_documents")
    total_fixed += f
    total_no_match += n

    # employee-documents
    f, n = fix_generic_bucket(conn, "employee-documents", "employee_documents")
    total_fixed += f
    total_no_match += n

    # task-completion-files (two tables)
    f, n = fix_generic_bucket(conn, "task-completion-files", "general_tasks", "completion_file_path")
    total_fixed += f
    total_no_match += n

    f, n = fix_generic_bucket(conn, "task-completion-files", "project_tasks", "completion_file_path")
    total_fixed += f
    total_no_match += n

    conn.close()

    print(f"\n{'='*50}")
    print(f"TOTAL: {total_fixed} fixed, {total_no_match} no match")
    print(f"{'='*50}")


if __name__ == "__main__":
    main()
