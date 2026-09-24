import { TelemetryMock } from './telemetry_mock.js';

const startBtn = document.getElementById('start-btn');
const statusEl = document.getElementById('status');

startBtn.addEventListener('click', async () => {
  startBtn.innerText = "Solicitando câmera...";

  try {
    // Acessa as instâncias globais reais injetadas no window
    const THREE = window.THREE;
    const MindARThree = window.MINDAR.IMAGE.MindARThree;

    // 1. Inicializa o WebAR com o marcador personalizado
    const mindarThree = new MindARThree({
      container: document.querySelector("#ar-container"),
      imageTargetSrc: "/targets.mind",
    });

    const { renderer, scene, camera } = mindarThree;

    renderer.setClearColor(0x000000, 0); // Fundo 100% transparente para exibir o vídeo da câmera

    // 2. Iluminação
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(0, 5, 5);
    scene.add(dirLight);

    // 3. Âncora AR
    const anchor = mindarThree.addAnchor(0);

    // 4. Modelo do Robô
    const robotGroup = new THREE.Group();
    anchor.group.add(robotGroup);
    robotGroup.scale.set(0.3, 0.3, 0.3);

    // Chassi
    const chassisGeo = new THREE.BoxGeometry(2, 0.4, 3);
    const chassisMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.3,
      metalness: 0.8
    });
    const chassis = new THREE.Mesh(chassisGeo, chassisMat);
    robotGroup.add(chassis);

    // Sensores HC-SR04
    const eyeGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.3, 16);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9 });
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.rotation.x = Math.PI / 2;
    leftEye.position.set(-0.35, 0.2, 1.5);
    robotGroup.add(leftEye);

    const rightEye = leftEye.clone();
    rightEye.position.x = 0.35;
    robotGroup.add(rightEye);

    // 5. Cone Ultrassônico Dinâmico
    const coneRadius = 0.26;
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
    sensorCone.position.set(0, 0.2, 1.5);
    robotGroup.add(sensorCone);

    const wireMat = new THREE.MeshBasicMaterial({ color: 0x00ffcc, wireframe: true });
    const sensorConeWire = new THREE.Mesh(coneGeo, wireMat);
    sensorCone.add(sensorConeWire);

    // 6. Atualização de Telemetria
    function updateDigitalTwin(data) {
      const visualLength = Math.max(0.5, data.distance_cm / 10);
      sensorCone.scale.set(visualLength * 0.4, visualLength, visualLength * 0.4);

      let dynamicColor = 0x00ffcc;
      if (data.state === 'BRAKE') dynamicColor = 0xffaa00;
      else if (data.state === 'REVERSE' || data.state === 'ROTATE') dynamicColor = 0xff2244;

      coneMat.color.setHex(dynamicColor);
      wireMat.color.setHex(dynamicColor);

      if (statusEl) {
        statusEl.innerHTML = `
          <b>ESTADO:</b> <span style="color: #${dynamicColor.toString(16)}">${data.state}</span><br>
          <b>DISTÂNCIA:</b> ${data.distance_cm} cm<br>
          <b>MOTORES:</b> L: ${data.left_motor_pwm} | R: ${data.right_motor_pwm}<br>
          <b>ALERTA:</b> ${data.alert ? 'ATIVADO' : 'NORMAL'}
        `;
      }
    }

    const mock = new TelemetryMock(updateDigitalTwin);
    mock.start();

    // 7. Eventos de Deteção
    anchor.onTargetFound = () => {
      if (statusEl) statusEl.innerHTML = `<b>Target Encontrado!</b>`;
    };

    anchor.onTargetLost = () => {
      if (statusEl) statusEl.innerHTML = `<b>Procurando Target...</b>`;
    };

    // 8. Inicia Câmera
    await mindarThree.start();
    startBtn.style.display = 'none';
    if (statusEl) statusEl.innerText = "Aponte a câmera para o cartão alvo...";

    renderer.setAnimationLoop(() => {
      renderer.render(scene, camera);
    });

  } catch (err) {
    console.error("Falha ao iniciar AR:", err);
    startBtn.innerText = "Erro ao carregar câmera";
  }
});