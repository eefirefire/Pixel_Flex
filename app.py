import eventlet
eventlet.monkey_patch()

from flask import Flask, render_template
from flask_socketio import SocketIO
import serial
import serial.tools.list_ports
import sqlite3
from datetime import datetime

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

# --- CONFIGURATION ---
THRESHOLD = 1  # Only values >= this will be logged
COOLDOWN = 0.4    # Minimum time between game actions
last_action_time = 0
last_raw_emit_time = 0  # Throttle raw sensor stream to 20Hz
trigger_count = 0       # Consecutive above-threshold readings (hysteresis counter)
TRIGGER_HYSTERESIS = 5  # How many consecutive reads above threshold before firing

# --- DATABASE INITIALIZATION ---
def init_db():
    """Creates the local database file if it doesn't exist."""
    conn = sqlite3.connect('pixel_flex_dataset.db')
    cursor = conn.cursor()
    # Schema: Only stores the peaks and their timestamps
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS filtered_metrics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            raw_value INTEGER,
            is_game_trigger INTEGER,
            timestamp DATETIME
        )
    ''')
    conn.commit()
    conn.close()

def log_to_dataset(val, is_trigger):
    """Saves only the high-value data points to SQLite"""
    try:
        conn = sqlite3.connect('pixel_flex_dataset.db')
        cursor = conn.cursor()
        # Precise millisecond timestamp
        now = datetime.now().strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]
        cursor.execute("INSERT INTO filtered_metrics (raw_value, is_game_trigger, timestamp) VALUES (?, ?, ?)", 
                       (val, is_trigger, now))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Database Error: {e}")

# --- HARDWARE BRIDGE ---
def hardware_bridge():
    global last_action_time, last_raw_emit_time, trigger_count
    print("\n[HARDWARE] 50Hz Stream Active. Filtering for Threshold...")
    ser = None
    # Keywords found in descriptions of common ESP32 USB chips
    ESP_KEYWORDS = ['cp210', 'ch340', 'ch9102', 'ch341', 'silicon labs',
                    'uart', 'usb serial', 'usb-serial', 'wch', 'ftdi', 'esp32']

    while True:
        if ser is None or not ser.is_open:
            all_ports = serial.tools.list_ports.comports()
            # Print every port + description so user can see what's connected
            print("[HARDWARE] Available ports:")
            for p in all_ports:
                print(f"  {p.device:8s} — {p.description}")
            # Sort: ESP32-likely ports first, everything else after
            esp_ports   = [p.device for p in all_ports
                           if any(kw in (p.description or '').lower() for kw in ESP_KEYWORDS)]
            other_ports = [p.device for p in all_ports if p.device not in esp_ports]
            ordered = esp_ports + other_ports
            print(f"[HARDWARE] Trying order: {ordered}")
            for port in ordered:
                try:
                    ser = serial.Serial(port, 115200, timeout=0.1)
                    print(f"[SUCCESS] Connected on {port}!")
                    break
                except: continue
            if ser is None: socketio.sleep(1); continue

        try:
            if ser.in_waiting > 0:
                line = ser.readline().decode('utf-8', errors='ignore').strip()
                if line.isdigit():
                    val = int(line)
                    current_time = datetime.now().timestamp()

                    # Emit raw value at ~20Hz for calibration UI (throttled)
                    if (current_time - last_raw_emit_time) >= 0.05:
                        socketio.emit('sensor_raw', {'value': val})
                        last_raw_emit_time = current_time

                    # STEP 1: Check if value is over threshold
                    if val >= THRESHOLD:
                        trigger_count += 1
                        is_trigger = 0

                        # STEP 2: Fire only after N consecutive above-threshold readings
                        # This filters out single-sample noise spikes
                        if trigger_count >= TRIGGER_HYSTERESIS:
                            if (current_time - last_action_time > COOLDOWN):
                                print(f">>> TRIGGERED! Value={val}  THRESHOLD={THRESHOLD}  Streak={trigger_count}")
                                socketio.emit('vibration', {'data': 'hit'})
                                last_action_time = current_time
                                is_trigger = 1

                        # STEP 3: Log this high-value data point
                        log_to_dataset(val, is_trigger)
                    else:
                        trigger_count = 0  # Reset streak when signal drops below threshold
                    
        except Exception as e:
            ser = None
        socketio.sleep(0.005) # High frequency check of serial buffer

@socketio.on('set_calibration')
def handle_set_calibration(data):
    """Receives calibrated threshold from the frontend after the calibration scene."""
    global THRESHOLD
    new_threshold = data.get('threshold', THRESHOLD)
    THRESHOLD = max(1, int(round(new_threshold)))
    print(f"[CALIBRATION] Session threshold updated to: {THRESHOLD}")

@app.route('/')
def index():
    return render_template('index.html')

if __name__ == '__main__':
    init_db() # Setup local database file
    socketio.start_background_task(hardware_bridge)
    print("\n--- PIXEL FLEX IS ONLINE ---")
    print("Point your browser to http://127.0.0.1:5000")
    socketio.run(app, debug=True, use_reloader=False, port=5000)