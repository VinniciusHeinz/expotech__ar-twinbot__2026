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

// Cria automaticamente o seletor de IP dentro do Painel Admin se não existir no index.html
let espIpInput = document.getElementById('esp-ip-input');
let espIpConnectBtn = document.getElementById('esp-ip-connect-btn');

if (!espIpInput && adminPanel) {
  const ipBox = document.createElement('div');
  ipBox.style.cssText = 'width:100%;display:flex;flex-direction:column;gap:4px;border-bottom:1px solid rgba(255,255,255,0.15);padding-bottom:8px;margin-bottom:4px;';
  ipBox.innerHTML = `
    <label style="font-size:10px;color:#94a3b8;">IP DA ESP32:</label>
    <div style="display:flex;gap:4px;width:100%;">
      <input type="text" id="esp-ip-input" placeholder="192.168.137.x" autocomplete="off" style="flex:1;min-width:0;width:110px;background:#1e293b;border:1px solid #475569;border-radius:6px;color:#f8fafc;font-family:monospace;font-size:11px;padding:6px;" />
      <button id="esp-ip-connect-btn" style="background:#00ffcc;color:#0f172a;border:none;border-radius:6px;padding:6px 8px;font-family:monospace;font-size:11px;font-weight:bold;cursor:pointer;">OK</button>
    </div>
  `;
  adminPanel.insertBefore(ipBox, adminPanel.firstChild);
  espIpInput = document.getElementById('esp-ip-input');
  espIpConnectBtn = document.getElementById('esp-ip-connect-btn');
}

// Credenciais de Acesso Admin
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'twinbot2026';

let isAdminLoggedIn = false;
let isManualControl = true; // Inicia em Modo Manual por segurança
let wsSocket = null;

// Usa o IP atual do Hotspot como padrão
let currentEspIp = localStorage.getItem('twinbot_esp_ip') || '192.168.137.162';
if (espIpInput) {
  espIpInput.value = currentEspIp;
}

// ============================================================================
// 1. CONEXÃO WEBSOCKET COM IP DINÂMICO (Via Proxy Seguro do Vite)
// ============================================================================
const activeCones = [];
let lastTelemetry = null;

async function connectWebSocket(targetIp = currentEspIp) {
  currentEspIp = targetIp.trim();
  localStorage.setItem('twinbot_esp_ip', currentEspIp);

  if (espIpInput && espIpInput.value !== currentEspIp) {
    espIpInput.value = currentEspIp;
  }

  if (wsSocket) {
    wsSocket.onclose = null;
    wsSocket.onerror = null;
    wsSocket.close();
  }

  if (statusEl) {
    statusEl.innerHTML = `Conectando ao ESP32 (${currentEspIp})...`;
  }

  // Avisa o servidor Vite qual é o novo IP antes de abrir o WebSocket
  try {
    await fetch(`/api/set-ip?ip=${encodeURIComponent(currentEspIp)}`);
  } catch (e) {
    console.warn("Não foi possível atualizar rota de IP:", e);
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const WS_URL = `${protocol}//${window.location.host}/api/ws`;

  wsSocket = new WebSocket(WS_URL);

  wsSocket.onopen = () => {
    console.log(`Conectado ao ESP32 (${currentEspIp}) via WebSocket!`);
    if (statusEl) {
      statusEl.innerHTML = `ESP32 Conectado (${currentEspIp}). Aguardando dados...`;
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

  wsSocket.onerror = () => {
    if (statusEl) {
      statusEl.innerHTML = `<span style='color: #ff2244;'>Sem resposta em ${currentEspIp}</span><br><small>Troque o IP no botão ADMIN</small>`;
    }
  };

  wsSocket.onclose = () => {
    console.warn("Conexão WebSocket com o ESP32 encerrada.");
  };
}

function sendCommand(payload) {
  if (wsSocket && wsSocket.readyState === WebSocket.OPEN) {
    wsSocket.send(JSON.stringify(payload));
  }
}

function handleIpChange() {
  if (!espIpInput) return;
  const newIp = espIpInput.value.trim();
  if (newIp) {
    connectWebSocket(newIp);
  }
}

if (espIpConnectBtn) {
  espIpConnectBtn.addEventListener('click', handleIpChange);
}
if (espIpInput) {
  espIpInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleIpChange();
  });
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

  if (typeof data.manual === 'boolean' && data.manual !== isManualControl) {
    isManualControl = data.manual;
    syncDriveModeUI();
  }

  const controlTag = data.manual ? '<span style="color:#ffaa00">MANUAL</span>' : '<span style="color:#00ffcc">AUTÓNOMO</span>';

  if (statusEl) {
    statusEl.innerHTML = `
      <b>IP:</b> ${currentEspIp}<br>
      <b>MODO:</b> ${controlTag}<br>
      <b>ESTADO:</b> <span style="color: #${dynamicColor.toString(16).padStart(6, '0')}">${data.state}</span><br>
      <b>DISTÂNCIA:</b> ${data.distance_cm} cm<br>
      <b>MOTORES:</b> L: ${data.left_motor_pwm} | R: ${data.right_motor_pwm}<br>
      <b>ALERTA:</b> ${data.alert ? 'ATIVADO' : 'NORMAL'}
    `;
  }
}

function syncDriveModeUI() {
  if (!toggleDriveModeBtn || !dpadContainer) return;
  if (isManualControl) {
    toggleDriveModeBtn.innerText = '🕹️ MODO: MANUAL';
    toggleDriveModeBtn.classList.add('manual-active');
    dpadContainer.classList.add('enabled');
  } else {
    toggleDriveModeBtn.innerText = '🤖 MODO: AUTÓNOMO';
    toggleDriveModeBtn.classList.remove('manual-active');
    dpadContainer.classList.remove('enabled');
  }
}

syncDriveModeUI();

// ============================================================================
// 3. AUTENTICAÇÃO ADMIN E CONTROLO REMOTO
// ============================================================================
if (btnAdminLogin) {
  btnAdminLogin.addEventListener('click', () => {
    if (isAdminLoggedIn) {
      adminPanel.style.display = adminPanel.style.display === 'none' ? 'flex' : 'none';
    } else {
      loginError.style.display = 'none';
      adminUser.value = '';
      adminPass.value = '';
      loginModal.style.display = 'flex';
      adminUser.focus();
    }
  });
}

if (loginCancel) {
  loginCancel.addEventListener('click', () => {
    loginModal.style.display = 'none';
  });
}

function handleLogin() {
  const u = adminUser.value.trim();
  const p = adminPass.value.trim();

  if (u === ADMIN_USER && p === ADMIN_PASS) {
    isAdminLoggedIn = true;
    loginModal.style.display = 'none';
    btnAdminLogin.innerText = '🔓 ADMIN';
    btnAdminLogin.classList.add('logged-in');
    adminPanel.style.display = 'flex';
    syncDriveModeUI();
  } else {
    loginError.style.display = 'block';
  }
}

if (loginSubmit) loginSubmit.addEventListener('click', handleLogin);
if (adminPass) {
  adminPass.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleLogin();
  });
}

if (toggleDriveModeBtn) {
  toggleDriveModeBtn.addEventListener('click', () => {
    isManualControl = !isManualControl;
    syncDriveModeUI();
    sendCommand({ cmd: 'mode', manual: isManualControl });
  });
}

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

const activeKeys = new Set();
window.addEventListener('keydown', (e) => {
  if (!isAdminLoggedIn || !isManualControl || loginModal.style.display === 'flex') return;
  if (document.activeElement === espIpInput) return;

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
  if (document.activeElement === espIpInput) return;

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

  const chassisShape = new THREE.Shape();
  chassisShape.moveTo(-0.68, 1.35);
  chassisShape.lineTo(0.68, 1.35);
  chassisShape.lineTo(0.88, 1.15);
  chassisShape.lineTo(0.88, 0.05);
  chassisShape.lineTo(0.66, 0.05);
  chassisShape.lineTo(0.66, -0.95);
  chassisShape.lineTo(1.08, -0.95);
  chassisShape.lineTo(1.08, -1.25);
  chassisShape.quadraticCurveTo(0, -1.72, -1.08, -1.25);
  chassisShape.lineTo(-1.08, -0.95);
  chassisShape.lineTo(-0.66, -0.95);
  chassisShape.lineTo(-0.66, 0.05);
  chassisShape.lineTo(-0.88, 0.05);
  chassisShape.lineTo(-0.88, 1.15);
  chassisShape.closePath();

  const chassisGeo = new THREE.ExtrudeGeometry(chassisShape, { depth: 0.06, bevelEnabled: false });
  chassisGeo.rotateX(Math.PI / 2);

  const chassisMesh = new THREE.Mesh(chassisGeo, acrylicMat);
  chassisMesh.position.y = 0.48;
  robotGroup.add(chassisMesh);

  const chassisEdges = new THREE.LineSegments(new THREE.EdgesGeometry(chassisGeo), acrylicEdgeMat);
  chassisMesh.add(chassisEdges);

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

  [-0.95, 0.95].forEach(xPos => {
    const wheelGroup = new THREE.Group();
    wheelGroup.position.set(xPos, 0.52, -0.45);

    const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.36, 32), rubberMat);
    tire.rotation.z = Math.PI / 2;
    wheelGroup.add(tire);

    for (let i = 0; i < 18; i++) {
      const angle = (i / 18) * Math.PI * 2;
      const tread = new THREE.Mesh(new THREE.BoxGeometry(0.37, 0.035, 0.06), treadMat);
      tread.position.set(0, Math.cos(angle) * 0.515, Math.sin(angle) * 0.515);
      tread.rotation.x = -angle;
      wheelGroup.add(tread);
    }

    const rimOuter = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.37, 24, 1, true), yellowRimMat);
    rimOuter.rotation.z = Math.PI / 2;
    wheelGroup.add(rimOuter);

    const rimBack = new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.37, 0.28, 24), rubberMat);
    rimBack.rotation.z = Math.PI / 2;
    wheelGroup.add(rimBack);

    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.38, 16), yellowRimMat);
    hub.rotation.z = Math.PI / 2;
    wheelGroup.add(hub);

    for (let i = 0; i < 5; i++) {
      const spokeAngle = (i / 5) * Math.PI * 2;
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.085, 0.36), yellowRimMat);
      spoke.position.set(0, Math.cos(spokeAngle) * 0.18, Math.sin(spokeAngle) * 0.18);
      spoke.rotation.x = spokeAngle;
      wheelGroup.add(spoke);
    }

    robotGroup.add(wheelGroup);
  });

  [-0.58, 0.58].forEach(xPos => {
    const motorBox = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.28, 0.78), yellowMotorMat);
    motorBox.position.set(xPos, 0.30, -0.45);
    robotGroup.add(motorBox);
  });

  const casterGroup = new THREE.Group();
  casterGroup.position.set(0, 0.42, 1.05);

  [[-0.14, -0.1], [0.14, -0.1], [-0.14, 0.1], [0.14, 0.1]].forEach(([bx, bz]) => {
    const standoff = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.12, 8), brassMat);
    standoff.position.set(bx, -0.06, bz);
    casterGroup.add(standoff);
  });

  const casterPlate = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.03, 0.3), metalMat);
  casterPlate.position.y = -0.12;
  casterGroup.add(casterPlate);

  const casterFork = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.22), metalMat);
  casterFork.position.set(0, -0.21, -0.03);
  casterGroup.add(casterFork);

  const casterWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.12, 24), whiteWheelMat);
  casterWheel.rotation.z = Math.PI / 2;
  casterWheel.position.set(0, -0.26, -0.05);
  casterGroup.add(casterWheel);

  robotGroup.add(casterGroup);

  const mountGroup = new THREE.Group();
  mountGroup.position.set(0, 0.48, 1.15);

  const baseFoot = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.04, 0.34), mdfMat);
  baseFoot.position.set(0, 0.02, -0.05);
  mountGroup.add(baseFoot);

  const redPad = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.14, 0.05, 16),
    new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.6 })
  );
  redPad.position.set(0, 0.025, -0.05);
  mountGroup.add(redPad);

  const neckMdf = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.52, 0.04), mdfMat);
  neckMdf.position.set(0, 0.26, 0.10);
  mountGroup.add(neckMdf);

  const neckBlue = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.52, 0.02), bracketBlue);
  neckBlue.position.set(0, 0.26, 0.125);
  mountGroup.add(neckBlue);

  [-0.08, 0.08].forEach(slotX => {
    const vSlot = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.20, 0.08), slotMat);
    vSlot.position.set(slotX, 0.32, 0.11);
    mountGroup.add(vSlot);
  });

  const headMdf = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.50, 0.04), mdfMat);
  headMdf.position.set(0, 0.68, 0.10);
  mountGroup.add(headMdf);

  const headBlue = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.50, 0.02), bracketBlue);
  headBlue.position.set(0, 0.68, 0.125);
  mountGroup.add(headBlue);

  const hcPcb = new THREE.Mesh(new THREE.BoxGeometry(0.90, 0.40, 0.03), pcbBlue);
  hcPcb.position.set(0, 0.68, 0.08);
  mountGroup.add(hcPcb);

  const sensorHeader = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.12, 0.08), espBlack);
  sensorHeader.position.set(0, 0.45, 0.06);
  mountGroup.add(sensorHeader);

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

  const espGroup = new THREE.Group();
  espGroup.position.set(-0.08, 0.52, 0.12);

  const espBase = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.08, 1.05), espBlack);
  espGroup.add(espBase);

  const espModule = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.08, 0.88), espBlack);
  espModule.position.y = 0.07;
  espGroup.add(espModule);

  const espChip = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.02, 0.30), metalMat);
  espChip.position.set(0, 0.115, 0.18);
  espGroup.add(espChip);

  [-0.22, 0.22].forEach(px => {
    const pinRow = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.10, 0.85), brassMat);
    pinRow.position.set(px, 0.06, 0);
    espGroup.add(pinRow);
  });

  const espLed = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, 0.03, 0.04),
    new THREE.MeshBasicMaterial({ color: 0xff2244 })
  );
  espLed.position.set(0.1, 0.12, -0.32);
  espGroup.add(espLed);

  robotGroup.add(espGroup);

  const l298Group = new THREE.Group();
  l298Group.position.set(0.08, 0.51, -0.68);

  const l298Pcb = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.05, 0.78), pcbRed);
  l298Group.add(l298Pcb);

  const heatsink = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.38, 0.34), darkMetalMat);
  heatsink.position.set(-0.05, 0.21, 0);
  l298Group.add(heatsink);

  [-0.12, 0.12].forEach(cx => {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.18, 12), metalMat);
    cap.position.set(cx, 0.11, -0.22);
    l298Group.add(cap);
  });

  const termSideL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.18, 0.26), terminalBlue);
  termSideL.position.set(-0.30, 0.11, 0.05);
  const termSideR = termSideL.clone();
  termSideR.position.set(0.30, 0.11, 0.05);
  const termRear = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.18, 0.16), terminalBlue);
  termRear.position.set(0.12, 0.11, -0.30);
  l298Group.add(termSideL, termSideR, termRear);

  robotGroup.add(l298Group);

  const wireColors = [0xef4444, 0x22c55e, 0xeab308, 0x3b82f6, 0xa855f7, 0xf97316];

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

  const coneRadius = 0.32;
  const rawConeGeo = new THREE.ConeGeometry(coneRadius, 1, 32, 1, true);
  rawConeGeo.translate(0, -0.5, 0);

  const coneMat = new THREE.MeshBasicMaterial({
    color: 0x00ffcc,
    transparent: true,
    opacity: 0.35,
    side: THREE.DoubleSide
  });

  const sensorCone = new THREE.Mesh(rawConeGeo, coneMat);
  sensorCone.rotation.x = -Math.PI / 2;
  sensorCone.position.set(0, 1.16, 1.48);
  robotGroup.add(sensorCone);

  const wireMat = new THREE.MeshBasicMaterial({ color: 0x00ffcc, wireframe: true });
  const sensorConeWire = new THREE.Mesh(rawConeGeo, wireMat);
  sensorCone.add(sensorConeWire);

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
// 7. EVENTOS DOS BOTÕES DE VISUALIZAÇÃO E INÍCIO DO WEBSOCKET
// ============================================================================
if (startArBtn) startArBtn.addEventListener('click', startARMode);
if (startOrbitBtn) startOrbitBtn.addEventListener('click', startOrbitMode);

if (btnModeAr) btnModeAr.addEventListener('click', startARMode);
if (btnModeOrbit) btnModeOrbit.addEventListener('click', startOrbitMode);

connectWebSocket(currentEspIp);