import * as THREE from 'three';
import { TelemetryMock } from './telemetry_mock.js';

// 1. Cena, Câmera e Renderizador
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

// 2. Iluminação
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(5, 10, 7);
scene.add(dirLight);

// 3. Grid de referência de solo
const grid = new THREE.GridHelper(20, 20, 0x00ffff, 0x223344);
grid.position.y = -0.5;
scene.add(grid);

// 4. Modelo do Robô (Chassi simplificado de Digital Twin)
const robotGroup = new THREE.Group();
scene.add(robotGroup);

// Base do carrinho (acrílico / chassi)
const chassisGeo = new THREE.BoxGeometry(2, 0.4, 3);
const chassisMat = new THREE.MeshStandardMaterial({
  color: 0x1e293b,
  roughness: 0.3,
  metalness: 0.8
});
const chassis = new THREE.Mesh(chassisGeo, chassisMat);
robotGroup.add(chassis);

// Olhos do HC-SR04 (sensor frontal)
const eyeGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.3, 16);
const eyeMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9 });
const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
leftEye.rotation.x = Math.PI / 2;
leftEye.position.set(-0.35, 0.2, 1.5);
robotGroup.add(leftEye);

const rightEye = leftEye.clone();
rightEye.position.x = 0.35;
robotGroup.add(rightEye);

// 5. Cone Ultrassónico Dinâmico (Projeção AR do feixe ~15 graus)
const coneRadius = 0.26; // Proporção do raio para a abertura do feixe
const coneGeo = new THREE.ConeGeometry(coneRadius, 1, 32, 1, true);

// Ajusta o pivô para que a ponta do cone fique na origem (0, 0, 0)
// e aponte para fora à medida que escalamos
coneGeo.translate(0, -0.5, 0);

const coneMat = new THREE.MeshBasicMaterial({
  color: 0x00ffcc,
  transparent: true,
  opacity: 0.3,
  side: THREE.DoubleSide
});
const sensorCone = new THREE.Mesh(coneGeo, coneMat);

// Rotaciona para apontar na direção frontal (+Z)
sensorCone.rotation.x = Math.PI / 2;
sensorCone.position.set(0, 0.2, 1.5);
robotGroup.add(sensorCone);

// Contorno aramado no cone para o visual holográfico
const wireMat = new THREE.MeshBasicMaterial({ color: 0x00ffcc, wireframe: true });
const sensorConeWire = new THREE.Mesh(coneGeo, wireMat);
sensorCone.add(sensorConeWire);

// 6. Atualização de Interface e HUD
const statusEl = document.getElementById('status');

function updateDigitalTwin(data) {
  // Ajusta a escala longitudinal do cone proporcionalmente à distância (escala 10 cm = 1 unid 3D)
  const visualLength = Math.max(0.5, data.distance_cm / 10);
  sensorCone.scale.set(visualLength * 0.4, visualLength, visualLength * 0.4);

  // Troca de cor reativa por estado de perigo
  let dynamicColor = 0x00ffcc; // Ciano / Normal
  if (data.state === 'BRAKE') {
    dynamicColor = 0xffaa00; // Amarelo / Alerta
  } else if (data.state === 'REVERSE' || data.state === 'ROTATE') {
    dynamicColor = 0xff2244; // Vermelho / Evasão
  }

  coneMat.color.setHex(dynamicColor);
  wireMat.color.setHex(dynamicColor);

  // Atualiza texto do overlay
  if (statusEl) {
    statusEl.innerHTML = `
      <b>ESTADO:</b> <span style="color: #${dynamicColor.toString(16)}">${data.state}</span><br>
      <b>DISTÂNCIA:</b> ${data.distance_cm} cm<br>
      <b>MOTORES (PWM):</b> L: ${data.left_motor_pwm} | R: ${data.right_motor_pwm}<br>
      <b>ALERTA:</b> ${data.alert ? 'ATIVADO' : 'NORMAL'}
    `;
  }
}

// 7. Inicia o Simulador de Telemetria (Mock)
const mock = new TelemetryMock((data) => {
  updateDigitalTwin(data);
});
mock.start();

// 8. Loop de animação
let angle = 0;
function animate() {
  requestAnimationFrame(animate);

  // Suave rotação de órbita da câmera para visualização tridimensional
  angle += 0.003;
  camera.position.x = Math.sin(angle) * 7;
  camera.position.z = Math.cos(angle) * 7;
  camera.position.y = 4;
  camera.lookAt(0, 0.5, 0);

  renderer.render(scene, camera);
}

animate();

// Responsividade
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});