
import { useState, useEffect, useRef } from "react";
import {
  BookOpen, Clock, Brain, Coffee, Play, Pause,
  RotateCcw, TrendingUp, BarChart3, CheckCircle,
  Target, CalendarDays, Flame, Trophy, ChartColumn
} from "lucide-react";
import "./App.css";

const API_URL = "http://localhost:5000";
const ACTIVE_PLAN_KEY = "studyBreakActivePlan";

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

function createRunId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getStartOfWeek(date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  const day = result.getDay();
  result.setDate(result.getDate() - (day === 0 ? 6 : day - 1));
  return result;
}

function getDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function readActivePlan() {
  try {
    return JSON.parse(localStorage.getItem(ACTIVE_PLAN_KEY)) || null;
  } catch {
    return null;
  }
}

function App() {
  const savedActivePlan = readActivePlan();

  const [subject, setSubject] = useState("");
  const [duration, setDuration] = useState(45);
  const [focus, setFocus] = useState(4);
  const [difficulty, setDifficulty] = useState(3);

  const [recommendation, setRecommendation] = useState(
    savedActivePlan?.recommendation || ""
  );

  const [recommendationDetails, setRecommendationDetails] = useState(
    savedActivePlan?.recommendationDetails || null
  );

  const [activeSessionId, setActiveSessionId] = useState(
    savedActivePlan?.activeSessionId || null
  );

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [dailyGoalHours, setDailyGoalHours] = useState(() => {
    const savedGoal = localStorage.getItem("studyBreakDailyGoal");
    return savedGoal ? Number(savedGoal) : 3;
  });

  const [timer, setTimer] = useState(() => {
    const saved = readActivePlan()?.timer;

    return saved
      ? { ...saved, running: false }
      : {
          index: 0,
          remaining: 0,
          running: false,
          completed: false,
          stepFinished: false,
          runId: createRunId()
        };
  });

  const processingRef = useRef(false);

  const schedule = recommendationDetails?.schedule || [];
  const currentStep = schedule[timer.index];
  const nextStep = schedule[timer.index + 1];
  const isBreak = currentStep?.activity === "Break";

  // Load saved sessions
  useEffect(() => {
    loadSessions();
  }, []);

  // Save daily goal
  useEffect(() => {
    localStorage.setItem("studyBreakDailyGoal", dailyGoalHours);
  }, [dailyGoalHours]);

  // Save active timer and plan so refresh does not erase progress
  useEffect(() => {
    if (!recommendationDetails) {
      localStorage.removeItem(ACTIVE_PLAN_KEY);
      return;
    }

    localStorage.setItem(
      ACTIVE_PLAN_KEY,
      JSON.stringify({
        recommendation,
        recommendationDetails,
        activeSessionId,
        timer: { ...timer, running: false }
      })
    );
  }, [recommendation, recommendationDetails, activeSessionId, timer]);

  async function loadSessions() {
    try {
      const response = await fetch(`${API_URL}/api/sessions`);
      const data = await response.json();

      if (response.ok) {
        setSessions(Array.isArray(data) ? data : data.sessions || []);
      }
    } catch (err) {
      console.error("Unable to load sessions:", err);
    }
  }

  // Timer countdown
  useEffect(() => {
    if (!timer.running || timer.stepFinished || !schedule.length) {
      return;
    }

    const interval = setInterval(() => {
      setTimer(current => {
        if (current.remaining > 1) {
          return {
            ...current,
            remaining: current.remaining - 1
          };
        }

        return {
          ...current,
          remaining: 0,
          running: false,
          stepFinished: true
        };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timer.running, timer.stepFinished, schedule.length]);

  // Save completed study blocks to backend
  useEffect(() => {
    if (!timer.stepFinished || processingRef.current) return;

    const finishedStep = schedule[timer.index];

    if (!finishedStep) return;

    processingRef.current = true;

    async function processFinishedStep() {
      try {
        if (finishedStep.activity === "Study") {
          if (!activeSessionId) {
            throw new Error("No active study session was found.");
          }

          const completionId = `${timer.runId}-${timer.index}`;

          const response = await fetch(
            `${API_URL}/api/sessions/${activeSessionId}/completions`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                completionId,
                minutes: Number(finishedStep.duration)
              })
            }
          );

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || "Unable to save completed study time.");
          }

          await loadSessions();
        }

        setError("");

        setTimer(current => {
          const nextIndex = current.index + 1;

          if (nextIndex >= schedule.length) {
            return {
              ...current,
              remaining: 0,
              running: false,
              completed: true,
              stepFinished: false
            };
          }

          return {
            ...current,
            index: nextIndex,
            remaining: Number(schedule[nextIndex].duration) * 60,
            running: true,
            completed: false,
            stepFinished: false
          };
        });
      } catch (err) {
        console.error("Timer completion error:", err);
        setError(`${err.message} Press Resume to retry saving this block.`);

        setTimer(current => ({
          ...current,
          remaining: 0,
          running: false,
          stepFinished: false
        }));
      } finally {
        processingRef.current = false;
      }
    }

    processFinishedStep();
  }, [
    timer.stepFinished,
    timer.index,
    timer.runId,
    activeSessionId,
    schedule
  ]);

  // Generate a new study plan
  async function startSession(event) {
    event.preventDefault();

    if (!subject.trim()) {
      setError("Please enter a subject name.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/api/sessions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          subject,
          duration: Number(duration),
          focusLevel: Number(focus),
          difficulty: Number(difficulty)
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to create study plan.");
      }

      const plan = data.plan || data.session?.recommendationDetails;

      if (!plan?.schedule?.length || !data.session?.id) {
        throw new Error("The backend did not return a valid study plan.");
      }

      setRecommendation(
        data.recommendation || plan.message || "Your study plan is ready!"
      );

      setRecommendationDetails(plan);
      setActiveSessionId(data.session.id);

      setTimer({
        index: 0,
        remaining: Number(plan.schedule[0].duration) * 60,
        running: false,
        completed: false,
        stepFinished: false,
        runId: createRunId()
      });

      await loadSessions();

    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function startTimer() {
    if (!schedule.length || timer.completed) return;

    if (timer.stepFinished) return;

    setError("");

    setTimer(current => ({
      ...current,
      running: true
    }));
  }

  function pauseTimer() {
    setTimer(current => ({
      ...current,
      running: false
    }));
  }

  function resetTimer() {
    if (!schedule.length) return;

    setError("");

    setTimer({
      index: 0,
      remaining: Number(schedule[0].duration) * 60,
      running: false,
      completed: false,
      stepFinished: false,
      runId: createRunId()
    });
  }

  // Actual completed study minutes
  function getStudyMinutes(session) {
    return Number(session.completedStudyMinutes) || 0;
  }

  // Planned study minutes, shown separately
  function getPlannedStudyMinutes(session) {
    return (
      Number(session.recommendationDetails?.total_study_time) ||
      Number(session.studyDuration) ||
      Number(session.duration) ||
      0
    );
  }

  function getSessionDate(session) {
    if (!session.createdAt) return null;

    const date = new Date(session.createdAt);

    return Number.isNaN(date.getTime()) ? null : date;
  }

  // OVERALL STATISTICS
  const totalStudyMinutes = sessions.reduce(
    (total, session) => total + getStudyMinutes(session),
    0
  );

  const totalPlannedMinutes = sessions.reduce(
    (total, session) => total + getPlannedStudyMinutes(session),
    0
  );

  const averageFocus = sessions.length
    ? sessions.reduce(
        (total, session) => total + Number(session.focusLevel || 0),
        0
      ) / sessions.length
    : 0;

  const productivity = Math.round((averageFocus / 10) * 100);

  const subjectTotals = {};

  sessions.forEach(session => {
    const name = session.subject || "Other";
    subjectTotals[name] =
      (subjectTotals[name] || 0) + getStudyMinutes(session);
  });

  const mostStudiedSubject =
    Object.keys(subjectTotals).length
      ? Object.keys(subjectTotals).reduce((a, b) =>
          subjectTotals[a] > subjectTotals[b] ? a : b
        )
      : "None yet";

  // DAILY GOAL
  const today = new Date();
  const todayKey = getDateKey(today);

  const todayStudyMinutes = sessions.reduce((total, session) => {
    const date = getSessionDate(session);

    return date && getDateKey(date) === todayKey
      ? total + getStudyMinutes(session)
      : total;
  }, 0);

  const dailyGoalMinutes = dailyGoalHours * 60;

  const goalProgress = Math.min(
    100,
    Math.round((todayStudyMinutes / dailyGoalMinutes) * 100)
  );

  const remainingGoalMinutes = Math.max(
    0,
    dailyGoalMinutes - todayStudyMinutes
  );

  const goalCompleted = todayStudyMinutes >= dailyGoalMinutes;

  // STUDY STREAK
  const activeDates = new Set(
    sessions
      .filter(session => getStudyMinutes(session) > 0)
      .map(session => getSessionDate(session))
      .filter(Boolean)
      .map(date => date.toDateString())
  );

  function calculateCurrentStreak() {
    let streak = 0;
    const date = new Date();

    if (!activeDates.has(date.toDateString())) {
      date.setDate(date.getDate() - 1);
    }

    while (activeDates.has(date.toDateString())) {
      streak++;
      date.setDate(date.getDate() - 1);
    }

    return streak;
  }

  function calculateLongestStreak() {
    const sortedDates = Array.from(activeDates)
      .map(date => new Date(date))
      .sort((a, b) => a - b);

    if (!sortedDates.length) return 0;

    let longest = 1;
    let current = 1;

    for (let i = 1; i < sortedDates.length; i++) {
      const difference = Math.round(
        (sortedDates[i] - sortedDates[i - 1]) / 86400000
      );

      if (difference === 1) {
        current++;
        longest = Math.max(longest, current);
      } else if (difference > 1) {
        current = 1;
      }
    }

    return longest;
  }

  const currentStreak = calculateCurrentStreak();
  const longestStreak = calculateLongestStreak();

  const weeklyCalendar = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));

    return {
      day: date.toLocaleDateString("en-US", { weekday: "short" }),
      date: date.getDate(),
      fullDate: date.toDateString(),
      studied: activeDates.has(date.toDateString()),
      isToday: date.toDateString() === today.toDateString()
    };
  });

  // DAILY ANALYTICS
  const dailyProgress = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const key = getDateKey(date);

    const minutes = sessions.reduce((total, session) => {
      const sessionDate = getSessionDate(session);

      return sessionDate && getDateKey(sessionDate) === key
        ? total + getStudyMinutes(session)
        : total;
    }, 0);

    return {
      day: date.toLocaleDateString("en-US", { weekday: "short" }),
      minutes
    };
  });

  const maxDailyMinutes = Math.max(
    ...dailyProgress.map(day => day.minutes),
    1
  );

  // WEEKLY AND MONTHLY REPORTS
  const weekStart = getStartOfWeek(today);

  const nextWeekStart = new Date(weekStart);
  nextWeekStart.setDate(nextWeekStart.getDate() + 7);

  const previousWeekStart = new Date(weekStart);
  previousWeekStart.setDate(previousWeekStart.getDate() - 7);

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1);

  const currentWeekSessions = sessions.filter(session => {
    const date = getSessionDate(session);
    return date && date >= weekStart && date < nextWeekStart;
  });

  const previousWeekSessions = sessions.filter(session => {
    const date = getSessionDate(session);
    return date && date >= previousWeekStart && date < weekStart;
  });

  const currentMonthSessions = sessions.filter(session => {
    const date = getSessionDate(session);
    return date && date >= monthStart && date < nextMonthStart;
  });

  function getTotalMinutes(list) {
    return list.reduce(
      (total, session) => total + getStudyMinutes(session),
      0
    );
  }

  function getAverageFocus(list) {
    if (!list.length) return 0;

    return list.reduce(
      (total, session) => total + Number(session.focusLevel || 0),
      0
    ) / list.length;
  }

  function getMostStudiedSubject(list) {
    const totals = {};

    list.forEach(session => {
      const name = session.subject || "Other";
      totals[name] = (totals[name] || 0) + getStudyMinutes(session);
    });

    const names = Object.keys(totals);

    if (!names.length) return "None yet";

    return names.reduce((a, b) => totals[a] >= totals[b] ? a : b);
  }

  const weeklyMinutes = getTotalMinutes(currentWeekSessions);
  const previousWeeklyMinutes = getTotalMinutes(previousWeekSessions);
  const monthlyMinutes = getTotalMinutes(currentMonthSessions);

  const weeklyChange = previousWeeklyMinutes
    ? Math.round(
        ((weeklyMinutes - previousWeeklyMinutes) /
          previousWeeklyMinutes) * 100
      )
    : null;

  const weeklyChart = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + index);
    const key = getDateKey(date);

    const minutes = currentWeekSessions.reduce((total, session) => {
      const sessionDate = getSessionDate(session);

      return sessionDate && getDateKey(sessionDate) === key
        ? total + getStudyMinutes(session)
        : total;
    }, 0);

    return {
      label: date.toLocaleDateString("en-US", { weekday: "short" }),
      minutes
    };
  });

  const maxWeeklyChart = Math.max(
    ...weeklyChart.map(day => day.minutes),
    1
  );

  const daysInMonth = new Date(
    today.getFullYear(),
    today.getMonth() + 1,
    0
  ).getDate();

  const monthlyChart = Array.from(
    { length: Math.ceil(daysInMonth / 7) },
    (_, index) => {
      const startDay = index * 7 + 1;
      const endDay = Math.min(startDay + 6, daysInMonth);

      const minutes = currentMonthSessions.reduce((total, session) => {
        const date = getSessionDate(session);

        return date &&
          date.getDate() >= startDay &&
          date.getDate() <= endDay
          ? total + getStudyMinutes(session)
          : total;
      }, 0);

      return {
        label: `${startDay}-${endDay}`,
        minutes
      };
    }
  );

  const maxMonthlyChart = Math.max(
    ...monthlyChart.map(week => week.minutes),
    1
  );

  return (
    <div className="app">
      <header className="hero">
        <div className="hero-content">
          <div className="hero-icon">
            <Brain size={32} />
          </div>
          <h1>StudyBreak AI</h1>
          <p>Your personalized AI-powered study and break planner</p>
        </div>
      </header>

      <main className="container">

        {/* CREATE STUDY PLAN */}
        <section className="card">
          <div className="section-heading">
            <BookOpen size={24} />
            <h2>Create Your Study Plan</h2>
          </div>

          <form onSubmit={startSession}>
            <div className="form-group">
              <label>Subject Name</label>
              <input
                type="text"
                placeholder="Enter subject (e.g. Mathematics)"
                value={subject}
                onChange={event => setSubject(event.target.value)}
              />
            </div>

            <div className="form-group">
              <label>
                Available Study Time: <strong>{duration} minutes</strong>
              </label>
              <input
                type="range"
                min="15"
                max="120"
                step="5"
                value={duration}
                onChange={event => setDuration(event.target.value)}
              />
            </div>

            <div className="form-group">
              <label>
                Current Focus Level: <strong>{focus}/10</strong>
              </label>
              <input
                type="range"
                min="1"
                max="10"
                value={focus}
                onChange={event => setFocus(event.target.value)}
              />
            </div>

            <div className="form-group">
              <label>
                Subject Difficulty: <strong>{difficulty}/10</strong>
              </label>
              <input
                type="range"
                min="1"
                max="10"
                value={difficulty}
                onChange={event => setDifficulty(event.target.value)}
              />
            </div>

            {error && <p className="error-message">{error}</p>}

            <button
              className="primary-button"
              type="submit"
              disabled={loading}
            >
              {loading ? "Generating Plan..." : "Generate AI Study Plan"}
            </button>
          </form>
        </section>

        {/* SMART POMODORO TIMER */}
        <section className="card timer-card">
          <div className="section-heading">
            <Clock size={24} />
            <h2>Smart Pomodoro Timer</h2>
          </div>

          {schedule.length > 0 ? (
            <>
              <div className="timer-status">
                {timer.completed ? (
                  <CheckCircle size={22} />
                ) : isBreak ? (
                  <Coffee size={22} />
                ) : (
                  <BookOpen size={22} />
                )}

                <span>
                  {timer.completed
                    ? "Study plan completed!"
                    : currentStep?.activity || "Ready"}
                </span>
              </div>

              <div className="timer-display">
                {formatTime(timer.remaining)}
              </div>

              <p className="timer-subtitle">
                {timer.completed
                  ? "Excellent work! You completed your study plan."
                  : timer.running
                  ? "Stay focused. Your timer is running."
                  : "Start your plan when you are ready."}
              </p>

              {!timer.completed && (
                <p className="timer-session">
                  Activity {timer.index + 1} of {schedule.length}
                  {currentStep?.session
                    ? ` · Session ${currentStep.session}`
                    : ""}
                </p>
              )}

              <div className="timer-buttons">
                {!timer.running ? (
                  <button
                    className="primary-button"
                    onClick={startTimer}
                    disabled={timer.completed || timer.stepFinished}
                  >
                    <Play size={18} />
                    {timer.remaining === 0 && !timer.stepFinished
                      ? "Start Timer"
                      : "Resume"}
                  </button>
                ) : (
                  <button
                    className="primary-button"
                    onClick={pauseTimer}
                  >
                    <Pause size={18} /> Pause
                  </button>
                )}

                <button
                  className="secondary-button"
                  onClick={resetTimer}
                >
                  <RotateCcw size={18} /> Reset
                </button>
              </div>

              {nextStep && !timer.completed && (
                <p className="next-activity">
                  Next: {nextStep.activity} – {nextStep.duration} minutes
                </p>
              )}

              <div className="schedule-list">
                <h3>Your Timer Schedule</h3>

                {schedule.map((item, index) => (
                  <div
                    className={`schedule-item ${
                      index === timer.index ? "active-schedule-item" : ""
                    } ${
                      index < timer.index ? "completed-schedule-item" : ""
                    }`}
                    key={`${item.session}-${item.activity}-${index}`}
                  >
                    <span>
                      {item.activity === "Break" ? (
                        <Coffee size={18} />
                      ) : (
                        <BookOpen size={18} />
                      )}
                      {item.activity}
                    </span>

                    <strong>{item.duration} min</strong>

                    {index < timer.index && (
                      <CheckCircle size={17} className="completed-icon" />
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="empty-state">
              <Clock size={38} />
              <p>
                Generate an AI study plan to activate your smart timer.
              </p>
            </div>
          )}
        </section>

        {/* AI RECOMMENDATION */}
        {recommendation && (
          <section className="card">
            <div className="section-heading">
              <Brain size={24} />
              <h2>AI Break Recommendation</h2>
            </div>

            <p className="recommendation-message">{recommendation}</p>

            {recommendationDetails && (
              <div className="plan-details">
                <div className="plan-detail">
                  <BookOpen size={20} />
                  <span>Recommended Study</span>
                  <strong>
                    {recommendationDetails.recommended_study_duration} min
                  </strong>
                </div>

                <div className="plan-detail">
                  <Coffee size={20} />
                  <span>Recommended Break</span>
                  <strong>
                    {recommendationDetails.recommended_break_duration} min
                  </strong>
                </div>

                <div className="plan-detail">
                  <Clock size={20} />
                  <span>Planned Study Time</span>
                  <strong>
                    {recommendationDetails.total_study_time} min
                  </strong>
                </div>

                <div className="plan-detail">
                  <Clock size={20} />
                  <span>Planned Break Time</span>
                  <strong>
                    {recommendationDetails.total_break_time} min
                  </strong>
                </div>
              </div>
            )}
          </section>
        )}

        {/* OVERALL STATISTICS */}
        <section className="stats-grid">
          <div className="stat-card">
            <BookOpen size={25} />
            <h3>{(totalStudyMinutes / 60).toFixed(1)} hrs</h3>
            <p>Actual Completed Study Time</p>
          </div>

          <div className="stat-card">
            <BarChart3 size={25} />
            <h3>{sessions.length}</h3>
            <p>Total Study Plans</p>
          </div>

          <div className="stat-card">
            <Brain size={25} />
            <h3>{productivity}%</h3>
            <p>Average Focus Score</p>
          </div>

          <div className="stat-card">
            <TrendingUp size={25} />
            <h3>{mostStudiedSubject}</h3>
            <p>Most Studied Subject</p>
          </div>
        </section>

        {/* DAILY STUDY GOAL */}
        <section className="card">
          <div className="section-heading">
            <Target size={24} />
            <h2>Daily Study Goal</h2>
          </div>

          <p>
            Your goal progress is calculated using actual completed study time.
          </p>

          <div className="form-group" style={{ marginTop: "20px" }}>
            <label>
              Your Daily Target: <strong>{dailyGoalHours} hours</strong>
            </label>

            <input
              type="range"
              min="1"
              max="12"
              value={dailyGoalHours}
              onChange={event =>
                setDailyGoalHours(Number(event.target.value))
              }
            />
          </div>

          <div className="plan-details">
            <div className="plan-detail">
              <Clock size={20} />
              <span>Today's Completed Study</span>
              <strong>{todayStudyMinutes} min</strong>
            </div>

            <div className="plan-detail">
              <Target size={20} />
              <span>Daily Target</span>
              <strong>{dailyGoalMinutes} min</strong>
            </div>

            <div className="plan-detail">
              <TrendingUp size={20} />
              <span>Remaining</span>
              <strong>{remainingGoalMinutes} min</strong>
            </div>
          </div>

          <div style={{ marginTop: "25px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "10px",
                fontWeight: "600"
              }}
            >
              <span>Daily Goal Progress</span>
              <span>{goalProgress}%</span>
            </div>

            <div
              style={{
                width: "100%",
                height: "16px",
                background: "#e9e7ff",
                borderRadius: "20px",
                overflow: "hidden"
              }}
            >
              <div
                style={{
                  width: `${goalProgress}%`,
                  height: "100%",
                  background: "linear-gradient(90deg, #6c63ff, #8f85ff)",
                  borderRadius: "20px",
                  transition: "width 0.4s ease"
                }}
              />
            </div>

            <p
              style={{
                marginTop: "15px",
                fontWeight: "600",
                color: goalCompleted ? "#218838" : "#6c63ff"
              }}
            >
              {goalCompleted
                ? "Congratulations! You achieved your daily study goal!"
                : `You have completed ${goalProgress}% of your daily goal. Keep going!`}
            </p>
          </div>
        </section>

        {/* STUDY STREAK AND WEEKLY CALENDAR */}
        <section className="card">
          <div className="section-heading">
            <CalendarDays size={24} />
            <h2>Study Streak & Weekly Calendar</h2>
          </div>

          <div className="plan-details">
            <div className="plan-detail">
              <Flame size={24} />
              <span>Current Streak</span>
              <strong>{currentStreak} days</strong>
            </div>

            <div className="plan-detail">
              <Trophy size={24} />
              <span>Longest Streak</span>
              <strong>{longestStreak} days</strong>
            </div>
          </div>

          <h3 style={{ marginTop: "25px", marginBottom: "15px" }}>
            Your Last 7 Days
          </h3>

          <div className="weekly-calendar">
            {weeklyCalendar.map(day => (
              <div
                key={day.fullDate}
                className={`calendar-day ${
                  day.studied ? "calendar-studied" : ""
                } ${day.isToday ? "calendar-today" : ""}`}
              >
                <span>{day.day}</span>
                <strong>{day.date}</strong>

                {day.studied ? (
                  <CheckCircle size={20} />
                ) : (
                  <span className="calendar-empty">—</span>
                )}
              </div>
            ))}
          </div>

          <p className="analytics-note" style={{ marginTop: "18px" }}>
            A day counts toward your streak when you complete at least one
            study block.
          </p>
        </section>

        {/* PRODUCTIVITY ANALYTICS */}
        <section className="card">
          <div className="section-heading">
            <TrendingUp size={24} />
            <h2>Productivity Analytics</h2>
          </div>

          <p className="analytics-note">
            Actual completed study time over the last seven days.
          </p>

          <div className="chart">
            {dailyProgress.map((day, index) => (
              <div className="chart-column" key={index}>
                <span className="chart-value">
                  {day.minutes > 0 ? `${day.minutes}m` : ""}
                </span>

                <div className="chart-bar-container">
                  <div
                    className="chart-bar"
                    style={{
                      height: `${(day.minutes / maxDailyMinutes) * 100}%`
                    }}
                  />
                </div>

                <span className="chart-label">{day.day}</span>
              </div>
            ))}
          </div>
        </section>

        {/* WEEKLY AND MONTHLY REPORTS */}
        <section className="card">
          <div className="section-heading">
            <ChartColumn size={24} />
            <h2>Weekly & Monthly Reports</h2>
          </div>

          <p className="analytics-note">
            Reports are calculated using actual completed study time.
          </p>

          <h3 style={{ marginTop: "22px", marginBottom: "15px" }}>
            Weekly Report
          </h3>

          <p className="analytics-note">
            {weekStart.toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short"
            })}{" "}
            –{" "}
            {new Date(weekStart.getTime() + 6 * 86400000).toLocaleDateString(
              "en-IN",
              { day: "numeric", month: "short", year: "numeric" }
            )}
          </p>

          <div className="plan-details">
            <div className="plan-detail">
              <BookOpen size={20} />
              <span>Study Plans</span>
              <strong>{currentWeekSessions.length}</strong>
            </div>

            <div className="plan-detail">
              <Clock size={20} />
              <span>Completed Study Time</span>
              <strong>{(weeklyMinutes / 60).toFixed(1)} hrs</strong>
            </div>

            <div className="plan-detail">
              <Brain size={20} />
              <span>Average Focus</span>
              <strong>
                {getAverageFocus(currentWeekSessions).toFixed(1)}/10
              </strong>
            </div>

            <div className="plan-detail">
              <Target size={20} />
              <span>Top Subject</span>
              <strong>{getMostStudiedSubject(currentWeekSessions)}</strong>
            </div>
          </div>

          <p className="analytics-note" style={{ marginTop: "18px" }}>
            {weeklyChange === null
              ? "Complete study blocks this week and next week to compare progress."
              : weeklyChange > 0
              ? `Your completed study time is up ${weeklyChange}% compared with last week.`
              : weeklyChange < 0
              ? `Your completed study time is down ${Math.abs(weeklyChange)}% compared with last week.`
              : "Your completed study time is the same as last week."}
          </p>

          <h3 style={{ marginTop: "25px", marginBottom: "15px" }}>
            Daily Completed Study Time This Week
          </h3>

          <div className="chart">
            {weeklyChart.map((day, index) => (
              <div className="chart-column" key={index}>
                <span className="chart-value">
                  {day.minutes > 0 ? `${day.minutes}m` : ""}
                </span>

                <div className="chart-bar-container">
                  <div
                    className="chart-bar"
                    style={{
                      height: `${(day.minutes / maxWeeklyChart) * 100}%`
                    }}
                  />
                </div>

                <span className="chart-label">{day.label}</span>
              </div>
            ))}
          </div>

          <div
            style={{
              borderTop: "1px solid #e9e7ff",
              marginTop: "28px",
              paddingTop: "22px"
            }}
          >
            <h3 style={{ marginBottom: "15px" }}>Monthly Report</h3>

            <p className="analytics-note">
              {today.toLocaleDateString("en-IN", {
                month: "long",
                year: "numeric"
              })}
            </p>

            <div className="plan-details">
              <div className="plan-detail">
                <BookOpen size={20} />
                <span>Study Plans</span>
                <strong>{currentMonthSessions.length}</strong>
              </div>

              <div className="plan-detail">
                <Clock size={20} />
                <span>Completed Study Time</span>
                <strong>{(monthlyMinutes / 60).toFixed(1)} hrs</strong>
              </div>

              <div className="plan-detail">
                <Brain size={20} />
                <span>Average Focus</span>
                <strong>
                  {getAverageFocus(currentMonthSessions).toFixed(1)}/10
                </strong>
              </div>

              <div className="plan-detail">
                <Target size={20} />
                <span>Top Subject</span>
                <strong>{getMostStudiedSubject(currentMonthSessions)}</strong>
              </div>
            </div>

            <h3 style={{ marginTop: "25px", marginBottom: "15px" }}>
              Weekly Breakdown This Month
            </h3>

            <div className="chart">
              {monthlyChart.map((week, index) => (
                <div className="chart-column" key={index}>
                  <span className="chart-value">
                    {week.minutes > 0 ? `${week.minutes}m` : ""}
                  </span>

                  <div className="chart-bar-container">
                    <div
                      className="chart-bar"
                      style={{
                        height: `${(week.minutes / maxMonthlyChart) * 100}%`
                      }}
                    />
                  </div>

                  <span className="chart-label">{week.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* STUDY HISTORY */}
        <section className="card">
          <div className="section-heading">
            <Clock size={24} />
            <h2>Study History</h2>
          </div>

          {sessions.length === 0 ? (
            <div className="empty-state">
              <BookOpen size={36} />
              <p>Your saved study sessions will appear here.</p>
            </div>
          ) : (
            <div className="history-list">
              {[...sessions].reverse().map(session => (
                <div className="history-item" key={session.id}>
                  <div>
                    <h3>{session.subject}</h3>

                    <p>
                      {session.createdAt
                        ? new Date(session.createdAt).toLocaleString()
                        : "Saved session"}
                    </p>
                  </div>

                  <div className="history-details">
                    <strong>
                      {getStudyMinutes(session)} min completed
                    </strong>
                    <span>
                      {getPlannedStudyMinutes(session)} min planned
                    </span>
                    <span>Focus: {session.focusLevel}/10</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </main>

      <footer className="footer">
        <p>StudyBreak AI · Study smarter, not longer.</p>
      </footer>
    </div>
  );
}

export default App;
