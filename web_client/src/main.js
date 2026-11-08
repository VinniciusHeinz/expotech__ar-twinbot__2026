const startMenu = document.getElementById('start-menu');
const startArBtn = document.getElementById('start-ar-btn');
const startOrbitBtn = document.getElementById('start-orbit-btn');

const modeSwitcher = document.getElementById('mode-switcher');
const btnModeAr = document.getElementById('btn-mode-ar');
const btnModeOrbit = document.getElementById('btn-mode-orbit');

const arContainer = document.getElementById('ar-container');
const orbitContainer = document.getElementById('orbit-container');
const orbitHint = document.getElementById('orbit-hint');
const statusEl = document.getElementById('status');

// Elementos do Modo Admin
const btnAdminLogin = document.getElementById('btn-admin-login');
const loginModal = document.getElementById('login-modal');
const adminUser = document.getElementById('admin-user');
const adminPass = document.getElementById('admin-pass');
const loginError = document.getElementById('login-error');
const loginSubmit = document.getElementById('login-submit');
const loginCancel = document.getElementById('login-cancel');
const adminPanel = document.getElementById('admin-panel');
const toggleDriveModeBtn = document.getElementById('toggle-drive-mode');
const dpadContainer = document.getElementById('dpad-container');
const dpadButtons = document.querySelectorAll('.dpad-btn');

// Credenciais de Acesso Admin
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'twinbot2026';

let isAdminLoggedIn = false;
let isManualControl = false;
let wsSocket = null;

// ============================================================================
// 1. CONEXÃO WEBSOCKET INTACTA (Via Proxy Seguro do Vite)
// ============================================================================
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const WS_URL = `${protocol}//${window.location.host}/api/ws`;

const activeCones = [];
let lastTelemetry = null;

function connectWebSocket() {
  if (statusEl) {
    statusEl.innerHTML = "Conectando ao ESP32 via Telemetria...";
  }

  wsSocket = new WebSocket(WS_URL);

  wsSocket.onopen = () => {
    console.log("Conectado ao ESP32 via WebSocket!");
    if (statusEl) {
      statusEl.innerHTML = "ESP32 Conectado. Aguardando dados...";
    }
  };

  wsSocket.onmessage = (event) => {
    try {
      const telemetry = JSON.parse(event.data);
      lastTelemetry = telemetry;
      updateDigitalTwin(telemetry);
    } catch (e) {
      console.error("Erro ao processar telemetria recebida:", e);
    }
  };

  wsSocket.onerror = (err) => {
    console.error("Erro no WebSocket:", err);
    if (statusEl) {
      statusEl.innerHTML = "<span style='color: #ff2244;'>Erro na conexão WebSocket</span>";
    }
  };

  wsSocket.onclose = () => {
    console.warn("Conexão WebSocket com o ESP32 encerrada.");
  };
}

connectWebSocket();

function sendCommand(payload) {
  if (wsSocket && wsSocket.readyState === WebSocket.OPEN) {
    wsSocket.send(JSON.stringify(payload));
  }
}

// ============================================================================
// 2. ATUALIZAÇÃO DO GÊMEO DIGITAL E HUD DE TELEMETRIA
// ============================================================================
function updateDigitalTwin(data) {
  const visualLength = Math.max(0.5, data.distance_cm / 10);

  let dynamicColor = 0x00ffcc;
  if (data.state === 'BRAKE') dynamicColor = 0xffaa00;
  else if (data.state === 'REVERSE' || data.state === 'ROTATE') dynamicColor = 0xff2244;

  activeCones.forEach(({ sensorCone, coneMat, wireMat }) => {
    sensorCone.scale.set(visualLength * 0.4, visualLength, visualLength * 0.4);
    coneMat.color.setHex(dynamicColor);
    wireMat.color.setHex(dynamicColor);
  });

  const controlTag = data.manual ? '<span style="color:#ffaa00">MANUAL</span>' : '<span style="color:#00ffcc">AUTÓNOMO</span>';

  if (statusEl) {
    statusEl.innerHTML = `
      <b>MODO:</b> ${controlTag}<br>
      <b>ESTADO:</b> <span style="color: #${dynamicColor.toString(16).padStart(6, '0')}">${data.state}</span><br>
      <b>DISTÂNCIA:</b> ${data.distance_cm} cm<br>
      <b>MOTORES:</b> L: ${data.left_motor_pwm} | R: ${data.right_motor_pwm}<br>
      <b>ALERTA:</b> ${data.alert ? 'ATIVADO' : 'NORMAL'}
    `;
  }
}

// ============================================================================
// 3. AUTENTICAÇÃO ADMIN E CONTROLO REMOTO
// ============================================================================
btnAdminLogin.addEventListener('click', () => {
  if (isAdminLoggedIn) {
    // Se já estiver logado, alterna a exibição do painel
    adminPanel.style.display = adminPanel.style.display === 'none' ? 'flex' : 'none';
  } else {
    loginError.style.display = 'none';
    adminUser.value = '';
    adminPass.value = '';
    loginModal.style.display = 'flex';
    adminUser.focus();
  }
});

loginCancel.addEventListener('click', () => {
  loginModal.style.display = 'none';
});

function handleLogin() {
  const u = adminUser.value.trim();
  const p = adminPass.value.trim();

  if (u === ADMIN_USER && p === ADMIN_PASS) {
    isAdminLoggedIn = true;
    loginModal.style.display = 'none';
    btnAdminLogin.innerText = '🔓 ADMIN';
    btnAdminLogin.classList.add('logged-in');
    adminPanel.style.display = 'flex';
  } else {
    loginError.style.display = 'block';
  }
}

loginSubmit.addEventListener('click', handleLogin);
adminPass.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleLogin();
});

// Alternar entre Modo Autónomo e Modo Manual
toggleDriveModeBtn.addEventListener('click', () => {
  isManualControl = !isManualControl;

  if (isManualControl) {
    toggleDriveModeBtn.innerText = '🕹️ MODO: MANUAL';
    toggleDriveModeBtn.classList.add('manual-active');
    dpadContainer.classList.add('enabled');
  } else {
    toggleDriveModeBtn.innerText = '🤖 MODO: AUTÓNOMO';
    toggleDriveModeBtn.classList.remove('manual-active');
    dpadContainer.classList.remove('enabled');
  }

  sendCommand({ cmd: 'mode', manual: isManualControl });
});

// Eventos dos botões direcionais (Touch e Rato)
dpadButtons.forEach((btn) => {
  const dir = btn.getAttribute('data-dir');

  const startMove = (e) => {
    e.preventDefault();
    if (!isManualControl) return;
    btn.classList.add('pressed');
    sendCommand({ cmd: 'move', dir });
  };

  const stopMove = (e) => {
    e.preventDefault();
    if (!isManualControl) return;
    btn.classList.remove('pressed');
    if (dir !== 'STOP') {
      sendCommand({ cmd: 'move', dir: 'STOP' });
    }
  };

  btn.addEventListener('mousedown', startMove);
  btn.addEventListener('mouseup', stopMove);
  btn.addEventListener('mouseleave', stopMove);

  btn.addEventListener('touchstart', startMove, { passive: false });
  btn.addEventListener('touchend', stopMove, { passive: false });
  btn.addEventListener('touchcancel', stopMove, { passive: false });
});

// Suporte a Teclado no PC (Setas ou WASD)
const activeKeys = new Set();
window.addEventListener('keydown', (e) => {
  if (!isAdminLoggedIn || !isManualControl || loginModal.style.display === 'flex') return;
  const key = e.key.toLowerCase();
  if (activeKeys.has(key)) return;

  let dir = null;
  if (key === 'arrowup' || key === 'w') dir = 'FORWARD';
  else if (key === 'arrowdown' || key === 's') dir = 'REVERSE';
  else if (key === 'arrowleft' || key === 'a') dir = 'LEFT';
  else if (key === 'arrowright' || key === 'd') dir = 'RIGHT';
  else if (key === ' ') dir = 'STOP';

  if (dir) {
    activeKeys.add(key);
    sendCommand({ cmd: 'move', dir });
  }
});

window.addEventListener('keyup', (e) => {
  if (!isAdminLoggedIn || !isManualControl) return;
  const key = e.key.toLowerCase();
  if (activeKeys.has(key)) {
    activeKeys.delete(key);
    sendCommand({ cmd: 'move', dir: 'STOP' });
  }
});

// ============================================================================
// 4. CONSTRUTOR DO MODELO 3D DO ROBÔ (Alta Fidelidade ao Hardware Real)
// ============================================================================
function createRobotModel() {
  const THREE = window.THREE;
  const robotGroup = new THREE.Group();

  // --- Materiais ---
  const metalMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.85, roughness: 0.2 });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.8, roughness: 0.25 });
  const darkMetalMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.7, roughness: 0.3 });
  const rubberMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.85, metalness: 0.1 });
  const treadMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.95 });
  const yellowRimMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.35, metalness: 0.1 });
  const yellowMotorMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.5 });
  const pcbBlue = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.4, metalness: 0.3 });
  const bracketBlue = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.35, metalness: 0.1 });
  const mdfMat = new THREE.MeshStandardMaterial({ color: 0xa16207, roughness: 0.8 });
  const pcbRed = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.4, metalness: 0.2 });
  const terminalBlue = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.4 });
  const espBlack = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.5, metalness: 0.3 });
  const whiteWheelMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.25 });

  // Acrílico fosco translúcido (visível em qualquer fundo escuro ou câmera AR)
  const acrylicMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    transparent: true,
    opacity: 0.48,
    roughness: 0.2,
    metalness: 0.1,
    side: THREE.DoubleSide
  });
  const acrylicEdgeMat = new THREE.LineBasicMaterial({
    color: 0x94a3b8,
    transparent: true,
    opacity: 0.65
  });

  // ==========================================================================
  // 4.1 CHASSI DE ACRÍLICO (Contorno fiel ao chassi real + bordas visíveis)
  // ==========================================================================
  const chassisShape = new THREE.Shape();
  chassisShape.moveTo(-0.68, 1.35);
  chassisShape.lineTo(0.68, 1.35);    // Ponta frontal onde fica o sensor
  chassisShape.lineTo(0.88, 1.15);    // Chanfro frontal direito
  chassisShape.lineTo(0.88, 0.05);    // Lateral dianteira direita
  chassisShape.lineTo(0.66, 0.05);    // Recorte estreito para a roda
  chassisShape.lineTo(0.66, -0.95);
  chassisShape.lineTo(1.08, -0.95);   // Aba traseira direita
  chassisShape.lineTo(1.08, -1.25);
  chassisShape.quadraticCurveTo(0, -1.72, -1.08, -1.25); // Para-choque curvo traseiro
  chassisShape.lineTo(-1.08, -0.95);  // Aba traseira esquerda
  chassisShape.lineTo(-0.66, -0.95);  // Recorte estreito para a roda
  chassisShape.lineTo(-0.66, 0.05);
  chassisShape.lineTo(-0.88, 0.05);
  chassisShape.lineTo(-0.88, 1.15);   // Chanfro frontal esquerdo
  chassisShape.closePath();

  const chassisGeo = new THREE.ExtrudeGeometry(chassisShape, { depth: 0.06, bevelEnabled: false });
  chassisGeo.rotateX(Math.PI / 2);

  const chassisMesh = new THREE.Mesh(chassisGeo, acrylicMat);
  chassisMesh.position.y = 0.48;
  robotGroup.add(chassisMesh);

  // Destaque das bordas do acrílico para dar efeito de vidro/acrílico cortado a laser
  const chassisEdges = new THREE.LineSegments(new THREE.EdgesGeometry(chassisGeo), acrylicEdgeMat);
  chassisMesh.add(chassisEdges);

  // Detalhes das furações no acrílico e parafusos metálicos
  const slotMat = new THREE.MeshBasicMaterial({ color: 0x0b0f19 });
  [-0.55, 0.55].forEach(x => {
    for (let z = 0.35; z <= 0.75; z += 0.2) {
      const slot = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.065, 0.11), slotMat);
      slot.position.set(x, 0.45, z);
      robotGroup.add(slot);
    }
  });
  const screwGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.07, 10);
  [[-0.35, 0.9], [0.35, 0.9], [-0.45, 0.2], [0.45, 0.2], [0, -1.1]].forEach(([sx, sz]) => {
    const screw = new THREE.Mesh(screwGeo, metalMat);
    screw.position.set(sx, 0.455, sz);
    robotGroup.add(screw);
  });

  // ==========================================================================
  // 4.2 RODAS TRASEIRAS COM 5 RAIOS AMARELOS E PNEUS TRATORADOS + MOTORES DC
  // ==========================================================================
  [-0.95, 0.95].forEach(xPos => {
    const wheelGroup = new THREE.Group();
    wheelGroup.position.set(xPos, 0.52, -0.45);

    // Pneu de borracha
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.36, 32), rubberMat);
    tire.rotation.z = Math.PI / 2;
    wheelGroup.add(tire);

    // Gomos / Sulcos do pneu
    for (let i = 0; i < 18; i++) {
      const angle = (i / 18) * Math.PI * 2;
      const tread = new THREE.Mesh(new THREE.BoxGeometry(0.37, 0.035, 0.06), treadMat);
      tread.position.set(0, Math.cos(angle) * 0.515, Math.sin(angle) * 0.515);
      tread.rotation.x = -angle;
      wheelGroup.add(tread);
    }

    // Aro amarelo externo (anel)
    const rimOuter = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.37, 24, 1, true), yellowRimMat);
    rimOuter.rotation.z = Math.PI / 2;
    wheelGroup.add(rimOuter);

    // Fundo escuro interno da roda para destacar os 5 raios
    const rimBack = new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.37, 0.28, 24), rubberMat);
    rimBack.rotation.z = Math.PI / 2;
    wheelGroup.add(rimBack);

    // Cubo central amarelo
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.38, 16), yellowRimMat);
    hub.rotation.z = Math.PI / 2;
    wheelGroup.add(hub);

    // Os 5 raios amarelos da calota
    for (let i = 0; i < 5; i++) {
      const spokeAngle = (i / 5) * Math.PI * 2;
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.085, 0.36), yellowRimMat);
      spoke.position.set(
        0,
        Math.cos(spokeAngle) * 0.18,
        Math.sin(spokeAngle) * 0.18
      );
      spoke.rotation.x = spokeAngle;
      wheelGroup.add(spoke);
    }

    robotGroup.add(wheelGroup);
  });

  // Motores amarelos TT (Caixa de redução embaixo do chassi)
  [-0.58, 0.58].forEach(xPos => {
    const motorBox = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.28, 0.78), yellowMotorMat);
    motorBox.position.set(xPos, 0.30, -0.45);
    robotGroup.add(motorBox);
  });

  // ==========================================================================
  // 4.3 RODA BOBA FRONTAL (CASTER) COM ESPAÇADORES DOURADOS
  // ==========================================================================
  const casterGroup = new THREE.Group();
  casterGroup.position.set(0, 0.42, 1.05);

  // 4 Espaçadores de latão dourado
  [[-0.14, -0.1], [0.14, -0.1], [-0.14, 0.1], [0.14, 0.1]].forEach(([bx, bz]) => {
    const standoff = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.12, 8), brassMat);
    standoff.position.set(bx, -0.06, bz);
    casterGroup.add(standoff);
  });

  // Base e garfo metálico giratório
  const casterPlate = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.03, 0.3), metalMat);
  casterPlate.position.y = -0.12;
  casterGroup.add(casterPlate);

  const casterFork = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.22), metalMat);
  casterFork.position.set(0, -0.21, -0.03);
  casterGroup.add(casterFork);

  // Rodinha branca de nylon
  const casterWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.12, 24), whiteWheelMat);
  casterWheel.rotation.z = Math.PI / 2;
  casterWheel.position.set(0, -0.26, -0.05);
  casterGroup.add(casterWheel);

  robotGroup.add(casterGroup);

  // ==========================================================================
  // 4.4 SUPORTE VERTICAL AZUL/MDF E SENSOR ULTRASSÔNICO HC-SR04 NA PONTA
  // ==========================================================================
  const mountGroup = new THREE.Group();
  mountGroup.position.set(0, 0.48, 1.15);

  // Base em L (MDF com frente azul)
  const baseFoot = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.04, 0.34), mdfMat);
  baseFoot.position.set(0, 0.02, -0.05);
  mountGroup.add(baseFoot);

  // Aderência vermelha/cola na base do suporte (igual à foto)
  const redPad = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.14, 0.05, 16),
    new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.6 })
  );
  redPad.position.set(0, 0.025, -0.05);
  mountGroup.add(redPad);

  // Haste inferior do suporte (pescoço azul com 2 furos verticais)
  const neckMdf = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.52, 0.04), mdfMat);
  neckMdf.position.set(0, 0.26, 0.10);
  mountGroup.add(neckMdf);

  const neckBlue = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.52, 0.02), bracketBlue);
  neckBlue.position.set(0, 0.26, 0.125);
  mountGroup.add(neckBlue);

  // Os 2 recortes verticais no pescoço do suporte azul
  [-0.08, 0.08].forEach(slotX => {
    const vSlot = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.20, 0.08), slotMat);
    vSlot.position.set(slotX, 0.32, 0.11);
    mountGroup.add(vSlot);
  });

  // Cabeça octogonal azul onde encaixa o HC-SR04
  const headMdf = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.50, 0.04), mdfMat);
  headMdf.position.set(0, 0.68, 0.10);
  mountGroup.add(headMdf);

  const headBlue = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.50, 0.02), bracketBlue);
  headBlue.position.set(0, 0.68, 0.125);
  mountGroup.add(headBlue);

  // Placa PCB do HC-SR04 (vista na traseira/interior do suporte)
  const hcPcb = new THREE.Mesh(new THREE.BoxGeometry(0.90, 0.40, 0.03), pcbBlue);
  hcPcb.position.set(0, 0.68, 0.08);
  mountGroup.add(hcPcb);

  // Conector preto de 4 pinos do sensor saindo por baixo
  const sensorHeader = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.12, 0.08), espBlack);
  sensorHeader.position.set(0, 0.45, 0.06);
  mountGroup.add(sensorHeader);

  // Os 2 Cilindros Metálicos (Olhos do Sensor HC-SR04 apontados para +Z)
  const barrelGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.24, 24);
  const meshCapGeo = new THREE.CircleGeometry(0.14, 20);
  const meshCapMat = new THREE.MeshBasicMaterial({ color: 0x111827 });

  [-0.26, 0.26].forEach(xOffset => {
    const barrel = new THREE.Mesh(barrelGeo, metalMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(xOffset, 0.68, 0.22);

    const cap = new THREE.Mesh(meshCapGeo, meshCapMat);
    cap.position.set(0, 0.122, 0);
    cap.rotation.x = -Math.PI / 2;
    barrel.add(cap);

    mountGroup.add(barrel);
  });

  robotGroup.add(mountGroup);

  // ==========================================================================
  // 4.5 MÓDULO ESP32 (Placa Preta Central) + PONTE H L298N (Vermelha Traseira)
  // ==========================================================================
  // ESP32 no centro-frente
  const espGroup = new THREE.Group();
  espGroup.position.set(-0.08, 0.52, 0.12);

  const espBase = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.08, 1.05), espBlack);
  espGroup.add(espBase);

  const espModule = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.08, 0.88), espBlack);
  espModule.position.y = 0.07;
  espGroup.add(espModule);

  // Chip prateado Wi-Fi do ESP32
  const espChip = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.02, 0.30), metalMat);
  espChip.position.set(0, 0.115, 0.18);
  espGroup.add(espChip);

  // Fileiras de pinos nas laterais do ESP32
  [-0.22, 0.22].forEach(px => {
    const pinRow = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.10, 0.85), brassMat);
    pinRow.position.set(px, 0.06, 0);
    espGroup.add(pinRow);
  });

  // LED vermelho aceso no ESP32
  const espLed = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, 0.03, 0.04),
    new THREE.MeshBasicMaterial({ color: 0xff2244 })
  );
  espLed.position.set(0.1, 0.12, -0.32);
  espGroup.add(espLed);

  robotGroup.add(espGroup);

  // Ponte H L298N (Atrás do ESP32)
  const l298Group = new THREE.Group();
  l298Group.position.set(0.08, 0.51, -0.68);

  const l298Pcb = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.05, 0.78), pcbRed);
  l298Group.add(l298Pcb);

  // Dissipador de calor preto alto com aletas
  const heatsink = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.38, 0.34), darkMetalMat);
  heatsink.position.set(-0.05, 0.21, 0);
  l298Group.add(heatsink);

  // 2 Capacitores eletrolíticos cilíndricos prateados
  [-0.12, 0.12].forEach(cx => {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.18, 12), metalMat);
    cap.position.set(cx, 0.11, -0.22);
    l298Group.add(cap);
  });

  // Bornes azuis da L298N (Laterais e Traseiro)
  const termSideL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.18, 0.26), terminalBlue);
  termSideL.position.set(-0.30, 0.11, 0.05);
  const termSideR = termSideL.clone();
  termSideR.position.set(0.30, 0.11, 0.05);
  const termRear = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.18, 0.16), terminalBlue);
  termRear.position.set(0.12, 0.11, -0.30);
  l298Group.add(termSideL, termSideR, termRear);

  robotGroup.add(l298Group);

  // ==========================================================================
  // 4.6 CHICOTE DE CABOS COLORIDOS (Fiel à passagem lateral e traseira da foto)
  // ==========================================================================
  const wireColors = [0xef4444, 0x22c55e, 0xeab308, 0x3b82f6, 0xa855f7, 0xf97316];

  // Cabos que saem do sensor na frente, passam pela borda esquerda do chassi e sobem pro ESP32
  [0xef4444, 0xeab308, 0x22c55e, 0x78350f].forEach((c, idx) => {
    const offset = idx * 0.025;
    const sensorWireCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.06 + offset, 0.88, 1.18),
      new THREE.Vector3(-0.45, 0.53 + offset, 1.05),
      new THREE.Vector3(-0.62, 0.53 + offset, 0.55),
      new THREE.Vector3(-0.28, 0.72, 0.25 - offset * 2)
    ]);
    const wGeo = new THREE.TubeGeometry(sensorWireCurve, 20, 0.014, 6, false);
    robotGroup.add(new THREE.Mesh(wGeo, new THREE.MeshBasicMaterial({ color: c })));
  });

  // Arco de jumpers entre o ESP32, a L298N e a borda direita do chassi
  for (let i = 0; i < 6; i++) {
    const o = i * 0.03;
    const mainHarnessCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.12, 0.62, 0.25 - o * 2),
      new THREE.Vector3(0.55 + o * 0.5, 0.65 - o * 0.3, -0.25),
      new THREE.Vector3(0.65, 0.55, -0.95 - o),
      new THREE.Vector3(0.20 - o * 2, 0.64, -0.75)
    ]);
    const wGeo = new THREE.TubeGeometry(mainHarnessCurve, 24, 0.015, 6, false);
    robotGroup.add(new THREE.Mesh(wGeo, new THREE.MeshBasicMaterial({ color: wireColors[i % wireColors.length] })));
  }

  // ==========================================================================
  // 5. CONE ULTRASSÔNICO DINÂMICO (CORRIGIDO: PROJETANDO PARA A FRENTE +Z)
  // ==========================================================================
  const coneRadius = 0.32;
  const coneGeo = new THREE.ConeGeometry(coneRadius, 1, 32, 1, true);
  // Desloca o vértice (ponta) do cone para a origem (0, 0, 0)
  coneGeo.translate(0, -0.5, 0);
  // Rotaciona -90 graus em X para que a base do cone aponte para +Z (FRENTE DO ROBÔ)
  coneGeo.rotateX(-Math.PI / 2);

  const coneMat = new THREE.MeshBasicMaterial({
    color: 0x00ffcc,
    transparent: true,
    opacity: 0.35,
    side: THREE.DoubleSide
  });

  // GRUPO PIVÔ: Ao escalar no updateDigitalTwin(x, y, z), o Three.js escala no eixo Y local.
  // Rotacionando o sensorCone em -Math.PI/2, o eixo Y local passa a apontar para +Z (para frente)!
  const rawConeGeo = new THREE.ConeGeometry(coneRadius, 1, 32, 1, true);
  rawConeGeo.translate(0, -0.5, 0);

  const sensorCone = new THREE.Mesh(rawConeGeo, coneMat);
  sensorCone.rotation.x = -Math.PI / 2; // <-- NEGATIVO faz o cone crescer para a FRENTE (+Z)!
  sensorCone.position.set(0, 1.16, 1.48); // Exatamente na frente dos cilindros do HC-SR04
  robotGroup.add(sensorCone);

  const wireMat = new THREE.MeshBasicMaterial({ color: 0x00ffcc, wireframe: true });
  const sensorConeWire = new THREE.Mesh(rawConeGeo, wireMat);
  sensorCone.add(sensorConeWire);

  // Registra o cone para receber atualizações em tempo real do WebSocket
  activeCones.push({ sensorCone, coneMat, wireMat });

  if (lastTelemetry) {
    updateDigitalTwin(lastTelemetry);
  }

  return robotGroup;
}

// ============================================================================
// 5. MODO 1: REALIDADE AUMENTADA (MindAR)
// ============================================================================
let arInitialized = false;
let mindarThreeInstance = null;

async function startARMode() {
  startMenu.style.display = 'none';
  modeSwitcher.style.display = 'flex';
  btnModeAr.classList.add('active');
  btnModeOrbit.classList.remove('active');

  orbitContainer.style.display = 'none';
  orbitHint.style.display = 'none';
  arContainer.style.display = 'block';

  if (arInitialized) return;

  try {
    const THREE = window.THREE;
    const MindARThree = window.MINDAR.IMAGE.MindARThree;

    mindarThreeInstance = new MindARThree({
      container: arContainer,
      imageTargetSrc: "/targets.mind",
    });

    const { renderer, scene, camera } = mindarThreeInstance;
    renderer.setClearColor(0x000000, 0);

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(0, 8, 5);
    scene.add(dirLight);

    const anchor = mindarThreeInstance.addAnchor(0);
    const robotGroup = createRobotModel();
    robotGroup.scale.set(0.35, 0.35, 0.35);
    anchor.group.add(robotGroup);

    await mindarThreeInstance.start();
    arInitialized = true;

    renderer.setAnimationLoop(() => {
      renderer.render(scene, camera);
    });
  } catch (err) {
    console.error("Falha ao iniciar AR:", err);
    alert("Não foi possível acessar a câmera. Abrindo o modo Inspeção 3D.");
    startOrbitMode();
  }
}

// ============================================================================
// 6. MODO 2: INSPEÇÃO 3D INTERATIVA (OrbitControls)
// ============================================================================
let orbitInitialized = false;

function startOrbitMode() {
  startMenu.style.display = 'none';
  modeSwitcher.style.display = 'flex';
  btnModeOrbit.classList.add('active');
  btnModeAr.classList.remove('active');

  arContainer.style.display = 'none';
  orbitContainer.style.display = 'block';
  orbitHint.style.display = 'block';

  if (orbitInitialized) return;

  const THREE = window.THREE;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(3.2, 2.5, 4.2);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  orbitContainer.appendChild(renderer.domElement);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
  scene.add(ambientLight);

  const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.4);
  dirLight1.position.set(5, 10, 7);
  scene.add(dirLight1);

  const dirLight2 = new THREE.DirectionalLight(0x00ffcc, 0.5);
  dirLight2.position.set(-5, -3, -5);
  scene.add(dirLight2);

  const gridHelper = new THREE.GridHelper(10, 20, 0x00ffcc, 0x1e293b);
  gridHelper.position.y = 0;
  scene.add(gridHelper);

  const robotGroup = createRobotModel();
  scene.add(robotGroup);

  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.target.set(0, 0.5, 0.3);
  controls.minDistance = 1.5;
  controls.maxDistance = 15;
  controls.update();

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  function animateOrbit() {
    requestAnimationFrame(animateOrbit);
    controls.update();
    renderer.render(scene, camera);
  }

  animateOrbit();
  orbitInitialized = true;
}

// ============================================================================
// 7. EVENTOS DOS BOTÕES DE VISUALIZAÇÃO
// ============================================================================
startArBtn.addEventListener('click', startARMode);
startOrbitBtn.addEventListener('click', startOrbitMode);

btnModeAr.addEventListener('click', startARMode);
btnModeOrbit.addEventListener('click', startOrbitMode);