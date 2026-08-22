from flask import jsonify

from backend.interact import interact_bp


@interact_bp.route("/test", methods=["GET"])
def interact_test():
    return jsonify({
        "message": "Interaction Blueprint is working!"
    })
