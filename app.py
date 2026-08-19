from flask import Flask  # creating smallest possible flask server

app = Flask(__name__)


@app.route("/")
def home():
    return "Aero Backend is Running!"


if __name__ == "__main__":
    app.run(debug=True)
