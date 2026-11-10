#include <Arduino.h>
#include <WiFi.h>
#include <WebSocketsServer.h>
#include <ArduinoJson.h>

// ---------------------------------------------------------
// Configurações de Rede (Hotspot do Notebook)
// ---------------------------------------------------------
const char* ssid = "Projeto Twinbot 2026";
const char* password = "Twinbot2026";

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
#define ENA 25 // Laranja
#define IN1 26 // Roxo
#define IN2 27 // Azul
// Motor Direito
#define ENB 13 // Verde
#define IN3 14 // Marrom
#define IN4 12 // Cinza

// Configurações do PWM (API do ESP32)
const int freq = 5000;
const int resolution = 8;
const int pwmChannelLeft = 0;
const int pwmChannelRight = 1;

// ---------------------------------------------------------
// Variáveis de Estado (Inicia PARADO em Modo Manual)
// ---------------------------------------------------------
enum BotState { FORWARD, BRAKE, REVERSE, ROTATE };
BotState currentState = BRAKE;

float currentDistance = 0.0;
int leftPwmVal = 0;
int rightPwmVal = 0;
bool isAlert = false;
unsigned long lastTelemetryTime = 0;

// Inicia em Modo Manual por segurança (não anda sozinho ao ligar)
bool isManualMode = true;
int manualLeftPwm = 0;
int manualRightPwm = 0;
BotState manualState = BRAKE;

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
  
  long duration = pulseIn(ECHO_PIN, HIGH, 30000); 
  if (duration == 0) return 100.0;
  
  return (duration * 0.0343) / 2.0;
}

// ---------------------------------------------------------
// Receção de Comandos WebSocket (Modo Admin)
// ---------------------------------------------------------
void onWebSocketEvent(uint8_t num, WStype_t type, uint8_t * payload, size_t length) {
  if (type == WStype_TEXT) {
    StaticJsonDocument<200> cmdDoc;
    DeserializationError error = deserializeJson(cmdDoc, payload, length);
    
    if (!error) {
      const char* cmd = cmdDoc["cmd"];
      
      if (cmd && strcmp(cmd, "mode") == 0) {
        isManualMode = cmdDoc["manual"];
        if (isManualMode) {
          manualLeftPwm = 0;
          manualRightPwm = 0;
          manualState = BRAKE;
          setMotors(0, 0);
        }
      } 
      else if (cmd && strcmp(cmd, "move") == 0 && isManualMode) {
        const char* dir = cmdDoc["dir"];
        if (!dir) return;

        if (strcmp(dir, "FORWARD") == 0) {
          manualLeftPwm = 200;
          manualRightPwm = 200;
          manualState = FORWARD;
        } else if (strcmp(dir, "REVERSE") == 0) {
          manualLeftPwm = -180;
          manualRightPwm = -180;
          manualState = REVERSE;
        } else if (strcmp(dir, "LEFT") == 0) {
          manualLeftPwm = -160;
          manualRightPwm = 160;
          manualState = ROTATE;
        } else if (strcmp(dir, "RIGHT") == 0) {
          manualLeftPwm = 160;
          manualRightPwm = -160;
          manualState = ROTATE;
        } else { // STOP
          manualLeftPwm = 0;
          manualRightPwm = 0;
          manualState = BRAKE;
        }
      }
    }
  }
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
  
  // Configuração do PWM e trava imediata dos motores no boot
  ledcSetup(pwmChannelLeft, freq, resolution);
  ledcAttachPin(ENA, pwmChannelLeft);
  ledcSetup(pwmChannelRight, freq, resolution);
  ledcAttachPin(ENB, pwmChannelRight);
  setMotors(0, 0);
  
  // Conexão Wi-Fi otimizada para o Hotspot do Windows (2,4 GHz)
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);         // Mantém o rádio ativo para não desconectar do Hotspot
  WiFi.setAutoReconnect(true);  // Reconecta automaticamente se oscilar
  WiFi.begin(ssid, password);

  Serial.print("Conectando ao Hotspot: ");
  Serial.print(ssid);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWi-Fi conectado!");
  Serial.print("IP do ESP32 no Hotspot: ");
  Serial.println(WiFi.localIP());
  
  // Inicia WebSocket
  webSocket.begin();
  webSocket.onEvent(onWebSocketEvent);
  Serial.println("Servidor WebSocket iniciado na porta 81 (Modo Inicial: MANUAL/PARADO)");
}

// ---------------------------------------------------------
// Loop Principal
// ---------------------------------------------------------
void loop() {
  webSocket.loop();
  
  unsigned long currentMillis = millis();
  
  if (currentMillis - lastTelemetryTime >= 66) {
    lastTelemetryTime = currentMillis;
    
    currentDistance = readDistance();
    
    if (isManualMode) {
      // Modo Manual (Padrão ao ligar)
      currentState = manualState;
      leftPwmVal = manualLeftPwm;
      rightPwmVal = manualRightPwm;
      isAlert = (currentDistance < 30.0);
    } else {
      // Modo Autónomo
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
    }
    
    setMotors(leftPwmVal, rightPwmVal);
    
    StaticJsonDocument<256> doc;
    doc["timestamp"] = currentMillis;
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
    doc["manual"] = isManualMode;
    
    String jsonString;
    serializeJson(doc, jsonString);
    
    webSocket.broadcastTXT(jsonString);
  }
}