from flask import (
    Flask,
    render_template,
    request,
    jsonify,
    Response,
    url_for,
    session,
    redirect,
)
import json
from logic import lookback_news_from_india
import traceback

app = Flask(__name__)
app.secret_key = "your-secret-key-here"


@app.route("/")
def index():
    if not all(
        [session.get("api_key"), session.get("base_url"), session.get("language_model")]
    ):
        return redirect(url_for("get_credentials"))
    return render_template("index.html")


@app.route("/credentials", methods=["GET", "POST"])
def get_credentials():
    if request.method == "POST":
        session.clear()
        session["api_key"] = request.form["api_key"].strip()
        session["base_url"] = request.form["base_url"].strip()
        session["language_model"] = request.form["language_model"].strip()

        return redirect(url_for("index"))
    return render_template("credentials.html")


@app.route("/app", methods=["POST"])
def get_news():
    if not all(
        [session.get("api_key"), session.get("base_url"), session.get("language_model")]
    ):
        return redirect(url_for("get_credentials"))

    api_key = session.get("api_key")
    base_url = session.get("base_url")
    language_model = session.get("language_model")

    data = request.get_json()
    summary_type = data.get("summary_type", "one sentence")

    def generate():
        try:
            for item in lookback_news_from_india(
                api_key=api_key,
                base_url=base_url,
                language_model=language_model,
                summary_type=summary_type
            ):
                yield json.dumps(item) + "\n"
        except Exception as e:
            print("Error from generator: ", e)
            traceback.print_exc()
            yield f'{{"type": "error", "content": "{e}"}}\n'

    return Response(generate(), mimetype="text/plain")


if __name__ == "__main__":
    app.run(debug=True, use_reloader=True, host="0.0.0.0", port=5000)
    