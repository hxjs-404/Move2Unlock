import cv2


# Starting simulated knee angle
angle = 160

# Squat detection thresholds
SQUAT_ANGLE = 100
STANDING_ANGLE = 160

# State and rep counter
state = "STANDING"
reps = 0


while True:
    # Create a blank window
    frame = cv2.UMat(500, 800, cv2.CV_8UC3)
    frame = frame.get()

    # Background
    frame[:] = (30, 30, 30)

    # --------------------------------
    # Change simulated angle
    # --------------------------------

    # UP = decrease angle
    # DOWN = increase angle

    if angle <= SQUAT_ANGLE:
        state = "SQUATTING"

    elif angle >= STANDING_ANGLE:
        if state == "SQUATTING":
            reps += 1

        state = "STANDING"

    print(state)

    # --------------------------------
    # Display information
    # --------------------------------

    cv2.putText(
        frame,
        f"Knee Angle: {angle} degrees",
        (40, 80),
        cv2.FONT_HERSHEY_SIMPLEX,
        1,
        (255, 255, 255),
        2
    )

    cv2.putText(
        frame,
        f"State: {state}",
        (40, 140),
        cv2.FONT_HERSHEY_SIMPLEX,
        1,
        (255, 255, 255),
        2
    )

    cv2.putText(
        frame,
        f"Reps: {reps}",
        (40, 200),
        cv2.FONT_HERSHEY_SIMPLEX,
        1.2,
        (255, 255, 255),
        3
    )

    cv2.putText(
        frame,
        "UP / DOWN = Change Angle",
        (40, 300),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.8,
        (200, 200, 200),
        2
    )

    cv2.putText(
        frame,
        "R = Reset     Q = Quit",
        (40, 340),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.8,
        (200, 200, 200),
        2
    )

    # Show the test window
    cv2.imshow("Move2Unlock Logic Test", frame)

    # --------------------------------
    # Keyboard input
    # --------------------------------

    key = cv2.waitKey(50) & 0xFF
    print(key)

    if key == ord("q"):
        break

    elif key == ord("r"):
        angle = 160
        state = "STANDING"
        reps = 0

    elif key == ord("a"):  # Up arrow
        angle -= 5

    elif key == ord("d"):  # Down arrow
        angle += 5


cv2.destroyAllWindows()