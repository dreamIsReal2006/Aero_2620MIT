from flask import request, jsonify

from backend import db
from backend.models.message import Message
from backend.auth.routes import token_required
from backend.messages import messages_bp


@messages_bp.route("/", methods=["POST"])
@token_required
def send_message(current_user):
    data = request.get_json()

    if not data:
        return jsonify({"error": "Request body is required"}), 400

    recipient_id = data.get("recipient_id")
    content = data.get("content")

    if not recipient_id:
        return jsonify({"error": "recipient_id is required"}), 400

    if not content or not content.strip():
        return jsonify({"error": "Message content is required"}), 400

    if recipient_id == current_user.id:
        return jsonify({"error": "You cannot message yourself"}), 400

    message = Message(
        sender_id=current_user.id,
        recipient_id=recipient_id,
        content=content.strip(),
        is_read=False
    )

    db.session.add(message)
    db.session.commit()

    return jsonify({
        "message": "Message sent successfully",
        "data": {
            "id": message.id,
            "sender_id": message.sender_id,
            "recipient_id": message.recipient_id,
            "content": message.content,
            "is_read": message.is_read,
            "created_at": message.created_at.isoformat()
        }
    }), 201
