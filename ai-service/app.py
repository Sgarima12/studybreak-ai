
from flask import Flask, request, jsonify
from flask_cors import CORS

from recommendation import generate_recommendation

app = Flask(__name__)
CORS(app)


@app.route("/", methods=["GET"])
def home():
    return jsonify({
        "message": "StudyBreak AI Python Service Running"
    })


@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "healthy",
        "service": "StudyBreak AI"
    })


@app.route("/recommend", methods=["POST"])
def recommend():

    data = request.get_json(silent=True) or {}

    try:
        focus_level = int(data["focus_level"])
        difficulty_level = int(data["difficulty_level"])
        available_time = int(data["available_time"])

        if not 1 <= focus_level <= 10:
            return jsonify({
                "error": "Focus level must be between 1 and 10"
            }), 400

        if not 1 <= difficulty_level <= 10:
            return jsonify({
                "error": "Difficulty level must be between 1 and 10"
            }), 400

        if not 1 <= available_time <= 1440:
            return jsonify({
                "error": "Available time must be between 1 and 1440 minutes"
            }), 400

        result = generate_recommendation(
            focus_level,
            difficulty_level,
            available_time
        )

        return jsonify(result), 200

    except (KeyError, ValueError, TypeError):
        return jsonify({
            "error": "Please provide valid focus_level, difficulty_level and available_time"
        }), 400

    except Exception as error:
        app.logger.exception("Recommendation failed")
        return jsonify({
            "error": "Unable to generate recommendation"
        }), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True)
