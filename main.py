import cv2
import mediapipe as mp
import math


mp_pose = mp.solutions.pose

camera = cv2.VideoCapture(0)


def calculate_angle(a, b, c):
    """
    Calculate the angle at point b using points a, b and c.
    """

    angle = math.degrees(
        math.atan2(c[1] - b[1], c[0] - b[0])
        - math.atan2(a[1] - b[1], a[0] - b[0])
    )

    angle = abs(angle)

    if angle > 180:
        angle = 360 - angle

    return angle


with mp_pose.Pose(
    static_image_mode=False,
    model_complexity=1,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5
) as pose:

    while True:
        success, frame = camera.read()

        if not success:
            print("Could not access camera.")
            break

        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

        results = pose.process(rgb_frame)

        if results.pose_landmarks:
            landmarks = results.pose_landmarks.landmark

            # Left leg
            left_hip = landmarks[mp_pose.PoseLandmark.LEFT_HIP]
            left_knee = landmarks[mp_pose.PoseLandmark.LEFT_KNEE]
            left_ankle = landmarks[mp_pose.PoseLandmark.LEFT_ANKLE]

            # Right leg
            right_hip = landmarks[mp_pose.PoseLandmark.RIGHT_HIP]
            right_knee = landmarks[mp_pose.PoseLandmark.RIGHT_KNEE]
            right_ankle = landmarks[mp_pose.PoseLandmark.RIGHT_ANKLE]

            # Convert landmarks into screen coordinates
            def to_pixel(landmark):
                x = int(landmark.x * frame.shape[1])
                y = int(landmark.y * frame.shape[0])
                return x, y

            left_hip_pos = to_pixel(left_hip)
            left_knee_pos = to_pixel(left_knee)
            left_ankle_pos = to_pixel(left_ankle)

            right_hip_pos = to_pixel(right_hip)
            right_knee_pos = to_pixel(right_knee)
            right_ankle_pos = to_pixel(right_ankle)

            # Calculate knee angles
            left_angle = calculate_angle(
                left_hip_pos,
                left_knee_pos,
                left_ankle_pos
            )

            right_angle = calculate_angle(
                right_hip_pos,
                right_knee_pos,
                right_ankle_pos
            )

            # Draw landmarks
            points = [
                left_hip_pos,
                left_knee_pos,
                left_ankle_pos,
                right_hip_pos,
                right_knee_pos,
                right_ankle_pos
            ]

            for point in points:
                cv2.circle(frame, point, 10, (0, 255, 0), -1)

            # Draw left leg
            cv2.line(frame, left_hip_pos, left_knee_pos, (0, 255, 0), 3)
            cv2.line(frame, left_knee_pos, left_ankle_pos, (0, 255, 0), 3)

            # Draw right leg
            cv2.line(frame, right_hip_pos, right_knee_pos, (0, 255, 0), 3)
            cv2.line(frame, right_knee_pos, right_ankle_pos, (0, 255, 0), 3)

            # Draw hips
            cv2.line(frame, left_hip_pos, right_hip_pos, (0, 255, 0), 3)

            # Display knee angles
            cv2.putText(
                frame,
                f"Left knee: {int(left_angle)}",
                (20, 40),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.8,
                (0, 255, 0),
                2
            )

            cv2.putText(
                frame,
                f"Right knee: {int(right_angle)}",
                (20, 75),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.8,
                (0, 255, 0),
                2
            )

        cv2.imshow("Move2Unlock Squat Test", frame)

        if cv2.waitKey(1) == ord("q"):
            break


camera.release()
cv2.destroyAllWindows()