import os
import uuid
from pathlib import Path

from supabase import create_client


SUPABASE_BUCKET = "aero-media"


def upload_file_to_supabase(file_obj, folder="uploads"):
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_KEY")
    if not supabase_url or not supabase_key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured")

    original_name = getattr(file_obj, "filename", "") or ""
    extension = Path(original_name).suffix.lower()
    filename = f"{uuid.uuid4().hex}{extension}"
    folder_name = str(folder or "uploads").strip("/ ") or "uploads"
    storage_path = f"{folder_name}/{filename}"
    content = file_obj.read()
    if not content:
        raise ValueError("Uploaded file is empty")

    client = create_client(supabase_url, supabase_key)
    options = {"content-type": getattr(file_obj, "mimetype", None) or "application/octet-stream"}
    client.storage.from_(SUPABASE_BUCKET).upload(storage_path, content, options)
    return client.storage.from_(SUPABASE_BUCKET).get_public_url(storage_path)