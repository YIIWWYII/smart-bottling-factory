(function () {
  'use strict';

  var host = document.getElementById('plan-host');
  var fallback = document.getElementById('fallback');
  var stageLabel = document.getElementById('stage-name');
  var sourceLabel = document.getElementById('data-source');
  var selectionLabel = document.getElementById('selection');
  var compatPlan = document.getElementById('compat-plan');

  if (!window.THREE) {
    fallback.classList.remove('hidden');
    return;
  }

  var THREE = window.THREE;
  var COLORS = {
    navy: 0x123a5b,
    blue: 0x145da0,
    accent: 0x1f7acb,
    line: 0x6f8fa3,
    panel: 0xf7fbfd,
    floor: 0xdfeaf1,
    belt: 0xb8cad7,
    running: 0x238b5a,
    warning: 0xd89016,
    alarm: 0xc83f49,
    offline: 0x8397a6,
    product: 0x2a86cf,
    arrow: 0xf0b13a
  };

  var state = {
    overview: false,
    stageCode: 'PRETREATMENT',
    stageName: 'PRETREATMENT',
    stateVersion: 0,
    source: 'LOCAL DEMO',
    errorMessage: '',
    paused: false,
    statusColors: true,
    layoutEdit: false,
    speed: 0.12,
    progress: 0,
    devices: [],
    products: [],
    stages: []
  };

  var scene;
  var camera;
  var renderer;
  var root;
  var deviceRoot;
  var productRoot;
  var flowRoot;
  var clickable = [];
  var raycaster = new THREE.Raycaster();
  var pointer = new THREE.Vector2();
  var resizeObserver;
  var animationFrameId = 0;
  var running = true;
  var lastFrameTime = 0;
  var motionPhase = 0;
  var compatWatchTimer = 0;
  var compatPlanSignature = '';
  var compatProductNodes = [];
  var draggedDevice = null;
  var pointerStart = { x: 0, y: 0 };
  var previousPointer = { x: 0, y: 0 };
  var testProbe = {
    ready: false,
    mode: 'PLANAR_2D',
    stateVersion: 0,
    deviceCount: 0,
    productCount: 0,
    paused: false,
    statusColors: true,
    motionPhase: 0,
    firstProductX: 0,
    lastSelection: { entityType: '', entityId: '' },
    source: 'LOCAL DEMO',
    lastError: '',
    semantic2d: true,
    rendererInfo: { calls: 0, triangles: 0 }
  };

  function makeMaterial(color, opacity) {
    return new THREE.MeshBasicMaterial({
      color: color,
      transparent: opacity !== undefined && opacity < 1,
      opacity: opacity === undefined ? 1 : opacity,
      depthWrite: false
    });
  }

  function rect(width, height, color, opacity) {
    return new THREE.Mesh(new THREE.PlaneGeometry(width, height), makeMaterial(color, opacity));
  }

  function circle(radius, color, opacity, segments) {
    return new THREE.Mesh(new THREE.CircleGeometry(radius, segments || 32), makeMaterial(color, opacity));
  }

  function ring(radius, tube, color, opacity) {
    return new THREE.Mesh(new THREE.RingGeometry(radius - tube, radius, 32), makeMaterial(color, opacity));
  }

  function setXY(object, x, y, z) {
    object.position.set(x, y, z || 0);
    return object;
  }

  function init() {
    try {
      scene = new THREE.Scene();
      scene.background = new THREE.Color(COLORS.floor);
      camera = new THREE.OrthographicCamera(-10, 10, 5.6, -5.6, 0.1, 20);
      camera.position.set(0, 0, 10);
      camera.lookAt(0, 0, 0);
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
      renderer.setClearColor(COLORS.floor, 1);
      host.appendChild(renderer.domElement);
      bindInteractions();
      rebuildPlan();
      resize();
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(host);
      animationFrameId = requestAnimationFrame(renderLoop);
      compatWatchTimer = window.setTimeout(showCompatibilityPlanIfNeeded, 900);
    } catch (error) {
      fallback.classList.remove('hidden');
      state.errorMessage = error && error.message ? error.message : 'WEBGL UNAVAILABLE';
      updateProbe();
    }
  }

  function disposeMaterial(material) {
    if (!material) return;
    if (material.map) material.map.dispose();
    material.dispose();
  }

  function showCompatibilityPlanIfNeeded() {
    if (!state.overview || !compatPlan) return;
    renderCompatibilityPlan();
    compatPlan.classList.remove('hidden');
  }

  function compatibilityNavigate(url) {
    window.location.href = url;
  }

  function markCompatibilitySelection(entityType, entityId, label) {
    selectionLabel.textContent = label || (entityType + ' ' + entityId);
    selectionLabel.classList.remove('hidden');
    testProbe.lastSelection = { entityType: entityType, entityId: entityId };
    updateProbe();
  }

  function demoProducts() {
    return [
      { traceCode: 'DEMO-001', status: 'RUNNING', bottleType: 'PLA-500' },
      { traceCode: 'DEMO-002', status: 'RUNNING', bottleType: 'PLA-500' },
      { traceCode: 'DEMO-003', status: 'HOLD', bottleType: 'PLA-330' },
      { traceCode: 'DEMO-004', status: 'RUNNING', bottleType: 'PLA-500' }
    ];
  }

  function updateCompatibilityProductPositions() {
    compatProductNodes.forEach(function (token, index) {
      token.style.left = (8 + ((motionPhase + index * 0.13) % 1) * 84) + '%';
    });
  }

  function renderCompatibilityPlan() {
    if (!compatPlan) return;
    var stages = state.stages && state.stages.length ? state.stages : demoStages();
    var devices = state.devices && state.devices.length ? state.devices : [];
    var products = state.products && state.products.length ? state.products : demoProducts();
    var nextSignature = JSON.stringify({
      statusColors: state.statusColors,
      stages: stages.map(function (stage) { return stage.code + ':' + stage.state + ':' + String(stage.wip || 0); }),
      devices: devices.map(function (device) { return device.stageCode + ':' + device.code + ':' + device.state; }),
      products: products.map(function (product) { return product.traceCode + ':' + product.status; })
    });
    if (nextSignature === compatPlanSignature && compatProductNodes.length > 0) {
      updateCompatibilityProductPositions();
      return;
    }
    compatPlanSignature = nextSignature;
    compatProductNodes = [];
    var track = document.createElement('div');
    track.className = 'compat-plan-track';
    stages.forEach(function (stage) {
      var status = state.statusColors && (stage.state === 'ALARM' || stage.state === 'FAIL' ? 'alarm' : stage.state === 'HOLD' || stage.state === 'WAIT' ? 'wait' : '');
      var block = document.createElement('div');
      block.className = 'compat-stage ' + status;
      block.setAttribute('role', 'button');
      block.setAttribute('tabindex', '0');
      block.setAttribute('data-stage-code', stage.code);
      block.addEventListener('click', function () {
        markCompatibilitySelection('STAGE', stage.code, stage.name || stage.code);
        compatibilityNavigate('factory://stage/' + encodeURIComponent(stage.code));
      });
      var title = document.createElement('strong');
      title.textContent = stage.name || stage.code;
      block.appendChild(title);
      var wip = document.createElement('small');
      wip.textContent = 'WIP ' + String(stage.wip || 0);
      block.appendChild(wip);
      var stageDevices = devices.filter(function (device) {
        return device.stageCode === stage.code;
      });
      if (!stageDevices.length) stageDevices = demoDevices(stage.code).slice(0, 2);
      var deviceRow = document.createElement('span');
      deviceRow.className = 'compat-device-row';
      stageDevices.slice(0, 2).forEach(function (device) {
        var deviceMark = document.createElement('button');
        deviceMark.className = 'compat-device ' + (state.statusColors && (device.state === 'ALARM' ? 'alarm' : device.state === 'WAIT' ? 'wait' : ''));
        deviceMark.type = 'button';
        deviceMark.textContent = device.code;
        deviceMark.setAttribute('aria-label', device.name || device.code);
        deviceMark.addEventListener('click', function (event) {
          event.stopPropagation();
          markCompatibilitySelection('DEVICE', device.code, device.name || device.code);
          compatibilityNavigate('factory://device/' + encodeURIComponent(device.code));
        });
        deviceRow.appendChild(deviceMark);
      });
      block.appendChild(deviceRow);
      track.appendChild(block);
    });
    products.slice(0, 8).forEach(function (product, index) {
      var token = document.createElement('button');
      token.type = 'button';
      token.className = 'compat-product ' + (state.statusColors && (product.status === 'HOLD' ? 'hold' : product.status === 'REJECTED' ? 'rejected' : ''));
      token.setAttribute('aria-label', product.traceCode || 'PRODUCT');
      token.title = product.traceCode || 'PRODUCT';
      token.addEventListener('click', function (event) {
        event.stopPropagation();
        markCompatibilitySelection('PRODUCT', product.traceCode || 'PRODUCT', product.traceCode || 'PRODUCT');
        compatibilityNavigate('factory://product/' + encodeURIComponent(product.traceCode || 'PRODUCT'));
      });
      compatProductNodes.push(token);
      track.appendChild(token);
    });
    compatPlan.replaceChildren(track);
    updateCompatibilityProductPositions();
  }

  function clearObject(object) {
    if (!object) return;
    scene.remove(object);
    object.traverse(function (child) {
      if (child.geometry) child.geometry.dispose();
      if (Array.isArray(child.material)) child.material.forEach(disposeMaterial);
      else if (child.material) disposeMaterial(child.material);
    });
  }

  function rebuildPlan() {
    clearObject(root);
    root = new THREE.Group();
    flowRoot = new THREE.Group();
    deviceRoot = new THREE.Group();
    productRoot = new THREE.Group();
    root.add(flowRoot);
    root.add(deviceRoot);
    root.add(productRoot);
    scene.add(root);
    root.position.set(0, 0, 0);
    root.scale.set(1, 1, 1);
    clickable = [];

    if (state.overview) {
      createOverviewPlan();
    } else {
      createGrid();
      createStageLane();
      createProcessOverlay();
      createFlowArrows();
      createDevices();
    }
    createProducts();
    updateHud();
    updateProbe();
  }

  function createGrid() {
    for (var x = -10; x <= 10; x += 1) {
      var vertical = rect(0.015, 11.2, x === 0 ? COLORS.line : 0xbfd0db, x === 0 ? 0.42 : 0.2);
      setXY(vertical, x, 0, -0.04);
      root.add(vertical);
    }
    for (var y = -5; y <= 5; y += 1) {
      var horizontal = rect(20, 0.015, y === 0 ? COLORS.line : 0xbfd0db, y === 0 ? 0.42 : 0.2);
      setXY(horizontal, 0, y, -0.04);
      root.add(horizontal);
    }
  }

  function createStageLane() {
    var laneHeight = state.stageCode === 'WAREHOUSE_INBOUND' ? 3.7 : state.stageCode === 'AGV_TRANSPORT' ? 2.8 : 2.05;
    var lane = rect(17.6, laneHeight, COLORS.belt, 0.78);
    lane.userData.selectType = 'stage';
    lane.userData.stageCode = state.stageCode;
    lane.userData.label = state.stageName + ' - 2D plan area';
    setXY(lane, 0, 0, 0.01);
    root.add(lane);
    clickable.push(lane);

    var center = rect(16.7, 0.16, state.stageCode === 'AGV_TRANSPORT' ? 0x697f8f : COLORS.accent, 0.95);
    setXY(center, 0, 0, 0.02);
    root.add(center);

    var leftGate = rect(0.18, laneHeight + 0.6, COLORS.navy, 0.9);
    var rightGate = rect(0.18, laneHeight + 0.6, COLORS.navy, 0.9);
    setXY(leftGate, -8.75, 0, 0.03);
    setXY(rightGate, 8.75, 0, 0.03);
    root.add(leftGate);
    root.add(rightGate);

    if (state.stageCode === 'WAREHOUSE_INBOUND') {
      [-5.8, 0, 5.8].forEach(function (x, index) {
        var zone = rect(2.5, 2.1, index === 1 ? 0xd3e2eb : 0xc7d7e0, 0.86);
        setXY(zone, x, 1.55, 0.04);
        root.add(zone);
      });
    }

    if (state.stageCode === 'AGV_TRANSPORT') {
      [-6, -2, 2, 6].forEach(function (x) {
        var marker = rect(1.0, 0.11, COLORS.arrow, 1);
        setXY(marker, x, -1.05, 0.04);
        root.add(marker);
      });
    }
  }

  function createOverviewPlan() {
    createGrid();

    var lane = rect(18.2, 2.55, COLORS.belt, 0.86);
    lane.userData.selectType = 'stage';
    lane.userData.stageCode = 'LINE-01';
    lane.userData.label = '整线输送主线';
    setXY(lane, 0, 0, 0.01);
    root.add(lane);
    clickable.push(lane);

    var center = rect(17.5, 0.16, COLORS.accent, 0.98);
    setXY(center, 0, 0, 0.03);
    root.add(center);

    var stages = state.stages && state.stages.length ? state.stages : demoStages();
    stages.forEach(function (stage, index) {
      var x = -8 + index * (16 / Math.max(1, stages.length - 1));
      var stageColor = colorForState(stage.state || 'STANDBY', COLORS.blue);
      var block = rect(1.52, 1.22, state.statusColors ? stageColor : COLORS.panel, 0.96);
      block.userData.selectType = 'stage';
      block.userData.stageCode = stage.code;
      block.userData.label = stage.name + ' · ' + (stage.state || 'STANDBY');
      setXY(block, x, 0.1, 0.08);
      root.add(block);
      clickable.push(block);

      var stageBorder = ring(0.58, 0.045, state.statusColors ? stageColor : COLORS.accent, 1);
      stageBorder.scale.x = 1.28;
      stageBorder.scale.y = 0.78;
      setXY(stageBorder, x, 0.1, 0.1);
      root.add(stageBorder);

      var label = createLabel(stage.name || stage.code, '#173247');
      label.scale.set(1.1, 0.28, 1);
      setXY(label, x, 1.05, 0.2);
      root.add(label);

      var wip = createLabel('WIP ' + String(stage.wip || 0), '#476276');
      wip.scale.set(0.84, 0.22, 1);
      setXY(wip, x, -0.98, 0.2);
      root.add(wip);

      var stageDevices = (state.devices || []).filter(function (device) {
        return device.stageCode === stage.code;
      });
      if (stageDevices.length > 0) addOverviewDevice(stageDevices[0], x, -1.48);
    });

    createFlowArrows();
  }

  function addOverviewDevice(device, x, y) {
    var stateColor = colorForState(device.state || 'STANDBY', COLORS.blue);
    var base = rect(0.76, 0.34, state.statusColors ? stateColor : COLORS.panel, 0.98);
    base.userData.selectType = 'device';
    base.userData.deviceCode = device.code;
    base.userData.label = (device.name || device.code) + ' · ' + (device.state || 'STANDBY');
    setXY(base, x, y, 0.12);
    deviceRoot.add(base);
    clickable.push(base);
  }

  function addProcessBlock(x, y, width, height, color, opacity) {
    var block = rect(width, height, color, opacity === undefined ? 0.5 : opacity);
    setXY(block, x, y, 0.045);
    root.add(block);
    return block;
  }

  function addActionPulse(x, y, color) {
    var pulse = ring(0.42, 0.055, color, 0.82);
    pulse.userData.actionPulse = true;
    pulse.userData.phaseOffset = flowRoot.children.length * 0.17;
    setXY(pulse, x, y, 0.09);
    flowRoot.add(pulse);
  }

  function createProcessOverlay() {
    if (state.stageCode === 'PRETREATMENT') {
      addProcessBlock(-4.8, 0, 2.4, 1.45, 0x8fc1dc, 0.52);
      addProcessBlock(0, 0, 2.4, 1.45, 0x80b7d4, 0.52);
      addProcessBlock(4.8, 0, 2.4, 1.45, 0xa4c9dd, 0.52);
      addActionPulse(-4.8, 0, COLORS.accent);
      addActionPulse(0, 0, COLORS.blue);
      addActionPulse(4.8, 0, COLORS.accent);
      return;
    }
    if (state.stageCode === 'GAS_INSPECTION') {
      addProcessBlock(0, 0, 5.0, 1.55, 0xb4cad8, 0.7);
      addProcessBlock(-5.8, 0, 2.0, 0.48, 0x7faac2, 0.72);
      addProcessBlock(5.8, 0, 2.0, 0.48, 0x7faac2, 0.72);
      addActionPulse(0, 0, COLORS.warning);
      return;
    }
    if (state.stageCode === 'APPEARANCE_INSPECTION') {
      addProcessBlock(-2.7, 0, 0.22, 2.8, COLORS.accent, 0.72);
      addProcessBlock(0, 0, 0.22, 2.8, COLORS.accent, 0.72);
      addProcessBlock(2.7, 0, 0.22, 2.8, COLORS.accent, 0.72);
      var rejectBranch = addProcessBlock(5.9, -1.15, 3.0, 0.18, COLORS.warning, 0.92);
      rejectBranch.rotation.z = -0.42;
      addActionPulse(0, 0, COLORS.accent);
      return;
    }
    if (state.stageCode === 'BEVERAGE_READY') {
      addProcessBlock(-4.6, 1.05, 2.8, 1.15, 0x91bed3, 0.68);
      addProcessBlock(0, 1.05, 2.8, 1.15, 0x7daec8, 0.68);
      addProcessBlock(4.6, -0.9, 3.3, 0.55, 0x9ec5d8, 0.66);
      addActionPulse(-4.6, 1.05, COLORS.blue);
      addActionPulse(0, 1.05, COLORS.warning);
      return;
    }
    if (state.stageCode === 'FILLING') {
      [-4.5, -1.5, 1.5, 4.5].forEach(function (x) {
        addProcessBlock(x, 0.95, 0.18, 1.0, COLORS.blue, 0.78);
        addActionPulse(x, 0.2, COLORS.accent);
      });
      return;
    }
    if (state.stageCode === 'SECONDARY_INSPECTION') {
      addProcessBlock(-1.6, 0, 4.2, 1.55, 0xa7c5d5, 0.7);
      var secondaryReject = addProcessBlock(4.8, -1.1, 3.2, 0.18, COLORS.warning, 0.92);
      secondaryReject.rotation.z = -0.38;
      addActionPulse(-1.6, 0, COLORS.accent);
      return;
    }
    if (state.stageCode === 'PACKING') {
      addProcessBlock(-4.6, 0, 2.5, 2.5, 0x9fc1d2, 0.64);
      [2.7, 4.3, 5.9].forEach(function (x) {
        [-0.65, 0, 0.65].forEach(function (y) { addProcessBlock(x, y, 1.15, 0.48, 0xc6d7e0, 0.9); });
      });
      addActionPulse(-4.6, 0, COLORS.blue);
      return;
    }
    if (state.stageCode === 'AGV_TRANSPORT') {
      addProcessBlock(0, 1.15, 14.8, 0.14, COLORS.accent, 0.86);
      addProcessBlock(0, -1.15, 14.8, 0.14, COLORS.accent, 0.86);
      addProcessBlock(-7.35, 0, 0.14, 2.4, COLORS.accent, 0.86);
      addProcessBlock(7.35, 0, 0.14, 2.4, COLORS.accent, 0.86);
      addActionPulse(-6.2, -1.15, COLORS.arrow);
      return;
    }
    if (state.stageCode === 'WAREHOUSE_INBOUND') {
      [-5.8, 0, 5.8].forEach(function (x) {
        [-0.55, 0, 0.55].forEach(function (offset) { addProcessBlock(x + offset, 1.55, 0.38, 1.7, 0x86aec2, 0.62); });
      });
      addProcessBlock(0, -1.3, 15.2, 0.24, COLORS.accent, 0.75);
    }
  }

  function createFlowArrows() {
    for (var i = 0; i < 8; i += 1) {
      var group = new THREE.Group();
      var body = rect(0.55, 0.08, COLORS.arrow, 0.95);
      var head = new THREE.Mesh(new THREE.CircleGeometry(0.18, 3), makeMaterial(COLORS.arrow, 0.95));
      head.rotation.z = -Math.PI / 2;
      setXY(body, 0, 0, 0.08);
      setXY(head, 0.38, 0, 0.08);
      group.add(body);
      group.add(head);
      group.userData.baseX = -7.6 + i * 2.1;
      group.position.set(group.userData.baseX, 0.38, 0);
      flowRoot.add(group);
    }
  }

  function createDevices() {
    var devices = state.devices && state.devices.length ? state.devices : demoDevices(state.stageCode);
    devices.forEach(function (device, index) {
      var group = createDeviceSymbol(device, index, devices.length);
      group.userData.selectType = 'device';
      group.userData.deviceCode = device.code;
      group.userData.label = (device.name || device.code) + ' - ' + (device.state || 'STANDBY');
      applySavedPosition(group);
      deviceRoot.add(group);
      clickable.push(group);
    });
  }

  function createDeviceSymbol(device, index, count) {
    var group = new THREE.Group();
    var x = count <= 1 ? 0 : -7 + index * (14 / (count - 1));
    var y = index % 2 === 0 ? -1.75 : 1.75;
    var stageLayouts = {
      PRETREATMENT: [[-6.7, -1.7], [-2.3, 1.7], [2.3, -1.7], [6.7, 1.7]],
      GAS_INSPECTION: [[-5.8, 1.7], [-1.8, -1.7], [2.0, 1.7], [5.8, -1.7]],
      APPEARANCE_INSPECTION: [[-6.8, 1.75], [-3.4, -1.75], [0, 1.75], [3.4, -1.75], [6.8, 1.75]],
      BEVERAGE_READY: [[-5.8, 2.35], [-1.9, 2.35], [2.0, -1.75], [5.8, -1.75]],
      FILLING: [[-6.8, -1.75], [-3.4, 1.75], [0, -1.75], [3.4, 1.75], [6.8, -1.75]],
      SECONDARY_INSPECTION: [[-5.8, 1.75], [-1.9, -1.75], [2.0, 1.75], [5.8, -1.75]],
      PACKING: [[-6.8, 1.75], [-3.4, -1.75], [0, 1.75], [3.4, -1.75], [6.8, 1.75]],
      AGV_TRANSPORT: [[-6.5, 0], [-2.2, 1.85], [2.2, -1.85], [6.5, 1.85], [6.5, -1.85]],
      WAREHOUSE_INBOUND: [[-6.8, -1.7], [-2.3, -1.7], [2.3, -1.7], [6.8, -1.7]]
    };
    var positions = stageLayouts[state.stageCode];
    if (positions && positions[index]) {
      x = positions[index][0];
      y = positions[index][1];
    }
    if (state.stageCode === 'BEVERAGE_READY') y = index < 2 ? 1.5 : -1.65;
    if (state.stageCode === 'AGV_TRANSPORT') y = index === 0 ? 0 : index % 2 === 0 ? 1.8 : -1.8;
    if (state.stageCode === 'WAREHOUSE_INBOUND') y = index < 2 ? -1.65 : 2.35;
    group.position.set(x, y, 0);

    var kind = kindForDevice(device.code);
    var statusColor = colorForState(device.state || 'STANDBY', COLORS.blue);
    var base = rect(kind === 'agv' ? 1.45 : 1.25, kind === 'sensor' ? 0.78 : 0.9, state.statusColors ? statusColor : COLORS.panel, 0.98);
    base.userData.deviceOwner = group;
    setXY(base, 0, 0, 0.12);
    group.add(base);

    var border = ring(0.58, 0.04, state.statusColors ? statusColor : COLORS.accent, 1);
    border.scale.x = kind === 'agv' ? 1.45 : 1.15;
    border.scale.y = kind === 'sensor' ? 0.72 : 0.88;
    border.userData.deviceOwner = group;
    setXY(border, 0, 0, 0.13);
    group.add(border);

    if (kind === 'camera') addCameraIcon(group);
    else if (kind === 'sensor') addSensorIcon(group);
    else if (kind === 'robot') addRobotIcon(group);
    else if (kind === 'reject') addRejectIcon(group);
    else if (kind === 'agv') addAgvIcon(group);
    else if (kind === 'tank') addTankIcon(group);
    else addMachineIcon(group);

    var label = createLabel(device.name || device.code, '#173247');
    label.userData.deviceOwner = group;
    setXY(label, 0, -0.72, 0.22);
    group.add(label);
    var stateLabel = createLabel(device.state || 'STANDBY', '#476276');
    stateLabel.scale.set(0.92, 0.23, 1);
    stateLabel.userData.deviceOwner = group;
    setXY(stateLabel, 0, -1.03, 0.22);
    group.add(stateLabel);
    return group;
  }

  function addMachineIcon(group) {
    group.add(setXY(rect(0.65, 0.28, COLORS.navy, 1), 0, 0.08, 0.18));
    group.add(setXY(rect(0.42, 0.1, COLORS.accent, 1), 0, -0.18, 0.19));
  }

  function addCameraIcon(group) {
    group.add(setXY(rect(0.56, 0.28, COLORS.navy, 1), -0.08, 0.02, 0.18));
    group.add(setXY(circle(0.15, COLORS.accent, 1), 0.24, 0.02, 0.19));
  }

  function addSensorIcon(group) {
    group.add(setXY(circle(0.22, COLORS.accent, 1), 0, 0, 0.18));
    group.add(setXY(ring(0.38, 0.035, COLORS.accent, 0.7), 0, 0, 0.19));
  }

  function addRobotIcon(group) {
    group.add(setXY(circle(0.2, COLORS.navy, 1), -0.28, 0, 0.18));
    var arm = rect(0.72, 0.12, COLORS.accent, 1);
    arm.rotation.z = 0.42;
    group.add(setXY(arm, 0.12, 0.08, 0.19));
  }

  function addRejectIcon(group) {
    var gate = rect(0.72, 0.12, COLORS.arrow, 1);
    gate.rotation.z = -0.38;
    group.add(setXY(gate, 0.05, 0.04, 0.18));
  }

  function addAgvIcon(group) {
    group.add(setXY(rect(0.82, 0.42, COLORS.navy, 1), 0, 0, 0.18));
    group.add(setXY(circle(0.08, COLORS.arrow, 1), -0.42, -0.28, 0.19));
    group.add(setXY(circle(0.08, COLORS.arrow, 1), 0.42, -0.28, 0.19));
    group.add(setXY(circle(0.08, COLORS.arrow, 1), -0.42, 0.28, 0.19));
    group.add(setXY(circle(0.08, COLORS.arrow, 1), 0.42, 0.28, 0.19));
  }

  function addTankIcon(group) {
    group.add(setXY(circle(0.35, COLORS.navy, 1), 0, 0.02, 0.18));
    group.add(setXY(rect(0.58, 0.08, COLORS.accent, 1), 0, -0.28, 0.19));
  }

  function createLabel(text, color) {
    var canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    var context = canvas.getContext('2d');
    context.fillStyle = 'rgba(249,251,253,.94)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = 'rgba(21,94,149,.5)';
    context.lineWidth = 4;
    context.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
    context.fillStyle = color || '#173247';
    context.font = '24px Microsoft YaHei, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text.length > 9 ? text.slice(0, 9) : text, canvas.width / 2, canvas.height / 2);
    var texture = new THREE.CanvasTexture(canvas);
    var sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false }));
    sprite.scale.set(1.45, 0.36, 1);
    return sprite;
  }

  function createProducts() {
    var products = state.products && state.products.length ? state.products : [
      { traceCode: 'DEMO-001', status: 'RUNNING', bottleType: 'PLA-500' },
      { traceCode: 'DEMO-002', status: 'RUNNING', bottleType: 'PLA-500' },
      { traceCode: 'DEMO-003', status: 'HOLD', bottleType: 'PLA-330' }
    ];
    products.slice(0, 10).forEach(function (product, index) {
      var group = new THREE.Group();
      var color = colorForState(product.status, COLORS.product);
      var token = circle(0.22, state.statusColors ? color : COLORS.product, 1);
      token.userData.productOwner = group;
      group.add(setXY(token, 0, 0, 0.28));
      var cap = rect(0.26, 0.06, COLORS.navy, 1);
      cap.userData.productOwner = group;
      group.add(setXY(cap, 0, 0.2, 0.29));
      group.userData.selectType = 'product';
      group.userData.traceCode = product.traceCode;
      group.userData.label = product.traceCode + ' - ' + (product.bottleType || 'UNKNOWN');
      group.userData.productIndex = index;
      productRoot.add(group);
      clickable.push(group);
    });
    positionProducts(0);
  }

  function kindForDevice(code) {
    if (code === 'AGV-01') return 'agv';
    if (code.indexOf('ARM') >= 0 || code.indexOf('GRIP') >= 0) return 'robot';
    if (code.indexOf('CAM') >= 0 || code.indexOf('LIGHT') >= 0) return 'camera';
    if (/(VERIFY|TEMP|HUM|SMOKE|US-|ODO|LOAD|FLOW|LEVEL|COUNT|VOC)/.test(code)) return 'sensor';
    if (code.indexOf('REJECT') >= 0) return 'reject';
    if (code.indexOf('MIX') >= 0 || code.indexOf('-HT-') >= 0) return 'tank';
    return 'machine';
  }

  function demoDevices(stageCode) {
    var codeMap = {
      PRETREATMENT: ['PT-CV-01', 'PT-WASH-01', 'PT-AIR-01', 'PT-PLC-01'],
      GAS_INSPECTION: ['GAS-CHAMBER-01', 'GAS-VERIFY-01', 'GAS-PUMP-01', 'GAS-LAMP-01'],
      APPEARANCE_INSPECTION: ['VIS-TOP-01', 'VIS-SIDE-01', 'VIS-BOTTOM-01', 'VIS-REJECT-01'],
      BEVERAGE_READY: ['BEV-MIX-01', 'BEV-HT-01', 'BEV-TEMP-01', 'BEV-HUM-01'],
      FILLING: ['FIL-POS-01', 'FIL-PUMP-01', 'FIL-HEAD-01', 'FIL-FLOW-01'],
      SECONDARY_INSPECTION: ['SEC-CAM-01', 'SEC-LEVEL-01', 'SEC-REJECT-01'],
      PACKING: ['PK-ARM-01', 'PK-GRIP-01', 'PK-CAM-01', 'PK-COUNT-01'],
      AGV_TRANSPORT: ['AGV-01', 'AGV-US-01', 'AGV-ODO-01', 'AGV-DISPATCH-01'],
      WAREHOUSE_INBOUND: ['WH-VOC-01', 'WH-SMOKE-01', 'WH-LAMP-01', 'WH-WMS-01']
    };
    return (codeMap[stageCode] || codeMap.PRETREATMENT).map(function (code) {
      return { code: code, name: code, state: 'RUNNING' };
    });
  }

  function demoStages() {
    return [
      { code: 'PRETREATMENT', name: '预处理', state: 'RUNNING', wip: 0 },
      { code: 'GAS_INSPECTION', name: '气体检测', state: 'RUNNING', wip: 0 },
      { code: 'APPEARANCE_INSPECTION', name: '外观检测', state: 'RUNNING', wip: 0 },
      { code: 'BEVERAGE_READY', name: '饮料制备', state: 'RUNNING', wip: 0 },
      { code: 'FILLING', name: '灌装', state: 'RUNNING', wip: 0 },
      { code: 'SECONDARY_INSPECTION', name: '二次检测', state: 'RUNNING', wip: 0 },
      { code: 'PACKING', name: '装箱', state: 'RUNNING', wip: 0 },
      { code: 'AGV_TRANSPORT', name: 'AGV运输', state: 'RUNNING', wip: 0 },
      { code: 'WAREHOUSE_INBOUND', name: '仓储', state: 'RUNNING', wip: 0 }
    ];
  }

  function colorForState(value, neutral) {
    if (!state.statusColors) return neutral;
    if (value === 'RUNNING' || value === 'PASS' || value === 'PASSED' || value === 'COMPLETED') return COLORS.running;
    if (value === 'ALARM' || value === 'FAIL' || value === 'FAILED' || value === 'REJECTED') return COLORS.alarm;
    if (value === 'HOLD' || value === 'WAIT' || value === 'WARNING' || value === 'STANDBY') return COLORS.warning;
    return COLORS.offline;
  }

  function positionProducts(phase) {
    if (!productRoot) return;
    productRoot.children.forEach(function (product, index) {
      var t = (phase + index * 0.16) % 1;
      if (state.overview) {
        product.position.set(-7.9 + t * 15.8, index % 2 ? 0.42 : -0.42, 0.25);
        return;
      }
      var y = state.stageCode === 'WAREHOUSE_INBOUND' ? 0.9 + (index % 3) * 0.45 : index % 2 ? 0.28 : -0.28;
      if (state.stageCode === 'AGV_TRANSPORT') y = index % 2 ? 0.48 : -0.48;
      var x = -7.7 + t * 15.4;
      if (state.stageCode === 'PACKING' && t > 0.58) {
        x = 2.3 + ((t - 0.58) / 0.42) * 4.3;
        y = -0.65 + (index % 3) * 0.65;
      }
      if (state.stageCode === 'WAREHOUSE_INBOUND' && t > 0.55) {
        x = [-5.8, 0, 5.8][index % 3];
        y = -0.2 + ((t - 0.55) / 0.45) * 2.0;
      }
      product.position.set(x, y, 0.25);
    });
  }

  function animateFlow(phase) {
    flowRoot.children.forEach(function (arrow, index) {
      if (arrow.userData.actionPulse) {
        var pulse = 0.88 + 0.22 * Math.sin((phase + arrow.userData.phaseOffset) * Math.PI * 2);
        arrow.scale.set(pulse, pulse, 1);
      } else {
        var offset = ((phase + index * 0.18) % 1) * 1.2;
        arrow.position.x = arrow.userData.baseX + offset;
        if (arrow.position.x > 8) arrow.position.x -= 16;
      }
    });
  }

  function renderSnapshotFrame() {
    animateFlow(motionPhase);
    positionProducts(motionPhase);
    if (state.overview) {
      renderCompatibilityPlan();
      compatPlan.classList.remove('hidden');
    } else if (!compatPlan.classList.contains('hidden')) {
      compatPlan.classList.add('hidden');
    }
    if (renderer && scene && camera) renderer.render(scene, camera);
    updateProbe();
  }

  function updateHud() {
    stageLabel.textContent = '2D ' + state.stageName + ' / ' + state.stageCode + ' v' + String(state.stateVersion || 0);
    sourceLabel.textContent = state.source + ' - ' + (state.layoutEdit ? 'LAYOUT EDIT' : state.paused ? 'PAUSED' : 'LIVE');
  }

  function updateProbe() {
    testProbe.ready = Boolean(renderer && scene && camera);
    testProbe.stateVersion = Number(state.stateVersion || 0);
    testProbe.deviceCount = state.devices ? state.devices.length : 0;
    testProbe.productCount = state.products ? state.products.length : 0;
    testProbe.paused = Boolean(state.paused);
    testProbe.statusColors = Boolean(state.statusColors);
    testProbe.motionPhase = Number(motionPhase.toFixed(4));
    testProbe.firstProductX = productRoot && productRoot.children.length > 0 ?
      Number(productRoot.children[0].position.x.toFixed(3)) : 0;
    testProbe.source = state.source;
    testProbe.lastError = state.errorMessage || '';
    testProbe.rendererInfo.calls = renderer ? renderer.info.render.calls : 0;
    testProbe.rendererInfo.triangles = renderer ? renderer.info.render.triangles : 0;
    window.__factoryPlanTest__ = testProbe;
  }

  function resize() {
    if (!renderer || !camera) return;
    var width = Math.max(1, host.clientWidth);
    var height = Math.max(1, host.clientHeight);
    renderer.setSize(width, height, false);
    var aspect = width / height;
    var frustum = 5.6;
    camera.left = -frustum * aspect;
    camera.right = frustum * aspect;
    camera.top = frustum;
    camera.bottom = -frustum;
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
    var hits = raycaster.intersectObjects(clickable, true);
    if (!hits.length) return null;
    var object = hits[0].object;
    return object.userData.deviceOwner || object.userData.productOwner || object;
  }

  function onPointerDown(event) {
      var canvas = renderer.domElement;
      pointerStart = { x: event.clientX, y: event.clientY };
      previousPointer = { x: event.clientX, y: event.clientY };
      if (state.layoutEdit) {
        var picked = pickObject(event);
        if (picked && picked.userData.selectType === 'device') draggedDevice = picked;
      }
      canvas.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event) {
      if (!draggedDevice) return;
      var dx = event.clientX - previousPointer.x;
      var dy = event.clientY - previousPointer.y;
      previousPointer = { x: event.clientX, y: event.clientY };
      var width = Math.max(1, host.clientWidth);
      var height = Math.max(1, host.clientHeight);
      var scale = (camera.right - camera.left) / width;
      draggedDevice.position.x += dx * scale;
      draggedDevice.position.y -= dy * ((camera.top - camera.bottom) / height);
      draggedDevice.position.x = Math.max(-8.4, Math.min(8.4, draggedDevice.position.x));
      draggedDevice.position.y = Math.max(-4.4, Math.min(4.4, draggedDevice.position.y));
  }

  function onPointerUp(event) {
      var canvas = renderer.domElement;
      var moved = Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y);
      if (draggedDevice) savePosition(draggedDevice);
      if (moved < 6 && !draggedDevice) selectAt(event);
      draggedDevice = null;
      canvas.releasePointerCapture(event.pointerId);
  }

  function bindInteractions() {
    var canvas = renderer.domElement;
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
  }

  function selectAt(event) {
    var picked = pickObject(event);
    if (!picked) {
      selectionLabel.classList.add('hidden');
      testProbe.lastSelection = { entityType: '', entityId: '' };
      updateProbe();
      window.location.href = 'factory://clear';
      return;
    }
    selectionLabel.textContent = picked.userData.label || 'SELECTED';
    selectionLabel.classList.remove('hidden');
    if (picked.userData.selectType === 'stage') {
      testProbe.lastSelection = { entityType: 'STAGE', entityId: picked.userData.stageCode };
      window.location.href = 'factory://stage/' + encodeURIComponent(picked.userData.stageCode);
    } else if (picked.userData.selectType === 'device') {
      testProbe.lastSelection = { entityType: 'DEVICE', entityId: picked.userData.deviceCode };
      window.location.href = 'factory://device/' + encodeURIComponent(picked.userData.deviceCode);
    } else if (picked.userData.selectType === 'product') {
      testProbe.lastSelection = { entityType: 'PRODUCT', entityId: picked.userData.traceCode };
      window.location.href = 'factory://product/' + encodeURIComponent(picked.userData.traceCode);
    }
    updateProbe();
  }

  function storageKey(code) {
    return 'factory2d.layout.' + state.stageCode + '.' + code;
  }

  function applySavedPosition(group) {
    try {
      var raw = localStorage.getItem(storageKey(group.userData.deviceCode));
      if (!raw) return;
      var saved = JSON.parse(raw);
      if (Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
        group.position.x = saved.x;
        group.position.y = saved.y;
      }
    } catch (_) {}
  }

  function savePosition(group) {
    try {
      localStorage.setItem(storageKey(group.userData.deviceCode), JSON.stringify({
        x: Number(group.position.x.toFixed(2)),
        y: Number(group.position.y.toFixed(2))
      }));
    } catch (_) {}
  }

  function normalizePayload(payload) {
    if (typeof payload === 'string') return JSON.parse(payload);
    return payload || {};
  }

  function renderLoop(timestamp) {
    if (!running) return;
    animationFrameId = requestAnimationFrame(renderLoop);
    if (!renderer || !scene || !camera) return;
    var deltaSeconds = lastFrameTime > 0 ? Math.min(0.1, (timestamp - lastFrameTime) / 1000) : 0;
    lastFrameTime = timestamp;
    if (!state.paused) {
      var speedRate = Math.max(0.012, Math.min(0.12, Math.abs(Number(state.speed || 0.12)) * 0.08));
      motionPhase = (motionPhase + deltaSeconds * speedRate) % 1;
    }
    animateFlow(motionPhase);
    positionProducts(motionPhase);
    if (state.overview) {
      if (compatProductNodes.length === 0) renderCompatibilityPlan();
      else updateCompatibilityProductPositions();
      compatPlan.classList.remove('hidden');
    }
    renderer.render(scene, camera);
    updateProbe();
  }

  window.FactoryPlan = {
    update: function (payload) {
      try {
        var next = normalizePayload(payload);
        var stageChanged = next.stageCode && next.stageCode !== state.stageCode;
        var statusColorsChanged = next.statusColors !== undefined && next.statusColors !== state.statusColors;
        var oldProducts = JSON.stringify((state.products || []).map(function (item) { return item.traceCode + ':' + item.status; }));
        var nextProducts = JSON.stringify((next.products || []).map(function (item) { return item.traceCode + ':' + item.status; }));
        var oldDevices = JSON.stringify((state.devices || []).map(function (item) { return item.code + ':' + item.state; }));
        var nextDevices = JSON.stringify((next.devices || []).map(function (item) { return item.code + ':' + item.state; }));
        Object.keys(next).forEach(function (key) { state[key] = next[key]; });
        if (Number.isFinite(Number(next.progress))) {
          var snapshotPhase = ((Number(next.progress) % 100) + 100) % 100 / 100;
          motionPhase = snapshotPhase;
        }
        if (stageChanged || statusColorsChanged || oldProducts !== nextProducts || oldDevices !== nextDevices) {
          rebuildPlan();
          renderSnapshotFrame();
        } else {
          updateHud();
          renderSnapshotFrame();
        }
        showCompatibilityPlanIfNeeded();
      } catch (error) {
        state.errorMessage = error && error.message ? error.message : 'DATA ERROR';
        sourceLabel.textContent = 'DATA ERROR';
        updateProbe();
      }
    },
    dispose: function () {
      running = false;
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      if (compatWatchTimer) window.clearTimeout(compatWatchTimer);
      if (resizeObserver) resizeObserver.disconnect();
      if (renderer && renderer.domElement) {
        renderer.domElement.removeEventListener('pointerdown', onPointerDown);
        renderer.domElement.removeEventListener('pointermove', onPointerMove);
        renderer.domElement.removeEventListener('pointerup', onPointerUp);
      }
      clearObject(root);
      if (renderer) {
        renderer.dispose();
        if (renderer.forceContextLoss) renderer.forceContextLoss();
      }
      testProbe.ready = false;
      updateProbe();
    }
  };

  window.addEventListener('error', function (event) {
    state.errorMessage = event && event.message ? event.message : 'WINDOW ERROR';
    updateProbe();
  });

  init();
}());

