#Import the cv2 python library
import cv2

#Setup camera variable to the cv2 video capture function
camera = cv2.VideoCapture(0)

#While true loops functions within it
while True:

    #Success is a boolean variable (true or false) that detectes whether opencv was able to see the next frame captured from the default camera.
    success, frame = camera.read()

    #If opencv didn't get the next frame (eg. camera permission wasn't given to the IDE) it stops running the code
    if not success:
        print("Could not access camera.")
        break

    #Show camera "frame" value in a window, name the window "Move2Unlock Camera Test"
    cv2.imshow("Move2Unlock Camera Test", frame)

    #If "q" is pressed stop the fuction
    if cv2.waitKey(1) == ord("q"):
        break

#Stop camera use by opencv and destroy all opencv windows
camera.release()
cv2.destroyAllWindows()