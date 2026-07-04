void setup() {
  Serial.begin(115200);
  // Remove all attenuation/pull-down settings for this test
  analogReadResolution(12); 
  pinMode(26, INPUT); 
}

void loop() {
  Serial.println(analogRead(26));
  delay(1); 
}