# Real-Time Camera Inspection

A browser-based live camera inspection dashboard. It runs TensorFlow.js COCO-SSD locally against successive camera frames and can optionally load an open-vocabulary ONNX detector to flag visible camera-like objects. Scan history is kept in browser storage.

## What it can identify

The bundled `@tensorflow-models/coco-ssd` `lite_mobilenet_v2` model was trained on COCO categories. Person detections are shown as neutral informational outlines only; they cannot trigger a red camera box, camera warning, history alert, or alarm. If a camera-model candidate overlaps most of a detected person's box, that candidate is suppressed to reduce false alarms on people. This conservative filter can also hide a real camera being held or worn by a person. Its **cell phone** and **laptop** outputs are neutral observations and do not trigger camera warnings or alarms.

Use **Load Camera Model** to download the optional `onnx-community/grounding-dino-tiny-ONNX` open-vocabulary detector (about 230 MB, first use). It runs in the browser using ONNX Runtime through Transformers.js and checks visible frames with a camera-device-and-lens prompt. The detector uses higher score thresholds and ignores boxes smaller than 16 pixels per edge or 0.05% of the frame to avoid warning about objects too small to identify reliably. Only this model's unconfirmed camera-like matches can produce a red **camera-like object — verify** box or, if enabled, the alert sound. This is a general open-set detector, not a camera-specialist model or a validated hidden-camera detector; CCTV, webcam, miniature, and other subtypes have not been separately validated. Matches are unconfirmed model outputs; lookalike objects may trigger them and real cameras may be missed. Its score is not a calibrated probability. Model weights are downloaded from Hugging Face; camera frames are processed in-browser and are not uploaded by this app. The model is not redistributed by this project.

**Manual Sweep** is a separate visible-light image heuristic. It marks a limited number of bright, high-contrast reflections and dark aperture-like patterns as neutral observations, not camera detections or danger alerts. Harmless lamps, screws, shiny surfaces, and image noise can produce the same patterns. The visual signal score measures the heuristic signal only; it is not the probability that a camera is present.

The browser camera API does not expose a standard way to determine whether a built-in camera is infrared-sensitive or to read raw IR measurements. This app therefore does **not** perform IR detection. IR inspection requires separate IR-sensitive hardware and compatible access software; an IR light is not proof of a camera or recording. Camera and TensorFlow.js code are loaded on demand, and the optional PDF/JSON report generator is loaded only when requested. A laptop prediction identifies the laptop body; it does not verify the presence, visibility, or state of its built-in camera.

Fast scan mode runs one full-frame COCO-SSD pass; Detail mode adds four overlapping image tiles. The optional camera model checks the full frame at a lower rate because open-vocabulary inference is slower. Camera image quality requests either 1280×720 or 1920×1080, subject to the camera and browser. Tiling and optical/digital zoom cannot recover detail the sensor did not resolve. Sensitivity changes score thresholds; it does not train the model or guarantee small-camera detection. Actual FPS depends on the device, browser, and loaded models.

The 10 m, 15 m, and 20 m values are manually selected test conditions, not measured distance or guaranteed operating ranges. Results at those distances depend on target size, resolution, optical zoom, focus, lighting, and motion. Candidates rendered smaller than 24 pixels are flagged as too small for reliable identification. Auto-center magnification is digital display zoom; it does not add image detail or provide optical zoom. No candidates means only that no supported object was identified in the analyzed frame.

This website cannot identify devices outside the frame, behind opaque materials, or too small to resolve. An inactive device may have no visible or IR signal; software cannot establish that a hidden device is absent. Laptop and phone detections do not mean their camera lenses were detected. No model in this app guarantees detection of all camera types or 10–20 m detection. Use suitable optical zoom or specialized inspection hardware where needed. Treat every result as an unconfirmed lead.

Manual Sweep checks visible reflection and aperture-like patterns only when enabled. Reflections and bright points are not evidence of a camera. The app does not analyze infrared emissions. Phone cameras vary in infrared sensitivity, and the common fingernail-gap mirror test is not reliable for identifying two-way glass.

## Privacy and permissions

- Camera frames are processed in the browser and are not uploaded by this application.
- COCO-SSD model files are fetched by TensorFlow.js from its configured model source when the app initializes. Grounding DINO weights are downloaded from Hugging Face only after you select **Load Camera Model**.
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
5. Start scanning, then use **Load Camera Model** to enable best-effort visible camera-like object prompts. This downloads about 230 MB of model files the first time. Use **Manual Sweep** only for separate neutral reflection/aperture cues. Settings adjust sensitivity, inference rate, and the alarm.

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
