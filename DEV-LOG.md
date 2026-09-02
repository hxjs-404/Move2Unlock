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