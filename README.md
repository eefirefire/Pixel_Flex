# 🕹️ Pixel Flex

> A retro-style, single-button contextual action game controlled by an **ESP32 EMG (muscle flex) sensor**.  
> Flex your arm — your stickman reacts.

---

## 📖 Overview

**Pixel Flex** is a browser-based pixel-art game where all in-game actions (grab, drop, dodge, climb, jump) are triggered by a **single physical input** — the electrical signal from your muscles, read by an EMG sensor connected to an ESP32 microcontroller.

The game runs in any browser. A **Flask + SocketIO** backend bridges the serial data from the ESP32 to the frontend game engine in real time.

**No sensor? No problem.** The game includes a full keyboard mode — press `Space` to trigger actions and test all levels without any hardware.

---

## ✨ Features

- 🎮 **Single-button contextual actions** — the game detects the correct action (Grab, Drop, Dodge, Climb, Jump) based on your position and timing
- 💪 **Real EMG control** — your actual muscle flexes control the game via an ESP32 vibration/EMG sensor on **Pin 26**
- 🔬 **In-game calibration** — a 10s REST + 10s FLEX calibration scene sets your personal threshold automatically
- 🏙️ **Animated night-city menu** — procedural pixel-art skyline with neon signs, twinkling stars, and parallax depth
- 👔 **Skin Shop** — 4 unlockable character skins (Classic, Neon, Ninja, Cowboy) purchasable with in-game score
- 🗺️ **Level Select** — 5 levels on an animated node map; levels unlock progressively as you complete them
- 🌦️ **Weather & parallax** — rain effects on Level 3, multi-layer parallax backgrounds per level theme
- 🎵 **Procedural 8-bit audio** — all sounds generated via the Web Audio API (no audio files required)
- 💥 **Combo system** — consecutive successful actions increase a score multiplier with visual feedback
- 📊 **Local dataset logging** — every EMG trigger is saved to a local SQLite database for analysis
- 🔑 **Hysteresis filtering** — 5 consecutive above-threshold readings required before a game action fires, eliminating noise spikes

---

## 🏗️ Repository Structure

```
Pixel_Flex/
│
├── pixel_flex/                  # Main game application
│   ├── app.py                   # Flask + SocketIO backend & EMG serial bridge
│   ├── templates/
│   │   └── index.html           # Game shell (640×480 canvas)
│   └── static/
│       ├── game.js              # Full game engine (menu, calibration, gameplay)
│       └── style.css            # Canvas & page styling
│
└── ArduinoEMG/                  # ESP32 firmware
    ├── AnalogInput/
    │   ├── AnalogInput.ino      # Arduino sketch — streams raw ADC values at ~1kHz
    │   ├── AnalogInput.txt      # Notes
    │   ├── layout.png           # Breadboard wiring diagram
    │   └── schematic.png        # Circuit schematic
    └── app.py                   # Early standalone Python bridge (legacy, for reference)
```

---

## 🔧 Hardware Requirements

| Component | Details |
|---|---|
| **Microcontroller** | ESP32 (any variant with Arduino support) |
| **EMG / Vibration Sensor** | Analog output connected to **GPIO 26** |
| **USB Cable** | USB-A to Micro-USB / USB-C (for serial communication) |
| **Computer** | Windows / macOS / Linux with Python 3.8+ |

### Wiring

| Sensor Pin | ESP32 Pin |
|---|---|
| Signal (OUT) | GPIO **26** |
| VCC | 3.3 V |
| GND | GND |

See `ArduinoEMG/AnalogInput/layout.png` and `schematic.png` for the full wiring diagram.

---

## 💻 Software Requirements

- **Python 3.8+**
- **Arduino IDE 2.x** (to flash the ESP32 firmware)
- **ESP32 board package** installed in Arduino IDE

### Python dependencies

```bash
pip install flask flask-socketio eventlet pyserial
```

---

## 🚀 Getting Started

### 1. Flash the ESP32

1. Open `ArduinoEMG/AnalogInput/AnalogInput.ino` in the Arduino IDE
2. Select your ESP32 board and the correct COM port
3. Upload the sketch

The firmware streams raw 12-bit ADC readings from **Pin 26** over Serial at **115200 baud**, one value per line.

### 2. Run the Game Server

```bash
cd pixel_flex
python app.py
```

The server will:
- Auto-detect your ESP32 across all available COM ports
- Start streaming sensor data to the browser at ~20 Hz
- Print `[SUCCESS] Connected on COMx!` when the ESP32 is found

### 3. Open the Game

Navigate to **http://127.0.0.1:5000** in your browser.

---

## 🎮 Playing the Game

### With EMG Sensor (Full Experience)

1. Connect your ESP32 and start the server (`python app.py`)
2. Open the browser — you'll see the **main menu**
3. Click **CALIBRATE** (orange button) and follow the on-screen prompts:
   - **Phase 1 (10s):** Keep your arm **relaxed** — establishes your noise floor
   - **Phase 2 (10s):** Repeatedly **flex your muscle** — captures your action signal
4. The threshold is calculated and sent to the backend automatically
5. Click **PLAY** and flex to control your stickman!

### Without Sensor (Keyboard / Test Mode)

1. Start the server (`python app.py`) — the sensor is optional
2. Open the browser → click **PLAY** directly (skip calibration)
3. Press **`Space`** at the right moment to trigger each action

### Controls

| Input | Action |
|---|---|
| **Muscle Flex** (EMG) | Trigger current contextual action |
| **Space** | Same as muscle flex (keyboard fallback) |
| **F** | Skip calibration scene |
| **Mouse Click** | Navigate all menu buttons |

### Game Actions (Contextual)

The game automatically displays the required action above your character:

| Action | When |
|---|---|
| **GRAB** | Standing next to an object |
| **DROP** | Carrying an object at a drop zone |
| **DODGE** | Hazard incoming — duck under it |
| **CLIMB** | At the base of a ladder |
| **JUMP** | Platforming section |

---

## 🗺️ Menu Navigation

```
Main Menu
├── CALIBRATE  →  EMG calibration scene (use before playing with sensor)
├── PLAY       →  Start Level 1 immediately
├── STORE      →  Skin Shop (spend score to unlock skins)
└── LEVELS     →  Level Select map (unlocks after completing each level)
```

After completing a level, press **Space** to return to the main menu — the next level will be unlocked in the Level Select screen.

---

## ⚙️ Backend Configuration (`app.py`)

| Variable | Default | Description |
|---|---|---|
| `THRESHOLD` | `1` | Minimum ADC reading to count as a flex (auto-updated by calibration) |
| `COOLDOWN` | `0.4 s` | Minimum time between consecutive game triggers |
| `TRIGGER_HYSTERESIS` | `5` | Consecutive above-threshold readings needed before firing |

The hysteresis filter prevents single-sample noise spikes from accidentally triggering game actions.

---

## 📊 Data Logging

Every EMG peak that meets the threshold is automatically saved to a local SQLite database:

```
pixel_flex/pixel_flex_dataset.db
```

**Schema:**

```sql
CREATE TABLE filtered_metrics (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    raw_value       INTEGER,   -- ADC reading (0–4095)
    is_game_trigger INTEGER,   -- 1 if this reading fired a game action
    timestamp       DATETIME   -- millisecond precision
);
```

This data can be used for training ML models to classify muscle gestures.

---

## 📁 Tech Stack

| Layer | Technology |
|---|---|
| Firmware | Arduino C++ (ESP32) |
| Backend | Python · Flask · Flask-SocketIO · Eventlet |
| Frontend | Vanilla JS · HTML5 Canvas · Web Audio API |
| Database | SQLite3 |
| Transport | WebSocket (SocketIO) |

---

## 🤝 Contributing

Pull requests are welcome! If you find a bug or want to add a new level/skin/mechanic, feel free to open an issue first to discuss the change.

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).