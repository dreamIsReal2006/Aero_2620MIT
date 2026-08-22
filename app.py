from pathlib import Path

from backend import create_app
from flask import send_from_directory

app = create_app()
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024
app.config["MAIL_SERVER"] = "smtp.gmail.com"
app.config["MAIL_PORT"] = 587
app.config["MAIL_USE_TLS"] = True
app.config["MAIL_USERNAME"] = "kaiyaowu3@gmail.com"
app.config["MAIL_PASSWORD"] = "hxqr ryjl srdz wulv"
app.config["MAIL_DEFAULT_SENDER"] = "kaiyaowu3@gmail.com"
BASE_DIR = Path(__file__).resolve().parent


@app.route("/")
def home():
    return send_from_directory(BASE_DIR, "index.html")


if __name__ == "__main__":
    app.run(debug=True)
