import os
import sys
import mimetypes
import requests
from pathlib import Path

SUPABASE_URL = "https://ltlvhmwrrsromwuiybwu.supabase.co"
SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0bHZobXdycnNyb213dWl5Ynd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzA3OTQ5NSwiZXhwIjoyMDg4NjU1NDk1fQ.paF1ggI8OkTCWGMZIE_qB6-c08F7QSDueLIie9yAk98"

DOWNLOADS = "C:/Users/admin/Downloads"

# Map download folder names to bucket names
FOLDERS = {
    "attendance-photos_20260310_223724": "attendance-photos",
    "chat-attachments_20260310_221931": "chat-attachments",
    "hr-policy-documents_20260310_222038": "hr-policy-documents",
    "inventory-invoices_20260310_222041": "inventory-invoices",
    "operations-distribution-images_20260310_222045": "operations-distribution-images",
    "project-files_20260310_221803": "project-files",
    "project-quotations_20260310_222916": "project-quotations",
    "task-completion-files_20260310_222028": "task-completion-files",
}

HEADERS = {
    "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
    "apikey": SERVICE_ROLE_KEY,
}


def upload_file(bucket, storage_path, local_path):
    """Upload a single file to Supabase storage."""
    mime_type, _ = mimetypes.guess_type(local_path)
    if not mime_type:
        mime_type = "application/octet-stream"

    url = f"{SUPABASE_URL}/storage/v1/object/{bucket}/{storage_path}"

    with open(local_path, "rb") as f:
        resp = requests.post(
            url,
            headers={**HEADERS, "Content-Type": mime_type},
            data=f,
        )

    if resp.status_code in (200, 201):
        return True
    elif resp.status_code == 409:
        # Already exists
        return True
    else:
        print(f"    FAIL [{resp.status_code}]: {storage_path} - {resp.text[:100]}")
        return False


def upload_bucket(folder_name, bucket_name):
    """Upload all files from a local folder to a Supabase storage bucket."""
    folder_path = os.path.join(DOWNLOADS, folder_name)
    if not os.path.isdir(folder_path):
        print(f"  SKIP {folder_name}: folder not found")
        return 0, 0

    # Collect all files
    files = []
    for root, dirs, filenames in os.walk(folder_path):
        for fname in filenames:
            local_path = os.path.join(root, fname)
            # Storage path = relative path from the folder root
            rel_path = os.path.relpath(local_path, folder_path).replace("\\", "/")
            files.append((rel_path, local_path))

    total = len(files)
    success = 0
    print(f"\n=== {bucket_name} ({total} files) ===")

    for i, (storage_path, local_path) in enumerate(files, 1):
        if upload_file(bucket_name, storage_path, local_path):
            success += 1
        if i % 50 == 0 or i == total:
            print(f"  Progress: {i}/{total} ({success} ok)", flush=True)

    print(f"  Done: {success}/{total} uploaded")
    return success, total


def main():
    print("Supabase Storage Upload")
    print(f"Project: {SUPABASE_URL}")
    print(f"Buckets: {len(FOLDERS)}")
    print("=" * 50)

    total_success = 0
    total_files = 0

    for folder_name, bucket_name in FOLDERS.items():
        s, t = upload_bucket(folder_name, bucket_name)
        total_success += s
        total_files += t

    print(f"\n{'=' * 50}")
    print(f"UPLOAD COMPLETE: {total_success}/{total_files} files")
    print(f"{'=' * 50}")


if __name__ == "__main__":
    main()
