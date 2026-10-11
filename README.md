# Project Title: Real-Time Hidden Camera Detector

## Objective
Create a simple, professional website that uses a device camera to scan the surroundings in real time for potentially visible hidden cameras. When the system detects a suspicious camera-like object, highlight it with a **red bounding box**, display a **DANGER** warning, and play an alert sound immediately.

## Key Features
- **Live Camera:** Access the device camera and display real-time video.
- **Camera Detection:** Use a real object-detection model to identify camera-like objects in the video feed.
- **Red Danger Alert:** Highlight detected camera-like objects with a flashing red box and a clear DANGER message.
- **Warning Sound:** Play an alarm sound when a suspicious camera-like object is detected.
- **Real-Time Scanning:** Continuously analyze video frames and update detections instantly.
- **Start / Stop Scan:** Provide simple controls to start and stop scanning.
- **Detection Status:** Display “SCANNING” in green when scanning and “POTENTIAL CAMERA DETECTED” in red when a candidate is found.
- **Clean UI:** Use a dark background, red danger indicators, smooth scanning animations, and a responsive design for mobile and desktop.
- **No Fake Results:** Never display random detections. Use genuine model predictions and show an error if the detection model is unavailable.
- **Browser Support:** Handle camera permissions and require HTTPS when deployed.

## Technical Requirements
Use React, TypeScript, and Vite. Use the browser camera API and a compatible, genuinely implemented object-detection model. Add an alert sound that works after the user enables audio. Keep video processing local to the browser wherever possible.

## Expected Outcome
Build a fully functional, simple website that scans a live camera feed, detects recognizable camera-like objects in real time, draws red boxes around potential detections, and plays a danger sound when a candidate is detected. Provide complete working code and instructions to run the website in VS Code.

Important: Do not claim to detect every concealed camera. A normal camera and visual object-detection model cannot reliably identify devices hidden behind objects or cameras that are too small or obscured.