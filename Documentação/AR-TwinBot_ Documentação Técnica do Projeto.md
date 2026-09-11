# **AR-TwinBot: Gêmeo Digital e Telemetria em Realidade Aumentada para Robôs Móveis Autônomos**

**Disciplinas Integradas:** Intelligent Mobile Robots & Computer Graphics and AR/VR

**Instituição:** Centro Universitário UniFECAF

**Data:** Setembro de 2026

## **1\. Visão Geral do Projeto**

O projeto **AR-TwinBot** consiste no desenvolvimento e implementação de uma plataforma robótica móvel terrestre integrada ao conceito de Gêmeo Digital (*Digital Twin*) por meio de Realidade Aumentada (AR). O agente físico é dotado de sensoriamento ultrassônico e lógica reativa autônoma para navegação e evasão de obstáculos em malha fechada, transmitindo continuamente variáveis de telemetria operacional via rede sem fio.

Concomitantemente, uma aplicação gráfica em Realidade Aumentada rastreia a pose do veículo no espaço tridimensional utilizando visão computacional baseada em marcadores fiduciais (*Image Target*). Sobre o robô, são projetados elementos visuais holográficos ancorados espacialmente (*Spatial HUD*), exibindo o cone de percepção do sensor de distância, vetores dinâmicos de velocidade/direção, distância detectada e alarmes de proximidade em tempo real.

## **2\. Arquitetura do Sistema**

A solução é dividida em três camadas fundamentais:

> 1. **Camada Física e Controle (Robô Móvel):** Microcontrolador ESP32 processa a leitura dos sensores e comanda os atuadores por meio de modulação por largura de pulso (PWM).  
> 2. **Camada de Comunicação (Transporte de Dados):** Protocolo WebSockets sob rede Wi-Fi local para troca bidirecional de mensagens JSON em baixa latência (\< 20 ms).  
> 3. **Camada Visual e Espacial (Realidade Aumentada):** Aplicação (Unity / AR Foundation ou WebXR) responsável pelo rastreamento óptico do marcador e renderização das primitivas gráficas tridimensionais alinhadas à pose física do robô.

## **3\. Especificação de Hardware e Lista de Componentes**

| Componente | Especificação Técnica | Quantidade | Função no Sistema&nbsp;&nbsp; |
| :---- | :---- | :---: | :---- |
| **ESP32 DevKit V1** | Dual-Core Tensilica Xtensa LX6, Wi-Fi 2.4 GHz, BLE | 1 | Unidade de controle central, FSM e servidor de telemetria |
| **Chassi 2WD** | Acrílico, 2 motores DC (caixa 1:48) \+ roda boba (caster) | 1 | Base física de locomoção diferencial |
| **Driver Ponte H L298N** | Ponte H dupla com dissipador, suporte até 2A por canal | 1 | Acionamento de potência e controle de sentido/PWM dos motores |
| **Sensor Ultrassônico HC-SR04** | Alcance de 2 cm a 400 cm, ângulo de abertura \~15° | 1 | Detecção de obstáculos frontais |
| **Baterias 18650 Li-Ion (ou 4x Pilhas AA)** | 2x 3.7V em série (7.4V nominal) com case | 1 kit | Alimentação da etapa de potência (motores) e lógica |
| **Marcador Fiducial (Target)** | Marcador ArUco / Vuforia Image Target (8 cm x 8 cm) | 1 | Ancoragem e cálculo de pose 6-DoF para o AR |
| **Acessórios de Conexão** | Jumpers macho-fêmea, chave liga/desliga, protoboard pequena | \- | Roteamento e proteção do circuito |

## **4\. Diagrama Esquemático de Ligações (Pinout)**

Tabela de referência para conexão das portas GPIO do ESP32 aos periféricos:

| Módulo / Periférico | Pino do Módulo | Pino no ESP32 | Observações&nbsp;&nbsp; |
| :---- | :---- | :---- | :---- |
| HC-SR04 (Ultrassônico) | Trigger | GPIO 5 | Saída lógica de disparo de pulso (10 µs) |
|  | Echo | GPIO 18 | Entrada lógica (recomenda-se divisor resistivo para 3.3V) |
| Ponte H L298N | ENA (Enable Motor A) | GPIO 14 | Canal PWM de controle de velocidade (Motor Esquerdo) |
|  | IN1 | GPIO 27 | Sentido de rotação A1 |
|  | IN2 | GPIO 26 | Sentido de rotação A2 |
|  | IN3 | GPIO 25 | Sentido de rotação B1 |
|  | IN4 | GPIO 33 | Sentido de rotação B2 |
|  | ENB (Enable Motor B) | GPIO 32 | Canal PWM de controle de velocidade (Motor Direito) |
| Alimentação Comum | GND | GND | **GND unificado:** obrigatório interligar bateria, ESP32 e L298N |

## **5\. Lógica de Navegação Autônoma (FSM)**

O robô opera através de uma Máquina de Estados Finitos (*Finite State Machine*) reativa, processada a cada 50 milissegundos:

> * **STATE\_FORWARD (Avançar):** Ambos os motores operam com PWM nominal. Condição: distância detectada \> 30 cm.  
> * **STATE\_BRAKE (Desaceleração e Parada):** Ao detectar obstáculo em intervalo de segurança (15 cm \< distância ≤ 30 cm), o robô reduz o PWM e cessa o movimento para evitar impacto por inércia.  
> * **STATE\_REVERSE (Ré de Desengate):** Acionamento reverso por 300 ms se a distância for crítica (≤ 15 cm).  
> * **STATE\_ROTATE (Manobra de Evasão):** Rotação sobre o próprio eixo diferencial (ex.: Motor esquerdo ré, motor direito frente) por período cronometrado até encontrar rota desobstruída.

## **6\. Protocolo de Comunicação e Formato da Telemetria**

O ESP32 atua como WebSocket Server (porta 81). A aplicação de Realidade Aumentada atua como WebSocket Client, recebendo pacotes de telemetria serializados em JSON em uma taxa periódica de 15 Hz a 20 Hz.

`{`  
  `"timestamp": 124800,`  
  `"distance_cm": 24.5,`  
  `"state": "BRAKING",`  
  `"left_motor_pwm": 120,`  
  `"right_motor_pwm": 120,`  
  `"alert": true`  
`}`

## **7\. Estrutura e Componentes de Realidade Aumentada (AR HUD)**

A aplicação AR rastreia o marcador físico e ancora uma árvore de objetos virtuais (GameObject Hierarchy):

> * **Cone de Percepção Visual:** Malha tridimensional cônica translúcida fixada à frente do marcador, com abertura de 15°. Sua escala no eixo longitudinal (Z) varia dinamicamente conforme o valor de distance\_cm recebido pela telemetria.  
> * **Código de Cores Reativo:**  
  * *Verde (Seguro):* distance\_cm \> 30 cm  
  * *Amarelo (Atenção):* 15 cm \< distance\_cm ≤ 30 cm  
  * *Vermelho pulsante (Crítico/Colisão):* distance\_cm ≤ 15 cm  
> * **Spatial Dashboard:** Painel flutuante posicionado a 10 cm acima do robô exibindo texto tridimensional com velocidade calculada, estado atual da FSM e status da conexão Wi-Fi.

## **8\. Estrutura Recomendada do Repositório Git**

`ar-twinbot/`  
`├── .gitignore`  
`├── LICENSE`  
`├── README.md`  
`├── docs/`  
`│   ├── schematics/             # Diagramas e esquemas elétricos`  
`│   ├── targets/                # Imagem do marcador para impressão (ArUco / Vuforia)`  
`│   └── architecture.png        # Diagrama de blocos do sistema`  
`├── firmware/                   # Código-fonte para o ESP32 (PlatformIO / Arduino IDE)`  
`│   ├── platformio.ini`  
`│   └── src/`  
`│       ├── main.cpp`  
`│       ├── MotorController.h`  
`│       ├── DistanceSensor.h`  
`│       └── TelemetryServer.h`  
`└── ar_client/                  # Projeto da interface gráfica em Realidade Aumentada`  
    `├── Assets/                 # Scripts C#, Shaders, Prefabs do HUD espacial`  
    `└── ProjectSettings/`

## **9\. Instruções de Instalação e Execução**

> 1. **Gravando o Firmware no ESP32:**  
   * Abra o diretório firmware/ no VS Code com PlatformIO ou na Arduino IDE.  
   * Configure as credenciais de rede Wi-Fi (SSID e senha do ponto de acesso local) no arquivo de cabeçalho de configuração.  
   * Conecte o ESP32 via porta USB e execute o upload do firmware. O endereço IP será impresso no Serial Monitor (baud rate: 115200).  
> 2. **Executando a Aplicação AR:**  
   * Abra o projeto contido em ar\_client/ na Unity (2022 LTS recomendada).  
   * No componente de rede do GameObject principal, insira o endereço IP atribuído ao ESP32.  
   * Gere a build para o dispositivo móvel (Android/iOS) ou execute no Editor utilizando a webcam.  
   * Aponte a câmera para o marcador impresso afixado sobre o chassi para visualizar os hologramas de telemetria.