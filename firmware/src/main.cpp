#include <Arduino.h>
#include <WiFi.h>
#include <WebSocketsServer.h>
#include <ArduinoJson.h>

// ---------------------------------------------------------
// Configurações de Rede (Substitua depois pelos seus dados)
// ---------------------------------------------------------
const char* ssid = "Vinnicius :D";
const char* password = "Vinnicius.ph02004";

WebSocketsServer webSocket = WebSocketsServer(81);

// ---------------------------------------------------------
// Definição de Pinos - Sensor Ultrassónico (HC-SR04)
// ---------------------------------------------------------
#define TRIG_PIN 5
#define ECHO_PIN 18

// ---------------------------------------------------------
// Definição de Pinos - Ponte H (L298N)
// ---------------------------------------------------------
// Motor Esquerdo
#define ENA 19 // PWM
#define IN1 21
#define IN2 22
// Motor Direito
#define ENB 23 // PWM
#define IN3 25
#define IN4 26

// Configurações do PWM (API do ESP32)
const int freq = 5000;
const int resolution = 8;
const int pwmChannelLeft = 0;
const int pwmChannelRight = 1;

// ---------------------------------------------------------
// Variáveis de Estado (Máquina de Estados Finitos)
// ---------------------------------------------------------
enum BotState { FORWARD, BRAKE, REVERSE, ROTATE };
BotState currentState = FORWARD;

float currentDistance = 0.0;
int leftPwmVal = 0;
int rightPwmVal = 0;
bool isAlert = false;
unsigned long lastTelemetryTime = 0;

// ---------------------------------------------------------
// Funções de Controlo dos Motores
// ---------------------------------------------------------
void setMotors(int leftSpeed, int rightSpeed) {
  // Motor Esquerdo
  if (leftSpeed >= 0) {
    digitalWrite(IN1, HIGH);
    digitalWrite(IN2, LOW);
    ledcWrite(pwmChannelLeft, leftSpeed);
  } else {
    digitalWrite(IN1, LOW);
    digitalWrite(IN2, HIGH);
    ledcWrite(pwmChannelLeft, -leftSpeed);
  }
  
  // Motor Direito
  if (rightSpeed >= 0) {
    digitalWrite(IN3, HIGH);
    digitalWrite(IN4, LOW);
    ledcWrite(pwmChannelRight, rightSpeed);
  } else {
    digitalWrite(IN3, LOW);
    digitalWrite(IN4, HIGH);
    ledcWrite(pwmChannelRight, -rightSpeed);
  }
}

// ---------------------------------------------------------
// Leitura do Sensor Ultrassónico
// ---------------------------------------------------------
float readDistance() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  
  // Timeout de 30ms para não bloquear o loop se não houver retorno
  long duration = pulseIn(ECHO_PIN, HIGH, 30000); 
  if (duration == 0) return 100.0; // Caminho livre assumido
  
  return (duration * 0.0343) / 2.0;
}

// ---------------------------------------------------------
// Setup
// ---------------------------------------------------------
void setup() {
  Serial.begin(115200);
  
  // Configuração dos Pinos
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(IN1, OUTPUT);
  pinMode(IN2, OUTPUT);
  pinMode(IN3, OUTPUT);
  pinMode(IN4, OUTPUT);
  
  // Configuração do PWM
  ledcSetup(pwmChannelLeft, freq, resolution);
  ledcAttachPin(ENA, pwmChannelLeft);
  ledcSetup(pwmChannelRight, freq, resolution);
  ledcAttachPin(ENB, pwmChannelRight);
  
  // Conexão Wi-Fi
  WiFi.begin(ssid, password);
  Serial.print("Conectando ao Wi-Fi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWi-Fi conectado!");
  Serial.print("IP do ESP32: ");
  Serial.println(WiFi.localIP());
  
  // Inicia WebSocket
  webSocket.begin();
  Serial.println("Servidor WebSocket iniciado na porta 81");
}

// ---------------------------------------------------------
// Loop Principal
// ---------------------------------------------------------
void loop() {
  webSocket.loop(); // Mantém a comunicação WebSocket ativa
  
  unsigned long currentMillis = millis();
  
  // Executa a lógica e envia telemetria a ~15 Hz (a cada 66 ms)
  if (currentMillis - lastTelemetryTime >= 66) {
    lastTelemetryTime = currentMillis;
    
    currentDistance = readDistance();
    
    // Máquina de Estados (Navegação Reativa)
    if (currentDistance <= 15.0) {
      currentState = REVERSE;
      leftPwmVal = -150;
      rightPwmVal = -150;
      isAlert = true;
    } else if (currentDistance < 30.0) {
      currentState = ROTATE;
      leftPwmVal = -120;
      rightPwmVal = 120;
      isAlert = true;
    } else {
      currentState = FORWARD;
      leftPwmVal = 200;
      rightPwmVal = 200;
      isAlert = false;
    }
    
    // Aplica a velocidade aos motores
    setMotors(leftPwmVal, rightPwmVal);
    
    // Prepara e envia o JSON de telemetria
    StaticJsonDocument<200> doc;
    doc["timestamp"] = currentMillis;
    
    // Garante 1 casa decimal para bater com o mock
    doc["distance_cm"] = round(currentDistance * 10.0) / 10.0;
    
    switch (currentState) {
      case FORWARD: doc["state"] = "FORWARD"; break;
      case BRAKE:   doc["state"] = "BRAKE";   break;
      case REVERSE: doc["state"] = "REVERSE"; break;
      case ROTATE:  doc["state"] = "ROTATE";  break;
    }
    
    doc["left_motor_pwm"] = leftPwmVal;
    doc["right_motor_pwm"] = rightPwmVal;
    doc["alert"] = isAlert;
    
    String jsonString;
    serializeJson(doc, jsonString);
    
    webSocket.broadcastTXT(jsonString); // Dispara para o Web Client
  }
}