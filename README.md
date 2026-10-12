# Real-Time Camera Inspection

A browser-based live camera inspection dashboard. It runs Grounding DINO Tiny through Transformers.js and ONNX Runtime Web against live camera frames using camera-only text prompts. Scan history is kept in browser storage.

## What it can identify

Scanning loads `onnx-community/grounding-dino-tiny-ONNX` (first use downloads model weights from Hugging Face). It runs in the browser using ONNX Runtime through Transformers.js. The exported ONNX model accepts a single text prompt, **“a camera”**; this is not a set of distinct CCTV/webcam/DSLR/miniature-camera classes. Sensitivity thresholds are high 0.65, balanced 0.75, and strict 0.85; these are open-vocabulary text-match scores, not calibrated probabilities. Boxes smaller than 16 pixels per edge or 0.005% of the analyzed region are ignored. Fast mode analyzes the full frame; Detail mode analyzes the full frame plus four overlapping high-resolution crops. Camera matches produce red **CAMERA DETECTED — VERIFY CANDIDATE** boxes, model scores, relative center coordinates, and detection times. If audio is enabled, a pulsed alarm sounds while a candidate is present; muting stops it. Manual optical cues are not camera alerts.

**Important model limitation:** Grounding DINO is a general open-vocabulary model, not a camera-specialist model with camera classes in a trained classifier head. This repository contains no camera-labeled training dataset or camera-specialized weights. In a smoke test the model returned a camera match for a DSLR image (score 0.897) and incorrectly matched a soccer ball in a football image (0.626); the configured minimum threshold filtered that one false match. This is not a labeled benchmark, and detection quality for CCTV, webcams, miniatures, and other subtypes is not established. Lookalike objects may still match and visible cameras may be missed. Camera frames are processed in-browser and are not uploaded by this app.

**Manual Sweep** is a separate visible-light image heuristic. It marks a limited number of bright, high-contrast reflections and dark aperture-like patterns as neutral observations, not camera detections or danger alerts. Harmless lamps, screws, shiny surfaces, and image noise can produce the same patterns. The visual signal score measures the heuristic signal only; it is not the probability that a camera is present.

The browser camera API does not expose a standard way to determine whether a built-in camera is infrared-sensitive or to read raw IR measurements. This app therefore does **not** perform IR detection. IR inspection requires separate IR-sensitive hardware and compatible access software; an IR light is not proof of a camera or recording. The camera model is loaded on demand; the optional PDF/JSON report generator is loaded only when requested.

Camera inference is rate-limited to approximately one pass every 1.2 seconds; Detail mode performs five passes per cycle and may be slower. Camera image quality requests either 1280×720 or 1920×1080, subject to the camera and browser. Tiling and optical/digital zoom cannot recover detail the sensor did not resolve. Sensitivity changes score thresholds; it does not train the model or guarantee small-camera detection. Actual FPS depends on the device, browser, and loaded model.

The 10 m, 15 m, and 20 m values are manually selected test conditions, not measured distance or guaranteed operating ranges. Results at those distances depend on target size, resolution, optical zoom, focus, lighting, and motion. Candidates rendered smaller than 24 pixels are flagged as too small for reliable identification. Auto-center magnification is digital display zoom; it does not add image detail or provide optical zoom. No candidates means only that no supported object was identified in the analyzed frame.

This website cannot identify devices outside the frame, behind opaque materials, or too small to resolve. An inactive device may have no visible or IR signal; software cannot establish that a hidden device is absent. No model in this app guarantees detection of all camera types or 10–20 m detection. Use suitable optical zoom or specialized inspection hardware where needed. Treat every result as an unconfirmed lead.

Manual Sweep checks visible reflection and aperture-like patterns only when enabled. Reflections and bright points are not evidence of a camera. The app does not analyze infrared emissions. Phone cameras vary in infrared sensitivity, and the common fingernail-gap mirror test is not reliable for identifying two-way glass.

## Privacy and permissions

- Camera frames are processed in the browser and are not uploaded by this application.
- Grounding DINO weights are downloaded from Hugging Face when you start scanning or select **Load Camera Model**.
- Scan events and preferences are stored in this browser's local storage. A still image is saved only when you request a snapshot.
- Camera access requires permission and a secure context: HTTPS in deployment, or `localhost` during development.
- Alarm playback requires browser audio permission/user interaction. Use the alarm test button after enabling audio.

## Run in VS Code

1. Install Node.js (a version supported by the installed Vite release) and open this folder in VS Code.
2. Open the integrated terminal and install project dependencies:

   ```sh
   npm install
   ```

3. Start the Vite development server:

   ```sh
   npm run dev
   ```

4. Open the local URL printed by Vite (by default `http://localhost:3000`) and allow camera access.
5. Start scanning. The app automatically downloads and initializes the camera-prompt model on first use; camera detection becomes active once the status says **CAMERA MODEL READY**. Use **Manual Sweep** only for separate neutral reflection/aperture cues. Settings adjust sensitivity, inference rate, and the alarm.

### Mobile phones

Open the deployed HTTPS site directly in the phone's browser (current Chrome on Android or Safari on iOS), grant camera permission, and tap **Start**. Camera access is intentionally requested from that tap to satisfy mobile permission and media-playback rules. On a phone-sized viewport the scanner starts with the standard resolution, fast single-frame inference, and a 5 FPS cap to limit heat and battery use; these settings can be changed in **Settings**. The camera selector prefers the rear camera and falls back to an available camera if the requested facing mode is unavailable. A development server opened from a phone over plain HTTP on a LAN address is not a secure context; use HTTPS or a secure local-development setup. Camera availability and inference speed vary by browser and device.

For production verification and preview:

```sh
npm run lint
npm run build
npm run preview
```

## Main project structure

```text
src/
  App.tsx
  main.tsx
  index.css
  components/
    BiometricModal.tsx
    CameraScanner.tsx
    DetectionStatusBadge.tsx
    DisclaimerBanner.tsx
    IgnoreMaskBar.tsx
    IncidentLogsModal.tsx
    Navbar.tsx
    QuickFlashlightBar.tsx
    SettingsModal.tsx
    TelemetryPanel.tsx
  services/
    audio.ts
    biometric.ts
    detector.ts
    glint.ts
    reportGenerator.ts
    visibleApertureDetector.ts
    visibleCameraDetector.ts
  types/
    index.ts
index.html
package.json
vite.config.ts
tsconfig.json
```
