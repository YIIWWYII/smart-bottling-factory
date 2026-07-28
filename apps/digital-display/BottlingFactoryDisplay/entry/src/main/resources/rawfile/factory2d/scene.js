(function () {
  'use strict';

  var plan = document.getElementById('plan');
  var canvas = document.getElementById('plan-canvas');
  var deviceLayer = document.getElementById('device-layer');
  var productLayer = document.getElementById('product-layer');
  var productStrip = document.getElementById('product-strip');
  var specialZone = document.getElementById('special-zone');
  var selection = document.getElementById('selection');
  var resetLayout = document.getElementById('reset-layout');

  var state = {
    stageCode: 'PRETREATMENT',
    stageName: '瓶体预处理',
    stateVersion: 'UNKNOWN',
    source: 'LOCAL DEMO',
    paused: false,
    statusColors: true,
    layoutEdit: false,
    speed: 0.12,
    progress: 20,
    devices: [],
    products: []
  };

  var visuals = {
    PRETREATMENT: { title: '瓶体预处理单元', material: 'PLA 瓶', output: '洁净干燥瓶', route: 'conveyor-route', devices: [['conveyor',12,60,1.05],['washer',36,40,1.1],['fan',62,38,.96],['plc',84,24,.84]] },
    GAS_INSPECTION: { title: '密封气体检测单元', material: '预处理瓶', output: '气体安全瓶', route: 'conveyor-route', devices: [['chamber',25,44,1.15],['sensor',50,25,.86],['pump',70,55,.88],['beacon',87,22,.78]] },
    APPEARANCE_INSPECTION: { title: '多视角外观检测单元', material: '待检空瓶', output: '外观合格瓶', route: 'conveyor-route', special: 'scan', devices: [['camera-top',24,18,.78],['camera-side',34,49,.78],['camera-bottom',52,72,.78],['light-ring',60,36,.9],['reject',82,52,.88]] },
    BEVERAGE_READY: { title: '饮料调配与杀菌单元', material: '饮料原料', output: '已杀菌饮料', route: 'liquid-route', devices: [['mixer',21,42,1.15],['heater',50,46,1.02],['sensor-temp',73,27,.8],['sensor-hum',86,58,.8]] },
    FILLING: { title: '定量灌装单元', material: '空瓶 + 饮料', output: '灌装完成瓶', route: 'conveyor-route', devices: [['positioner',13,57,.84],['pump',30,24,.82],['filler',50,36,1.1],['flowmeter',71,23,.78],['level-sensor',87,57,.8]] },
    SECONDARY_INSPECTION: { title: '成品二次检测单元', material: '灌装完成瓶', output: '装箱合格瓶', route: 'conveyor-route', special: 'scan', devices: [['camera-side',24,29,.86],['camera-level',48,49,.86],['light-panel',65,23,.86],['reject',84,55,.9]] },
    PACKING: { title: '机械臂自动装箱单元', material: '二检合格瓶 + 纸箱', output: '成品箱', route: 'conveyor-route', special: 'packing', devices: [['robot',31,40,1.22],['gripper',47,17,.7],['camera-top',63,23,.76],['printer',81,32,.86],['counter',83,66,.74]] },
    AGV_TRANSPORT: { title: 'AGV 物流运输单元', material: '已装满成品箱', output: '仓储到货箱', route: 'agv-route', devices: [['agv',30,47,1.2],['ultrasonic',48,45,.74],['odometer',61,68,.7],['load-cell',37,23,.76],['dispatch',83,23,.9]] },
    WAREHOUSE_INBOUND: { title: '智能仓储入库单元', material: 'AGV 到货箱', output: '在库成品', route: 'warehouse-route', special: 'warehouse', devices: [['sensor-voc',17,24,.78],['sensor-smoke',35,24,.78],['location-light',60,31,.74],['rack',81,46,1.14]] }
  };

  function getVisual() {
    return visuals[state.stageCode] || visuals.PRETREATMENT;
  }

  function normalizeState(value) {
    var status = String(value || '').toUpperCase();
    if (status === 'RUNNING') return 'running';
    if (status === 'HOLD' || status === 'WAIT' || status === 'WARNING' || status === 'STANDBY') return 'hold';
    if (status === 'ALARM' || status === 'FAIL' || status === 'FAILED' || status === 'REJECTED') return 'alarm';
    if (status === 'PASS' || status === 'PASSED' || status === 'COMPLETED') return 'passed';
    return 'standby';
  }

  function operationLabel(device) {
    var status = normalizeState(device.state);
    if (status === 'alarm') return '报警停机';
    if (status === 'hold') return '等待联动';
    if (status === 'standby') return '设备待机';
    return '联动动作';
  }

  function savedPositions() {
    try {
      var value = JSON.parse(localStorage.getItem('factory2d.layout.' + state.stageCode) || '[]');
      return Array.isArray(value) ? value : [];
    } catch (_) {
      return [];
    }
  }

  function savePositions(positions) {
    try { localStorage.setItem('factory2d.layout.' + state.stageCode, JSON.stringify(positions)); } catch (_) {}
  }

  function renderHeader() {
    var visual = getVisual();
    document.getElementById('stage-title').textContent = visual.title;
    document.getElementById('stage-subtitle').textContent = state.stageName + ' · 二维工艺布置示意';
    document.getElementById('flow-material').textContent = visual.material;
    document.getElementById('flow-result').textContent = visual.output;
    document.getElementById('flow-input').textContent = visual.material;
    document.getElementById('flow-output').textContent = visual.output;
    document.getElementById('data-source').textContent = state.source || 'LOCAL DEMO';
    document.getElementById('runtime-speed').textContent = state.stageCode === 'AGV_TRANSPORT' ? Number(state.speed || 0).toFixed(2) + ' m/s' : Math.round(Number(state.speed || 0) * 1000) + ' mm/s';
    document.getElementById('runtime-progress').textContent = Math.round(Number(state.progress || 0)) + '%';
    document.getElementById('runtime-status').textContent = state.paused ? '画面与数据同时冻结' : '平面图实时运行';
    var live = document.getElementById('live-state');
    live.classList.toggle('paused', state.paused);
    live.lastChild.nodeValue = state.paused ? '画面已暂停' : '实时联动';
    plan.classList.toggle('paused', state.paused);
    plan.classList.toggle('state-colors', state.statusColors);
    plan.classList.toggle('layout-edit', state.layoutEdit);
    resetLayout.classList.toggle('hidden', !state.layoutEdit);
    canvas.className = 'plan-canvas ' + visual.route;
    specialZone.className = visual.special ? 'special-zone ' + visual.special : 'special-zone hidden';
    var names = (state.devices.length ? state.devices : demoDevices()).map(function (item) { return item.name || item.code; });
    document.getElementById('flow-devices').textContent = names.join(' / ');
    plan.style.setProperty('--motion-speed', Math.max(.55, 1.8 - Math.min(1.2, Number(state.speed || .12))) + 's');
  }

  function demoDevices() {
    return getVisual().devices.map(function (item, index) {
      return { code: state.stageCode + '-' + String(index + 1).padStart(2, '0'), name: '工位设备 ' + (index + 1), state: 'RUNNING', reading: '' };
    });
  }

  function renderDevices() {
    var visual = getVisual();
    var devices = state.devices.length ? state.devices : demoDevices();
    var positions = savedPositions();
    deviceLayer.innerHTML = '';
    devices.forEach(function (device, index) {
      var design = visual.devices[index] || ['plc', 18 + index * 16, 40, .8];
      var position = positions[index] || { x: design[1], y: design[2] };
      var button = document.createElement('button');
      var status = normalizeState(device.state);
      button.type = 'button';
      button.className = 'device-node ' + design[0] + ' ' + status + (status === 'running' ? ' active-device' : '');
      button.style.left = position.x + '%';
      button.style.top = position.y + '%';
      button.style.setProperty('--scale', String(design[3] || 1));
      button.dataset.index = String(index);
      button.innerHTML = '<span class="node-number">' + String(index + 1).padStart(2, '0') + '</span>' +
        '<div class="device-symbol"><i></i><i></i><i></i><i></i><span></span></div>' +
        '<div class="node-copy"><strong>' + escapeHtml(device.name || device.code) + '</strong><small>' + escapeHtml(device.code || '') + '</small><b><i></i>' + operationLabel(device) + '</b></div>';
      button.addEventListener('click', function () {
        if (state.layoutEdit) return;
        showSelection((device.name || device.code) + ' / ' + (device.reading || operationLabel(device)));
        window.location.href = 'factory://device/' + encodeURIComponent(device.code);
      });
      button.addEventListener('pointerdown', beginDrag);
      deviceLayer.appendChild(button);
    });
  }

  var drag = null;
  function beginDrag(event) {
    if (!state.layoutEdit) return;
    event.preventDefault();
    var target = event.currentTarget;
    drag = { target: target, index: Number(target.dataset.index), pointerId: event.pointerId };
    target.classList.add('dragging');
    target.setPointerCapture(event.pointerId);
    target.addEventListener('pointermove', moveDrag);
    target.addEventListener('pointerup', endDrag);
    target.addEventListener('pointercancel', endDrag);
  }

  function moveDrag(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    var rect = canvas.getBoundingClientRect();
    var x = Math.min(94, Math.max(6, (event.clientX - rect.left) / rect.width * 100));
    var y = Math.min(84, Math.max(12, (event.clientY - rect.top) / rect.height * 100));
    drag.target.style.left = x.toFixed(2) + '%';
    drag.target.style.top = y.toFixed(2) + '%';
  }

  function endDrag(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    var positions = savedPositions();
    positions[drag.index] = { x: parseFloat(drag.target.style.left), y: parseFloat(drag.target.style.top) };
    savePositions(positions);
    drag.target.classList.remove('dragging');
    drag.target.removeEventListener('pointermove', moveDrag);
    drag.target.removeEventListener('pointerup', endDrag);
    drag.target.removeEventListener('pointercancel', endDrag);
    drag = null;
  }

  function renderProducts() {
    var products = state.products.length ? state.products : [
      { traceCode: 'DEMO-001', bottleType: 'PLA-500', status: 'RUNNING' },
      { traceCode: 'DEMO-002', bottleType: 'PLA-330', status: 'RUNNING' },
      { traceCode: 'DEMO-003', bottleType: 'PLA-500', status: 'HOLD' }
    ];
    productLayer.innerHTML = '';
    productStrip.innerHTML = '';
    document.getElementById('empty-products').classList.toggle('hidden', products.length > 0);
    products.slice(0, 6).forEach(function (product, index) {
      var status = normalizeState(product.status);
      var progress = (Number(state.progress || 0) / 100 + index / Math.max(6, products.length)) % 1;
      var token = document.createElement('button');
      token.type = 'button';
      token.className = 'material-token ' + status;
      token.style.left = (4 + progress * 92) + '%';
      token.title = product.traceCode || '产品';
      token.innerHTML = '<i></i><span>' + escapeHtml(shortCode(product.traceCode)) + '</span>';
      token.addEventListener('click', function () { selectProduct(product); });
      productLayer.appendChild(token);

      var item = document.createElement('button');
      item.type = 'button';
      item.innerHTML = '<i class="' + status + '"></i><span><b>' + escapeHtml(product.traceCode || 'PRODUCT') + '</b><small>' + escapeHtml((product.bottleType || '待识别') + ' · ' + statusLabel(status)) + '</small></span>';
      item.addEventListener('click', function () { selectProduct(product); });
      productStrip.appendChild(item);
    });
  }

  function selectProduct(product) {
    showSelection((product.traceCode || 'PRODUCT') + ' / ' + (product.bottleType || '待识别') + ' / ' + statusLabel(normalizeState(product.status)));
    if (product.traceCode) window.location.href = 'factory://product/' + encodeURIComponent(product.traceCode);
  }

  function showSelection(text) {
    selection.textContent = text;
    selection.classList.remove('hidden');
  }

  function shortCode(value) {
    var parts = String(value || 'PRODUCT').split('-');
    return parts.length > 2 ? parts.slice(-2).join('-') : String(value || 'PRODUCT');
  }

  function statusLabel(status) {
    if (status === 'running') return '运行中';
    if (status === 'hold') return '待处理';
    if (status === 'alarm') return '异常';
    if (status === 'passed') return '已通过';
    return '待机';
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>'"]/g, function (char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char];
    });
  }

  function normalizePayload(payload) {
    if (typeof payload === 'string') return JSON.parse(payload);
    return payload || {};
  }

  function render() {
    renderHeader();
    renderDevices();
    renderProducts();
  }

  resetLayout.addEventListener('click', function () {
    try { localStorage.removeItem('factory2d.layout.' + state.stageCode); } catch (_) {}
    renderDevices();
  });

  window.FactoryPlan = {
    update: function (payload) {
      try {
        var next = normalizePayload(payload);
        Object.keys(next).forEach(function (key) { state[key] = next[key]; });
        render();
      } catch (_) {
        document.getElementById('runtime-status').textContent = '数据解析失败';
      }
    },
    setPaused: function (paused) { state.paused = Boolean(paused); renderHeader(); },
    setStatusColors: function (enabled) { state.statusColors = Boolean(enabled); renderHeader(); },
    setLayoutEdit: function (enabled) { state.layoutEdit = Boolean(enabled); render(); },
    resetLayout: function () { resetLayout.click(); }
  };

  window.__factoryTest__ = {
    mode: 'FLOOR_PLAN_2D',
    ready: function () { return Boolean(plan && canvas); },
    stateVersion: function () { return state.stateVersion || 'UNKNOWN'; },
    deviceCount: function () { return state.devices.length; },
    productCount: function () { return state.products.length; },
    paused: function () { return Boolean(state.paused); }
  };

  render();
}());
