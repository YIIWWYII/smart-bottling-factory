(function () {
  'use strict';

  var host = document.getElementById('scene-host');
  var fallback = document.getElementById('fallback');
  var revision = document.getElementById('revision');
  if (!window.THREE) {
    fallback.classList.remove('hidden');
    return;
  }

  var THREE = window.THREE;
  var COLORS = {
    floor: 0x0b181e,
    floorLine: 0x20343c,
    steel: 0x52666e,
    steelLight: 0x91a3a9,
    dark: 0x14252c,
    blue: 0x0877a8,
    cyan: 0x00a6c7,
    white: 0xd7e1e4,
    running: 0x22a66f,
    waiting: 0xc88112,
    alarm: 0xc63f4c,
    bottle: 0x28a8d0,
    box: 0xa77b42
  };

  var state = { stateVersion: 0, source: 'LOCAL DEMO', speed: 0.12, stages: [], products: [] };
  var scene;
  var camera;
  var renderer;
  var root;
  var route;
  var stationGroups = [];
  var products = [];
  var movers = [];
  var flowMarkers = [];
  var clickable = [];
  var raycaster = new THREE.Raycaster();
  var pointer = new THREE.Vector2();
  var resizeObserver;
  var frameId = 0;
  var running = true;
  var clock = new THREE.Clock();
  var phase = 0;

  var stationLayout = [
    { code: 'PRETREATMENT', name: '预处理', x: -13.4, z: -2.5, kind: 'wash' },
    { code: 'GAS_INSPECTION', name: '气体检测', x: -9.2, z: -2.5, kind: 'gas' },
    { code: 'APPEARANCE_INSPECTION', name: '外观检测', x: -5.0, z: -2.5, kind: 'vision' },
    { code: 'FILLING', name: '灌装汇流', x: -0.6, z: -2.5, kind: 'filling' },
    { code: 'SECONDARY_INSPECTION', name: '二次检测', x: 3.8, z: -2.5, kind: 'vision' },
    { code: 'PACKING', name: '机械臂装箱', x: 7.9, z: -2.5, kind: 'robot' },
    { code: 'AGV_TRANSPORT', name: 'AGV运输', x: 11.7, z: -2.5, kind: 'agv' },
    { code: 'WAREHOUSE_INBOUND', name: '仓储入库', x: 15.0, z: -2.5, kind: 'warehouse' },
    { code: 'BEVERAGE_READY', name: '饮料准备', x: -0.6, z: 4.0, kind: 'beverage' }
  ];

  function material(color, metalness, roughness, emissive) {
    return new THREE.MeshStandardMaterial({
      color: color,
      metalness: metalness === undefined ? 0.56 : metalness,
      roughness: roughness === undefined ? 0.46 : roughness,
      emissive: emissive || 0x000000,
      emissiveIntensity: emissive ? 0.3 : 0
    });
  }

  function mesh(geometry, color, metalness, roughness, emissive) {
    var value = new THREE.Mesh(geometry, material(color, metalness, roughness, emissive));
    value.castShadow = true;
    value.receiveShadow = true;
    return value;
  }

  function box(w, h, d, color) {
    return mesh(new THREE.BoxGeometry(w, h, d), color);
  }

  function cylinder(radius, height, color, segments) {
    return mesh(new THREE.CylinderGeometry(radius, radius, height, segments || 20), color);
  }

  function statusColor(value) {
    if (value === 'RUNNING' || value === 'PASS') return COLORS.running;
    if (value === 'ALARM' || value === 'FAIL' || value === 'REJECTED') return COLORS.alarm;
    return COLORS.waiting;
  }

  function init() {
    try {
      scene = new THREE.Scene();
      scene.background = new THREE.Color(0x09151b);
      scene.fog = new THREE.Fog(0x09151b, 25, 54);
      camera = new THREE.OrthographicCamera(-18, 18, 5.8, -5.8, 0.1, 100);
      camera.position.set(0, 18, 15);
      camera.lookAt(0, 0.5, 0);

      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      host.appendChild(renderer.domElement);

      scene.add(new THREE.HemisphereLight(0xb8d0d5, 0x071015, 1.8));
      var key = new THREE.DirectionalLight(0xe6eff1, 2.5);
      key.position.set(-12, 19, 11);
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      key.shadow.camera.left = -20;
      key.shadow.camera.right = 20;
      key.shadow.camera.top = 14;
      key.shadow.camera.bottom = -14;
      scene.add(key);
      var rim = new THREE.DirectionalLight(0x00a6c7, 1.2);
      rim.position.set(12, 9, -10);
      scene.add(rim);

      createFloor();
      rebuild();
      bindInteractions();
      resize();
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(host);
      frameId = requestAnimationFrame(renderLoop);
    } catch (error) {
      fallback.classList.remove('hidden');
    }
  }

  function createFloor() {
    var floor = box(38, 0.25, 17, COLORS.floor);
    floor.position.y = -0.22;
    scene.add(floor);
    var grid = new THREE.GridHelper(38, 38, COLORS.floorLine, COLORS.floorLine);
    grid.position.y = -0.08;
    grid.material.transparent = true;
    grid.material.opacity = 0.42;
    scene.add(grid);
    [-7.35, 7.35].forEach(function (z) {
      var rail = box(36.5, 0.04, 0.04, COLORS.cyan);
      rail.position.set(0, -0.04, z);
      scene.add(rail);
    });

    for (var x = -17; x <= 17; x += 1.5) {
      var safety = box(0.7, 0.025, 0.05, x % 3 === 0 ? COLORS.white : COLORS.blue);
      safety.position.set(x, -0.03, -6.65);
      scene.add(safety);
    }
  }

  function rebuild() {
    if (root) disposeObject(root);
    root = new THREE.Group();
    scene.add(root);
    stationGroups = [];
    products = [];
    movers = [];
    flowMarkers = [];
    clickable = [];
    createRoutes();
    stationLayout.forEach(function (definition) {
      var runtime = findStage(definition.code);
      var group = createStation(definition, runtime);
      root.add(group);
      stationGroups.push(group);
      clickable.push(group);
    });
    createProducts();
    revision.textContent = 'STATE v' + String(state.stateVersion || 0) + ' · ' + state.source;
  }

  function disposeObject(object) {
    scene.remove(object);
    object.traverse(function (child) {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach(function (item) { item.dispose(); });
        else child.material.dispose();
      }
    });
  }

  function findStage(code) {
    for (var i = 0; i < state.stages.length; i += 1) {
      if (state.stages[i].code === code) return state.stages[i];
    }
    return { code: code, state: 'RUNNING', wip: 0, onlineDevices: 0, totalDevices: 0 };
  }

  function createRoutes() {
    route = new THREE.Group();
    root.add(route);
    var main = box(31.8, 0.34, 0.92, COLORS.dark);
    main.position.set(0.7, 0.18, -2.5);
    route.add(main);
    var beverage = box(0.92, 0.28, 5.9, COLORS.dark);
    beverage.position.set(-0.6, 0.15, 0.75);
    route.add(beverage);
    var merge = cylinder(0.5, 0.14, COLORS.waiting, 24);
    merge.position.set(-0.6, 0.42, -2.5);
    route.add(merge);

    for (var x = -14.7; x <= 15.5; x += 0.72) {
      var marker = cylinder(0.07, 0.72, x > -1.3 && x < 0 ? COLORS.waiting : COLORS.steelLight, 10);
      marker.rotation.x = Math.PI / 2;
      marker.position.set(x, 0.42, -2.5);
      route.add(marker);
      movers.push({ object: marker, type: 'roller' });
    }
    for (var z = 3.2; z >= -1.5; z -= 0.72) {
      var pipeMarker = cylinder(0.07, 0.72, COLORS.steelLight, 10);
      pipeMarker.rotation.z = Math.PI / 2;
      pipeMarker.position.set(-0.6, 0.4, z);
      route.add(pipeMarker);
    }

    for (var markerIndex = 0; markerIndex < 12; markerIndex += 1) {
      var signal = mesh(new THREE.SphereGeometry(0.085, 12, 8), COLORS.cyan, 0.1, 0.24, COLORS.cyan);
      signal.position.set(-14.4 + markerIndex * 2.62, 0.58, -2.5);
      route.add(signal);
      flowMarkers.push({ object: signal, offset: markerIndex / 12 });
    }
  }

  function createStation(definition, runtime) {
    var group = new THREE.Group();
    group.position.set(definition.x, 0, definition.z);
    group.scale.setScalar(1.12);
    group.userData.stageCode = definition.code;
    group.userData.selectType = 'stage';

    var plinth = box(2.75, 0.14, 2.22, COLORS.dark);
    plinth.position.y = 0.08;
    group.add(plinth);
    var statusRail = mesh(new THREE.BoxGeometry(2.3, 0.08, 0.09), statusColor(runtime.state), 0.25, 0.4, statusColor(runtime.state));
    statusRail.position.set(0, 0.2, 1.02);
    statusRail.userData.statusIndicator = true;
    group.add(statusRail);
    [-1.05, 1.05].forEach(function (x) {
      var corner = box(0.08, 0.04, 1.85, COLORS.steel);
      corner.position.set(x, 0.18, 0);
      group.add(corner);
    });
    var frontEdge = box(2.15, 0.035, 0.04, COLORS.steelLight);
    frontEdge.position.set(0, 0.2, -0.9);
    group.add(frontEdge);
    var beaconPost = cylinder(0.035, 0.75, COLORS.steel, 10);
    beaconPost.position.set(1.0, 0.52, -0.82);
    group.add(beaconPost);
    var beacon = mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.18, 16), statusColor(runtime.state), 0.1, 0.35, statusColor(runtime.state));
    beacon.position.set(1.0, 0.98, -0.82);
    beacon.userData.statusIndicator = true;
    group.add(beacon);

    if (definition.kind === 'wash') createWash(group);
    else if (definition.kind === 'gas') createGas(group);
    else if (definition.kind === 'vision') createVision(group);
    else if (definition.kind === 'filling') createFilling(group);
    else if (definition.kind === 'beverage') createBeverage(group);
    else if (definition.kind === 'robot') createRobot(group);
    else if (definition.kind === 'agv') createAgv(group);
    else createWarehouse(group);

    var label = labelSprite(definition.name, definition.code, runtime, statusColor(runtime.state));
    label.position.set(0, 3.28, 0);
    group.add(label);
    group.traverse(function (child) { if (child.isMesh || child.isSprite) child.userData.stageOwner = group; });
    return group;
  }

  function createWash(group) {
    var chamber = box(1.55, 1.5, 1.35, COLORS.steelLight);
    chamber.position.y = 1.0;
    group.add(chamber);
    var windowMesh = box(1.12, 0.7, 0.05, COLORS.blue);
    windowMesh.position.set(0, 1.12, 0.7);
    group.add(windowMesh);
    var fan = cylinder(0.38, 0.12, COLORS.cyan, 20);
    fan.rotation.x = Math.PI / 2;
    fan.position.set(0, 1.18, 0.76);
    group.add(fan);
    movers.push({ object: fan, type: 'fan' });
  }

  function createGas(group) {
    var chamber = cylinder(0.82, 1.7, COLORS.steelLight, 24);
    chamber.position.y = 1.02;
    group.add(chamber);
    var cap = cylinder(0.88, 0.15, COLORS.blue, 24);
    cap.position.y = 1.92;
    group.add(cap);
    var sensor = cylinder(0.16, 0.58, COLORS.cyan, 16);
    sensor.position.set(0.7, 2.05, 0);
    group.add(sensor);
    movers.push({ object: sensor, type: 'pulse' });
  }

  function createVision(group) {
    [-0.65, 0.65].forEach(function (x) {
      var post = box(0.13, 1.75, 0.13, COLORS.steel);
      post.position.set(x, 0.98, 0);
      group.add(post);
    });
    var beam = box(1.45, 0.16, 0.2, COLORS.blue);
    beam.position.y = 1.86;
    group.add(beam);
    var cameraBody = box(0.45, 0.35, 0.55, COLORS.white);
    cameraBody.position.set(0, 1.58, 0);
    group.add(cameraBody);
    var scan = box(1.2, 0.04, 0.05, COLORS.cyan);
    scan.position.set(0, 0.8, 0);
    group.add(scan);
    movers.push({ object: scan, type: 'scan' });
  }

  function createFilling(group) {
    var top = box(1.65, 0.16, 1.15, COLORS.steel);
    top.position.y = 2.05;
    group.add(top);
    [-0.55, 0, 0.55].forEach(function (x) {
      var nozzle = cylinder(0.08, 0.9, COLORS.cyan, 12);
      nozzle.position.set(x, 1.52, 0);
      group.add(nozzle);
      movers.push({ object: nozzle, type: 'filler', originY: 1.52 });
    });
    [-0.72, 0.72].forEach(function (x) {
      var post = box(0.13, 1.85, 0.13, COLORS.steelLight);
      post.position.set(x, 1.05, 0);
      group.add(post);
    });
  }

  function createBeverage(group) {
    var tank = cylinder(0.8, 1.8, COLORS.steelLight, 28);
    tank.position.y = 1.08;
    group.add(tank);
    var cap = cylinder(0.86, 0.13, COLORS.blue, 28);
    cap.position.y = 2.04;
    group.add(cap);
    var agitator = cylinder(0.07, 2.2, COLORS.cyan, 12);
    agitator.position.y = 1.25;
    group.add(agitator);
    movers.push({ object: agitator, type: 'agitator' });
  }

  function createRobot(group) {
    var base = cylinder(0.5, 0.36, COLORS.dark, 22);
    base.position.y = 0.35;
    group.add(base);
    var joint = new THREE.Group();
    joint.position.y = 0.55;
    var lower = box(0.28, 1.35, 0.28, COLORS.blue);
    lower.position.y = 0.65;
    lower.rotation.z = -0.25;
    joint.add(lower);
    var upper = box(1.05, 0.25, 0.25, COLORS.cyan);
    upper.position.set(0.42, 1.25, 0);
    upper.rotation.z = -0.3;
    joint.add(upper);
    var boxMesh = box(0.76, 0.58, 0.68, COLORS.box);
    boxMesh.position.set(1.05, 0.52, 0.45);
    group.add(boxMesh);
    group.add(joint);
    movers.push({ object: joint, type: 'robot' });
  }

  function createAgv(group) {
    var body = box(1.7, 0.42, 1.05, COLORS.blue);
    body.position.y = 0.52;
    group.add(body);
    var deck = box(1.45, 0.14, 0.85, COLORS.white);
    deck.position.y = 0.8;
    group.add(deck);
    [-0.55, 0.55].forEach(function (x) {
      [-0.48, 0.48].forEach(function (z) {
        var wheel = cylinder(0.18, 0.12, COLORS.dark, 14);
        wheel.rotation.x = Math.PI / 2;
        wheel.position.set(x, 0.28, z);
        group.add(wheel);
        movers.push({ object: wheel, type: 'wheel' });
      });
    });
    movers.push({ object: group, type: 'agv', originX: group.position.x });
  }

  function createWarehouse(group) {
    [-0.65, 0.65].forEach(function (x) {
      var post = box(0.12, 2.15, 0.12, COLORS.blue);
      post.position.set(x, 1.15, 0);
      group.add(post);
    });
    [0.55, 1.2, 1.85].forEach(function (y) {
      var shelf = box(1.55, 0.1, 1.0, COLORS.steel);
      shelf.position.y = y;
      group.add(shelf);
      var carton = box(0.5, 0.38, 0.55, COLORS.box);
      carton.position.set(y === 1.2 ? 0.35 : -0.35, y + 0.23, 0);
      group.add(carton);
    });
  }

  function labelSprite(name, code, runtime, color) {
    var canvas = document.createElement('canvas');
    canvas.width = 430;
    canvas.height = 96;
    var context = canvas.getContext('2d');
    context.fillStyle = '#' + color.toString(16).padStart(6, '0');
    context.fillRect(0, 78, canvas.width, 4);
    context.fillStyle = '#eef5f6';
    context.font = 'bold 27px Microsoft YaHei, sans-serif';
    context.fillText(name, 6, 34);
    context.fillStyle = '#86a0a9';
    context.font = '17px Microsoft YaHei, sans-serif';
    context.fillText(code + '  /  WIP ' + String(runtime.wip || 0), 6, 62);
    context.fillStyle = '#6f8992';
    context.textAlign = 'right';
    context.fillText('DEV ' + String(runtime.onlineDevices || 0) + '/' + String(runtime.totalDevices || 0), canvas.width - 6, 62);
    var texture = new THREE.CanvasTexture(canvas);
    var sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
    sprite.scale.set(3.35, 0.75, 1);
    return sprite;
  }

  function createProducts() {
    var source = state.products.length ? state.products : [
      { traceCode: 'DEMO-01', status: 'RUNNING' },
      { traceCode: 'DEMO-02', status: 'RUNNING' },
      { traceCode: 'DEMO-03', status: 'HOLD' }
    ];
    source.slice(0, 7).forEach(function (item, index) {
      var group = new THREE.Group();
      var color = statusColor(item.status);
      var bottle = cylinder(0.22, 0.74, color, 18);
      bottle.position.y = 0.66;
      group.add(bottle);
      var neck = cylinder(0.11, 0.2, COLORS.white, 12);
      neck.position.y = 1.13;
      group.add(neck);
      var cap = cylinder(0.12, 0.08, COLORS.dark, 12);
      cap.position.y = 1.27;
      group.add(cap);
      group.userData.offset = index / Math.min(7, source.length);
      root.add(group);
      products.push(group);
    });
  }

  function positionProducts(value) {
    products.forEach(function (product, index) {
      var t = (value + product.userData.offset) % 1;
      var x = -14.5 + t * 30.3;
      product.position.set(x, 0.25, -2.5 + (index % 2 ? 0.22 : -0.22));
      var packed = x > 6.7;
      product.scale.set(packed ? 1.45 : 1, packed ? 0.8 : 1, packed ? 1.45 : 1);
    });
  }

  function animateParts(elapsed, delta) {
    movers.forEach(function (part, index) {
      if (part.type === 'fan' || part.type === 'wheel') part.object.rotation.z -= delta * 6;
      else if (part.type === 'roller') part.object.rotation.z -= delta * 3.5;
      else if (part.type === 'agitator') part.object.rotation.y += delta * 4;
      else if (part.type === 'pulse') part.object.scale.setScalar(1 + Math.sin(elapsed * 3) * 0.14);
      else if (part.type === 'scan') part.object.position.y = 0.75 + Math.sin(elapsed * 2.3) * 0.36;
      else if (part.type === 'filler') part.object.position.y = part.originY + Math.sin(elapsed * 2.5 + index) * 0.12;
      else if (part.type === 'robot') part.object.rotation.y = Math.sin(elapsed * 0.85) * 0.6;
      else if (part.type === 'agv') part.object.position.x = part.originX + Math.sin(elapsed * 0.7) * 0.55;
    });
    flowMarkers.forEach(function (marker) {
      var offset = (phase + marker.offset) % 1;
      marker.object.position.x = -14.4 + offset * 29.2;
      marker.object.material.emissiveIntensity = 0.3 + Math.sin(elapsed * 3 + marker.offset * 8) * 0.12;
    });
  }

  function bindInteractions() {
    renderer.domElement.addEventListener('pointerup', function (event) {
      var rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      var hits = raycaster.intersectObjects(clickable, true);
      if (!hits.length) return;
      var picked = hits[0].object.userData.stageOwner || hits[0].object;
      if (picked.userData.stageCode) window.location.href = 'factory://stage/' + encodeURIComponent(picked.userData.stageCode);
    });
  }

  function resize() {
    var width = Math.max(1, host.clientWidth);
    var height = Math.max(1, host.clientHeight);
    renderer.setSize(width, height, false);
    var aspect = width / height;
    var vertical = 5.8;
    camera.left = -vertical * aspect;
    camera.right = vertical * aspect;
    camera.top = vertical;
    camera.bottom = -vertical;
    camera.updateProjectionMatrix();
  }

  function renderLoop() {
    if (!running) return;
    frameId = requestAnimationFrame(renderLoop);
    var delta = Math.min(clock.getDelta(), 0.05);
    var elapsed = clock.elapsedTime;
    phase = (phase + delta * Math.max(0.035, Math.min(0.15, Math.abs(Number(state.speed || 0.12)) * 0.35))) % 1;
    positionProducts(phase);
    animateParts(elapsed, delta);
    stationGroups.forEach(function (station, index) {
      station.children.forEach(function (child) {
        if (child.userData.statusIndicator) child.material.emissiveIntensity = 0.26 + Math.sin(elapsed * 2 + index) * 0.08;
      });
    });
    renderer.render(scene, camera);
  }

  window.FactoryOverview = {
    update: function (payload) {
      try {
        var next = typeof payload === 'string' ? JSON.parse(payload) : (payload || {});
        var signature = JSON.stringify((next.stages || []).map(function (item) {
          return item.code + ':' + item.state + ':' + item.wip + ':' + item.onlineDevices;
        }));
        var previous = JSON.stringify(state.stages.map(function (item) {
          return item.code + ':' + item.state + ':' + item.wip + ':' + item.onlineDevices;
        }));
        Object.keys(next).forEach(function (key) { state[key] = next[key]; });
        revision.textContent = 'STATE v' + String(state.stateVersion || 0) + ' · ' + state.source;
        if (signature !== previous) rebuild();
      } catch (_) {}
    },
    dispose: function () {
      running = false;
      if (frameId) cancelAnimationFrame(frameId);
      if (resizeObserver) resizeObserver.disconnect();
      if (root) disposeObject(root);
      if (renderer) {
        renderer.dispose();
        if (renderer.forceContextLoss) renderer.forceContextLoss();
      }
    }
  };

  init();
}());
