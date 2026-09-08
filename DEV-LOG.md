# Move2Unlock Development Log

## 1 September 2026 — Project Setup

### What I did
- Created the Move2Unlock GitHub repository.
- Set up the project on my Mac.
- Created a Python virtual environment.
- Connected the local repository to GitHub.

### What I learnt
- `git init` creates a local Git repository.
- `git add` stages changes.
- `git commit` records a version of the project.
- `git push` sends commits to GitHub.
- A Python virtual environment isolates project dependencies.

### Problems I encountered
I initially created the Git repository in the wrong directory on the school Windows computer. This caused Git to see files from my entire user folder, so I removed the repository and re-initialised it inside the correct project folder.

### Next step
Get the laptop camera working with Python.


## 2 September 2026 — Camera Test

### What I did
- Installed OpenCV using pip.
- Created a Python program that accesses the laptop webcam.
- Successfully displayed a live camera feed.

### What I learnt
- OpenCV can access hardware such as a webcam.
- `cv2.VideoCapture(0)` connects to the default camera.
- A loop can continuously read individual camera frames.
- `cv2.imshow()` can display those frames.

### Result
The laptop camera successfully works with Python.

### Next step
Add pose detection so the program can recognise body movement.

## 2 September 2026 — Performance Issue

### Problem
The pose detection worked, but the camera feed was very laggy.

### Possible causes
- Pose detection was being performed on every frame.
- The pose model was using model complexity 1.
- The camera was processing a relatively large image.
- Debug messages were being printed continuously.

### Next step
Optimise the pose detection so the camera feed is smoother.

## 4 September 2026 — Environment Setup

- Added `requirements.txt` with pinned versions for Python 3.12, MediaPipe, OpenCV and NumPy.
- Added `setup.sh` to automate environment setup.
- Standardised the project on Python 3.12 and MediaPipe 0.10.21.
- Verified the required packages work together.

## 7 September 2026 — Squat Logic Testing

- Added simulated knee-angle testing without the camera. (Logic-Test)
- Added standing/squatting states and rep counting. 
- Added adjustable squat angle thresholds.
- Added keyboard controls for testing the logic. (Logic-Test)
- Separated squat detection logic from MediaPipe tracking.