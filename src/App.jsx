import { useEffect, useRef, useState } from "react"
import {
  FilesetResolver,
  PoseLandmarker,
} from "@mediapipe/tasks-vision"

const SQUAT_ANGLE = 100
const STANDING_ANGLE = 160

const PUSHUP_DOWN_ANGLE = 95
const PUSHUP_UP_ANGLE = 155

const TARGET_REPS = 10
const MAX_SCREEN_TIME = 180
const UNLOCK_DURATION = 30 * 60

const EXERCISES = [
  {
    id: "squats",
    name: "Squats",
  },
  {
    id: "pushups",
    name: "Push-ups",
  },
  {
    id: "starjumps",
    name: "Star Jumps",
  },
]

function calculateAngle(a, b, c) {
  const radians =
    Math.atan2(c.y - b.y, c.x - b.x) -
    Math.atan2(a.y - b.y, a.x - b.x)

  let angle = Math.abs(radians * (180 / Math.PI))

  if (angle > 180) {
    angle = 360 - angle
  }

  return angle
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60

  return `${String(minutes).padStart(2, "0")}:${String(
    remainingSeconds
  ).padStart(2, "0")}`
}

function App() {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)

  const poseRef = useRef(null)
  const streamRef = useRef(null)
  const animationRef = useRef(null)

  const squatStateRef = useRef("STANDING")
  const pushupStateRef = useRef("UP")
  const starJumpStateRef = useRef("CLOSED")

  const [screen, setScreen] = useState("home")

  const [cameraOn, setCameraOn] = useState(false)
  const [tracking, setTracking] = useState(false)
  const [poseReady, setPoseReady] = useState(false)

  const [reps, setReps] = useState(0)

  const [error, setError] = useState("")

  const [screenLimit, setScreenLimit] = useState(
    () => localStorage.getItem("screenLimit") || "60"
  )

  const [screenTimeSeconds, setScreenTimeSeconds] = useState(0)

  const [settingsError, setSettingsError] = useState("")
  const [settingsSaved, setSettingsSaved] = useState(false)

  const [locked, setLocked] = useState(false)

  const [sessionComplete, setSessionComplete] = useState(false)
  const [unlockSeconds, setUnlockSeconds] = useState(0)

  const [selectedExercise, setSelectedExercise] = useState(
    () => localStorage.getItem("selectedExercise") || "squats"
  )

  const [wheelRotation, setWheelRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)

  const [statistics, setStatistics] = useState(() => {
    const saved = localStorage.getItem("statistics")

    if (!saved) {
      return {
        challengesCompleted: 0,
        totalReps: 0,
        totalUnlockMinutes: 0,
      }
    }

    try {
      const parsed = JSON.parse(saved)

      return {
        challengesCompleted:
          Number(parsed.challengesCompleted) || 0,

        totalReps:
          Number(parsed.totalReps) || 0,

        totalUnlockMinutes:
          Number(parsed.totalUnlockMinutes) || 0,
      }
    } catch {
      return {
        challengesCompleted: 0,
        totalReps: 0,
        totalUnlockMinutes: 0,
      }
    }
  })

  const selectedExerciseData =
    EXERCISES.find(
      (exercise) =>
        exercise.id === selectedExercise
    ) || EXERCISES[0]

  useEffect(() => {
    localStorage.setItem(
      "statistics",
      JSON.stringify(statistics)
    )
  }, [statistics])

  useEffect(() => {
    localStorage.setItem(
      "selectedExercise",
      selectedExercise
    )
  }, [selectedExercise])

  useEffect(() => {
    let active = true

    async function loadPose() {
      try {
        const vision =
          await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm"
          )

        const landmarker =
          await PoseLandmarker.createFromOptions(
            vision,
            {
              baseOptions: {
                modelAssetPath:
                  "/models/pose_landmarker_lite.task",
              },

              runningMode: "VIDEO",
              numPoses: 1,
            }
          )

        if (!active) {
          landmarker.close()
          return
        }

        poseRef.current = landmarker
        setPoseReady(true)
      } catch (err) {
        console.error(
          "MediaPipe loading error:",
          err
        )

        setPoseReady(false)

        setError(
          "Movement detection could not be loaded."
        )
      }
    }

    loadPose()

    return () => {
      active = false

      if (poseRef.current) {
        poseRef.current.close()
        poseRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (
      cameraOn &&
      poseReady &&
      !animationRef.current
    ) {
      animationRef.current =
        requestAnimationFrame(
          detectPose
        )
    }
  }, [cameraOn, poseReady])

  useEffect(() => {
    if (
      screen !== "challenge" ||
      !streamRef.current ||
      !videoRef.current
    ) {
      return
    }

    async function connectCamera() {
      try {
        videoRef.current.srcObject =
          streamRef.current

        await videoRef.current.play()

        setCameraOn(true)
      } catch (err) {
        console.error(
          "Video error:",
          err
        )

        setError(
          "The camera could not be started."
        )

        stopCamera()
      }
    }

    connectCamera()
  }, [screen])

  useEffect(() => {
    if (
      screen !== "home" ||
      locked ||
      sessionComplete
    ) {
      return
    }

    const timer = setInterval(() => {
      setScreenTimeSeconds(
        (current) => current + 1
      )
    }, 1000)

    return () => {
      clearInterval(timer)
    }
  }, [
    screen,
    locked,
    sessionComplete,
  ])

  useEffect(() => {
    const limitSeconds =
      Number(screenLimit) * 60

    if (
      screen !== "home" ||
      locked ||
      sessionComplete ||
      !Number.isFinite(limitSeconds) ||
      limitSeconds <= 0
    ) {
      return
    }

    if (
      screenTimeSeconds >= limitSeconds
    ) {
      stopCamera()

      setReps(0)
      setSessionComplete(false)

      resetExerciseStates()

      setLocked(true)
      setError("")
    }
  }, [
    screenTimeSeconds,
    screenLimit,
    screen,
    locked,
    sessionComplete,
  ])

  useEffect(() => {
    if (!sessionComplete) {
      return
    }

    stopCamera()

    setUnlockSeconds(
      UNLOCK_DURATION
    )
  }, [sessionComplete])

  useEffect(() => {
    if (unlockSeconds <= 0) {
      return
    }

    const timer = setInterval(() => {
      setUnlockSeconds(
        (current) => {
          if (current <= 1) {
            clearInterval(timer)

            setSessionComplete(false)
            setLocked(true)
            setReps(0)
            setScreenTimeSeconds(0)

            resetExerciseStates()

            return 0
          }

          return current - 1
        }
      )
    }, 1000)

    return () => {
      clearInterval(timer)
    }
  }, [unlockSeconds])

  function resetExerciseStates() {
    squatStateRef.current = "STANDING"
    pushupStateRef.current = "UP"
    starJumpStateRef.current = "CLOSED"
  }

function spinWheel() {
  if (spinning) {
    return
  }

  const segmentAngle = 360 / EXERCISES.length

  // Randomly choose which exercise wins
  const chosenIndex = Math.floor(
    Math.random() * EXERCISES.length
  )

  /*
   * Choose a random point INSIDE the selected segment.
   * We stay 12° away from either edge so the pointer
   * never lands awkwardly on a boundary.
   */
  const randomOffset =
    12 +
    Math.random() * (segmentAngle - 24)

  const targetAngle =
    chosenIndex * segmentAngle + randomOffset

  /*
   * The pointer is at the top of the wheel.
   *
   * To place targetAngle under the pointer,
   * the wheel needs to rotate by the opposite angle.
   */
  const currentRotation =
    ((wheelRotation % 360) + 360) % 360

  const targetRotation =
    (360 - targetAngle) % 360

  let rotationNeeded =
    targetRotation - currentRotation

  if (rotationNeeded < 0) {
    rotationNeeded += 360
  }

  // Random number of full spins
  const extraSpins =
    6 + Math.floor(Math.random() * 4)

  const finalRotation =
    wheelRotation +
    extraSpins * 360 +
    rotationNeeded

  setSpinning(true)
  setWheelRotation(finalRotation)

  setTimeout(() => {
    setSelectedExercise(
      EXERCISES[chosenIndex].id
    )

    setSpinning(false)
  }, 4200)
}

  function stopCamera() {
    if (animationRef.current) {
      cancelAnimationFrame(
        animationRef.current
      )

      animationRef.current = null
    }

    if (streamRef.current) {
      streamRef.current
        .getTracks()
        .forEach((track) => track.stop())

      streamRef.current = null
    }

    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.srcObject = null
    }

    setCameraOn(false)
    setTracking(false)
  }

  function recordCompletedChallenge(
    completedReps
  ) {
    setStatistics((current) => ({
      challengesCompleted:
        current.challengesCompleted + 1,

      totalReps:
        current.totalReps + completedReps,

      totalUnlockMinutes:
        current.totalUnlockMinutes +
        UNLOCK_DURATION / 60,
    }))
  }

  function addRep() {
    setReps((currentReps) => {
      const nextReps = Math.min(
        currentReps + 1,
        TARGET_REPS
      )

      if (nextReps >= TARGET_REPS) {
        recordCompletedChallenge(
          TARGET_REPS
        )

        setSessionComplete(true)
      }

      return nextReps
    })
  }

  function detectSquat(landmarks) {
    const leftAngle =
      calculateAngle(
        landmarks[23],
        landmarks[25],
        landmarks[27]
      )

    const rightAngle =
      calculateAngle(
        landmarks[24],
        landmarks[26],
        landmarks[28]
      )

    const averageAngle =
      (leftAngle + rightAngle) / 2

    if (
      squatStateRef.current ===
        "STANDING" &&
      averageAngle <=
        SQUAT_ANGLE
    ) {
      squatStateRef.current =
        "SQUATTING"
    }

    if (
      squatStateRef.current ===
        "SQUATTING" &&
      averageAngle >=
        STANDING_ANGLE
    ) {
      squatStateRef.current =
        "STANDING"

      addRep()
    }
  }

  function detectPushup(landmarks) {
    const leftAngle =
      calculateAngle(
        landmarks[11],
        landmarks[13],
        landmarks[15]
      )

    const rightAngle =
      calculateAngle(
        landmarks[12],
        landmarks[14],
        landmarks[16]
      )

    const shoulderY =
      (landmarks[11].y +
        landmarks[12].y) /
      2

    const hipY =
      (landmarks[23].y +
        landmarks[24].y) /
      2

    const bodyHorizontal =
      Math.abs(
        shoulderY - hipY
      ) < 0.35

    if (!bodyHorizontal) {
      return
    }

    const averageElbowAngle =
      (leftAngle + rightAngle) / 2

    if (
      pushupStateRef.current ===
        "UP" &&
      averageElbowAngle <=
        PUSHUP_DOWN_ANGLE
    ) {
      pushupStateRef.current =
        "DOWN"
    }

    if (
      pushupStateRef.current ===
        "DOWN" &&
      averageElbowAngle >=
        PUSHUP_UP_ANGLE
    ) {
      pushupStateRef.current =
        "UP"

      addRep()
    }
  }

  function detectStarJump(landmarks) {
    const wristsAboveShoulders =
      landmarks[15].y <
        landmarks[11].y &&
      landmarks[16].y <
        landmarks[12].y

    const ankleDistance =
      Math.abs(
        landmarks[27].x -
          landmarks[28].x
      )

    const hipDistance =
      Math.abs(
        landmarks[23].x -
          landmarks[24].x
      )

    const legsOpen =
      ankleDistance >
      hipDistance * 1.35

    const legsClosed =
      ankleDistance <
      hipDistance * 1.15

    const isOpen =
      wristsAboveShoulders &&
      legsOpen

    const isClosed =
      !wristsAboveShoulders &&
      legsClosed

    if (
      starJumpStateRef.current ===
        "CLOSED" &&
      isOpen
    ) {
      starJumpStateRef.current =
        "OPEN"
    }

    if (
      starJumpStateRef.current ===
        "OPEN" &&
      isClosed
    ) {
      starJumpStateRef.current =
        "CLOSED"

      addRep()
    }
  }

  function detectExercise(
    landmarks
  ) {
    if (
      selectedExercise ===
      "squats"
    ) {
      detectSquat(
        landmarks
      )

      return
    }

    if (
      selectedExercise ===
      "pushups"
    ) {
      detectPushup(
        landmarks
      )

      return
    }

    if (
      selectedExercise ===
      "starjumps"
    ) {
      detectStarJump(
        landmarks
      )
    }
  }

  function detectPose() {
    const video =
      videoRef.current

    const canvas =
      canvasRef.current

    const pose =
      poseRef.current

    if (
      !video ||
      !canvas ||
      !pose ||
      video.readyState < 2
    ) {
      animationRef.current =
        requestAnimationFrame(
          detectPose
        )

      return
    }

    try {
      const results =
        pose.detectForVideo(
          video,
          performance.now()
        )

      const ctx =
        canvas.getContext("2d")

      if (
        canvas.width !==
          video.videoWidth ||
        canvas.height !==
          video.videoHeight
      ) {
        canvas.width =
          video.videoWidth

        canvas.height =
          video.videoHeight
      }

      ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
      )

      if (
        results.landmarks &&
        results.landmarks.length > 0
      ) {
        setTracking(true)

        const landmarks =
          results.landmarks[0]

        detectExercise(
          landmarks
        )

        const points =
          landmarks.map(
            (landmark) => ({
              x:
                landmark.x *
                canvas.width,

              y:
                landmark.y *
                canvas.height,
            })
          )

        const connections = [
          [11, 12],
          [11, 13],
          [13, 15],
          [12, 14],
          [14, 16],
          [11, 23],
          [12, 24],
          [23, 24],
          [23, 25],
          [25, 27],
          [24, 26],
          [26, 28],
        ]

        ctx.strokeStyle =
          "#ff7a00"

        ctx.lineWidth = 4
        ctx.lineCap = "round"

        for (
          const [start, end]
          of connections
        ) {
          ctx.beginPath()

          ctx.moveTo(
            points[start].x,
            points[start].y
          )

          ctx.lineTo(
            points[end].x,
            points[end].y
          )

          ctx.stroke()
        }

        ctx.fillStyle =
          "#ff7a00"

        for (
          const point of points
        ) {
          ctx.beginPath()

          ctx.arc(
            point.x,
            point.y,
            5,
            0,
            Math.PI * 2
          )

          ctx.fill()
        }
      } else {
        setTracking(false)
      }
    } catch (err) {
      console.error(
        "Pose detection error:",
        err
      )

      setError(
        err instanceof Error
          ? err.message
          : String(err)
      )
    }

    animationRef.current =
      requestAnimationFrame(
        detectPose
      )
  }

  function resetSession() {
    setReps(0)
    setSessionComplete(false)

    resetExerciseStates()
  }

  function goToSettings() {
    stopCamera()

    setLocked(false)
    setSessionComplete(false)

    setScreen("settings")

    setSettingsError("")
    setSettingsSaved(false)
  }

  function goHome() {
    stopCamera()

    setLocked(false)
    setSessionComplete(false)
    setUnlockSeconds(0)
    setReps(0)
    setScreenTimeSeconds(0)

    resetExerciseStates()

    setError("")
    setScreen("home")
  }

  function saveScreenLimit() {
    setSettingsError("")
    setSettingsSaved(false)

    const value =
      screenLimit.trim()

    if (value === "") {
      setSettingsError(
        "Please enter a screen time limit."
      )

      return
    }

    if (
      !/^-?\d+$/.test(value)
    ) {
      setSettingsError(
        "Please enter a whole number."
      )

      return
    }

    const minutes =
      Number(value)

    if (minutes <= 0) {
      setSettingsError(
        "Screen time must be greater than 0 minutes."
      )

      return
    }

    if (
      minutes > MAX_SCREEN_TIME
    ) {
      setSettingsError(
        `Screen time cannot exceed ${MAX_SCREEN_TIME} minutes.`
      )

      return
    }

    localStorage.setItem(
      "screenLimit",
      String(minutes)
    )

    setScreenLimit(
      String(minutes)
    )

    setSettingsSaved(true)
  }

  function simulateLimitReached() {
    stopCamera()

    setReps(0)
    setSessionComplete(false)

    resetExerciseStates()

    setLocked(true)
    setError("")
  }

  const progress = Math.min(
    (reps / TARGET_REPS) *
      100,
    100
  )

  const limitSeconds =
    Number(screenLimit) * 60

  const remainingScreenSeconds =
    Math.max(
      limitSeconds -
        screenTimeSeconds,
      0
    )

  /*
   * UNLOCK SCREEN
   */
  if (sessionComplete) {
    return (
      <div className="app">
        <header className="topbar">
          <div>
            <div className="logo">
              Move2Unlock
            </div>

            <div className="tagline">
              Move first. Scroll later.
            </div>
          </div>

          <div className="status-pill unlocked">
            <span className="status-dot active" />

            Unlocked
          </div>
        </header>

        <main className="unlock-screen">
          <div className="unlock-content">
            <div className="success-icon">
              ✓
            </div>

            <p className="eyebrow">
              CHALLENGE COMPLETE
            </p>

            <h1>
              You're{" "}
              <span>
                unlocked.
              </span>
            </h1>

            <p className="unlock-subtitle">
              Nice work. Your screen
              time is available again.
            </p>

            <div className="unlock-timer-card">
              <p>
                TIME REMAINING
              </p>

              <strong>
                {formatTime(
                  unlockSeconds
                )}
              </strong>
            </div>

            <button
              className="primary-button unlock-button"
              onClick={goHome}
            >
              Return Home
            </button>
          </div>
        </main>
      </div>
    )
  }

  /*
   * LOCKED SCREEN
   */
  if (locked) {
    return (
      <div className="app">
        <header className="topbar">
          <div>
            <div className="logo">
              Move2Unlock
            </div>

            <div className="tagline">
              Move first. Scroll later.
            </div>
          </div>

          <div className="status-pill locked">
            <span className="status-dot active" />

            Locked
          </div>
        </header>

        <main className="lock-screen">
          <div className="lock-content">
            <div className="lock-icon">
              🔒
            </div>

            <p className="eyebrow">
              SCREEN TIME LIMIT REACHED
            </p>

            <h1>
              Time to{" "}
              <span>
                move.
              </span>
            </h1>

            <p className="lock-subtitle">
              You've reached your{" "}
              {screenLimit}
              -minute screen-time
              limit.
            </p>

            <div className="challenge-summary">
              <p>
                TO UNLOCK
              </p>

              <strong>
                10{" "}
                {selectedExerciseData.name}
              </strong>

              <span>
                Complete the challenge
                to continue.
              </span>
            </div>

            <button
              className="primary-button lock-button"
              onClick={startCamera}
            >
              Start Challenge
            </button>

            <button
              className="secondary-button lock-back-button"
              onClick={goHome}
            >
              Back
            </button>

            {error && (
              <p className="error">
                {error}
              </p>
            )}

            {!poseReady && (
              <p className="detection-status">
                Movement detection is
                still loading.
              </p>
            )}
          </div>
        </main>
      </div>
    )
  }

  /*
   * SETTINGS
   */
  if (screen === "settings") {
    return (
      <div className="app">
        <header className="topbar">
          <div>
            <div className="logo">
              Move2Unlock
            </div>

            <div className="tagline">
              Move first. Scroll later.
            </div>
          </div>

          <div className="status-pill">
            <span className="status-dot" />

            Ready
          </div>
        </header>

        <main className="main-content settings-page">
          <button
            className="back-button"
            onClick={goHome}
          >
            ← Back
          </button>

          <div className="settings-header">
            <p className="eyebrow">
              PREFERENCES
            </p>

            <h1>
              Settings
            </h1>

            <p className="subtitle">
              Configure how Move2Unlock
              works.
            </p>
          </div>

          <section className="settings-card">
            <div className="setting-row">
              <div className="setting-info">
                <h2>
                  Screen Time Limit
                </h2>

                <p>
                  Set how long you can
                  use a selected app
                  before a challenge
                  begins.
                </p>
              </div>

              <div className="setting-control">
                <div className="input-row">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={screenLimit}
                    onChange={(
                      event
                    ) => {
                      setScreenLimit(
                        event.target.value
                      )

                      setSettingsError(
                        ""
                      )

                      setSettingsSaved(
                        false
                      )
                    }}
                    placeholder="60"
                    aria-label="Screen time limit in minutes"
                  />

                  <span>
                    minutes
                  </span>
                </div>

                <button
                  className="save-button"
                  onClick={
                    saveScreenLimit
                  }
                >
                  Save
                </button>

                {settingsError && (
                  <p className="settings-error">
                    {settingsError}
                  </p>
                )}

                {settingsSaved && (
                  <p className="settings-success">
                    Saved successfully.
                  </p>
                )}
              </div>
            </div>

            <div className="setting-row">
              <div className="setting-info">
                <h2>
                  Unlock Duration
                </h2>

                <p>
                  How long browsing stays
                  unlocked after
                  completing a challenge.
                </p>
              </div>

              <div className="setting-value">
                30 min
              </div>
            </div>

            <div className="setting-row">
              <div className="setting-info">
                <h2>
                  Challenge Statistics
                </h2>

                <p>
                  Your completed
                  challenges are saved
                  locally on this device.
                </p>
              </div>

              <div className="setting-value">
                {
                  statistics.challengesCompleted
                }
              </div>
            </div>

            <div className="setting-row">
              <div className="setting-info">
                <h2>
                  Current Exercise
                </h2>

                <p>
                  The exercise selected
                  by the challenge wheel.
                </p>
              </div>

              <div className="setting-value">
                {
                  selectedExerciseData.name
                }
              </div>
            </div>
          </section>
        </main>
      </div>
    )
  }

  /*
   * CHALLENGE
   */
  if (screen === "challenge") {
    return (
      <div className="app">
        <header className="topbar">
          <div>
            <div className="logo">
              Move2Unlock
            </div>

            <div className="tagline">
              Move first. Scroll later.
            </div>
          </div>

          <div className="status-pill">
            <span
              className={`status-dot ${
                tracking
                  ? "active"
                  : ""
              }`}
            />

            {tracking
              ? "Tracking"
              : "Move into view"}
          </div>
        </header>

        <main className="challenge-page">
          <div className="challenge-header">
            <p className="eyebrow">
              CHALLENGE
            </p>

            <h1>
              Complete your
              <span>
                {" "}
                {selectedExerciseData.name.toLowerCase()}.
              </span>
            </h1>

            <p className="subtitle">
              Keep your full body visible
              to the camera.
            </p>
          </div>

          <section className="challenge-grid">
            <div className="camera-card">
              <div className="card-header">
                <span>
                  CAMERA
                </span>

                <span className="live-label">
                  {tracking
                    ? "● TRACKING"
                    : cameraOn
                      ? "● LIVE"
                      : "● STARTING"}
                </span>
              </div>

              <div className="camera-container">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                />

                <canvas
                  ref={canvasRef}
                />

                {!tracking && (
                  <div className="camera-message">
                    <p>
                      Move into camera view
                    </p>

                    <span>
                      Your movement will
                      be detected
                      automatically.
                    </span>
                  </div>
                )}
              </div>
            </div>

            <aside className="challenge-stats">
              <p className="exercise-label">
                CURRENT EXERCISE
              </p>

              <h2>
                {
                  selectedExerciseData.name
                }
              </h2>

              <div className="rep-display">
                <span className="rep-number">
                  {reps}
                </span>

                <span className="rep-target">
                  / {TARGET_REPS}
                </span>
              </div>

              <div className="progress-track">
                <div
                  className="progress-value"
                  style={{
                    width: `${progress}%`,
                  }}
                />
              </div>

              <p className="progress-text">
                {TARGET_REPS -
                  reps}{" "}
                reps remaining
              </p>

              <button
                className="secondary-button"
                onClick={() => {
                  stopCamera()
                  resetSession()
                  setScreen("home")
                }}
              >
                Stop Challenge
              </button>
            </aside>
          </section>
        </main>
      </div>
    )
  }

  /*
   * HOME
   */
  return (
    <div className="app">
      <header className="topbar">
        <div>
          <div className="logo">
            Move2Unlock
          </div>

          <div className="tagline">
            Move first. Scroll later.
          </div>
        </div>

        <div className="status-pill">
          <span className="status-dot" />

          Ready
        </div>
      </header>

      <main className="main-content">
        <div className="page-header">
          <div>
            <p className="eyebrow">
              TIME FOR A RESET
            </p>

            <h1>
              Earn your
              <span>
                {" "}
                screen time.
              </span>
            </h1>

            <p className="subtitle">
              Spin the wheel to choose
              your challenge.
            </p>
          </div>

          <button
            className="settings-button"
            onClick={
              goToSettings
            }
          >
            Settings
          </button>
        </div>

        <section className="wheel-layout">
          <div className="wheel-card">
            <div className="card-header">
              <span>
                EXERCISE SELECTION
              </span>

              <span className="live-label">
                RANDOM
              </span>
            </div>

            <div className="wheel-stage">
              <div className="wheel-pointer">
                ▼
              </div>

              <div
                className={`exercise-wheel ${
                  spinning
                    ? "spinning"
                    : ""
                }`}
                style={{
                  transform: `rotate(${wheelRotation}deg)`,
                  "--wheel-rotation": `${wheelRotation}deg`,
                }}
              >
                <div className="wheel-center">
                  <span>
                    MOVE
                  </span>
                </div>

                <div className="wheel-label wheel-label-1">
                  Squats
                </div>

                <div className="wheel-label wheel-label-2">
                  Push-ups
                </div>

                <div className="wheel-label wheel-label-3">
                  Star Jumps
                </div>
              </div>
            </div>

            <div className="wheel-result">
              <span>
                SELECTED
              </span>

              <strong>
                {
                  selectedExerciseData.name
                }
              </strong>
            </div>

            <button
              className="primary-button spin-button"
              onClick={spinWheel}
              disabled={spinning}
            >
              {spinning
                ? "Spinning..."
                : "Spin Wheel"}
            </button>
          </div>

          <aside className="stats-card">
            <div className="exercise-label">
              SCREEN TIME
            </div>

            <h2>
              {formatTime(
                screenTimeSeconds
              )}
            </h2>

            <div className="progress-track">
              <div
                className="progress-value"
                style={{
                  width: `${Math.min(
                    (screenTimeSeconds /
                      Math.max(
                        limitSeconds,
                        1
                      )) *
                      100,
                    100
                  )}%`,
                }}
              />
            </div>

            <p className="progress-text">
              {formatTime(
                remainingScreenSeconds
              )}{" "}
              remaining until your
              screen-time limit.
            </p>

            <div className="home-exercise">
              <span>
                NEXT CHALLENGE
              </span>

              <strong>
                {
                  selectedExerciseData.name
                }
              </strong>

              <small>
                10 reps
              </small>
            </div>

            <button
              className="primary-button"
              onClick={
                simulateLimitReached
              }
            >
              Simulate Limit Reached
            </button>
          </aside>
        </section>

        <section className="statistics-section">
          <div className="statistics-header">
            <div>
              <p className="eyebrow">
                YOUR PROGRESS
              </p>

              <h2>
                Statistics
              </h2>
            </div>
          </div>

          <div className="statistics-grid">
            <div className="statistics-card">
              <span>
                CHALLENGES
              </span>

              <strong>
                {
                  statistics.challengesCompleted
                }
              </strong>
            </div>

            <div className="statistics-card">
              <span>
                TOTAL REPS
              </span>

              <strong>
                {
                  statistics.totalReps
                }
              </strong>
            </div>

            <div className="statistics-card">
              <span>
                UNLOCK TIME
              </span>

              <strong>
                {
                  statistics.totalUnlockMinutes
                }

                <small>
                  {" "}
                  min
                </small>
              </strong>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

export default App