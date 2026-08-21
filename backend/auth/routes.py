from flask import jsonify

from backend.auth import auth_bp


@auth_bp.route("/test", methods=["GET"])
def auth_test():
    return jsonify({
        "message": "Authentication Blueprint is working!"
    })
