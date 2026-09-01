import cv2

camera = cv2.VideoCapture(0)

while True:
    success, frame = camera.read()

    if not success:
        print("Could not access camera.")
        break

    cv2.imshow("Move2Unlock Camera Test", frame)

    if cv2.waitKey(1) == ord("q"):
        break

camera.release()
cv2.destroyAllWindows()