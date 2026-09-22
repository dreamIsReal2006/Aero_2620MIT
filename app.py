from pathlib import Path

from dotenv import load_dotenv
from backend import create_app
from flask import send_from_directory

load_dotenv()

app = create_app()
app.config["MAX_CONTENT_LENGTH"] = 500 * 1024 * 1024
BASE_DIR = Path(__file__).resolve().parent


@app.route("/")
def home():
    return send_from_directory(BASE_DIR, "index.html")


if __name__ == "__main__":
    app.run(debug=True)
