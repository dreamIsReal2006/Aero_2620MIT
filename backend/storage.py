import mimetypes
import os
import uuid
from io import BytesIO
from pathlib import Path

from PIL import Image
from pillow_heif import register_heif_opener
from supabase import create_client


SUPABASE_BUCKET = "aero-media"
register_heif_opener()


def _prepare_upload(file_obj):
    original_name = getattr(file_obj, "filename", "") or ""
    extension = Path(original_name).suffix.lower()
    if extension not in {".heic", ".heif"}:
        return file_obj, extension

    content = file_obj.read()
    if not content:
        raise ValueError("Uploaded file is empty")
    try:
        image = Image.open(BytesIO(content))
        if image.mode not in {"RGB", "L"}:
            image = image.convert("RGB")
        converted = BytesIO()
        image.save(converted, format="JPEG", quality=92, optimize=True)
        converted.seek(0)
        converted.filename = f"{Path(original_name).stem}.jpg"
        converted.mimetype = "image/jpeg"
        return converted, ".jpg"
    except Exception as error:
        raise ValueError("The HEIF image could not be decoded") from error


def upload_file_to_supabase(file_obj, folder="uploads"):
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_KEY")
    if not supabase_url or not supabase_key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured")

    upload_obj, extension = _prepare_upload(file_obj)
    filename = f"{uuid.uuid4().hex}{extension}"
    folder_name = str(folder or "uploads").strip("/ ") or "uploads"
    storage_path = f"{folder_name}/{filename}"
    content = upload_obj.read()
    if not content:
        raise ValueError("Uploaded file is empty")

    client = create_client(supabase_url, supabase_key)
    video_content_types = {
        ".mp4": "video/mp4",
        ".webm": "video/webm",
        ".mov": "video/quicktime",
        ".m4v": "video/x-m4v",
    }
    content_type = video_content_types.get(extension) or getattr(upload_obj, "mimetype", None)
    if not content_type or content_type == "application/octet-stream":
        content_type = mimetypes.guess_type(getattr(upload_obj, "filename", None) or filename)[0] or "application/octet-stream"
    options = {"content-type": content_type}
    client.storage.from_(SUPABASE_BUCKET).upload(storage_path, content, options)
    return client.storage.from_(SUPABASE_BUCKET).get_public_url(storage_path)