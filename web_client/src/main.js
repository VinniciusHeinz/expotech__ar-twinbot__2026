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
// 4. CONSTRUTOR DO MODELO 3D DO ROBÔ
// ============================================================================
function createRobotModel() {
  const THREE = window.THREE;
  const robotGroup = new THREE.Group();

  const metalMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.85, roughness: 0.25 });
  const rubberMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9, metalness: 0.1 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.6, roughness: 0.3 });
  const pcbMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.3, roughness: 0.4 });
  const chassisPlateMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.5, roughness: 0.4 });

  const baseGeo = new THREE.BoxGeometry(2.0, 0.08, 2.6);
  const basePlate = new THREE.Mesh(baseGeo, chassisPlateMat);
  basePlate.position.y = 0.35;
  robotGroup.add(basePlate);

  const mcuGeo = new THREE.BoxGeometry(1.2, 0.35, 1.4);
  const mcuMat = new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.2, roughness: 0.7 });
  const mcuBox = new THREE.Mesh(mcuGeo, mcuMat);
  mcuBox.position.set(0, 0.55, -0.2);
  robotGroup.add(mcuBox);

  const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.22, 24);
  const rimGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.23, 16);

  const wheelPositions = [
    { x: -1.15, z: 0.8 },
    { x: 1.15, z: 0.8 },
    { x: -1.15, z: -0.8 },
    { x: 1.15, z: -0.8 }
  ];

  wheelPositions.forEach(pos => {
    const tire = new THREE.Mesh(wheelGeo, rubberMat);
    tire.rotation.z = Math.PI / 2;
    tire.position.set(pos.x, 0.35, pos.z);

    const rim = new THREE.Mesh(rimGeo, rimMat);
    tire.add(rim);

    robotGroup.add(tire);
  });

  const sensorGroup = new THREE.Group();
  sensorGroup.position.set(0, 0.65, 1.3);

  const sensorPcb = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.45, 0.05), pcbMat);
  sensorGroup.add(sensorPcb);

  const barrelGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.22, 20);
  const capGeo = new THREE.CircleGeometry(0.13, 16);
  const capMat = new THREE.MeshBasicMaterial({ color: 0x1e293b });

  [-0.24, 0.24].forEach(xOffset => {
    const barrel = new THREE.Mesh(barrelGeo, metalMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(xOffset, 0, 0.11);

    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.set(0, 0.115, 0);
    cap.rotation.x = -Math.PI / 2;
    barrel.add(cap);

    sensorGroup.add(barrel);
  });

  robotGroup.add(sensorGroup);

  const coneRadius = 0.32;
  const coneGeo = new THREE.ConeGeometry(coneRadius, 1, 32, 1, true);
  coneGeo.translate(0, -0.5, 0);

  const coneMat = new THREE.MeshBasicMaterial({
    color: 0x00ffcc,
    transparent: true,
    opacity: 0.35,
    side: THREE.DoubleSide
  });
  const sensorCone = new THREE.Mesh(coneGeo, coneMat);
  sensorCone.rotation.x = Math.PI / 2;
  sensorCone.position.set(0, 0.65, 1.45);
  robotGroup.add(sensorCone);

  const wireMat = new THREE.MeshBasicMaterial({ color: 0x00ffcc, wireframe: true });
  const sensorConeWire = new THREE.Mesh(coneGeo, wireMat);
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
// 7. EVENTOS DOS BOTÕES DE VISUALIZAÇÃO
// ============================================================================
startArBtn.addEventListener('click', startARMode);
startOrbitBtn.addEventListener('click', startOrbitMode);

btnModeAr.addEventListener('click', startARMode);
btnModeOrbit.addEventListener('click', startOrbitMode);