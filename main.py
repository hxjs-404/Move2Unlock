import cv2
import mediapipe as mp


mp_hands = mp.solutions.hands

camera = cv2.VideoCapture(0)

# Controls how much the new position affects the smoothed position.
# Higher = more responsive but more jitter.
# Lower = smoother but more delayed.
SMOOTHING = 0.4

smoothed_x = None
smoothed_y = None


with mp_hands.Hands(
    static_image_mode=False,
    max_num_hands=2,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5
) as hands:

    while True:
        success, frame = camera.read()

        if not success:
            print("Could not access camera.")
            break

        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

        results = hands.process(rgb_frame)

        if results.multi_hand_landmarks:

            hand = results.multi_hand_landmarks[0]

            # MediaPipe landmark 8 = index finger tip
            index_finger = hand.landmark[8]

            raw_x = index_finger.x
            raw_y = index_finger.y

            # Start the smoothed position at the first detected position
            if smoothed_x is None:
                smoothed_x = raw_x
                smoothed_y = raw_y
            else:
                # Exponential smoothing
                smoothed_x = (
                    SMOOTHING * raw_x
                    + (1 - SMOOTHING) * smoothed_x
                )

                smoothed_y = (
                    SMOOTHING * raw_y
                    + (1 - SMOOTHING) * smoothed_y
                )

            # Convert smoothed coordinates into pixels
            x = int(smoothed_x * frame.shape[1])
            y = int(smoothed_y * frame.shape[0])

            # Draw the smoothed fingertip
            cv2.circle(
                frame,
                (x, y),
                12,
                (0, 255, 0),
                -1
            )

            # Show the coordinates
            cv2.putText(
                frame,
                f"X: {x}  Y: {y}",
                (20, 40),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.8,
                (0, 255, 0),
                2
            )

        cv2.imshow("Move2Unlock Hand Test", frame)

        if cv2.waitKey(1) == ord("q"):
            break


camera.release()
cv2.destroyAllWindows()