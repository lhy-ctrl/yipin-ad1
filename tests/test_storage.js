/**
 * tests/test_storage.js - 数据存储层单元测试
 * 运行方式：node tests/test_storage.js
 */

var assert = require('assert');
var Storage = require('../js/storage.js');

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
    console.log('    ' + e.stack.split('\n')[1]);
    failed++;
  }
}

// 创建内存存储后端
function createMockBackend() {
  var mem = {};
  return {
    getItem: function (k) { return mem[k] !== undefined ? mem[k] : null; },
    setItem: function (k, v) { mem[k] = v; },
    removeItem: function (k) { delete mem[k]; }
  };
}

console.log('\n=== storage.js 数据存储层测试 ===\n');

// --- 初始化与默认数据 ---
test('初始化: 项目库默认为空', function () {
  var store = Storage.createStore(createMockBackend());
  var projects = store.getProjects();
  assert.strictEqual(projects.length, 0);
});

test('初始化: 客户列表默认为空', function () {
  var store = Storage.createStore(createMockBackend());
  assert.deepStrictEqual(store.getCustomers(), []);
});

test('初始化: 账单列表默认为空', function () {
  var store = Storage.createStore(createMockBackend());
  assert.deepStrictEqual(store.getBills(), []);
});

// --- 项目CRUD ---
test('项目: 新增项目', function () {
  var store = Storage.createStore(createMockBackend());
  var proj = store.addProject('条幅制作', 28, 10);
  assert.strictEqual(proj.name, '条幅制作');
  assert.strictEqual(proj.price, 28);
  assert.strictEqual(proj.cost, 10);
  assert.strictEqual(store.getProjects().length, 1);
});

test('项目: 更新项目价格和成本', function () {
  var store = Storage.createStore(createMockBackend());
  var proj = store.addProject('条幅', 28, 10);
  var updated = store.updateProject(proj.id, { price: 30, cost: 12 });
  assert.strictEqual(updated.price, 30);
  assert.strictEqual(updated.cost, 12);
});

test('项目: 删除项目', function () {
  var store = Storage.createStore(createMockBackend());
  var proj = store.addProject('条幅', 28, 10);
  assert.strictEqual(store.getProjects().length, 1);
  var result = store.deleteProject(proj.id);
  assert.strictEqual(result, true);
  assert.strictEqual(store.getProjects().length, 0);
});

test('项目: 所有项目均可删除', function () {
  var store = Storage.createStore(createMockBackend());
  var design = store.addProject('设计费用', 50, 20);
  assert.strictEqual(store.getProjects().length, 1);
  var result = store.deleteProject(design.id);
  assert.strictEqual(result, true);
  assert.strictEqual(store.getProjects().length, 0);
});

test('项目: 按名称查找', function () {
  var store = Storage.createStore(createMockBackend());
  store.addProject('设计费用', 50, 20);
  var proj = store.getProjectByName('设计费用');
  assert.strictEqual(proj.price, 50);
  assert.strictEqual(store.getProjectByName('不存在'), null);
});

// --- 客户CRUD ---
test('客户: 新增客户', function () {
  var store = Storage.createStore(createMockBackend());
  var cust = store.addCustomer({
    name: '爱肌色',
    contact: '张总',
    phone: '13800138000',
    vipType: 'vip1'
  });
  assert.strictEqual(cust.name, '爱肌色');
  assert.strictEqual(cust.vipType, 'vip1');
  assert.strictEqual(store.getCustomers().length, 1);
});

test('客户: 默认VIP类型为normal', function () {
  var store = Storage.createStore(createMockBackend());
  var cust = store.addCustomer({ name: '测试客户' });
  assert.strictEqual(cust.vipType, 'normal');
});

test('客户: 更新客户信息', function () {
  var store = Storage.createStore(createMockBackend());
  var cust = store.addCustomer({ name: '旧名', vipType: 'normal' });
  var updated = store.updateCustomer(cust.id, { name: '新名', vipType: 'vip3' });
  assert.strictEqual(updated.name, '新名');
  assert.strictEqual(updated.vipType, 'vip3');
});

test('客户: 删除客户同时删除其账单', function () {
  var store = Storage.createStore(createMockBackend());
  var cust = store.addCustomer({ name: '待删客户' });
  store.addBill({ customerId: cust.id, total: 100, items: [] });
  store.addBill({ customerId: cust.id, total: 200, items: [] });
  assert.strictEqual(store.getBills().length, 2);
  store.deleteCustomer(cust.id);
  assert.strictEqual(store.getCustomers().length, 0);
  assert.strictEqual(store.getBills().length, 0);
});

test('客户: 按ID查找', function () {
  var store = Storage.createStore(createMockBackend());
  var cust = store.addCustomer({ name: '查找测试' });
  assert.strictEqual(store.getCustomerById(cust.id).name, '查找测试');
  assert.strictEqual(store.getCustomerById('不存在'), null);
});

// --- 账单CRUD ---
test('账单: 新增账单', function () {
  var store = Storage.createStore(createMockBackend());
  var cust = store.addCustomer({ name: '账单客户' });
  var bill = store.addBill({
    customerId: cust.id,
    date: '2026-08-18',
    status: 'unpaid',
    items: [{ content: '测试', qty: 2, price: 25, total: 50 }],
    total: 50
  });
  assert.strictEqual(bill.customerId, cust.id);
  assert.strictEqual(bill.total, 50);
  assert.strictEqual(bill.status, 'unpaid');
  assert.strictEqual(store.getBills().length, 1);
});

test('账单: 默认状态为未结', function () {
  var store = Storage.createStore(createMockBackend());
  var bill = store.addBill({ customerId: 'c1', total: 100 });
  assert.strictEqual(bill.status, 'unpaid');
});

test('账单: 更新账单状态为已结', function () {
  var store = Storage.createStore(createMockBackend());
  var bill = store.addBill({ customerId: 'c1', total: 100 });
  var updated = store.updateBill(bill.id, { status: 'paid' });
  assert.strictEqual(updated.status, 'paid');
});

test('账单: 删除账单', function () {
  var store = Storage.createStore(createMockBackend());
  var bill = store.addBill({ customerId: 'c1', total: 100 });
  assert.strictEqual(store.getBills().length, 1);
  store.deleteBill(bill.id);
  assert.strictEqual(store.getBills().length, 0);
});

test('账单: 按客户筛选', function () {
  var store = Storage.createStore(createMockBackend());
  var c1 = store.addCustomer({ name: '客户A' });
  var c2 = store.addCustomer({ name: '客户B' });
  store.addBill({ customerId: c1.id, total: 100 });
  store.addBill({ customerId: c1.id, total: 200 });
  store.addBill({ customerId: c2.id, total: 300 });
  assert.strictEqual(store.getBillsByCustomer(c1.id).length, 2);
  assert.strictEqual(store.getBillsByCustomer(c2.id).length, 1);
});

// --- 客户统计 ---
test('统计: 客户累计消费', function () {
  var store = Storage.createStore(createMockBackend());
  var cust = store.addCustomer({ name: '统计客户' });
  store.addBill({ customerId: cust.id, total: 100 });
  store.addBill({ customerId: cust.id, total: 250.5 });
  assert.strictEqual(store.getCustomerTotalSpent(cust.id), 350.5);
});

test('统计: 客户未结账单数量', function () {
  var store = Storage.createStore(createMockBackend());
  var cust = store.addCustomer({ name: '未结客户' });
  var b1 = store.addBill({ customerId: cust.id, total: 100, status: 'unpaid' });
  store.addBill({ customerId: cust.id, total: 200, status: 'paid' });
  store.addBill({ customerId: cust.id, total: 300, status: 'unpaid' });
  assert.strictEqual(store.getCustomerUnpaidCount(cust.id), 2);
});

test('统计: 客户未结金额', function () {
  var store = Storage.createStore(createMockBackend());
  var cust = store.addCustomer({ name: '未结金额' });
  store.addBill({ customerId: cust.id, total: 100, status: 'unpaid' });
  store.addBill({ customerId: cust.id, total: 200, status: 'paid' });
  store.addBill({ customerId: cust.id, total: 300, status: 'unpaid' });
  assert.strictEqual(store.getCustomerUnpaidAmount(cust.id), 400);
});

test('统计: 无账单客户累计消费为0', function () {
  var store = Storage.createStore(createMockBackend());
  var cust = store.addCustomer({ name: '空客户' });
  assert.strictEqual(store.getCustomerTotalSpent(cust.id), 0);
  assert.strictEqual(store.getCustomerUnpaidCount(cust.id), 0);
});

// --- 全量导入导出 ---
test('全量: 导出所有数据', function () {
  var store = Storage.createStore(createMockBackend());
  store.addCustomer({ name: '导出客户' });
  store.addProject('条幅', 28, 10);
  var data = store.exportAll();
  assert.strictEqual(data.customers.length, 1);
  assert.strictEqual(data.projects.length, 1);
  assert.ok(data.exportedAt);
});

test('全量: 导入数据覆盖', function () {
  var store = Storage.createStore(createMockBackend());
  var importData = {
    customers: [{ id: 'c1', name: '导入客户', vipType: 'vip2' }],
    bills: [{ id: 'b1', customerId: 'c1', total: 999, status: 'paid' }],
    projects: [{ id: 'p1', name: '导入项目', price: 10, cost: 5 }]
  };
  store.importAll(importData);
  assert.strictEqual(store.getCustomers().length, 1);
  assert.strictEqual(store.getCustomers()[0].name, '导入客户');
  assert.strictEqual(store.getBills()[0].total, 999);
  assert.strictEqual(store.getProjects()[0].name, '导入项目');
});

test('全量: 清空所有数据', function () {
  var store = Storage.createStore(createMockBackend());
  store.addCustomer({ name: '清空测试' });
  store.clearAll();
  assert.strictEqual(store.getCustomers().length, 0);
  assert.strictEqual(store.getProjects().length, 0);
});

// --- 数据持久化 ---
test('持久化: 同一后端多次创建store数据一致', function () {
  var backend = createMockBackend();
  var store1 = Storage.createStore(backend);
  store1.addCustomer({ name: '持久化客户' });
  var store2 = Storage.createStore(backend);
  assert.strictEqual(store2.getCustomers().length, 1);
  assert.strictEqual(store2.getCustomers()[0].name, '持久化客户');
});

console.log('\n=== 测试结果 ===');
console.log('通过: ' + passed + ', 失败: ' + failed);
if (failed > 0) {
  process.exit(1);
}
console.log('全部通过!\n');
