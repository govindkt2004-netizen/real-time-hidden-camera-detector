# Real-Time Camera Inspection

A browser-based live camera inspection dashboard. It runs TensorFlow.js COCO-SSD locally against successive camera frames, highlights model-supported object candidates, and keeps scan history in browser storage.

## What it can identify

The bundled `@tensorflow-models/coco-ssd` `lite_mobilenet_v2` model was trained on the COCO object categories. It reports visible **people** and raises alerts for its **cell phone** and **laptop** categories. Person detections are per-frame estimates, not persistent identities. Camera and TensorFlow.js code are loaded on demand, and the optional PDF/JSON report generator is loaded only when requested. A laptop prediction identifies the laptop body; it does not resolve or verify the presence, visibility, or state of its built-in camera. COCO-SSD has no dedicated camera, webcam, CCTV, pinhole, or micro-camera class, so it cannot reliably detect all cameras. These device predictions are inspection candidates, not confirmation of a hidden camera or that recording is taking place.

Fast scan mode runs one full-frame model pass. Detail mode adds four overlapping image tiles to give small visible objects more input pixels, at the cost of slower updates. Camera image quality requests either 1280×720 or 1920×1080, subject to the camera and browser. Tiling and optical/digital zoom cannot recover detail the sensor did not resolve. The sensitivity setting changes the COCO-SSD score threshold; it does not add classes or train the model for small cameras. The maximum inference-rate control is 5, 10, or 15 frames per second; actual FPS is limited by the selected mode and device.

The 10 m, 15 m, and 20 m values are manually selected test conditions, not measured distance or guaranteed operating ranges. Results at those distances depend on target size, resolution, optical zoom, focus, lighting, and motion. Candidates rendered smaller than 24 pixels are flagged as too small for reliable identification. Auto-center magnification is digital display zoom; it does not add image detail or provide optical zoom. No candidates means only that no supported object was identified in the analyzed frame.

This website cannot reliably identify devices hidden behind opaque materials, powered-off devices, tiny lenses, or objects outside the model's trained categories. Laptop and phone detections do not mean the camera lens itself was detected. Use appropriate optical zoom or specialized inspection equipment when needed. Treat every result as an unconfirmed lead.

The application does not automatically detect lens reflections or infrared emissions. Phone cameras vary in infrared sensitivity, and visible reflections or bright points are not evidence of a camera. The common fingernail-gap mirror test is not reliable for identifying two-way glass.

## Privacy and permissions

- Camera frames are processed in the browser and are not uploaded by this application.
- COCO-SSD model files are fetched by TensorFlow.js from its configured model source when the app initializes.
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
5. Use **Settings** to change the confidence threshold, inference rate, or alarm. Start/stop and pause/resume scanning from the scanner controls; use the camera-switch control on devices with multiple cameras.

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
    reportGenerator.ts
  types/
    index.ts
index.html
package.json
vite.config.ts
tsconfig.json
```
