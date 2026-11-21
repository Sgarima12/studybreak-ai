
def generate_recommendation(focus_level, difficulty_level, available_time):
    """
    Generate a personalized study and break plan.
    All inputs are integers.
    """

    # Calculate study duration
    study_time = 35 + (focus_level - 5) * 2 - (difficulty_level - 5) * 1.5
    study_time = round(max(20, min(50, study_time)))

    # Calculate break duration
    break_time = 5 + (difficulty_level - 1) * 0.7 + (10 - focus_level) * 0.4
    break_time = round(max(5, min(15, break_time)))

    # Generate study schedule
    remaining_time = available_time
    schedule = []
    session_number = 1

    while remaining_time > 0:
        current_study = min(study_time, remaining_time)

        schedule.append({
            "session": session_number,
            "activity": "Study",
            "duration": current_study
        })

        remaining_time -= current_study

        if remaining_time <= 0:
            break

        current_break = min(break_time, remaining_time)

        schedule.append({
            "session": session_number,
            "activity": "Break",
            "duration": current_break
        })

        remaining_time -= current_break
        session_number += 1

    total_study = sum(
        item["duration"] for item in schedule
        if item["activity"] == "Study"
    )

    total_break = sum(
        item["duration"] for item in schedule
        if item["activity"] == "Break"
    )

    return {
        "recommended_study_duration": study_time,
        "recommended_break_duration": break_time,
        "total_study_time": total_study,
        "total_break_time": total_break,
        "schedule": schedule,
        "message": "Your personalized study plan is ready!"
    }
