import { useEffect, useRef, useState } from "react"
import {
  FilesetResolver,
  PoseLandmarker,
} from "@mediapipe/tasks-vision"

const SQUAT_ANGLE = 100
const STANDING_ANGLE = 160
const TARGET_REPS = 10

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

function App() {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const poseRef = useRef(null)
  const animationRef = useRef(null)
  const streamRef = useRef(null)
  const squatStateRef = useRef("STANDING")

  const [cameraOn, setCameraOn] = useState(false)
  const [tracking, setTracking] = useState(false)
  const [reps, setReps] = useState(0)
  const [error, setError] = useState("")

  useEffect(() => {
    async function loadPose() {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        )

        poseRef.current = await PoseLandmarker.createFromOptions(
          vision,
          {
            baseOptions: {
              modelAssetPath: "/models/pose_landmarker_lite.task",
            },
            runningMode: "VIDEO",
            numPoses: 1,
          }
        )
      } catch (err) {
        console.error(err)
        setError("Could not load MediaPipe.")
      }
    }

    loadPose()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }

      if (streamRef.current) {
        streamRef.current
          .getTracks()
          .forEach((track) => track.stop())
      }
    }
  }, [])

  async function startCamera() {
    try {
      setError("")

      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      })

      streamRef.current = stream
      videoRef.current.srcObject = stream

      await videoRef.current.play()

      setCameraOn(true)
      animationRef.current = requestAnimationFrame(detectPose)
    } catch (err) {
      console.error(err)
      setError("Could not access the camera.")
    }
  }

  function detectPose() {
    const video = videoRef.current
    const canvas = canvasRef.current
    const pose = poseRef.current

    if (!video || !canvas || !pose) {
      animationRef.current = requestAnimationFrame(detectPose)
      return
    }

    if (video.readyState >= 2) {
      const results = pose.detectForVideo(
        video,
        performance.now()
      )

      const ctx = canvas.getContext("2d")

      canvas.width = video.videoWidth
      canvas.height = video.videoHeight

      ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
      )

      if (results.landmarks.length > 0) {
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

          setReps((currentReps) =>
            Math.min(currentReps + 1, TARGET_REPS)
          )
        }

        for (const point of landmarks) {
          const x = point.x * canvas.width
          const y = point.y * canvas.height

          ctx.beginPath()
          ctx.arc(x, y, 5, 0, Math.PI * 2)

          ctx.fillStyle = "#00ff88"
          ctx.fill()
        }
      } else {
        setTracking(false)
      }
    }

    animationRef.current = requestAnimationFrame(detectPose)
  }

  const progress = Math.min(
    (reps / TARGET_REPS) * 100,
    100
  )

  return (
    <div className="app">
      <header className="topbar">
        <div className="logo">
          Move2Unlock
        </div>

        <div className="status">
          <span
            className={`status-dot ${
              tracking ? "active" : ""
            }`}
          />

          {tracking
            ? "Tracking"
            : cameraOn
              ? "Camera Ready"
              : "Ready"}
        </div>
      </header>

      <main className="dashboard">
        <section className="hero">
          <p className="eyebrow">
            SCREEN TIME
          </p>

          <h1>
            Time to move.
          </h1>

          <p className="subtitle">
            Complete your exercise goal to continue.
          </p>

          <div className="progress-card">
            <div className="progress-header">
              <span>
                Squats
              </span>

              <strong>
                {reps} / {TARGET_REPS}
              </strong>
            </div>

            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{
                  width: `${progress}%`,
                }}
              />
            </div>
          </div>

          {!cameraOn && (
            <button
              className="start-button"
              onClick={startCamera}
            >
              Start Session
            </button>
          )}

          {error && (
            <p className="error">
              {error}
            </p>
          )}
        </section>

        <section className="preview-card">
          <div className="preview-header">
            <span>
              CAMERA
            </span>

            <span className="camera-status">
              {tracking
                ? "TRACKING"
                : cameraOn
                  ? "LIVE"
                  : "OFFLINE"}
            </span>
          </div>

          <div className="camera-preview">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
            />

            <canvas ref={canvasRef} />

            {!cameraOn && (
              <div className="camera-placeholder">
                <div className="camera-icon">
                  ⌾
                </div>

                <p>
                  Start a session to enable your camera
                </p>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
