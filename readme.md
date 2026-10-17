# 🤖 AR-TwinBot — Gêmeo Digital e Telemetria em WebAR (ExpoTech 2026)

![Status do Projeto](https://img.shields.io/badge/Status-Concluído%20%26%20Operacional-00ffcc?style=for-the-badge)
![Plataforma](https://img.shields.io/badge/Hardware-ESP32%20%7C%20L298N%20%7C%20HC--SR04-0284c7?style=for-the-badge)
![Front-End](https://img.shields.io/badge/Web-Three.js%20%7C%20MindAR%20%7C%20Vite-aa3bff?style=for-the-badge)

O **AR-TwinBot** é uma plataforma de robótica móvel autônoma e teleoperada integrada a um **Gêmeo Digital (Digital Twin)** em Realidade Aumentada baseada na Web (**WebAR**). 

O sistema transmite dados físicos do robô a uma taxa de **~15 Hz (a cada 66 ms)** via **WebSockets**, permitindo visualizar em tempo real o feixe do sensor ultrassônico, o estado da máquina de estados finitos (FSM) e o PWM dos motores diretamente sobre o robô real através da câmera do smartphone (iOS/Android) ou em um ambiente de inspeção 3D interativo no navegador.

---

## ✨ Principais Funcionalidades

1. **📷 Modo Realidade Aumentada (WebAR com MindAR):**
   * Rastreamento óptico de marcador (`targets.mind`) com sobreposição holográfica 3D do robô em escala.
   * Cone ultrassônico dinâmico que altera seu comprimento e coloração (`#00ffcc` Livre, `#ffaa00` Alerta/Freio, `#ff2244` Manobra Crítica) em sincronia com os obstáculos físicos reais.
2. **🪐 Modo Inspeção 3D Livre (Orbit Viewer):**
   * Visualizador 3D completo com `OrbitControls` (rotação 360°, zoom e inclinação) que dispensa o uso da câmera, mantendo a reação do modelo e do sensor ao vivo via telemetria.
3. **🔓 Modo Admin Autenticado (Comando Bidirecional):**
   * Painel protegido por login e senha que permite alternar instantaneamente o robô entre **Modo Autônomo** e **Modo Manual**.
   * Controle direcional remoto via **D-Pad Touch** (para dispositivos móveis com trava automática ao soltar o botão) e suporte a teclado (**WASD / Setas** no Desktop).
4. **🌐 Arquitetura Multiplataforma com Proxy WSS:**
   * Túnel reverso configurado no Vite (`wss://` $\rightarrow$ `ws://`) com `basic-ssl` e reescrita de origem (`rewriteWsOrigin`), eliminando bloqueios de *Mixed Content* no **Safari/iOS**, **Android** e **Desktop**.

---

## 🛠️ Arquitetura de Hardware e Pinagem (ESP32)

### Componentes Físicos
* **Microcontrolador:** ESP32 DOIT DevKit V1 (Wi-Fi 2.4 GHz integrado)
* **Driver de Motores:** Ponte H Dupla L298N
* **Sensoriamento:** Sensor Ultrassônico HC-SR04 (operando em lógica/alimentação de 3.3V)
* **Atuação:** 2x Motores DC com caixa de redução (Chassi 2WD + roda boba)
* **Alimentação:** Suporte para células de Íon de Lítio 18650 em série com chave liga/desliga dedicada

### Mapeamento de Pinos (Pinout)

| Componente | Pino no Módulo | Pino no ESP32 | Função / Observação |
| :--- | :--- | :--- | :--- |
| **HC-SR04** | `VCC` | **3V3** | Alimentação regulada e limpa de 3.3V (evita queda de tensão dos motores) |
| **HC-SR04** | `TRIG` | **GPIO 5 (D5)** | Disparo do pulso ultrassônico de $10\ \mu\text{s}$ |
| **HC-SR04** | `ECHO` | **GPIO 18 (D18)** | Leitura do tempo de retorno da onda sonora |
| **HC-SR04** | `GND` | **GND** | Terra comum compartilhado |
| **Ponte H L298N** | `ENA` | **GPIO 25 (D25)** | Controle de velocidade PWM — Motor Esquerdo (Canal 0, 5 kHz, 8 bits) |
| **Ponte H L298N** | `IN1` | **GPIO 26 (D26)** | Direção A — Motor Esquerdo |
| **Ponte H L298N** | `IN2` | **GPIO 27 (D27)** | Direção B — Motor Esquerdo |
| **Ponte H L298N** | `ENB` | **GPIO 13 (D13)** | Controle de velocidade PWM — Motor Direito (Canal 1, 5 kHz, 8 bits) |
| **Ponte H L298N** | `IN3` | **GPIO 14 (D14)** | Direção A — Motor Direito |
| **Ponte H L298N** | `IN4` | **GPIO 12 (D12)** | Direção B — Motor Direito |
| **Alimentação** | `+5V (L298N)` | **VIN (VN)** | Alimenta o ESP32 a partir do regulador da L298N quando na bateria |
| **Alimentação** | `GND (L298N)` | **GND** | Referência comum entre baterias, ponte H e ESP32 |

> ⚠️ **Nota de Segurança Elétrica:** Sempre mantenha a chave da bateria em **OFF** antes de conectar o cabo USB do ESP32 ao computador para gravação de firmware.

---

## 🧠 Máquina de Estados Finitos e Física do Sensor

O cálculo de distância baseia-se na velocidade de propagação do som no ar ($\approx 343\ \text{m/s}$ ou $0.0343\ \text{cm}/\mu\text{s}$):

$$\text{Distância (cm)} = \frac{\Delta t_{\text{eco}}\ (\mu\text{s}) \times 0.0343}{2}$$

No **Modo Autônomo**, o ESP32 processa uma máquina de estados reativa a cada ciclo de $66\ \text{ms}$:
* **`FORWARD` ($d \ge 30.0\ \text{cm}$):** Pista livre. Motores avançam com PWM `200` | Alerta: `NORMAL`.
* **`ROTATE` ($15.0\ \text{cm} < d < 30.0\ \text{cm}$):** Obstáculo detectado à média distância. Manobra de giro no próprio eixo (`L: -120 | R: 120`) | Alerta: `ATIVADO`.
* **`REVERSE` ($d \le 15.0\ \text{cm}$):** Obstáculo crítico próximo. Inversão imediata de marcha (`L: -150 | R: -150`) | Alerta: `ATIVADO`.

---

## 📂 Estrutura de Diretórios

```text
expotech__ar-twinbot__2026/
├── firmware/                  # Projeto PlatformIO (C++ / Arduino Framework)
│   ├── src/
│   │   └── main.cpp           # Firmware do ESP32 (FSM, PWM, HC-SR04 e WebSocketsServer)
│   └── platformio.ini         # Configurações da placa e bibliotecas (ArduinoJson, WebSockets)
└── web_client/                # Aplicação Front-End (Vite + Three.js + MindAR)
    ├── public/
    │   └── targets.mind       # Marcador de imagem compilado para rastreamento AR
    ├── src/
    │   ├── main.js            # Lógica 3D, WebSocket, OrbitControls e Painel Admin
    │   └── style.css          # Estilização Glassmorphism HUD e responsividade mobile
    ├── index.html             # Interface principal e containers de visualização
    ├── vite.config.js         # Configuração de SSL (HTTPS) e Proxy WebSocket (/api/ws)
    └── package.json           # Dependências do cliente web
```

---

## 🚀 Como Executar o Projeto

### 1. Gravação do Firmware no ESP32
1. Abra a pasta `firmware` utilizando o **VS Code** com a extensão **PlatformIO IDE** instalada.
2. No arquivo `firmware/src/main.cpp`, verifique o SSID e a senha da sua rede Wi-Fi 2.4 GHz:
   ```cpp
   const char* ssid = "SEU_WIFI";
   const char* password = "SUA_SENHA";
   ```
3. Certifique-se de que a bateria do robô está desligada (**OFF**), conecte o ESP32 via USB e execute o **Upload** pelo PlatformIO.
4. Abra o **Serial Monitor** (`115200 baud`) para anotar o endereço IP atribuído ao ESP32 (ex: `192.168.15.28`).

### 2. Inicialização do Cliente Web (Vite)
1. No arquivo `web_client/vite.config.js`, confirme se o IP no `target` do proxy corresponde ao IP do seu ESP32:
   ```javascript
   proxy: {
     '/api/ws': {
       target: 'ws://192.168.15.28:81',
       ws: true,
       changeOrigin: true,
       rewriteWsOrigin: true
     }
   }
   ```
2. Abra o terminal na pasta `web_client`, instale as dependências e inicie o servidor de desenvolvimento:
   ```bash
   cd web_client
   npm install
   npm run dev
   ```
3. Acesse o endereço HTTPS exibido no terminal (ex: `https://localhost:5173` no PC ou `https://192.168.15.30:5173` no smartphone conectado ao mesmo Wi-Fi).

---

## 🎮 Credenciais do Painel Admin (Pilotagem Remota)

Para acessar os controles manuais e alternar o modo de operação pela interface web, clique no botão **🔒 ADMIN** no canto superior direito e utilize as credenciais padrão:

* **Usuário:** `admin`
* **Senha:** `twinbot2026`

---

## 📡 Protocolo de Comunicação (JSON via WebSocket)

### Telemetria (ESP32 $\rightarrow$ Web Client a 15 Hz)
```json
{
  "timestamp": 45210,
  "distance_cm": 60.9,
  "state": "FORWARD",
  "left_motor_pwm": 200,
  "right_motor_pwm": 200,
  "alert": false,
  "manual": false
}
```

### Comandos de Controle (Web Client $\rightarrow$ ESP32)
* **Troca de Modo (Autônomo / Manual):**
  ```json
  { "cmd": "mode", "manual": true }
  ```
* **Acionamento Direcional (`FORWARD`, `REVERSE`, `LEFT`, `RIGHT`, `STOP`):**
  ```json
  { "cmd": "move", "dir": "FORWARD" }
  ```

---

## 👨‍💻 Autor

Desenvolvido por **Vinnicius Heinz** para a **ExpoTech 2026**.