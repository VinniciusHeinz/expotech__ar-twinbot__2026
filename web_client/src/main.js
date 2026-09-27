const startBtn = document.getElementById('start-btn');
const statusEl = document.getElementById('status');

// Endereço WebSocket do ESP32 na rede local
const WS_URL = "ws://192.168.15.28:81";

startBtn.addEventListener('click', async () => {
  startBtn.innerText = "Solicitando câmara...";

  try {
    const THREE = window.THREE;
    const MindARThree = window.MINDAR.IMAGE.MindARThree;

    // 1. Inicializa o WebAR com o marcador
    const mindarThree = new MindARThree({
      container: document.querySelector("#ar-container"),
      imageTargetSrc: "/targets.mind",
    });

    const { renderer, scene, camera } = mindarThree;
    renderer.setClearColor(0x000000, 0);

    // 2. Iluminação
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(0, 8, 5);
    scene.add(dirLight);

    // 3. Âncora AR
    const anchor = mindarThree.addAnchor(0);

    // 4. Modelo do Robô Procedural Detalhado
    const robotGroup = new THREE.Group();
    anchor.group.add(robotGroup);
    robotGroup.scale.set(0.35, 0.35, 0.35);

    // Materiais
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.85, roughness: 0.25 });
    const rubberMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9, metalness: 0.1 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.6, roughness: 0.3 });
    const pcbMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.3, roughness: 0.4 });
    const chassisPlateMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.5, roughness: 0.4 });

    // 4.1 Placa Base do Chassi
    const baseGeo = new THREE.BoxGeometry(2.0, 0.08, 2.6);
    const basePlate = new THREE.Mesh(baseGeo, chassisPlateMat);
    basePlate.position.y = 0.35;
    robotGroup.add(basePlate);

    // 4.2 Caixa de Bateria / Módulo Central ESP32
    const mcuGeo = new THREE.BoxGeometry(1.2, 0.35, 1.4);
    const mcuMat = new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.2, roughness: 0.7 });
    const mcuBox = new THREE.Mesh(mcuGeo, mcuMat);
    mcuBox.position.set(0, 0.55, -0.2);
    robotGroup.add(mcuBox);

    // 4.3 Quatro Rodas com Jantes
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

    // 4.4 Módulo HC-SR04 Detalhado
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

    // 5. Cone Ultrassónico Dinâmico
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
          <b>ESTADO:</b> <span style="color: #${dynamicColor.toString(16).padStart(6, '0')}">${data.state}</span><br>
          <b>DISTÂNCIA:</b> ${data.distance_cm} cm<br>
          <b>MOTORES:</b> L: ${data.left_motor_pwm} | R: ${data.right_motor_pwm}<br>
          <b>ALERTA:</b> ${data.alert ? 'ATIVADO' : 'NORMAL'}
        `;
      }
    }

    // 7. Conexão WebSocket Real
    const socket = new WebSocket(WS_URL);

    socket.onopen = () => {
      console.log("Conectado ao ESP32 via WebSocket!");
    };

    socket.onmessage = (event) => {
      try {
        const telemetry = JSON.parse(event.data);
        updateDigitalTwin(telemetry);
      } catch (e) {
        console.error("Erro ao processar telemetria recebida:", e);
      }
    };

    socket.onerror = (err) => {
      console.error("Erro no WebSocket:", err);
    };

    socket.onclose = () => {
      console.warn("Conexão WebSocket com o ESP32 encerrada.");
    };

    // 8. Eventos de Deteção AR
    anchor.onTargetFound = () => {
      console.log("Alvo AR encontrado!");
    };

    anchor.onTargetLost = () => {
      console.log("Alvo AR perdido!");
    };

    // 9. Inicia Câmara
    await mindarThree.start();
    startBtn.style.display = 'none';

    renderer.setAnimationLoop(() => {
      renderer.render(scene, camera);
    });

  } catch (err) {
    console.error("Falha ao iniciar AR:", err);
    startBtn.innerText = "Erro ao carregar câmara";
  }
});