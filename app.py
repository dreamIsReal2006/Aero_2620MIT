from pathlib import Path

from backend import create_app
from flask import send_from_directory

app = create_app()

BASE_DIR = Path(__file__).resolve().parent


@app.route("/")
def home():
    return send_from_directory(BASE_DIR, "index.html")


if __name__ == "__main__":
    app.run(debug=True)
