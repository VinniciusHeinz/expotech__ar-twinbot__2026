/**
 * Simulador de telemetria do AR-TwinBot.
 * Emite pacotes JSON a ~15 Hz simulando a aproximação de um obstáculo,
 * frenagem e manobra evasiva do robô.
 */
export class TelemetryMock {
  constructor(onDataCallback) {
    this.onData = onDataCallback;
    this.intervalId = null;

    // Estado inicial simulado
    this.distance = 70.0; // cm
    this.direction = -1;  // -1 aproximando, +1 afastando
    this.state = "FORWARD";
    this.leftPwm = 200;
    this.rightPwm = 200;
    this.alert = false;
  }

  start() {
    this.intervalId = setInterval(() => {
      // Simula variação contínua da distância frontal
      this.distance += this.direction * 1.5;

      // Máquina de estados reativa simulada (igual à FSM do ESP32)
      if (this.distance <= 15) {
        this.distance = 15;
        this.direction = 1; // Robô recua/gira e a distância volta a subir
        this.state = "REVERSE";
        this.leftPwm = -150;
        this.rightPwm = -150;
        this.alert = true;
      } else if (this.distance < 30) {
        if (this.direction === -1) {
          this.state = "BRAKE";
          this.leftPwm = 90;
          this.rightPwm = 90;
          this.alert = true;
        } else {
          this.state = "ROTATE";
          this.leftPwm = -120;
          this.rightPwm = 120;
          this.alert = true;
        }
      } else {
        if (this.distance >= 80) {
          this.direction = -1; // Começa a se aproximar de uma nova parede
        }
        this.state = "FORWARD";
        this.leftPwm = 200;
        this.rightPwm = 200;
        this.alert = false;
      }

      // Payload JSON idêntico ao firmware
      const payload = {
        timestamp: Date.now(),
        distance_cm: parseFloat(this.distance.toFixed(1)),
        state: this.state,
        left_motor_pwm: this.leftPwm,
        right_motor_pwm: this.rightPwm,
        alert: this.alert
      };

      if (this.onData) {
        this.onData(payload);
      }
    }, 66); // ~15 atualizações por segundo (66 ms)
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}