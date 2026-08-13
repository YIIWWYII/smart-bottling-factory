(function () {
  'use strict';

  var host = document.getElementById('scene-host');
  var fallback = document.getElementById('fallback');
  var stageLabel = document.getElementById('stage-name');
  var sourceLabel = document.getElementById('data-source');
  var selectionLabel = document.getElementById('selection');

  if (!window.THREE) {
    fallback.classList.remove('hidden');
    return;
  }

  var THREE = window.THREE;
  var COLORS = {
    navy: 0x123a5b,
    blue: 0x145da0,
    accent: 0x1f7acb,
    steel: 0x698395,
    steelDark: 0x405968,
    floor: 0xd6e2e9,
    white: 0xf4f8fb,
    running: 0x238b5a,
    warning: 0xd89016,
    alarm: 0xc83f49,
    offline: 0x8397a6,
    product: 0x2a86cf,
    liquid: 0x40a8d8,
    box: 0xb68a52,
    line: 0x6f8796,
    planarBg: 0xe8f1f6,
    reject: 0xb94040
  };

  var state = {
    stageCode: 'PRETREATMENT',
    stageName: '预处理',
    source: 'LOCAL DEMO',
    viewMode: 'THREE',
    paused: false,
    statusColors: true,
    layoutEdit: false,
    speed: 0.12,
    progress: 0,
    stateVersion: 0,
    devices: [],
    products: [],
    sensors: [],
    qualityGates: [],
    alarms: [],
    incidents: [],
    buffer: { inputLevel: 0, outputLevel: 0, capacity: 0, blockedReason: '' },
    upstreamImpact: '',
    downstreamImpact: '',
    latestError: ''
  };

  var scene;
  var camera;
  var perspectiveCamera;
  var planarCamera;
  var renderer;
  var stageRoot;
  var deviceRoot;
  var productRoot;
  var floorRoot;
  var planarFlowParts = [];
  var movingParts = [];
  var clickable = [];
  var raycaster = new THREE.Raycaster();
  var pointer = new THREE.Vector2();
  var clock = new THREE.Clock();
  var draggedDevice = null;
  var pointerStart = { x: 0, y: 0 };
  var previousPointer = { x: 0, y: 0 };
  var cameraOrbit = { yaw: -0.65, pitch: 0.62, distance: 19 };
  var isPointerDown = false;
  var renderFrameId = 0;
  var disposed = false;
  var resizeObserver;

  function material(color, metalness, roughness) {
    return new THREE.MeshStandardMaterial({
      color: color,
      metalness: metalness === undefined ? 0.48 : metalness,
      roughness: roughness === undefined ? 0.48 : roughness
    });
  }

  function mesh(geometry, color, metalness, roughness) {
    var result = new THREE.Mesh(geometry, material(color, metalness, roughness));
    result.castShadow = true;
    result.receiveShadow = true;
    return result;
  }

  function box(w, h, d, color) {
    return mesh(new THREE.BoxGeometry(w, h, d), color);
  }

  function cylinder(radius, height, color, radialSegments) {
    return mesh(new THREE.CylinderGeometry(radius, radius, height, radialSegments || 20), color);
  }

  function flatMaterial(color, opacity) {
    return new THREE.MeshBasicMaterial({
      color: color,
      transparent: opacity !== undefined && opacity < 1,
      opacity: opacity === undefined ? 1 : opacity,
      side: THREE.DoubleSide
    });
  }

  function plane(w, h, color, opacity) {
    return new THREE.Mesh(new THREE.PlaneGeometry(w, h), flatMaterial(color, opacity));
  }

  function disk(radius, color, opacity, segments) {
    return new THREE.Mesh(new THREE.CircleGeometry(radius, segments || 32), flatMaterial(color, opacity));
  }

  function ring(radius, tube, color) {
    return new THREE.Mesh(new THREE.RingGeometry(Math.max(0.01, radius - tube), radius, 32), flatMaterial(color, 1));
  }

  function setPosition(object, x, y, z) {
    object.position.set(x, y, z);
    return object;
  }

  function init() {
    try {
      scene = new THREE.Scene();
      scene.background = new THREE.Color(0xdfeaf1);
      scene.fog = new THREE.Fog(0xdfeaf1, 22, 42);

      perspectiveCamera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
      planarCamera = new THREE.OrthographicCamera(-10, 10, 6, -6, 0.1, 100);
      camera = perspectiveCamera;
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      host.appendChild(renderer.domElement);

      var hemisphere = new THREE.HemisphereLight(0xf5fbff, 0x657786, 2.2);
      scene.add(hemisphere);
      var key = new THREE.DirectionalLight(0xffffff, 3.2);
      key.position.set(-8, 15, 10);
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      key.shadow.camera.left = -18;
      key.shadow.camera.right = 18;
      key.shadow.camera.top = 14;
      key.shadow.camera.bottom = -14;
      scene.add(key);
      var rim = new THREE.DirectionalLight(0x6db7e8, 1.5);
      rim.position.set(10, 8, -10);
      scene.add(rim);

      createFactoryFloor();
      bindInteractions();
      rebuildStage();
      resetCamera();
      resize();
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(host);
      renderFrameId = requestAnimationFrame(renderLoop);
    } catch (error) {
      state.latestError = String(error);
      fallback.classList.remove('hidden');
      sourceLabel.textContent = 'WEBGL UNAVAILABLE';
    }
  }

  function createFactoryFloor() {
    floorRoot = new THREE.Group();
    var floor = box(36, 0.35, 22, COLORS.floor);
    floor.position.y = -0.22;
    floor.receiveShadow = true;
    floor.userData.isFloor = true;
    floorRoot.add(floor);

    var grid = new THREE.GridHelper(36, 36, 0x7c9bad, 0xaec0cb);
    grid.position.y = -0.035;
    grid.material.opacity = 0.35;
    grid.material.transparent = true;
    floorRoot.add(grid);

    for (var x = -17; x <= 17; x += 2) {
      var marker = box(0.08, 0.02, 0.8, x % 4 === 0 ? 0xf0b13a : 0x8297a5);
      marker.position.set(x, 0.01, 9.4);
      floorRoot.add(marker);
    }
    scene.add(floorRoot);
  }

  function clearObject(object) {
    if (!object) return;
    scene.remove(object);
    object.traverse(function (child) {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach(function (item) {
          if (item.map) item.map.dispose();
          item.dispose();
        });
        else {
          if (child.material.map) child.material.map.dispose();
          child.material.dispose();
        }
      }
    });
  }

  function rebuildStage() {
    clearObject(stageRoot);
    stageRoot = new THREE.Group();
    deviceRoot = new THREE.Group();
    productRoot = new THREE.Group();
    stageRoot.add(deviceRoot);
    stageRoot.add(productRoot);
    scene.add(stageRoot);
    movingParts = [];
    planarFlowParts = [];
    clickable = [];
    if (floorRoot) floorRoot.visible = state.viewMode !== 'PLANAR';

    createStageEnvironment(state.stageCode);
    var devices = state.devices.length ? state.devices : demoDevices(state.stageCode);
    devices.forEach(function (device, index) {
      var group = state.viewMode === 'PLANAR'
        ? createPlanarDevice(device, index, devices.length)
        : createDevice(device, index, devices.length);
      group.userData.deviceCode = device.code;
      group.userData.selectType = 'device';
      group.userData.label = device.name || device.code;
      applySavedPosition(group);
      deviceRoot.add(group);
      clickable.push(group);
    });
    rebuildProducts();
    applyRuntimeState();
    resetCamera();
    stageLabel.textContent = state.stageName + ' / ' + state.stageCode;
    sourceLabel.textContent = state.source + (state.paused ? ' · PAUSED' : ' · LIVE');
  }

  function createStageEnvironment(stageCode) {
    if (state.viewMode === 'PLANAR') {
      createPlanarEnvironment(stageCode);
      return;
    }
    if (stageCode === 'AGV_TRANSPORT') {
      var path = box(17, 0.08, 4.6, 0x647887);
      path.position.set(0, 0.02, 0);
      stageRoot.add(path);
      for (var i = -7; i <= 7; i += 2) {
        var line = box(0.8, 0.03, 0.08, 0xf1c34a);
        line.position.set(i, 0.09, 0);
        stageRoot.add(line);
      }
      return;
    }

    if (stageCode === 'WAREHOUSE_INBOUND') {
      [-5.6, 0, 5.6].forEach(function (x) { stageRoot.add(createRack(x, 1.9)); });
      var aisle = box(17, 0.07, 3.4, 0x9cb0bd);
      aisle.position.y = 0.02;
      stageRoot.add(aisle);
      return;
    }

    if (stageCode === 'BEVERAGE_READY') {
      var pipe = cylinder(0.13, 14, COLORS.accent, 14);
      pipe.rotation.z = Math.PI / 2;
      pipe.position.set(0, 3.1, -1.7);
      stageRoot.add(pipe);
      return;
    }

    var conveyor = createConveyor(state.stageCode === 'PACKING' ? 14 : 17);
    conveyor.position.set(0, 0, 0);
    stageRoot.add(conveyor);
  }

  function createPlanarEnvironment(stageCode) {
    var background = plane(18.6, 9.2, COLORS.planarBg, 1);
    background.position.z = -0.08;
    stageRoot.add(background);

    var borderTop = plane(18, 0.08, COLORS.blue, 1);
    borderTop.position.set(0, 4.35, -0.04);
    stageRoot.add(borderTop);
    var borderBottom = plane(18, 0.06, 0x9ab2c0, 1);
    borderBottom.position.set(0, -4.35, -0.04);
    stageRoot.add(borderBottom);

    createPlanarProcessLane(stageCode);
    createPlanarSensorLane();
    createPlanarQualityLane();
    createPlanarBufferLane();
    createPlanarExceptionFlow();
  }

  function createPlanarProcessLane(stageCode) {
    var laneColor = stageCode === 'AGV_TRANSPORT' || stageCode === 'WAREHOUSE_INBOUND' ? 0xa6b7c2 : COLORS.line;
    var lane = plane(16.5, 1.1, laneColor, 0.96);
    lane.position.set(0, 0, 0);
    stageRoot.add(lane);
    var center = plane(16.5, 0.06, 0xf4f8fb, 0.86);
    center.position.set(0, 0, 0.02);
    stageRoot.add(center);
    for (var i = -7; i <= 7; i += 2) {
      var arrow = createPlanarArrow();
      arrow.position.set(i, 0, 0.04);
      stageRoot.add(arrow);
      planarFlowParts.push({ object: arrow, type: 'flow-arrow', originX: i });
    }
    if (stageCode === 'WAREHOUSE_INBOUND') {
      [-5.5, 0, 5.5].forEach(function (x) {
        var zone = plane(2.8, 1.15, 0xc7d5df, 1);
        zone.position.set(x, 2.15, 0.02);
        stageRoot.add(zone);
        stageRoot.add(createPlanarLabel('库位区', x, 2.15, 1.6));
      });
    }
    if (stageCode === 'BEVERAGE_READY') {
      var pipe = plane(13.5, 0.18, COLORS.accent, 1);
      pipe.position.set(0, -2.25, 0.03);
      stageRoot.add(pipe);
      stageRoot.add(createPlanarLabel('配料/杀菌管线', 0, -2.55, 3.1));
    }
  }

  function createPlanarArrow() {
    var group = new THREE.Group();
    var body = plane(0.58, 0.08, 0xf1c34a, 1);
    body.position.x = -0.08;
    group.add(body);
    var shape = new THREE.Shape();
    shape.moveTo(-0.16, -0.17);
    shape.lineTo(0.18, 0);
    shape.lineTo(-0.16, 0.17);
    shape.lineTo(-0.16, -0.17);
    var head = new THREE.Mesh(new THREE.ShapeGeometry(shape), flatMaterial(0xf1c34a, 1));
    head.position.x = 0.32;
    group.add(head);
    return group;
  }

  function createPlanarSensorLane() {
    var sensors = state.sensors || [];
    var startX = -7.2;
    var step = sensors.length <= 1 ? 0 : 14.4 / Math.max(1, sensors.length - 1);
    sensors.slice(0, 8).forEach(function (reading, index) {
      var x = sensors.length <= 1 ? 0 : startX + index * step;
      var qualityColor = reading.quality === 'BAD' || reading.quality === 'FAIL' ? COLORS.alarm : reading.quality === 'STALE' ? COLORS.warning : COLORS.running;
      var node = new THREE.Group();
      node.position.set(x, 3.35, 0.06);
      node.add(disk(0.22, qualityColor, 1, 24));
      node.add(ring(0.34, 0.035, COLORS.blue));
      node.add(createPlanarLabel(reading.sensorType || 'SENSOR', 0, -0.55, 1.2));
      node.add(createPlanarLabel(String(reading.value) + (reading.unit || ''), 0, -0.88, 1.2));
      stageRoot.add(node);
    });
    if (!sensors.length) {
      stageRoot.add(createPlanarLabel('传感器读数等待后端快照', 0, 3.2, 4.2));
    }
  }

  function createPlanarQualityLane() {
    var gates = state.qualityGates || [];
    gates.slice(0, 5).forEach(function (gate, index) {
      var x = -6.3 + index * 3.15;
      var gateColor = colorForState(gate.status || 'WAIT', COLORS.warning);
      var tile = new THREE.Group();
      tile.position.set(x, -3.15, 0.05);
      tile.add(plane(2.35, 0.78, 0xf4f8fb, 0.94));
      tile.add(plane(2.35, 0.08, gateColor, 1));
      tile.children[1].position.y = 0.35;
      tile.add(createPlanarLabel(gate.label || '质量门', 0, 0.08, 1.9));
      tile.add(createPlanarLabel(gate.actual || gate.status || 'WAIT', 0, -0.22, 1.9));
      stageRoot.add(tile);
    });
  }

  function createPlanarBufferLane() {
    var buffer = state.buffer || { inputLevel: 0, outputLevel: 0, capacity: 0, blockedReason: '' };
    var capacity = Math.max(1, Number(buffer.capacity || 0));
    var inputRatio = Math.max(0, Math.min(1, Number(buffer.inputLevel || 0) / capacity));
    var outputRatio = Math.max(0, Math.min(1, Number(buffer.outputLevel || 0) / capacity));
    var input = createBufferBar('IN ' + String(buffer.inputLevel || 0) + '/' + String(capacity), inputRatio, -7.1, -1.8);
    var output = createBufferBar('OUT ' + String(buffer.outputLevel || 0) + '/' + String(capacity), outputRatio, 7.1, -1.8);
    stageRoot.add(input);
    stageRoot.add(output);
    stageRoot.add(createPlanarLabel('上游: ' + (state.upstreamImpact || '等待数据'), -4.1, -2.32, 3.1));
    stageRoot.add(createPlanarLabel('下游: ' + (state.downstreamImpact || '等待数据'), 4.1, -2.32, 3.1));
    if (buffer.blockedReason) {
      stageRoot.add(createPlanarLabel('阻塞: ' + buffer.blockedReason, 0, -2.75, 4.8, COLORS.alarm));
    }
  }

  function createBufferBar(label, ratio, x, y) {
    var group = new THREE.Group();
    group.position.set(x, y, 0.04);
    group.add(plane(2.55, 0.42, 0xd5e1e8, 1));
    var fill = plane(2.55 * ratio, 0.42, ratio > 0.8 ? COLORS.warning : COLORS.running, 1);
    fill.position.x = -1.275 + (2.55 * ratio) / 2;
    fill.position.z = 0.02;
    group.add(fill);
    group.add(createPlanarLabel(label, 0, 0, 2));
    return group;
  }

  function createPlanarExceptionFlow() {
    var alarms = state.alarms || [];
    var incidents = state.incidents || [];
    if (!alarms.length && !incidents.length) return;
    var bypass = plane(13.6, 0.08, COLORS.reject, 1);
    bypass.position.set(0, 1.75, 0.04);
    stageRoot.add(bypass);
    [-6, -3, 0, 3, 6].forEach(function (x, index) {
      var marker = disk(0.13 + (index % 2) * 0.04, COLORS.reject, 1, 18);
      marker.position.set(x, 1.75, 0.06);
      stageRoot.add(marker);
      planarFlowParts.push({ object: marker, type: 'exception-pulse', originX: x });
    });
    stageRoot.add(createPlanarLabel('异常/剔除/回流通道 ' + String(alarms.length + incidents.length) + ' 项', 0, 2.05, 4.4, COLORS.reject));
  }

  function createPlanarLabel(text, x, y, width, color) {
    var canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 96;
    var ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#' + (color || COLORS.navy).toString(16).padStart(6, '0');
    ctx.font = '700 30px HarmonyOS Sans SC, Microsoft YaHei, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(text).slice(0, 28), canvas.width / 2, canvas.height / 2);
    var texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    var label = new THREE.Mesh(new THREE.PlaneGeometry(width || 2.2, 0.42), new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide
    }));
    label.userData.noStatusColor = true;
    label.position.set(x, y, 0.12);
    return label;
  }

  function createConveyor(length) {
    var group = new THREE.Group();
    var bed = box(length, 0.35, 2.4, COLORS.steelDark);
    bed.position.y = 0.65;
    group.add(bed);
    for (var x = -length / 2 + 0.35; x < length / 2; x += 0.7) {
      var roller = cylinder(0.13, 2.05, 0x9bb0bd, 12);
      roller.rotation.x = Math.PI / 2;
      roller.position.set(x, 0.9, 0);
      group.add(roller);
      movingParts.push({ object: roller, type: 'roller', deviceCode: '' });
    }
    [-length / 2 + 0.5, length / 2 - 0.5].forEach(function (x) {
      [-0.9, 0.9].forEach(function (z) {
        var leg = box(0.18, 1.25, 0.18, COLORS.steel);
        leg.position.set(x, 0.15, z);
        group.add(leg);
      });
    });
    return group;
  }

  function createRack(x, z) {
    var group = new THREE.Group();
    for (var y = 0.7; y <= 4.4; y += 1.2) {
      var shelf = box(3.8, 0.12, 1.2, COLORS.steelDark);
      shelf.position.set(0, y, 0);
      group.add(shelf);
      for (var slot = -1.2; slot <= 1.2; slot += 1.2) {
        var carton = box(0.85, 0.72, 0.82, COLORS.box);
        carton.position.set(slot, y + 0.42, 0);
        group.add(carton);
      }
    }
    [-1.75, 1.75].forEach(function (px) {
      var post = box(0.16, 5.2, 0.16, COLORS.blue);
      post.position.set(px, 2.55, 0);
      group.add(post);
    });
    group.position.set(x, 0, z);
    return group;
  }

  function demoDevices(stageCode) {
    var codeMap = {
      PRETREATMENT: ['PT-WASH-01', 'PT-AIR-01', 'PT-PLC-01'],
      GAS_INSPECTION: ['GAS-CHAMBER-01', 'GAS-VERIFY-01', 'GAS-PUMP-01'],
      APPEARANCE_INSPECTION: ['VIS-TOP-01', 'VIS-SIDE-01', 'VIS-REJECT-01'],
      BEVERAGE_READY: ['BEV-MIX-01', 'BEV-HT-01', 'BEV-TEMP-01'],
      FILLING: ['FIL-POS-01', 'FIL-PUMP-01', 'FIL-HEAD-01'],
      SECONDARY_INSPECTION: ['SEC-CAM-01', 'SEC-LEVEL-01', 'SEC-REJECT-01'],
      PACKING: ['PK-ARM-01', 'PK-CAM-01', 'PK-PRINT-01'],
      AGV_TRANSPORT: ['AGV-01', 'AGV-US-01', 'AGV-DISPATCH-01'],
      WAREHOUSE_INBOUND: ['WH-VOC-01', 'WH-SMOKE-01', 'WH-WMS-01']
    };
    return (codeMap[stageCode] || codeMap.PRETREATMENT).map(function (code) {
      return { code: code, name: code, state: 'RUNNING' };
    });
  }

  function kindForDevice(code) {
    if (code === 'AGV-01') return 'agv';
    if (code.indexOf('ARM') >= 0) return 'robot';
    if (code.indexOf('WASH') >= 0 || code.indexOf('CHAMBER') >= 0) return 'chamber';
    if (code.indexOf('MIX') >= 0) return 'tank';
    if (code.indexOf('-HT-') >= 0) return 'heater';
    if (code.indexOf('AIR') >= 0) return 'fan';
    if (code.indexOf('CAM') >= 0 || code.indexOf('LIGHT') >= 0) return 'camera';
    if (code.indexOf('REJECT') >= 0) return 'reject';
    if (code.indexOf('PUMP') >= 0) return 'pump';
    if (code.indexOf('HEAD') >= 0) return 'filler';
    if (code.indexOf('PRINT') >= 0) return 'printer';
    if (code.indexOf('LAMP') >= 0) return 'lamp';
    if (/(VERIFY|TEMP|HUM|SMOKE|US-|ODO|LOAD|FLOW|LEVEL|COUNT)/.test(code)) return 'sensor';
    if (/(PLC|WMS|DISPATCH)/.test(code)) return 'console';
    return 'machine';
  }

  function createDevice(device, index, count) {
    var kind = kindForDevice(device.code);
    var group = new THREE.Group();
    var x = count <= 1 ? 0 : -6.2 + index * (12.4 / (count - 1));
    var z = index % 2 === 0 ? -2.3 : 2.3;
    if (state.stageCode === 'BEVERAGE_READY') z = 0;
    if (state.stageCode === 'AGV_TRANSPORT') z = index === 0 ? 0 : index === 1 ? -3.2 : 3.2;
    if (state.stageCode === 'WAREHOUSE_INBOUND') z = -2.3;
    group.position.set(x, 0, z);

    var base = box(2.1, 0.2, 1.55, COLORS.navy);
    base.position.y = 0.12;
    group.add(base);

    if (kind === 'chamber') createChamber(group);
    else if (kind === 'tank') createTank(group);
    else if (kind === 'heater') createHeater(group);
    else if (kind === 'fan') createFan(group, device.code);
    else if (kind === 'camera') createCamera(group, device.code);
    else if (kind === 'reject') createRejector(group, device.code);
    else if (kind === 'pump') createPump(group, device.code);
    else if (kind === 'filler') createFiller(group, device.code);
    else if (kind === 'robot') createRobot(group, device.code);
    else if (kind === 'agv') createAgv(group, device.code);
    else if (kind === 'sensor') createSensor(group, device.code);
    else if (kind === 'console') createConsole(group);
    else if (kind === 'printer') createPrinter(group);
    else if (kind === 'lamp') createLamp(group);
    else createMachine(group);

    group.traverse(function (child) {
      if (child.isMesh) {
        child.userData.deviceOwner = group;
        child.userData.baseColor = child.material.color.getHex();
      }
    });
    return group;
  }

  function createPlanarDevice(device, index, count) {
    var group = new THREE.Group();
    var x = count <= 1 ? 0 : -6.6 + index * (13.2 / (count - 1));
    var y = index % 2 === 0 ? -0.98 : 0.98;
    if (state.stageCode === 'AGV_TRANSPORT') y = index === 0 ? 0 : index === 1 ? -1.25 : 1.25;
    if (state.stageCode === 'WAREHOUSE_INBOUND') y = -0.8 + index * 0.55;
    group.position.set(x, y, 0.08);

    var kind = kindForDevice(device.code);
    var stateColor = colorForState(device.state || 'RUNNING', COLORS.accent);
    var base = plane(1.7, 0.92, COLORS.white, 0.98);
    group.add(base);
    var band = plane(1.7, 0.1, stateColor, 1);
    band.position.set(0, 0.41, 0.02);
    group.add(band);
    var marker = disk(0.18, stateColor, 1, 24);
    marker.position.set(-0.58, 0.03, 0.04);
    group.add(marker);
    var symbol = createPlanarSymbol(kind);
    symbol.position.set(0.22, 0.02, 0.05);
    group.add(symbol);
    group.add(createPlanarLabel(device.name || device.code, 0, -0.62, 1.9));
    if (device.actionCode) {
      group.add(createPlanarLabel(device.actionCode, 0, -0.92, 1.9, COLORS.blue));
    }
    movingParts.push({ object: marker, type: 'pulse', deviceCode: device.code });
    group.traverse(function (child) {
      if (child.isMesh) {
        child.userData.deviceOwner = group;
        child.userData.baseColor = child.material.color.getHex();
      }
    });
    return group;
  }

  function createPlanarSymbol(kind) {
    var group = new THREE.Group();
    if (kind === 'robot') {
      var armA = plane(0.12, 0.7, COLORS.accent, 1);
      armA.rotation.z = 0.55;
      group.add(armA);
      var armB = plane(0.12, 0.55, COLORS.blue, 1);
      armB.rotation.z = -0.55;
      armB.position.x = 0.22;
      group.add(armB);
    } else if (kind === 'agv') {
      var car = plane(0.82, 0.48, COLORS.blue, 1);
      group.add(car);
      [-0.25, 0.25].forEach(function (x) {
        var wheel = disk(0.08, COLORS.navy, 1, 14);
        wheel.position.set(x, -0.32, 0.02);
        group.add(wheel);
      });
    } else if (kind === 'sensor' || kind === 'camera') {
      var eye = disk(0.23, COLORS.accent, 1, 24);
      group.add(eye);
      var ray = plane(0.08, 0.62, 0x9bc4dc, 0.8);
      ray.position.y = -0.43;
      group.add(ray);
    } else if (kind === 'reject') {
      var gate = plane(0.78, 0.14, COLORS.warning, 1);
      gate.rotation.z = 0.45;
      group.add(gate);
    } else {
      var core = plane(0.68, 0.46, COLORS.accent, 1);
      group.add(core);
    }
    return group;
  }

  function createMachine(group) {
    var body = box(1.55, 1.6, 1.15, COLORS.white);
    body.position.y = 1.05;
    group.add(body);
    var panel = box(0.8, 0.55, 0.06, COLORS.blue);
    panel.position.set(0, 1.25, 0.61);
    group.add(panel);
  }

  function createChamber(group) {
    var body = box(2.0, 2.25, 1.45, COLORS.white);
    body.position.y = 1.35;
    group.add(body);
    var windowMesh = box(1.35, 1.15, 0.06, 0x71a9c7);
    windowMesh.position.set(0, 1.45, 0.76);
    group.add(windowMesh);
    var cap = box(2.15, 0.18, 1.6, COLORS.blue);
    cap.position.y = 2.56;
    group.add(cap);
  }

  function createTank(group) {
    var tank = cylinder(0.82, 2.5, 0xb8cad5, 28);
    tank.position.y = 1.45;
    group.add(tank);
    var lid = cylinder(0.88, 0.13, COLORS.blue, 28);
    lid.position.y = 2.75;
    group.add(lid);
    var agitator = cylinder(0.08, 3.0, COLORS.steelDark, 10);
    agitator.position.y = 1.65;
    group.add(agitator);
    movingParts.push({ object: agitator, type: 'agitator', deviceCode: '' });
  }

  function createHeater(group) {
    var body = box(1.75, 2.1, 1.25, 0x8e9da5);
    body.position.y = 1.25;
    group.add(body);
    for (var i = -0.55; i <= 0.55; i += 0.55) {
      var stripe = box(0.13, 1.5, 0.04, 0xc83f49);
      stripe.position.set(i, 1.25, 0.65);
      group.add(stripe);
    }
  }

  function createFan(group, code) {
    var housing = cylinder(0.72, 0.35, COLORS.white, 28);
    housing.rotation.x = Math.PI / 2;
    housing.position.y = 1.35;
    group.add(housing);
    var blades = new THREE.Group();
    blades.position.set(0, 1.35, 0.2);
    for (var i = 0; i < 4; i += 1) {
      var blade = box(0.55, 0.12, 0.06, COLORS.accent);
      blade.position.x = 0.27;
      blade.rotation.z = i * Math.PI / 2;
      blades.add(blade);
    }
    group.add(blades);
    movingParts.push({ object: blades, type: 'fan', deviceCode: code });
  }

  function createCamera(group, code) {
    var post = box(0.16, 2.65, 0.16, COLORS.steelDark);
    post.position.y = 1.45;
    group.add(post);
    var cameraBody = box(0.65, 0.45, 0.85, COLORS.white);
    cameraBody.position.set(0, 2.45, 0.2);
    group.add(cameraBody);
    var lens = cylinder(0.16, 0.22, COLORS.navy, 20);
    lens.rotation.x = Math.PI / 2;
    lens.position.set(0, 2.42, 0.72);
    group.add(lens);
    movingParts.push({ object: cameraBody, type: 'scanner', deviceCode: code });
  }

  function createRejector(group, code) {
    var post = box(0.2, 2.2, 0.2, COLORS.steelDark);
    post.position.set(-0.65, 1.2, 0);
    group.add(post);
    var arm = box(1.35, 0.18, 0.28, COLORS.warning);
    arm.position.set(0, 1.85, 0);
    group.add(arm);
    movingParts.push({ object: arm, type: 'reject', deviceCode: code });
  }

  function createPump(group, code) {
    var motor = cylinder(0.5, 1.2, COLORS.blue, 22);
    motor.rotation.z = Math.PI / 2;
    motor.position.y = 0.95;
    group.add(motor);
    var pipe = cylinder(0.12, 2.1, 0x88a5b5, 14);
    pipe.position.set(0, 1.9, 0);
    group.add(pipe);
    movingParts.push({ object: motor, type: 'pump', deviceCode: code });
  }

  function createFiller(group, code) {
    var frame = box(1.9, 0.18, 1.2, COLORS.steelDark);
    frame.position.y = 2.4;
    group.add(frame);
    [-0.55, 0, 0.55].forEach(function (x) {
      var nozzle = cylinder(0.08, 1.3, COLORS.accent, 12);
      nozzle.position.set(x, 1.75, 0);
      group.add(nozzle);
      movingParts.push({ object: nozzle, type: 'filler', deviceCode: code, originY: 1.75 });
    });
    [-0.85, 0.85].forEach(function (x) {
      var post = box(0.16, 2.3, 0.16, COLORS.steelDark);
      post.position.set(x, 1.25, 0);
      group.add(post);
    });
  }

  function createRobot(group, code) {
    var base = cylinder(0.65, 0.45, COLORS.navy, 24);
    base.position.y = 0.45;
    group.add(base);
    var joint = new THREE.Group();
    joint.position.y = 0.75;
    var lower = box(0.35, 1.8, 0.35, COLORS.blue);
    lower.position.y = 0.8;
    lower.rotation.z = -0.28;
    joint.add(lower);
    var upper = box(1.5, 0.3, 0.3, COLORS.accent);
    upper.position.set(0.55, 1.55, 0);
    upper.rotation.z = -0.35;
    joint.add(upper);
    var gripper = box(0.45, 0.25, 0.75, COLORS.steelDark);
    gripper.position.set(1.25, 1.25, 0);
    joint.add(gripper);
    group.add(joint);
    movingParts.push({ object: joint, type: 'robot', deviceCode: code });
  }

  function createAgv(group, code) {
    group.children[0].visible = false;
    var body = box(2.6, 0.6, 1.65, COLORS.blue);
    body.position.y = 0.65;
    group.add(body);
    var deck = box(2.25, 0.18, 1.35, COLORS.white);
    deck.position.y = 1.08;
    group.add(deck);
    [-0.8, 0.8].forEach(function (x) {
      [-0.72, 0.72].forEach(function (z) {
        var wheel = cylinder(0.28, 0.18, 0x263844, 18);
        wheel.rotation.x = Math.PI / 2;
        wheel.position.set(x, 0.35, z);
        group.add(wheel);
        movingParts.push({ object: wheel, type: 'wheel', deviceCode: code });
      });
    });
    movingParts.push({ object: group, type: 'agv', deviceCode: code, originX: group.position.x });
  }

  function createSensor(group, code) {
    var post = cylinder(0.12, 2.1, COLORS.steelDark, 12);
    post.position.y = 1.15;
    group.add(post);
    var head = cylinder(0.42, 0.55, COLORS.white, 20);
    head.position.y = 2.2;
    group.add(head);
    var signal = cylinder(0.23, 0.12, COLORS.accent, 20);
    signal.position.y = 2.53;
    group.add(signal);
    movingParts.push({ object: signal, type: 'pulse', deviceCode: code });
  }

  function createConsole(group) {
    var cabinet = box(1.35, 2.1, 0.85, COLORS.white);
    cabinet.position.y = 1.2;
    group.add(cabinet);
    var screen = box(0.95, 0.65, 0.05, COLORS.navy);
    screen.position.set(0, 1.55, 0.45);
    group.add(screen);
  }

  function createPrinter(group) {
    var body = box(1.45, 1.35, 1.15, COLORS.white);
    body.position.y = 0.85;
    group.add(body);
    var slot = box(0.85, 0.12, 0.07, COLORS.navy);
    slot.position.set(0, 1.0, 0.6);
    group.add(slot);
  }

  function createLamp(group) {
    var post = cylinder(0.1, 2.3, COLORS.steelDark, 12);
    post.position.y = 1.25;
    group.add(post);
    [COLORS.running, COLORS.warning, COLORS.alarm].forEach(function (color, index) {
      var light = cylinder(0.22, 0.22, color, 18);
      light.position.y = 2.1 + index * 0.25;
      group.add(light);
    });
  }

  function rebuildProducts() {
    if (!productRoot) return;
    while (productRoot.children.length) {
      var child = productRoot.children.pop();
      child.traverse(function (part) {
        if (part.geometry) part.geometry.dispose();
        if (part.material) {
          if (Array.isArray(part.material)) part.material.forEach(function (item) { item.dispose(); });
          else part.material.dispose();
        }
      });
    }
    clickable = clickable.filter(function (item) { return item.userData.selectType !== 'product'; });
    var products = state.products.length ? state.products : [
      { traceCode: 'DEMO-001', status: 'RUNNING', bottleType: 'PLA-500' },
      { traceCode: 'DEMO-002', status: 'RUNNING', bottleType: 'PLA-500' },
      { traceCode: 'DEMO-003', status: 'HOLD', bottleType: 'PLA-330' }
    ];
    products.slice(0, 8).forEach(function (product, index) {
      var group = createProduct(product);
      group.userData.selectType = 'product';
      group.userData.traceCode = product.traceCode;
      group.userData.label = product.traceCode + ' · ' + (product.bottleType || '待识别');
      group.userData.productIndex = index;
      group.traverse(function (child) {
        if (child.isMesh) child.userData.productOwner = group;
      });
      productRoot.add(group);
      clickable.push(group);
    });
    positionProducts(0);
  }

  function createProduct(product) {
    var group = new THREE.Group();
    var productColor = colorForState(product.status, COLORS.product);
    if (state.viewMode === 'PLANAR') {
      var dot = disk(0.23, state.statusColors ? productColor : COLORS.product, 1, 24);
      dot.position.z = 0.06;
      group.add(dot);
      var tail = plane(0.42, 0.06, COLORS.navy, 1);
      tail.position.set(-0.3, 0, 0.08);
      group.add(tail);
      group.add(createPlanarLabel(product.traceCode || 'WIP', 0, -0.42, 1.35));
    } else if (state.stageCode === 'PACKING' || state.stageCode === 'AGV_TRANSPORT' || state.stageCode === 'WAREHOUSE_INBOUND') {
      var carton = box(1.0, 0.78, 0.82, state.statusColors ? productColor : COLORS.box);
      carton.position.y = 1.45;
      group.add(carton);
      var tape = box(0.13, 0.8, 0.84, 0xe9d7a7);
      tape.position.y = 1.47;
      group.add(tape);
    } else {
      var bottleBody = cylinder(0.26, 1.05, state.statusColors ? productColor : COLORS.product, 18);
      bottleBody.position.y = 1.52;
      group.add(bottleBody);
      var shoulder = mesh(new THREE.ConeGeometry(0.26, 0.3, 18), state.statusColors ? productColor : COLORS.product, 0.2, 0.35);
      shoulder.position.y = 2.18;
      group.add(shoulder);
      var neck = cylinder(0.12, 0.32, 0xbdd7e6, 16);
      neck.position.y = 2.45;
      group.add(neck);
      var cap = cylinder(0.15, 0.13, COLORS.navy, 16);
      cap.position.y = 2.68;
      group.add(cap);
    }
    return group;
  }

  function colorForState(value, neutral) {
    if (!state.statusColors) return neutral;
    if (value === 'RUNNING' || value === 'PASS' || value === 'PASSED' || value === 'COMPLETED') return COLORS.running;
    if (value === 'ALARM' || value === 'FAIL' || value === 'FAILED' || value === 'REJECTED') return COLORS.alarm;
    if (value === 'HOLD' || value === 'WAIT' || value === 'WARNING' || value === 'STANDBY') return COLORS.warning;
    return COLORS.offline;
  }

  function applyRuntimeState() {
    if (!deviceRoot) return;
    var runtimeMap = {};
    state.devices.forEach(function (device) { runtimeMap[device.code] = device.state; });
    deviceRoot.children.forEach(function (group) {
      var runtimeState = runtimeMap[group.userData.deviceCode] || 'STANDBY';
      group.userData.runtimeState = runtimeState;
      group.traverse(function (child) {
        if (!child.isMesh) return;
        if (child.userData.noStatusColor) return;
        var baseColor = child.userData.baseColor === undefined ? COLORS.steel : child.userData.baseColor;
        var targetColor = state.statusColors ? colorForState(runtimeState, baseColor) : baseColor;
        child.material.color.setHex(targetColor);
      });
    });
  }

  function positionProducts(elapsed) {
    if (!productRoot) return;
    var baseProgress = Number(state.progress || 0) / 100;
    if (!state.paused) baseProgress += elapsed * Math.max(0.02, state.speed) * 0.035;
    productRoot.children.forEach(function (product, index) {
      var productState = state.products[index] || {};
      var productProgress = productState.progress === undefined ? baseProgress * 100 : Number(productState.progress || 0);
      var t = ((productProgress / 100) + index * 0.05) % 1;
      if (!state.paused && productState.progress === undefined) t = (baseProgress + index * 0.19) % 1;
      if (state.viewMode === 'PLANAR') {
        var y = productState.status === 'REJECTED' || productState.status === 'FAILED' || productState.defectType ? 1.75 : (index % 2 ? 0.34 : -0.34);
        product.position.set(-7.3 + t * 14.6, y, 0.12);
      } else if (state.stageCode === 'AGV_TRANSPORT') {
        product.position.set(-6.4 + t * 12.8, 0, 0.1 + index * 0.08);
      } else if (state.stageCode === 'WAREHOUSE_INBOUND') {
        product.position.set(-7 + t * 7.5, 0, 0);
      } else if (state.stageCode === 'BEVERAGE_READY') {
        product.position.set(-6 + t * 12, 0, 2.8);
      } else if (state.stageCode === 'PACKING') {
        product.position.set(-6.3 + t * 12.6, 0, index % 2 ? 0.35 : -0.35);
      } else {
        product.position.set(-7.2 + t * 14.4, 0, index % 2 ? 0.28 : -0.28);
      }
    });
  }

  function animateEquipment(elapsed, delta) {
    planarFlowParts.forEach(function (part, index) {
      if (state.paused) return;
      if (part.type === 'flow-arrow') {
        part.object.position.x = part.originX + (Math.sin(elapsed * Math.max(0.45, state.speed) + index) * 0.08);
        part.object.material && (part.object.material.opacity = 0.78 + Math.sin(elapsed * 2 + index) * 0.12);
      } else if (part.type === 'exception-pulse') {
        part.object.scale.setScalar(1 + Math.sin(elapsed * 3 + index) * 0.22);
      }
    });
    movingParts.forEach(function (part, index) {
      var ownerState = findDeviceState(part.deviceCode);
      if (state.paused || (ownerState !== 'RUNNING' && part.deviceCode)) return;
      if (part.type === 'roller' || part.type === 'wheel') part.object.rotation.z -= delta * 5.5;
      else if (part.type === 'fan') part.object.rotation.z -= delta * 7;
      else if (part.type === 'agitator' || part.type === 'pump') part.object.rotation.y += delta * 3.5;
      else if (part.type === 'robot') part.object.rotation.y = Math.sin(elapsed * 0.8) * 0.65;
      else if (part.type === 'scanner') part.object.rotation.y = Math.sin(elapsed * 1.5) * 0.22;
      else if (part.type === 'reject') part.object.rotation.z = Math.max(0, Math.sin(elapsed * 1.8 + index) * 0.45);
      else if (part.type === 'filler') part.object.position.y = part.originY + Math.sin(elapsed * 2.4) * 0.16;
      else if (part.type === 'pulse') part.object.scale.setScalar(1 + Math.sin(elapsed * 3 + index) * 0.13);
      else if (part.type === 'agv') part.object.position.x = part.originX + Math.sin(elapsed * Math.max(0.25, state.speed)) * 2.4;
    });
  }

  function findDeviceState(code) {
    if (!code) return 'RUNNING';
    for (var i = 0; i < state.devices.length; i += 1) {
      if (state.devices[i].code === code) return state.devices[i].state;
    }
    return 'STANDBY';
  }

  function renderLoop() {
    if (disposed) return;
    renderFrameId = requestAnimationFrame(renderLoop);
    if (!renderer || !scene || !camera) return;
    var delta = Math.min(clock.getDelta(), 0.05);
    var elapsed = clock.elapsedTime;
    animateEquipment(elapsed, delta);
    positionProducts(elapsed);
    renderer.render(scene, camera);
  }

  function updateCamera() {
    if (state.viewMode === 'PLANAR') {
      camera = planarCamera;
      camera.position.set(0, 0, 18);
      camera.lookAt(0, 0, 0);
      return;
    }
    camera = perspectiveCamera;
    var cosPitch = Math.cos(cameraOrbit.pitch);
    camera.position.set(
      Math.sin(cameraOrbit.yaw) * cosPitch * cameraOrbit.distance,
      Math.sin(cameraOrbit.pitch) * cameraOrbit.distance,
      Math.cos(cameraOrbit.yaw) * cosPitch * cameraOrbit.distance
    );
    camera.lookAt(0, 1.3, 0);
  }

  function resetCamera() {
    if (state.viewMode === 'PLANAR') {
      updateCamera();
      return;
    }
    cameraOrbit = { yaw: -0.65, pitch: 0.62, distance: 19 };
    if (state.stageCode === 'WAREHOUSE_INBOUND') cameraOrbit.distance = 22;
    updateCamera();
  }

  function resize() {
    if (!renderer || !camera) return;
    var width = Math.max(1, host.clientWidth);
    var height = Math.max(1, host.clientHeight);
    renderer.setSize(width, height, false);
    if (perspectiveCamera) {
      perspectiveCamera.aspect = width / height;
      perspectiveCamera.updateProjectionMatrix();
    }
    if (planarCamera) {
      var aspect = width / height;
      var vertical = 5.2;
      planarCamera.left = -vertical * aspect;
      planarCamera.right = vertical * aspect;
      planarCamera.top = vertical;
      planarCamera.bottom = -vertical;
      planarCamera.updateProjectionMatrix();
    }
    camera.updateProjectionMatrix();
  }

  function updatePointer(event) {
    var rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function pickObject(event) {
    updatePointer(event);
    raycaster.setFromCamera(pointer, camera);
    var intersections = raycaster.intersectObjects(clickable, true);
    if (!intersections.length) return null;
    var object = intersections[0].object;
    return object.userData.deviceOwner || object.userData.productOwner || object;
  }

  function bindInteractions() {
    var canvas = renderer.domElement;
    canvas.addEventListener('pointerdown', function (event) {
      isPointerDown = true;
      pointerStart = { x: event.clientX, y: event.clientY };
      previousPointer = { x: event.clientX, y: event.clientY };
      if (state.layoutEdit) {
        var picked = pickObject(event);
        if (picked && picked.userData.selectType === 'device') draggedDevice = picked;
      }
      canvas.setPointerCapture(event.pointerId);
    });

    canvas.addEventListener('pointermove', function (event) {
      if (!isPointerDown) return;
      var dx = event.clientX - previousPointer.x;
      var dy = event.clientY - previousPointer.y;
      previousPointer = { x: event.clientX, y: event.clientY };
      if (draggedDevice) {
        updatePointer(event);
        raycaster.setFromCamera(pointer, camera);
        var dragPlane = state.viewMode === 'PLANAR'
          ? new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)
          : new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        var point = new THREE.Vector3();
        if (raycaster.ray.intersectPlane(dragPlane, point)) {
          draggedDevice.position.x = Math.max(-8, Math.min(8, point.x));
          if (state.viewMode === 'PLANAR') {
            draggedDevice.position.y = Math.max(-3.8, Math.min(3.8, point.y));
            draggedDevice.position.z = 0.08;
          } else {
            draggedDevice.position.z = Math.max(-5, Math.min(5, point.z));
          }
        }
      } else if (state.viewMode !== 'PLANAR') {
        cameraOrbit.yaw -= dx * 0.007;
        cameraOrbit.pitch = Math.max(0.22, Math.min(1.15, cameraOrbit.pitch + dy * 0.006));
        updateCamera();
      }
    });

    canvas.addEventListener('pointerup', function (event) {
      var moved = Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y);
      if (draggedDevice) savePosition(draggedDevice);
      if (moved < 6 && !draggedDevice) selectAt(event);
      draggedDevice = null;
      isPointerDown = false;
      canvas.releasePointerCapture(event.pointerId);
    });

    canvas.addEventListener('wheel', function (event) {
      if (state.viewMode === 'PLANAR') {
        event.preventDefault();
        return;
      }
      cameraOrbit.distance = Math.max(10, Math.min(32, cameraOrbit.distance + event.deltaY * 0.015));
      updateCamera();
      event.preventDefault();
    }, { passive: false });
  }

  function selectAt(event) {
    var picked = pickObject(event);
    if (!picked) {
      selectionLabel.classList.add('hidden');
      return;
    }
    selectionLabel.textContent = picked.userData.label || 'SELECTED';
    selectionLabel.classList.remove('hidden');
    if (picked.userData.selectType === 'device') {
      window.location.href = 'factory://device/' + encodeURIComponent(picked.userData.deviceCode);
    } else if (picked.userData.selectType === 'product') {
      window.location.href = 'factory://product/' + encodeURIComponent(picked.userData.traceCode);
    }
  }

  function positionStorageKey(code) {
    return 'factory3d.layout.' + state.stageCode + '.' + state.viewMode + '.' + code;
  }

  function applySavedPosition(group) {
    try {
      var raw = localStorage.getItem(positionStorageKey(group.userData.deviceCode));
      if (!raw) return;
      var saved = JSON.parse(raw);
      if (Number.isFinite(saved.x) && Number.isFinite(saved.z)) {
        group.position.x = saved.x;
        if (state.viewMode === 'PLANAR') {
          group.position.y = Number.isFinite(saved.y) ? saved.y : group.position.y;
          group.position.z = 0.08;
        } else {
          group.position.z = saved.z;
        }
      }
    } catch (_) {}
  }

  function savePosition(group) {
    try {
      localStorage.setItem(positionStorageKey(group.userData.deviceCode), JSON.stringify({
        x: Number(group.position.x.toFixed(2)),
        y: Number(group.position.y.toFixed(2)),
        z: Number(group.position.z.toFixed(2))
      }));
    } catch (_) {}
  }

  function normalizePayload(payload) {
    if (typeof payload === 'string') return JSON.parse(payload);
    return payload || {};
  }

  window.FactoryScene = {
    update: function (payload) {
      try {
        var next = normalizePayload(payload);
        var stageChanged = next.stageCode && next.stageCode !== state.stageCode;
        var viewModeChanged = next.viewMode && next.viewMode !== state.viewMode;
        var pausedChanged = next.paused !== undefined && next.paused !== state.paused;
        var versionChanged = next.stateVersion !== undefined && next.stateVersion !== state.stateVersion;
        var statusColorsChanged = next.statusColors !== undefined && next.statusColors !== state.statusColors;
        var productSignature = JSON.stringify((next.products || []).map(function (item) {
          return item.traceCode + ':' + item.status;
        }));
        var oldProductSignature = JSON.stringify(state.products.map(function (item) {
          return item.traceCode + ':' + item.status;
        }));
        Object.keys(next).forEach(function (key) { state[key] = next[key]; });
        var shouldRebuildPlanar = state.viewMode === 'PLANAR' && !state.paused && (versionChanged || pausedChanged || statusColorsChanged);
        if (stageChanged || viewModeChanged || shouldRebuildPlanar) {
          rebuildStage();
        } else {
          if (productSignature !== oldProductSignature || statusColorsChanged) rebuildProducts();
          applyRuntimeState();
        }
        stageLabel.textContent = state.stageName + ' / ' + state.stageCode;
        sourceLabel.textContent = state.source + (state.paused ? ' · PAUSED' : ' · LIVE');
      } catch (error) {
        state.latestError = String(error);
        sourceLabel.textContent = 'DATA ERROR';
      }
    },
    setPaused: function (paused) {
      state.paused = Boolean(paused);
      sourceLabel.textContent = state.source + (state.paused ? ' · PAUSED' : ' · LIVE');
    },
    setStatusColors: function (enabled) {
      state.statusColors = Boolean(enabled);
      rebuildProducts();
      applyRuntimeState();
    },
    setLayoutEdit: function (enabled) {
      state.layoutEdit = Boolean(enabled);
      sourceLabel.textContent = state.layoutEdit ? 'LAYOUT EDIT · DRAG DEVICE' : state.source + (state.paused ? ' · PAUSED' : ' · LIVE');
    },
    resetCamera: resetCamera,
    dispose: function () {
      disposed = true;
      if (renderFrameId) cancelAnimationFrame(renderFrameId);
      if (resizeObserver) resizeObserver.disconnect();
      clearObject(stageRoot);
      if (renderer) {
        renderer.dispose();
        if (renderer.forceContextLoss) renderer.forceContextLoss();
        if (renderer.domElement && renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    }
  };

  Object.defineProperty(window, '__factoryTest__', {
    configurable: true,
    get: function () {
      var canvas = renderer ? renderer.domElement : null;
      return {
        ready: Boolean(renderer && scene && camera && !disposed),
        mode: state.viewMode,
        sceneKind: state.viewMode === 'PLANAR' ? 'PLANAR_PROCESS_2D' : 'THREE_DIMENSIONAL_3D',
        stateVersion: state.stateVersion,
        rendererInfo: renderer ? { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles } : { calls: 0, triangles: 0 },
        canvas: { width: canvas ? canvas.width : 0, height: canvas ? canvas.height : 0 },
        deviceCount: state.devices.length,
        productCount: state.products.length,
        sensorCount: state.sensors.length,
        qualityGateCount: state.qualityGates.length,
        alarmCount: state.alarms.length,
        paused: state.paused,
        latestError: state.latestError
      };
    }
  });

  init();
}());
