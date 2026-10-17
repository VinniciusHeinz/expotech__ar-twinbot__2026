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

// ============================================================================
// 1. CONEXÃO WEBSOCKET INTACTA (Via Proxy Seguro do Vite)
// ============================================================================
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const WS_URL = `${protocol}//${window.location.host}/api/ws`;

// Guarda referências de todos os cones/materiais criados (AR e 3D Livre)
// para que ambos atualizem em tempo real com a telemetria do ESP32
const activeCones = [];
let lastTelemetry = null;

function connectWebSocket() {
  if (statusEl) {
    statusEl.innerHTML = "Conectando ao ESP32 via Telemetria...";
  }

  const socket = new WebSocket(WS_URL);

  socket.onopen = () => {
    console.log("Conectado ao ESP32 via WebSocket!");
    if (statusEl) {
      statusEl.innerHTML = "ESP32 Conectado. Aguardando dados...";
    }
  };

  socket.onmessage = (event) => {
    try {
      const telemetry = JSON.parse(event.data);
      lastTelemetry = telemetry;
      updateDigitalTwin(telemetry);
    } catch (e) {
      console.error("Erro ao processar telemetria recebida:", e);
    }
  };

  socket.onerror = (err) => {
    console.error("Erro no WebSocket:", err);
    if (statusEl) {
      statusEl.innerHTML = "<span style='color: #ff2244;'>Erro na conexão WebSocket</span>";
    }
  };

  socket.onclose = () => {
    console.warn("Conexão WebSocket com o ESP32 encerrada.");
  };
}

// Inicia o WebSocket imediatamente ao abrir a página
connectWebSocket();

// ============================================================================
// 2. ATUALIZAÇÃO DO GÊMEO DIGITAL E HUD DE TELEMETRIA
// ============================================================================
function updateDigitalTwin(data) {
  const visualLength = Math.max(0.5, data.distance_cm / 10);

  let dynamicColor = 0x00ffcc;
  if (data.state === 'BRAKE') dynamicColor = 0xffaa00;
  else if (data.state === 'REVERSE' || data.state === 'ROTATE') dynamicColor = 0xff2244;

  // Atualiza os cones 3D ativos (tanto no modo AR quanto no modo Inspeção 3D)
  activeCones.forEach(({ sensorCone, coneMat, wireMat }) => {
    sensorCone.scale.set(visualLength * 0.4, visualLength, visualLength * 0.4);
    coneMat.color.setHex(dynamicColor);
    wireMat.color.setHex(dynamicColor);
  });

  if (statusEl) {
    statusEl.innerHTML = `
      <b>ESTADO:</b> <span style="color: #${dynamicColor.toString(16).padStart(6, '0')}">${data.state}</span><br>
      <b>DISTÂNCIA:</b> ${data.distance_cm} cm<br>
      <b>MOTORES:</b> L: ${data.left_motor_pwm} | R: ${data.right_motor_pwm}<br>
      <b>ALERTA:</b> ${data.alert ? 'ATIVADO' : 'NORMAL'}
    `;
  }
}

// ============================================================================
// 3. CONSTRUTOR DO MODELO 3D DO ROBÔ (Reutilizado no Modo AR e no Modo 3D)
// ============================================================================
function createRobotModel() {
  const THREE = window.THREE;
  const robotGroup = new THREE.Group();

  // Materiais
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.85, roughness: 0.25 });
  const rubberMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9, metalness: 0.1 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.6, roughness: 0.3 });
  const pcbMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.3, roughness: 0.4 });
  const chassisPlateMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.5, roughness: 0.4 });

  // Placa Base do Chassi
  const baseGeo = new THREE.BoxGeometry(2.0, 0.08, 2.6);
  const basePlate = new THREE.Mesh(baseGeo, chassisPlateMat);
  basePlate.position.y = 0.35;
  robotGroup.add(basePlate);

  // Caixa de Bateria / Módulo Central ESP32
  const mcuGeo = new THREE.BoxGeometry(1.2, 0.35, 1.4);
  const mcuMat = new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.2, roughness: 0.7 });
  const mcuBox = new THREE.Mesh(mcuGeo, mcuMat);
  mcuBox.position.set(0, 0.55, -0.2);
  robotGroup.add(mcuBox);

  // Quatro Rodas com Jantes
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

  // Módulo HC-SR04 Detalhado
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

  // Cone Ultrassónico Dinâmico
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

  // Regista o cone para receber atualizações do WebSocket
  activeCones.push({ sensorCone, coneMat, wireMat });

  // Se já houver telemetria recebida, aplica imediatamente
  if (lastTelemetry) {
    updateDigitalTwin(lastTelemetry);
  }

  return robotGroup;
}

// ============================================================================
// 4. MODO 1: REALIDADE AUMENTADA (MindAR)
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

    anchor.onTargetFound = () => console.log("Alvo AR encontrado!");
    anchor.onTargetLost = () => console.log("Alvo AR perdido!");

    await mindarThreeInstance.start();
    arInitialized = true;

    renderer.setAnimationLoop(() => {
      renderer.render(scene, camera);
    });
  } catch (err) {
    console.error("Falha ao iniciar AR:", err);
    alert("Não foi possível acessar a câmera. Você pode usar o modo Inspeção 3D.");
    startOrbitMode();
  }
}

// ============================================================================
// 5. MODO 2: INSPEÇÃO 3D INTERATIVA (OrbitControls sem Câmera)
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

  // Iluminação destacada para o visualizador 3D
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
  scene.add(ambientLight);

  const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.4);
  dirLight1.position.set(5, 10, 7);
  scene.add(dirLight1);

  const dirLight2 = new THREE.DirectionalLight(0x00ffcc, 0.5);
  dirLight2.position.set(-5, -3, -5);
  scene.add(dirLight2);

  // Grelha de referência tecnológica sob o robô
  const gridHelper = new THREE.GridHelper(10, 20, 0x00ffcc, 0x1e293b);
  gridHelper.position.y = 0;
  scene.add(gridHelper);

  // Adiciona o modelo do robô no centro da cena
  const robotGroup = createRobotModel();
  scene.add(robotGroup);

  // Controles de rotação 360º com mouse ou toque
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
// 6. EVENTOS DOS BOTÕES
// ============================================================================
startArBtn.addEventListener('click', startARMode);
startOrbitBtn.addEventListener('click', startOrbitMode);

btnModeAr.addEventListener('click', startARMode);
btnModeOrbit.addEventListener('click', startOrbitMode);