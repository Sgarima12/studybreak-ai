# StudyBreak AI – Personalized Study & Break Recommendation System

StudyBreak AI is a web-based productivity application designed to help students manage their study sessions, maintain focus, and improve their learning habits through personalized study and break recommendations.

The system considers the student's focus level, subject difficulty, and available study time to generate a customized study schedule.

## Features

- **Personalized Study Plans:** Generates study and break schedules based on focus level, difficulty, and available time.
- **Smart Pomodoro Timer:** Start, pause, resume, and track study sessions.
- **Study History:** Maintains records of saved study sessions.
- **Daily Study Goals:** Helps students monitor their daily study progress.
- **Study Streaks:** Tracks consistent study activity.
- **Progress Analytics:** Displays weekly and monthly study reports.
- **Completed Study Tracking:** Records successfully completed study blocks.
- **Python Recommendation Service:** Generates personalized recommendations using a rule-based algorithm.

## Technology Stack

### Frontend
- React.js
- Tailwind CSS
- JavaScript
- Vite
- Lucide React

### Backend
- Node.js
- Express.js
- REST API

### Recommendation Service
- Python
- Flask
- Flask-CORS

### Data Storage
- JSON-based local session storage

## Project Architecture

The application consists of three main services:

1. **Frontend:** Provides the user interface and study dashboard.
2. **Node.js Backend:** Handles API requests, session management, and data storage.
3. **Python Recommendation Service:** Generates personalized study and break schedules.

## Local Installation and Setup

### 1. Clone the Repository

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
cd "StudyBreak AI project"
```

### 2. Start the Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend URL: http://localhost:5173

### 3. Start the Backend

Open another terminal:

```bash
cd backend
npm install
node server.js
```

Backend URL: http://localhost:5000

### 4. Start the Python Recommendation Service

Open another terminal:

```bash
cd ai-service
pip install flask flask-cors
python app.py
```

Python service URL: http://localhost:5001

Make sure all three services are running.

## API Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/` | Backend health check |
| POST | `/api/sessions` | Create a study session |
| GET | `/api/sessions` | Retrieve saved sessions |
| POST | `/api/sessions/:id/completions` | Record completed study time |
| GET | `/` | Python service health check |
| GET | `/health` | Python service health status |
| POST | `/recommend` | Generate a study recommendation |

## Recommendation Logic

The current recommendation engine uses a rule-based algorithm.

It considers:
- Focus level
- Difficulty level
- Available study time

Based on these inputs, it calculates recommended study and break durations and creates a personalized schedule.

The current implementation is not a trained machine learning model.

## Future Improvements

- Train and integrate a machine learning recommendation model.
- Add subject-wise productivity analytics.
- Introduce personalized weekly study suggestions.
- Deploy the application with persistent cloud storage.
- Improve the recommendation engine using completed study-session data.

## Project Purpose

StudyBreak AI aims to make studying more structured and productive by helping students balance focused learning sessions with appropriate breaks.

**Developed as a final-year B.Tech Computer Science and Engineering project.**