/**
 * tests/test_projects.js - 项目库模块测试
 * 运行方式：node tests/test_projects.js
 */

var assert = require('assert');
var Storage = require('../js/storage.js');
var Calc = require('../js/calc.js');

var passed = 0;
var failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log('  ✓ ' + name);
    passed++;
  } catch (e) {
    console.log('  ✗ ' + name);
    console.log('    ' + e.message);
    failed++;
  }
}

function createMockBackend() {
  var mem = {};
  return {
    getItem: function (k) { return mem[k] !== undefined ? mem[k] : null; },
    setItem: function (k, v) { mem[k] = v; },
    removeItem: function (k) { delete mem[k]; }
  };
}

console.log('\n=== 项目库模块测试 ===\n');

// --- 默认项目 ---
test('默认: 初始化项目库为空', function () {
  var store = Storage.createStore(createMockBackend());
  var projects = store.getProjects();
  assert.strictEqual(projects.length, 0);
});

// --- 新增项目 ---
test('新增: 项目名称、售价、成本正确保存', function () {
  var store = Storage.createStore(createMockBackend());
  var p = store.addProject('条幅制作', 28, 10);
  assert.strictEqual(p.name, '条幅制作');
  assert.strictEqual(p.price, 28);
  assert.strictEqual(p.cost, 10);
  assert.strictEqual(store.getProjects().length, 1);
});

test('新增: 售价和成本默认为0', function () {
  var store = Storage.createStore(createMockBackend());
  var p = store.addProject('测试项目');
  assert.strictEqual(p.price, 0);
  assert.strictEqual(p.cost, 0);
});

test('新增: 字符串数字转为数值', function () {
  var store = Storage.createStore(createMockBackend());
  var p = store.addProject('字符串项目', '25.5', '10.2');
  assert.strictEqual(p.price, 25.5);
  assert.strictEqual(p.cost, 10.2);
});

// --- 重名检查逻辑 ---
test('重名: 同名项目不应重复添加', function () {
  var store = Storage.createStore(createMockBackend());
  // 模拟UI层的重名检查
  function addProjectWithCheck(name, price, cost) {
    if (store.getProjectByName(name)) return null;
    return store.addProject(name, price, cost);
  }
  var p1 = addProjectWithCheck('条幅', 28, 10);
  var p2 = addProjectWithCheck('条幅', 30, 12);
  assert.ok(p1);
  assert.strictEqual(p2, null);
  assert.strictEqual(store.getProjects().length, 1); // 只有条幅
});

// --- 修改项目 ---
test('修改: 更新售价', function () {
  var store = Storage.createStore(createMockBackend());
  var p = store.addProject('条幅', 28, 10);
  store.updateProject(p.id, { price: 30 });
  assert.strictEqual(store.getProjectById(p.id).price, 30);
  assert.strictEqual(store.getProjectById(p.id).cost, 10); // 成本不变
});

test('修改: 更新成本', function () {
  var store = Storage.createStore(createMockBackend());
  var p = store.addProject('条幅', 28, 10);
  store.updateProject(p.id, { cost: 12 });
  assert.strictEqual(store.getProjectById(p.id).cost, 12);
  assert.strictEqual(store.getProjectById(p.id).price, 28); // 售价不变
});

test('修改: 同时更新售价和成本', function () {
  var store = Storage.createStore(createMockBackend());
  var p = store.addProject('条幅', 28, 10);
  store.updateProject(p.id, { price: 35, cost: 15 });
  var updated = store.getProjectById(p.id);
  assert.strictEqual(updated.price, 35);
  assert.strictEqual(updated.cost, 15);
});

test('修改: 无效价格不更新（UI层验证逻辑）', function () {
  var store = Storage.createStore(createMockBackend());
  var p = store.addProject('条幅', 28, 10);
  // 模拟UI层验证
  function validatePrice(val) {
    var n = parseFloat(val);
    return !isNaN(n) && n >= 0 ? n : null;
  }
  assert.strictEqual(validatePrice('abc'), null);
  assert.strictEqual(validatePrice('-5'), null);
  assert.strictEqual(validatePrice('30.5'), 30.5);
});

// --- 删除项目 ---
test('删除: 普通项目可删除', function () {
  var store = Storage.createStore(createMockBackend());
  var p = store.addProject('条幅', 28, 10);
  assert.strictEqual(store.getProjects().length, 1);
  var result = store.deleteProject(p.id);
  assert.strictEqual(result, true);
  assert.strictEqual(store.getProjects().length, 0);
});

test('删除: 所有项目均可删除（含设计费用）', function () {
  var store = Storage.createStore(createMockBackend());
  var design = store.addProject('设计费用', 50, 20);
  assert.strictEqual(store.getProjects().length, 1);
  var result = store.deleteProject(design.id);
  assert.strictEqual(result, true);
  assert.strictEqual(store.getProjects().length, 0);
});

test('删除: 不存在的项目返回false', function () {
  var store = Storage.createStore(createMockBackend());
  assert.strictEqual(store.deleteProject('not_exist'), false);
});

// --- 查找项目 ---
test('查找: 按ID查找', function () {
  var store = Storage.createStore(createMockBackend());
  var p = store.addProject('条幅', 28, 10);
  assert.strictEqual(store.getProjectById(p.id).name, '条幅');
  assert.strictEqual(store.getProjectById('not_exist'), null);
});

test('查找: 按名称查找', function () {
  var store = Storage.createStore(createMockBackend());
  store.addProject('条幅', 28, 10);
  assert.strictEqual(store.getProjectByName('条幅').price, 28);
  assert.strictEqual(store.getProjectByName('不存在'), null);
});

// --- 成本与利润联动 ---
test('联动: 修改成本后利润重新计算', function () {
  var store = Storage.createStore(createMockBackend());
  var p = store.addProject('条幅', 28, 10);
  var projects = store.getProjects();

  var bill = {
    total: 84,
    items: [{ project: '条幅', qty: 3, total: 84 }]
  };

  // 初始成本 3*10=30, 利润 84-30=54
  assert.strictEqual(Calc.calcBillProfit(bill, projects), 54);

  // 修改成本为15
  store.updateProject(p.id, { cost: 15 });
  projects = store.getProjects();
  // 新成本 3*15=45, 利润 84-45=39
  assert.strictEqual(Calc.calcBillProfit(bill, projects), 39);
});

test('联动: 设计费用折扣与成本独立计算', function () {
  var store = Storage.createStore(createMockBackend());
  var design = store.addProject('设计费用', 50, 20, 0.9, 0.7, 0.5);
  var projects = store.getProjects();

  // 高级VIP设计费5折=25，成本仍为20
  var vipPrice = Calc.getUnitPrice(design, 'vip3');
  assert.strictEqual(vipPrice, 25);

  var bill = {
    total: 25,
    items: [{ project: '设计费用', qty: 1, total: 25 }]
  };
  // 利润 = 25 - 1*20 = 5
  assert.strictEqual(Calc.calcBillProfit(bill, projects), 5);
});

// --- 数据完整性 ---
test('完整性: 项目ID唯一', function () {
  var store = Storage.createStore(createMockBackend());
  var ids = {};
  for (var i = 0; i < 15; i++) {
    var p = store.addProject('项目' + i, i, i * 0.5);
    assert.ok(!ids[p.id], 'ID重复');
    ids[p.id] = true;
  }
});

test('完整性: 项目字段完整', function () {
  var store = Storage.createStore(createMockBackend());
  var p = store.addProject('完整项目', 99.99, 50.5);
  assert.ok(p.id);
  assert.strictEqual(p.name, '完整项目');
  assert.strictEqual(p.price, 99.99);
  assert.strictEqual(p.cost, 50.5);
});

console.log('\n=== 测试结果 ===');
console.log('通过: ' + passed + ', 失败: ' + failed);
if (failed > 0) {
  process.exit(1);
}
console.log('全部通过!\n');
