# AR-TwinBot: Gêmeo Digital e Telemetria em WebAR para Robôs Móveis Autônomos

**Disciplinas Integradas:** Intelligent Mobile Robots & Computer Graphics and AR/VR  
**Instituição:** Centro Universitário UniFECAF  
**Data:** Setembro de 2026  

---

## 1. Visão Geral

O **AR-TwinBot** é um protótipo de robô móvel autônomo acoplado ao conceito de **Gêmeo Digital (Digital Twin)** por meio de **Realidade Aumentada baseada na Web (WebAR)**. 

O robô físico executa navegação reativa e desvio de obstáculos de forma 100% autônoma utilizando um sensor ultrassônico e microcontrolador ESP32, transmitindo suas variáveis de telemetria em tempo real via rede sem fio. 

Em paralelo, qualquer dispositivo móvel ou computador conectado à rede local pode acessar a aplicação via navegador (sem necessidade de instalar aplicativos nativos), apontar a câmera para o marcador óptico fixado no robô e visualizar elementos holográficos tridimensionais ancorados espacialmente (*Spatial HUD*). A interface projeta o alcance do sensor de distância, a velocidade dos atuadores, os alertas de proximidade e o estado lógico do agente em tempo real.

---

## 2. Arquitetura do Sistema

O sistema opera em três camadas integradas:

1. **Camada Física e Controle (Robô Móvel):**
   * Processamento e controle em malha fechada executados pelo **ESP32**[cite: 5].
   * Leitura periódica do sensor ultrassônico frontal e comando dos motores DC diferenciais via modulação por largura de pulso (PWM) através do driver Ponte H L298N[cite: 5].
   * Máquina de estados finitos (FSM) reativa embarcada[cite: 5].

2. **Camada de Comunicação e Transporte (IoT):**
   * O ESP32 atua como servidor de rede local provendo um endpoint **WebSocket** (porta `81`)[cite: 5].
   * Transmissão contínua de pacotes de telemetria serializados em JSON em uma taxa de 15 Hz a 20 Hz para todos os clientes conectados[cite: 5].

3. **Camada Gráfica e Espacial (WebAR Client):**
   * Aplicação web servida na rede local executando em navegadores modernos via HTTPS[cite: 5].
   * Rastreamento óptico baseado em marcadores fiduciais 2D (*Image Target*) utilizando **MindAR.js**[cite: 5].
   * Pipeline de renderização 3D utilizando **Three.js** para projetar primitivas translúcidas (cone do sensor dinâmico) e painel espacial flutuante ancorados na pose do robô[cite: 5].

---

## 3. Hardware e Componentes

| Componente | Especificação Técnica | Quantidade | Função no Sistema |
| :--- | :--- | :---: | :--- |
| **ESP32 DevKit V1** | Dual-Core Tensilica Xtensa LX6, Wi-Fi 2.4 GHz, BLE | 1 | Unidade de controle central, FSM e servidor WebSocket[cite: 5] |
| **Kit Chassi 2WD** | Acrílico, 2 motores DC (caixa 1:48) + roda boba (caster) | 1 | Plataforma mecânica de locomoção diferencial[cite: 5] |
| **Driver Ponte H L298N** | Driver duplo com dissipador, suporte até 2A por canal | 1 | Controle de sentido e modulação PWM dos motores[cite: 5] |
| **Sensor HC-SR04** | Ultrassônico, alcance de 2 cm a 400 cm, feixe ~15° | 1 | Detecção de obstáculos frontais[cite: 5] |
| **Suporte Acrílico** | Suporte dedicado para montagem do sensor frontal | 1 | Fixação mecânica alinhada ao eixo longitudinal do chassi |
| **Baterias 18650 Li-Ion** | 2 células em série (~7.4V nominal) + case com chave | 1 kit | Alimentação da etapa de potência e barramento lógico[cite: 5] |
| **Cabos Jumper** | Kit com fitas Macho-Macho, Macho-Fêmea e Fêmea-Fêmea | 120 pcs | Roteamento de sinais e alimentação entre os módulos[cite: 5] |
| **Marcador Fiducial** | Marcador impresso de alto contraste (8 cm x 8 cm) | 1 | Alvo de ancoragem 6-DoF para rastreamento visual no WebAR[cite: 5] |

---

## 4. Diagrama de Conexões (Pinout ESP32)

| Módulo / Periférico | Pino do Periférico | GPIO do ESP32 | Descrição / Observações |
| :--- | :--- | :--- | :--- |
| **HC-SR04** | Trigger | `GPIO 5` | Saída digital para disparo do pulso ultrassônico (10 µs)[cite: 5] |
| **HC-SR04** | Echo | `GPIO 18` | Entrada digital (pulso proporcional à distância)[cite: 5] |
| **Ponte H L298N** | ENA | `GPIO 14` | Sinal PWM para controle de velocidade (Motor Esquerdo)[cite: 5] |
| **Ponte H L298N** | IN1 | `GPIO 27` | Sentido de rotação Motor Esquerdo (A1)[cite: 5] |
| **Ponte H L298N** | IN2 | `GPIO 26` | Sentido de rotação Motor Esquerdo (A2)[cite: 5] |
| **Ponte H L298N** | IN3 | `GPIO 25` | Sentido de rotação Motor Direito (B1)[cite: 5] |
| **Ponte H L298N** | IN4 | `GPIO 33` | Sentido de rotação Motor Direito (B2)[cite: 5] |
| **Ponte H L298N** | ENB | `GPIO 32` | Sinal PWM para controle de velocidade (Motor Direito)[cite: 5] |
| **Alimentação** | GND | `GND` | **Atenção:** Interligar polo negativo da bateria, GND da Ponte H e GND do ESP32[cite: 5] |

---

## 5. Máquina de Estados da Navegação Autônoma (FSM)

A lógica reativa do robô avalia a distância frontal continuamente e atualiza o estado de locomoção a cada 50 ms[cite: 5]:

* **`STATE_FORWARD`:** Caminho livre (`distância > 30 cm`). Ambos os motores avançam em velocidade nominal[cite: 5].
* **`STATE_BRAKE`:** Atenção / Desaceleração (`15 cm < distância <= 30 cm`). Redução ativa do ciclo de trabalho (PWM) para minimizar a inércia[cite: 5].
* **`STATE_REVERSE`:** Evasão crítica (`distância <= 15 cm`). Ré preventiva por curto período (300 ms) para desengate de obstáculos frontais[cite: 5].
* **`STATE_ROTATE`:** Manobra diferencial. Motores acionados em sentidos opostos para rotação sobre o próprio eixo até liberar a visada frontal[cite: 5].

---

## 6. Formato do Pacote de Telemetria (JSON)

Os dados são transmitidos em tempo real pelo servidor WebSocket do ESP32 com a seguinte estrutura[cite: 5]:

```json
{
  "timestamp": 124800,
  "distance_cm": 24.5,
  "state": "BRAKING",
  "left_motor_pwm": 120,
  "right_motor_pwm": 120,
  "alert": true
}
```
## 7. Estrutura do Repositório

ar-twinbot/
├── .gitignore
├── LICENSE
├── README.md
├── docs/
│   ├── schematics/             # Diagramas elétricos e ligações da bancada
│   └── targets/                # Arquivo de imagem do marcador (.png / .mind compilado)
├── firmware/                   # Código-fonte C++ para o ESP32
│   ├── platformio.ini          # Configurações de build do PlatformIO
│   └── src/
│       ├── main.cpp            # Loop principal e inicialização Wi-Fi
│       ├── MotorController.h   # Modulação PWM e sentido das rodas
│       ├── DistanceSensor.h    # Rotinas de leitura do HC-SR04
│       └── TelemetryServer.h   # Servidor WebSocket e serialização JSON
└── web_client/                 # Aplicação WebAR (Three.js + MindAR)
    ├── index.html              # Interface do visualizador e viewport da câmera
    ├── package.json            # Dependências da aplicação web
    ├── public/
    │   └── targets/            # Marcador compilado para o rastreador
    └── src/
        ├── main.js             # Setup de cena, câmera AR e pipeline gráfico
        ├── telemetry.js        # Cliente WebSocket conectado ao ESP32
        └── hud.js              # Geração procedural do cone visual e painel 3D

## 8. Como Executar

1. Gravando o Firmware no ESP32
Acesse o diretório firmware/ no VS Code (com PlatformIO) ou na Arduino IDE[cite: 5].

Configure as credenciais do Wi-Fi local (SSID e senha da rede / roteador / hotspot) no arquivo de configuração do firmware[cite: 5].

Conecte a placa ESP32 ao computador via cabo USB e realize o upload[cite: 5].

Abra o Monitor Serial (baud rate: 115200) e anote o endereço IP atribuído ao robô[cite: 5].

2. Executando o Servidor WebAR Local
Acesse o diretório web_client/:

cd web_client
npm install

Inicie o servidor local com suporte a HTTPS (necessário para acesso à câmera pelo navegador):

Bash
npm run dev
O terminal exibirá o endereço de acesso local na rede (ex.: https://192.168.x.x:5173).

3. Acessando a Demonstração
Certifique-se de que o dispositivo móvel (smartphone/tablet) está conectado na mesma rede Wi-Fi que o notebook e o ESP32[cite: 5].

Acesse o link gerado (ou escaneie o QR Code apontando para a URL) e conceda permissão de acesso à câmera no navegador.

No campo de configuração do site, informe o endereço IP do ESP32 para abrir a conexão WebSocket com a telemetria do robô.

Aponte a câmera para o marcador impresso no teto do carrinho para acompanhar os hologramas do Digital Twin em tempo real[cite: 5].
