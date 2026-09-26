import html
import json
import logging
import os
from urllib import error as urllib_error
from urllib import request as urllib_request


logger = logging.getLogger(__name__)


def send_mention_email(to_email, sender_name, post_id, content):
    api_key = os.getenv("SENDGRID_API_KEY")
    sender = os.getenv("MAIL_DEFAULT_SENDER", "kaiyaowu3@gmail.com")
    if not api_key:
        logger.warning("SENDGRID_API_KEY is not configured; mention email was not sent")
        return False

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
            logger.warning("SendGrid returned HTTP %s for mention email", response.getcode())
    except urllib_error.HTTPError as error:
        logger.warning("SendGrid HTTP %s while sending mention email: %s", error.code, error.reason)
    except Exception:
        logger.exception("Unable to send mention email to %s", to_email)
    return False