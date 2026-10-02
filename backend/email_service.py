# Email delivery service for authentication and chat notifications
# From: backend routes -> To: configured SMTP provider and recipient inboxes
import html
import json
import logging
import os
from urllib import error as urllib_error
from urllib import request as urllib_request


logger = logging.getLogger(__name__)


def _send_sendgrid_email(to_email, subject, html_body):
    api_key = os.getenv("SENDGRID_API_KEY")
    sender = os.getenv("MAIL_DEFAULT_SENDER", "kaiyaowu3@gmail.com")
    if not api_key:
        logger.warning("SENDGRID_API_KEY is not configured; email was not sent")
        return False

    payload = {
        "personalizations": [{"to": [{"email": to_email}]}],
        "from": {"email": sender},
        "subject": subject,
        "content": [{"type": "text/html", "value": html_body}],
    }
    request = urllib_request.Request(
        "https://api.sendgrid.com/v3/mail/send",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib_request.urlopen(request, timeout=10) as response:
            if response.getcode() in (200, 202):
                return True
            logger.warning("SendGrid returned HTTP %s", response.getcode())
    except urllib_error.HTTPError as error:
        logger.warning("SendGrid HTTP %s: %s", error.code, error.reason)
    except Exception:
        logger.exception("Unable to send email to %s", to_email)
    return False


def send_mention_email(to_email, sender_name, post_id, content):
    post_url = f"https://aero-2620mit.onrender.com/posts/{post_id}"
    preview = (content or "").strip()
    if len(preview) > 240:
        preview = preview[:237] + "..."
    safe_sender = html.escape(sender_name or "Aero user")
    safe_preview = html.escape(preview)
    subject = f"[Aero] @{sender_name} 在帖子中提及了你"
    html_body = (
        f"<p>@{safe_sender} 在帖子中提及了你：</p>"
        f"<blockquote>{safe_preview}</blockquote>"
        f'<p><a href="{post_url}">查看帖子</a></p>'
    )
    return _send_sendgrid_email(to_email, subject, html_body)


def send_chat_message_email(to_email, sender_name, sender_id):
    safe_sender = " ".join(str(sender_name or "Aero user").split())[:80]
    base_url = os.getenv("AERO_PUBLIC_URL", "https://aero-2620mit.onrender.com").rstrip("/")
    chat_url = html.escape(f"{base_url}/chat?user_id={int(sender_id)}", quote=True)
    subject = f"[Aero] {safe_sender} sent you a message"
    html_body = (
        f"<p>{html.escape(safe_sender)} sent you a new message on Aero.</p>"
        f'<p><a href="{chat_url}" style="display:inline-block;padding:12px 20px;'
        'background:#1677ff;color:#fff;text-decoration:none;border-radius:6px;">'
        'Open conversation</a></p>'
    )
    return _send_sendgrid_email(to_email, subject, html_body)