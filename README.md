# 🤖 AR-TwinBot — Digital Twin Robótico com WebAR, Inspeção 3D e Telemetria em Tempo Real

![Status](https://img.shields.io/badge/Status-Concluído-00ffcc?style=for-the-badge)
![Hardware](https://img.shields.io/badge/Hardware-ESP32%20%7C%20L298N%20%7C%20HC--SR04-0284c7?style=for-the-badge)
![Frontend](https://img.shields.io/badge/Web-Three.js%20%7C%20MindAR%20%7C%20Vite-aa3bff?style=for-the-badge)
![Protocol](https://img.shields.io/badge/Protocolo-WebSockets%20(15Hz)-ffaa00?style=for-the-badge)

O **AR-TwinBot** é um sistema ciber-físico de **Gêmeo Digital (Digital Twin)** desenvolvido para a **ExpoTech 2026**, integrando um robô móvel autônomo e teleoperado baseado em **ESP32** a uma aplicação web interativa com **Realidade Aumentada (WebAR)** e **Visualização 3D Orbital**.

O sistema transmite dados reais de sensoriamento ultrassônico, estado operacional da Máquina de Estados Finitos (FSM) e potência de motores (PWM) a uma taxa de **$15\ \text{Hz}$ (a cada $66\ \text{ms}$)** via **WebSockets**, refletindo instantaneamente o comportamento do robô físico em um modelo 3D procedural de alta fidelidade no navegador de smartphones (**iOS e Android**) e computadores.

---

## ✨ Funcionalidades Principais

1. **📷 Modo Realidade Aumentada (WebAR com MindAR):**
   * Rastreia um marcador óptico físico (`targets.mind`) pela câmera do dispositivo e projeta o gêmeo digital 3D do robô sobre o mundo real.
   * Exibe o feixe do sensor ultrassônico como um cone holográfico dinâmico que se expande, contrai e altera sua cor de acordo com a distância real dos obstáculos.

2. **🪐 Modo Inspeção 3D Livre (`OrbitControls`):**
   * Permite visualizar e inspecionar o gêmeo digital em **$360^\circ$** com rotação livre, inclinação e zoom (pinça ou scroll), dispensando o uso da câmera ou do marcador impresso.
   * Mantém a sincronização ao vivo com a telemetria do ESP32 sobre um grid tecnológico de referência.

3. **🔒 Painel Admin com Controle Remoto Bidirecional:**
   * Acesso protegido por autenticação local (**Usuário:** `admin` | **Senha:** `twinbot2026`).
   * Permite comutar o robô em tempo real entre **🤖 Modo Autônomo** (desvio reativo de obstáculos) e **🕹️ Modo Manual** (teleoperação direta).
   * Suporta pilotagem via **D-Pad Virtual Touch/Mouse** (com frenagem automática de segurança `STOP` ao soltar o botão) e via teclado no computador (**WASD**, **Setas Direcionais** e **Barra de Espaço**).

4. **📊 HUD de Telemetria em Tempo Real:**
   * Painel em estilo *glassmorphism* exibindo: Modo de Operação (`AUTÔNOMO` / `MANUAL`), Estado da Máquina de Estados (`FORWARD`, `ROTATE`, `REVERSE`, `BRAKE`), Distância em centímetros ($\text{cm}$), PWM individual das rodas esquerda/direita e Status de Alerta.

---

## 🏗️ Arquitetura do Sistema

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                        ROBÔ FÍSICO (ESP32 Node)                         │
│  [Sensor HC-SR04] ──► [Máquina de Estados / Controle] ──► [Ponte L298N] │
│                              │                     ▲                    │
│                   Telemetria │ (JSON @ 15Hz)       │ Comandos (JSON)    │
└──────────────────────────────┼─────────────────────┼────────────────────┘
                               ▼                     │
                     ws://192.168.15.28:81 (Wi-Fi Local)
                               │                     ▲
┌──────────────────────────────▼─────────────────────┼────────────────────┐
│                    SERVIDOR VITE + PROXY SSL (Node.js)                  │
│             Tunelamento Seguro: /api/ws ◄──► ws://ESP32:81              │
└──────────────────────────────┬─────────────────────▲────────────────────┘
                               ▼                     │
                    wss://<IP_DO_HOST>:5173/api/ws (HTTPS)
                               │                     ▲
┌──────────────────────────────▼─────────────────────┼────────────────────┐
│                 CLIENTE WEB MULTIPLATAFORMA (iOS / Android / PC)        │
│   [Three.js 3D Twin]  +  [MindAR Tracking]  +  [Painel Admin D-Pad]     │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🔌 Hardware e Mapeamento de Pinos (Pinout)

### Componentes Físicos
* **Microcontrolador:** ESP32 DOIT DevKit V1 (Wi-Fi $2.4\ \text{GHz}$ integrado).
* **Driver de Motores:** Ponte H Dupla L298N.
* **Chassi e Tração:** Chassi em acrílico transparente de 3 rodas (2 motores DC TT amarelos com caixa de redução nas rodas traseiras + 1 roda boba/caster dianteira sob o suporte do sensor).
* **Sensoriamento:** Sensor de Distância Ultrassônico HC-SR04 montado em suporte frontal vertical.
* **Alimentação:** Suporte de baterias de Íon de Lítio 18650 em série com chave gangorra dedicada (`ON/OFF`).

### Tabela de Conexões (ESP32 $\rightarrow$ Periféricos)

| Componente | Pino do Módulo | Pino do ESP32 | Cor de Referência / Função |
| :--- | :--- | :--- | :--- |
| **HC-SR04** | `VCC` | **3V3** | Alimentação regulada em $3.3\ \text{V}$ (livre de ruído dos motores) |
| **HC-SR04** | `TRIG` | **GPIO 5 (D5)** | Disparo do pulso ultrassônico de $10\ \mu\text{s}$ |
| **HC-SR04** | `ECHO` | **GPIO 18 (D18)** | Leitura do tempo de retorno da onda sonora |
| **HC-SR04** | `GND` | **GND** | Terra comum compartilhado |
| **L298N (Motor Esq.)** | `ENA` | **GPIO 25 (D25)** | Fio Laranja — Controle PWM Motor Esquerdo (Canal 0) |
| **L298N (Motor Esq.)** | `IN1` | **GPIO 26 (D26)** | Fio Roxo — Direção A Motor Esquerdo |
| **L298N (Motor Esq.)** | `IN2` | **GPIO 27 (D27)** | Fio Azul — Direção B Motor Esquerdo |
| **L298N (Motor Dir.)** | `ENB` | **GPIO 13 (D13)** | Fio Verde — Controle PWM Motor Direito (Canal 1) |
| **L298N (Motor Dir.)** | `IN3` | **GPIO 14 (D14)** | Fio Marrom — Direção A Motor Direito |
| **L298N (Motor Dir.)** | `IN4` | **GPIO 12 (D12)** | Fio Cinza — Direção B Motor Direito |
| **Alimentação** | `+5V (L298N)` | **VIN (VN)** | Alimenta o ESP32 a partir do regulador da L298N |
| **Alimentação** | `GND (L298N)` | **GND** | Referência comum entre baterias, ponte H e ESP32 |

> ⚠️ **Nota de Segurança Elétrica:** Parâmetros de PWM configurados em frequência de $5000\ \text{Hz}$ e resolução de $8\ \text{bits}$ ($0$ a $255$). Sempre mantenha a chave da bateria em **`OFF`** antes de conectar o cabo USB do ESP32 ao computador.

---

## 🧠 Máquina de Estados e Física do Sensor

O cálculo de distância baseia-se na velocidade de propagação do som no ar ($\approx 343\ \text{m/s}$ ou $0.0343\ \text{cm}/\mu\text{s}$):

$$\text{Distância (cm)} = \frac{\Delta t_{\text{eco}}\ (\mu\text{s}) \times 0.0343}{2}$$

### Estados de Navegação e Cores do Cone 3D

| Estado | Condição de Distância ($d$) | Motor Esq. (PWM) | Motor Dir. (PWM) | Alerta | Cor do Cone 3D |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **`FORWARD`** | $d \ge 30.0\ \text{cm}$ (Livre) | `200` | `200` | `false` | 🟢 Ciano (`#00ffcc`) |
| **`ROTATE`** | $15.0\ \text{cm} < d < 30.0\ \text{cm}$ | `-120` | `120` | `true` | 🔴 Vermelho (`#ff2244`) |
| **`REVERSE`** | $d \le 15.0\ \text{cm}$ (Crítico) | `-150` | `-150` | `true` | 🔴 Vermelho (`#ff2244`) |
| **`BRAKE`** | Parada Manual (`STOP`) | `0` | `0` | Dinâmico | 🟠 Âmbar (`#ffaa00`) |

---

## 📡 Protocolo de Comunicação (JSON via WebSocket)

* **Telemetria enviada pelo ESP32 (Broadcast a $15\ \text{Hz}$):**
  ```json
  {
    "timestamp": 45210,
    "distance_cm": 40.3,
    "state": "FORWARD",
    "left_motor_pwm": 200,
    "right_motor_pwm": 200,
    "alert": false,
    "manual": false
  }
  ```

* **Comandos enviados pelo Painel Admin (Web Client $\rightarrow$ ESP32):**
  * Alternar modo de condução (Autônomo / Manual):
    ```json
    { "cmd": "mode", "manual": true }
    ```
  * Acionamento direcional (`FORWARD`, `REVERSE`, `LEFT`, `RIGHT`, `STOP`):
    ```json
    { "cmd": "move", "dir": "FORWARD" }
    ```

---

## 🛠️ Decisões de Engenharia e Soluções Técnicas

1. **Isolamento de Ruído no Sensor Ultrassônico (Alimentação $3.3\ \text{V}$):**
   * Quando alimentado na linha de $5\ \text{V}$ compartilhada com a ponte H, o sensor HC-SR04 sofria interferência eletromagnética e quedas de tensão durante os picos de corrente dos motores DC. A migração do pino `VCC` do sensor para o pino regulado `3V3` do ESP32 estabilizou completamente as leituras.

2. **Compatibilidade Multiplataforma e iOS/Safari (Vite WSS Proxy):**
   * Navegadores móveis exigem contexto seguro (`https://`) para liberar o acesso à câmera (`getUserMedia`), mas bloqueiam conexões WebSocket não criptografadas (`ws://`) oriundas de páginas HTTPS (*Mixed Content Blocking*).
   * Para evitar o custo computacional de criptografia TLS dentro do ESP32, o servidor Vite atua como um **Proxy Reverso SSL**: o smartphone conecta-se ao Vite via `wss://` na porta `5173` (`/api/ws`) com reescrita de origem (`rewriteWsOrigin: true`), e o Vite repassa os pacotes em `ws://` para a porta `81` do ESP32 na rede local.

3. **Modelagem 3D Procedural Fiel ao Hardware Montado:**
   * O modelo 3D em Three.js foi construído inteiramente via código, sem dependência de arquivos `.gltf` externos pesados, reproduzindo fielmente o chassi em acrílico fosco com bordas destacadas (`EdgesGeometry`), as duas rodas traseiras com calotas amarelas de 5 raios e pneus tratorados, a roda boba frontal com espaçadores de latão, o suporte azul em L do sensor HC-SR04, o módulo ESP32, a ponte H L298N e o chicote de cabos coloridos.

---

## 📂 Estrutura de Diretórios

```text
expotech__ar-twinbot__2026/
├── firmware/                  # Projeto PlatformIO (C++ / Arduino Framework)
│   ├── src/
│   │   └── main.cpp           # Firmware do ESP32 (FSM, PWM, HC-SR04 e WebSocket Server)
│   └── platformio.ini         # Configurações de placa e bibliotecas (WebSockets, ArduinoJson)
├── web_client/                # Aplicação Front-end (Vite + Three.js + MindAR)
│   ├── public/
│   │   └── targets.mind       # Marcador compilado para rastreamento óptico WebAR
│   ├── src/
│   │   ├── main.js            # Modelo 3D procedural, cliente WebSocket, AR, Orbit e Admin
│   │   └── style.css          # Estilos base da interface e HUD Glassmorphism
│   ├── index.html             # Estrutura da página, HUD, seletores de modo e modal Admin
│   ├── vite.config.js         # Configuração de SSL básico e proxy reverso WebSocket
│   └── package.json           # Dependências do Node.js / Vite
└── README.md                  # Documentação completa do projeto
```

---

## 🚀 Como Executar o Projeto

### 1. Gravação do Firmware no ESP32
1. Certifique-se de que a **chave da bateria está na posição `OFF`** antes de conectar o cabo USB ao computador.
2. Abra a pasta `firmware` no **VS Code** com a extensão **PlatformIO IDE** instalada.
3. No arquivo `firmware/src/main.cpp`, verifique as credenciais da sua rede Wi-Fi $2.4\ \text{GHz}$ (`ssid` e `password`).
4. Clique em **PlatformIO: Upload** (`->`) na barra inferior para compilar e gravar o código no ESP32.
5. Abra o **Serial Monitor** (`115200 baud`) para verificar o endereço IP atribuído ao ESP32 (ex: `192.168.15.28`).
6. Desconecte o cabo USB, posicione o robô no chão e ligue a chave da bateria em **`ON`**.

### 2. Inicialização do Servidor Web (Digital Twin)
1. No terminal do VS Code, acesse a pasta do cliente web:
   ```bash
   cd web_client
   ```
2. Instale as dependências (caso ainda não tenha instalado):
   ```bash
   npm install
   ```
3. Verifique no arquivo `web_client/vite.config.js` se o campo `target` do proxy corresponde ao IP do seu ESP32:
   ```javascript
   target: 'ws://192.168.15.28:81'
   ```
4. Inicie o servidor de desenvolvimento com HTTPS:
   ```bash
   npm run dev
   ```
5. Acesse o endereço exibido em **Network** (ex: `https://192.168.15.30:5173`) pelo navegador do computador, Android ou iPhone conectado à mesma rede Wi-Fi.

---

## 👨‍💻 Autor

Desenvolvido por **Vinnicius Patera Heinz de Oliveira**  
Projeto de Robótica Móvel, IoT e Realidade Aumentada — **UniFECAF (ExpoTech 2026)**