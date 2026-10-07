# Relatório de Status: AR-TwinBot 2026

## 🎯 Objetivo do Projeto
Desenvolver um Gêmeo Digital (Digital Twin) em Realidade Aumentada para um robô autônomo (TwinBot), integrando hardware (ESP32), eletrônica, comunicação em tempo real (WebSocket) e uma interface imersiva no navegador (WebAR).

---

## ✅ O que já foi concluído (Até 06/Out/2026)

### 1. Estrutura e Versionamento
- [x] Criação do repositório no GitHub (branch `main`).
- [x] Configuração adequada do `.gitignore` para pastas pesadas (`node_modules`, `.pio`).
- [x] Divisão estruturada do projeto em `firmware/` (C++) e `web_client/` (Node.js/Vite).

### 2. Firmware (ESP32)
- [x] Resolução dos problemas de driver USB-to-UART (Silicon Labs CP210x).
- [x] Configuração do sensor ultrassônico HC-SR04 para leitura de distância.
- [x] Criação da Máquina de Estados Finitos de movimentação (`FORWARD`, `BRAKE`, `REVERSE`, `ROTATE`).
- [x] Implementação de um Servidor WebSocket rodando na porta 81 do ESP32, enviando telemetria em formato JSON.

### 3. Frontend / WebAR (Navegador)
- [x] Configuração do ambiente Vite com Three.js e MindAR.
- [x] Transição de dados simulados (Mock) para telemetria real via conexão WebSocket com o IP do ESP32.
- [x] **UI/UX:** Criação de um painel HUD em estilo *Glassmorphism* (translúcido/desfocado) para exibição dos dados de telemetria sobrepostos à câmera.
- [x] **Modelagem 3D:** Substituição de formas básicas por um modelo 3D procedural detalhado, contendo:
  - Chassi de acrílico semitransparente.
  - Quatro rodas com pneus escuros e jantes em ciano.
  - Eletrônica central (bateria/ESP32).
  - Sensor HC-SR04 com placa PCB e cilindros metálicos.
  - Cone ultrassônico dinâmico que muda de tamanho e cor conforme a leitura de distância e estado do robô.

### 4. Hardware e Eletrônica
- [x] Aquisição do ferro de solda e insumos.
- [x] Chegada do suporte de baterias 18650 com chave liga/desliga (06/Out).

---

## 🚀 O que falta fazer (Próximos Passos)

### 1. Montagem Física e Soldagem
- [ ] Soldar os fios nos terminais dos 4 motores DC com estanho para evitar mau contato.
- [ ] Conectar os motores às saídas da Ponte H (L298N).
- [ ] Ligar a alimentação do suporte de baterias (18650) na Ponte H, compartilhando o GND com o ESP32, e alimentar o ESP32.

### 2. Integração de Software e Motores (Firmware)
- [ ] Mapear e configurar os pinos de saída PWM no código do ESP32 para controlar a Ponte H L298N (pinos ENA, ENB, IN1, IN2, IN3, IN4).
- [ ] Conectar a lógica dos motores à máquina de estados já existente (fazer os motores efetivamente girarem para frente, pararem, ou inverterem com base na distância lida pelo HC-SR04).

### 3. Testes Práticos e Refinamentos
- [ ] Colocar o robô no chão de forma 100% autônoma (sem cabo USB) e testar a capacidade de desviar de obstáculos fisicamente.
- [ ] Verificar a estabilidade da conexão WebSocket quando o robô estiver em movimento pela casa.
- [ ] (Opcional) Implementar mDNS (ex: acessar via `ws://twinbot.local:81`) no ESP32 para não depender de um IP fixo (`192.168.15.28`) caso o roteador mude o endereço.

---
*Documento gerado para alinhamento e acompanhamento das etapas finais de desenvolvimento físico e lógico.*