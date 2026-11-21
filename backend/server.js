
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

const PYTHON_SERVICE_URL = (
    process.env.PYTHON_SERVICE_URL || "http://127.0.0.1:5001"
).replace(/\/+$/, "");

const DATA_FILE = path.join(__dirname, "sessions.json");

// Read saved sessions
function readSessions() {
    if (!fs.existsSync(DATA_FILE)) {
        fs.writeFileSync(DATA_FILE, "[]");
    }

    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

// Save sessions
function saveSessions(sessions) {
    fs.writeFileSync(
        DATA_FILE,
        JSON.stringify(sessions, null, 2)
    );
}

// Backend health check
app.get("/", (req, res) => {
    res.json({
        message: "StudyBreak AI Backend Running"
    });
});

// Generate recommendation and save a new study plan
app.post("/api/sessions", async (req, res) => {
    try {
        const {
            subject,
            duration,
            focusLevel,
            difficulty
        } = req.body;

        if (
            !subject ||
            !Number.isFinite(Number(duration)) ||
            !Number.isFinite(Number(focusLevel)) ||
            !Number.isFinite(Number(difficulty))
        ) {
            return res.status(400).json({
                success: false,
                error: "Please provide valid subject, duration, focusLevel and difficulty"
            });
        }

        if (
            Number(duration) < 1 ||
            Number(duration) > 1440 ||
            Number(focusLevel) < 1 ||
            Number(focusLevel) > 10 ||
            Number(difficulty) < 1 ||
            Number(difficulty) > 10
        ) {
            return res.status(400).json({
                success: false,
                error: "Duration must be 1-1440 minutes. Focus and difficulty must be 1-10."
            });
        }

        const pythonResponse = await fetch(
            `${PYTHON_SERVICE_URL}/recommend`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    available_time: Number(duration),
                    focus_level: Number(focusLevel),
                    difficulty_level: Number(difficulty)
                })
            }
        );

        const recommendation = await pythonResponse.json();

        if (!pythonResponse.ok) {
            return res.status(pythonResponse.status).json({
                success: false,
                error: recommendation.error || "Python recommendation failed"
            });
        }

        const sessions = readSessions();

        const session = {
            id: Date.now(),
            subject,
            duration: Number(duration),
            focusLevel: Number(focusLevel),
            difficulty: Number(difficulty),

            studyDuration: recommendation.recommended_study_duration,
            breakDuration: recommendation.recommended_break_duration,

            recommendation: recommendation.message,
            recommendationDetails: recommendation,

            completedStudyMinutes: 0,
            completedBlocks: [],

            createdAt: new Date().toISOString()
        };

        sessions.push(session);
        saveSessions(sessions);

        res.json({
            success: true,
            recommendation: recommendation.message,
            plan: recommendation,
            session
        });

    } catch (error) {
        console.error("Backend Error:", error);

        res.status(500).json({
            success: false,
            error: "Unable to create study plan"
        });
    }
});

// Record one completed study timer block
app.post("/api/sessions/:id/completions", (req, res) => {
    try {
        const sessionId = Number(req.params.id);
        const { completionId, minutes } = req.body;

        if (
            !completionId ||
            typeof completionId !== "string" ||
            !Number.isFinite(Number(minutes)) ||
            Number(minutes) <= 0 ||
            Number(minutes) > 1440
        ) {
            return res.status(400).json({
                success: false,
                error: "Please provide a valid completionId and minutes"
            });
        }

        const sessions = readSessions();

        const session = sessions.find(
            item => Number(item.id) === sessionId
        );

        if (!session) {
            return res.status(404).json({
                success: false,
                error: "Study session not found"
            });
        }

        if (!Array.isArray(session.completedBlocks)) {
            session.completedBlocks = [];
        }

        if (!Number.isFinite(Number(session.completedStudyMinutes))) {
            session.completedStudyMinutes = 0;
        }

        const alreadyRecorded = session.completedBlocks.some(
            block => block.completionId === completionId
        );

        if (alreadyRecorded) {
            return res.json({
                success: true,
                alreadyRecorded: true,
                completedStudyMinutes: session.completedStudyMinutes,
                message: "This study block was already recorded"
            });
        }

        const completedMinutes = Number(minutes);

        const completion = {
            completionId,
            minutes: completedMinutes,
            completedAt: new Date().toISOString()
        };

        session.completedBlocks.push(completion);
        session.completedStudyMinutes += completedMinutes;
        session.updatedAt = new Date().toISOString();

        saveSessions(sessions);

        res.json({
            success: true,
            alreadyRecorded: false,
            completion,
            completedStudyMinutes: session.completedStudyMinutes,
            message: "Completed study time saved successfully"
        });

    } catch (error) {
        console.error("Completion Tracking Error:", error);

        res.status(500).json({
            success: false,
            error: "Unable to save completed study time"
        });
    }
});

// Get all saved sessions
app.get("/api/sessions", (req, res) => {
    try {
        const sessions = readSessions();
        res.json(sessions);

    } catch (error) {
        res.status(500).json({
            error: "Unable to read saved sessions"
        });
    }
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`StudyBreak AI Backend running on port ${PORT}`);
});
