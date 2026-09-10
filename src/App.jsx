import { useEffect, useRef, useState } from "react"
import {
  FilesetResolver,
  PoseLandmarker,
} from "@mediapipe/tasks-vision"

const SQUAT_ANGLE = 100
const STANDING_ANGLE = 160
const TARGET_REPS = 10
const MAX_SCREEN_TIME = 180
const UNLOCK_DURATION = 30 * 60

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

  const [screen, setScreen] = useState("home")

  const [cameraOn, setCameraOn] = useState(false)
  const [tracking, setTracking] = useState(false)
  const [poseReady, setPoseReady] = useState(false)

  const [reps, setReps] = useState(0)

  const [error, setError] = useState("")

  const [screenLimit, setScreenLimit] = useState(
    () => localStorage.getItem("screenLimit") || "60"
  )

  const [settingsError, setSettingsError] = useState("")
  const [settingsSaved, setSettingsSaved] = useState(false)

  const [locked, setLocked] = useState(false)

  const [sessionComplete, setSessionComplete] = useState(false)
  const [unlockSeconds, setUnlockSeconds] = useState(0)

  useEffect(() => {
    let active = true

    async function loadPose() {
      try {
        const vision = await FilesetResolver.forVisionTasks(
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
        console.error("MediaPipe loading error:", err)
        setPoseReady(false)
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
        requestAnimationFrame(detectPose)
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
        console.error("Video error:", err)

        setError("The camera could not be started.")
        stopCamera()
      }
    }

    connectCamera()
  }, [screen])

  useEffect(() => {
    if (!sessionComplete) {
      return
    }

    stopCamera()
    setUnlockSeconds(UNLOCK_DURATION)
  }, [sessionComplete])

  useEffect(() => {
    if (unlockSeconds <= 0) {
      return
    }

    const timer = setInterval(() => {
      setUnlockSeconds((current) => {
        if (current <= 1) {
          clearInterval(timer)

          setSessionComplete(false)
          setLocked(true)
          setReps(0)

          squatStateRef.current = "STANDING"

          return 0
        }

        return current - 1
      })
    }, 1000)

    return () => {
      clearInterval(timer)
    }
  }, [unlockSeconds])

  async function startCamera() {
    try {
      setError("")

      const stream =
        await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        })

      streamRef.current = stream

      setReps(0)

      squatStateRef.current = "STANDING"

      setLocked(false)
      setScreen("challenge")
    } catch (err) {
      console.error("Camera error:", err)

      setError(
        "Camera access was denied or unavailable."
      )
    }
  }

  function stopCamera() {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }

    if (streamRef.current) {
      streamRef.current
        .getTracks()
        .forEach((track) => track.stop())

      streamRef.current = null
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }

    setCameraOn(false)
    setTracking(false)
  }

  function detectPose() {
    const video = videoRef.current
    const canvas = canvasRef.current
    const pose = poseRef.current

    if (
      !video ||
      !canvas ||
      !pose ||
      video.readyState < 2
    ) {
      animationRef.current =
        requestAnimationFrame(detectPose)

      return
    }

    const results = pose.detectForVideo(
      video,
      performance.now()
    )

    const ctx = canvas.getContext("2d")

    if (
      canvas.width !== video.videoWidth ||
      canvas.height !== video.videoHeight
    ) {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
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

      const landmarks = results.landmarks[0]

      const leftAngle = calculateAngle(
        landmarks[23],
        landmarks[25],
        landmarks[27]
      )

      const rightAngle = calculateAngle(
        landmarks[24],
        landmarks[26],
        landmarks[28]
      )

      const averageAngle =
        (leftAngle + rightAngle) / 2

      if (
        squatStateRef.current === "STANDING" &&
        averageAngle <= SQUAT_ANGLE
      ) {
        squatStateRef.current = "SQUATTING"
      }

      if (
        squatStateRef.current === "SQUATTING" &&
        averageAngle >= STANDING_ANGLE
      ) {
        squatStateRef.current = "STANDING"

        setReps((currentReps) => {
          const nextReps = Math.min(
            currentReps + 1,
            TARGET_REPS
          )

          if (nextReps >= TARGET_REPS) {
            setSessionComplete(true)
          }

          return nextReps
        })
      }

      for (const point of landmarks) {
        const x = point.x * canvas.width
        const y = point.y * canvas.height

        ctx.beginPath()
        ctx.arc(
          x,
          y,
          4,
          0,
          Math.PI * 2
        )

        ctx.fillStyle = "#ff7a00"
        ctx.fill()
      }
    } else {
      setTracking(false)
    }

    animationRef.current =
      requestAnimationFrame(detectPose)
  }

  function resetSession() {
    setReps(0)
    setSessionComplete(false)

    squatStateRef.current = "STANDING"
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

    squatStateRef.current = "STANDING"

    setError("")
    setScreen("home")
  }

  function saveScreenLimit() {
    setSettingsError("")
    setSettingsSaved(false)

    const value = screenLimit.trim()

    if (value === "") {
      setSettingsError(
        "Please enter a screen time limit."
      )

      return
    }

    if (!/^-?\d+$/.test(value)) {
      setSettingsError(
        "Please enter a whole number."
      )

      return
    }

    const minutes = Number(value)

    if (minutes <= 0) {
      setSettingsError(
        "Screen time must be greater than 0 minutes."
      )

      return
    }

    if (minutes > MAX_SCREEN_TIME) {
      setSettingsError(
        `Screen time cannot exceed ${MAX_SCREEN_TIME} minutes.`
      )

      return
    }

    localStorage.setItem(
      "screenLimit",
      String(minutes)
    )

    setScreenLimit(String(minutes))
    setSettingsSaved(true)
  }

  function simulateLimitReached() {
    stopCamera()

    setReps(0)
    setSessionComplete(false)

    squatStateRef.current = "STANDING"

    setLocked(true)
    setError("")
  }

  const progress = Math.min(
    (reps / TARGET_REPS) * 100,
    100
  )

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
              You're <span>unlocked.</span>
            </h1>

            <p className="unlock-subtitle">
              Nice work. Your screen time is
              available again.
            </p>

            <div className="unlock-timer-card">
              <p>
                TIME REMAINING
              </p>

              <strong>
                {formatTime(unlockSeconds)}
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
              Time to <span>move.</span>
            </h1>

            <p className="lock-subtitle">
              You've reached your{" "}
              {screenLimit}-minute
              screen-time limit.
            </p>

            <div className="challenge-summary">
              <p>
                TO UNLOCK
              </p>

              <strong>
                10 Squats
              </strong>

              <span>
                Complete the challenge to
                continue.
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
                Movement detection is still
                loading.
              </p>
            )}
          </div>
        </main>
      </div>
    )
  }

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
              Configure how Move2Unlock works.
            </p>
          </div>

          <section className="settings-card">
            <div className="setting-row">
              <div className="setting-info">
                <h2>
                  Screen Time Limit
                </h2>

                <p>
                  Set how long you can use a
                  selected app before a challenge
                  begins.
                </p>
              </div>

              <div className="setting-control">
                <div className="input-row">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={screenLimit}
                    onChange={(event) => {
                      setScreenLimit(
                        event.target.value
                      )

                      setSettingsError("")
                      setSettingsSaved(false)
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
                  onClick={saveScreenLimit}
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
                  How long browsing stays unlocked
                  after completing a challenge.
                </p>
              </div>

              <div className="setting-value">
                30 min
              </div>
            </div>
          </section>
        </main>
      </div>
    )
  }

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
                tracking ? "active" : ""
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
              <span> squats.</span>
            </h1>

            <p className="subtitle">
              Keep your full body visible to
              the camera.
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
                      Your movement will be
                      detected automatically.
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
                Squats
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
                {TARGET_REPS - reps} reps
                remaining
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
              <span> screen time.</span>
            </h1>

            <p className="subtitle">
              Complete your exercise goal before
              continuing to browse.
            </p>
          </div>

          <button
            className="settings-button"
            onClick={goToSettings}
          >
            Settings
          </button>
        </div>

        <section className="session-grid">
          <div className="camera-card">
            <div className="card-header">
              <span>
                CAMERA
              </span>

              <span className="live-label">
                PREVIEW
              </span>
            </div>

            <div className="camera-container">
              <div className="camera-overlay">
                <div className="camera-icon">
                  +
                </div>

                <p>
                  Start a challenge to enable
                  your camera.
                </p>
              </div>
            </div>
          </div>

          <aside className="stats-card">
            <div className="exercise-label">
              NEXT CHALLENGE
            </div>

            <h2>
              Squats
            </h2>

            <div className="rep-display">
              <span className="rep-number">
                0
              </span>

              <span className="rep-target">
                / {TARGET_REPS}
              </span>
            </div>

            <div className="progress-track">
              <div className="progress-value" />
            </div>

            <p className="progress-text">
              Ready when you are.
            </p>

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
      </main>
    </div>
  )
}

export default App