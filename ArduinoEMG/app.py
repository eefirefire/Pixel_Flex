import serial
import time
import pyautogui

# --- Configuration ---
SERIAL_PORT = 'COM7'
BAUD_RATE = 115200

# We will likely need to change this based on your debug output!
FLEX_THRESHOLD = 3
COOLDOWN_TIME = 0.01

try:
    print(f"Connecting to ESP32 on {SERIAL_PORT}...")
    ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=0.1)
    print("Connected! Monitoring live sensor values...")
    
    last_flex_time = 0
    last_debug_time = 0  # NEW: Tracks when we last printed debug info
    
    while True:
        if ser.in_waiting > 0:
            line = ser.readline().decode('utf-8').strip()
            
            if "Envelope:" in line:
                parts = line.split(',')
                for part in parts:
                    if part.startswith("Envelope:"):
                        try:
                            envelope_val = float(part.split(':')[1])
                            current_time = time.time()
                            
                            # --- NEW: Print the value every 1 second for debugging ---
                            if current_time - last_debug_time >= 1.0:
                                print(f"[DEBUG] Current Envelope: {envelope_val:.1f}")
                                last_debug_time = current_time
                            
                            # The trigger logic
                            if envelope_val > FLEX_THRESHOLD and (current_time - last_flex_time > COOLDOWN_TIME):
                                print(f">>> BAM! Muscle flexed! (Strength: {envelope_val:.1f}) <<<")
                                
                                # Simulate pressing 'z'
                                pyautogui.press('z')
                                
                                last_flex_time = current_time
                                
                        except ValueError:
                            pass
                            
except serial.SerialException:
    print(f"\nERROR: Could not open {SERIAL_PORT}.")
    print("Make sure your ESP32 is plugged in and the Arduino Serial Plotter is CLOSED!")
except KeyboardInterrupt:
    print("\nExiting program.")
finally:
    if 'ser' in locals() and ser.is_open:
        ser.close()