/**
 * tests/test_home.js - 主页客户列表测试
 * 运行方式：node tests/test_home.js
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

// 模拟主页的筛选和排序逻辑
function getHomeCustomers(store, keyword, filter) {
  var customers = store.getCustomers().map(function (c) {
    c._total = store.getCustomerTotalSpent(c.id);
    c._unpaidCount = store.getCustomerUnpaidCount(c.id);
    c._unpaidAmount = store.getCustomerUnpaidAmount(c.id);
    return c;
  }).sort(function (a, b) {
    return b._total - a._total;
  });

  keyword = (keyword || '').trim().toLowerCase();
  return customers.filter(function (c) {
    if (keyword && c.name.toLowerCase().indexOf(keyword) === -1) return false;
    if (filter === 'unpaid' && c._unpaidCount === 0) return false;
    if (filter === 'paid' && c._unpaidCount > 0) return false;
    return true;
  });
}

console.log('\n=== 主页客户列表测试 ===\n');

// --- 排序 ---
test('排序: 按累计消费降序', function () {
  var store = Storage.createStore(createMockBackend());
  var c1 = store.addCustomer({ name: 'A客户' });
  var c2 = store.addCustomer({ name: 'B客户' });
  var c3 = store.addCustomer({ name: 'C客户' });
  store.addBill({ customerId: c1.id, total: 100 });
  store.addBill({ customerId: c2.id, total: 500 });
  store.addBill({ customerId: c3.id, total: 300 });

  var list = getHomeCustomers(store, '', 'all');
  assert.strictEqual(list[0].name, 'B客户');
  assert.strictEqual(list[1].name, 'C客户');
  assert.strictEqual(list[2].name, 'A客户');
});

test('排序: 相同消费保持稳定', function () {
  var store = Storage.createStore(createMockBackend());
  var c1 = store.addCustomer({ name: 'A客户' });
  var c2 = store.addCustomer({ name: 'B客户' });
  store.addBill({ customerId: c1.id, total: 200 });
  store.addBill({ customerId: c2.id, total: 200 });

  var list = getHomeCustomers(store, '', 'all');
  assert.strictEqual(list.length, 2);
  assert.strictEqual(list[0]._total, 200);
  assert.strictEqual(list[1]._total, 200);
});

// --- 搜索 ---
test('搜索: 按名称关键词过滤', function () {
  var store = Storage.createStore(createMockBackend());
  store.addCustomer({ name: '爱肌色' });
  store.addCustomer({ name: '澜琦' });
  store.addCustomer({ name: '爱某某' });

  var list = getHomeCustomers(store, '爱', 'all');
  assert.strictEqual(list.length, 2);
});

test('搜索: 不区分大小写', function () {
  var store = Storage.createStore(createMockBackend());
  store.addCustomer({ name: 'ABC公司' });
  store.addCustomer({ name: 'xyz公司' });

  var list = getHomeCustomers(store, 'abc', 'all');
  assert.strictEqual(list.length, 1);
  assert.strictEqual(list[0].name, 'ABC公司');
});

test('搜索: 无匹配返回空', function () {
  var store = Storage.createStore(createMockBackend());
  store.addCustomer({ name: '爱肌色' });
  var list = getHomeCustomers(store, '不存在', 'all');
  assert.strictEqual(list.length, 0);
});

test('搜索: 空关键词返回全部', function () {
  var store = Storage.createStore(createMockBackend());
  store.addCustomer({ name: 'A' });
  store.addCustomer({ name: 'B' });
  var list = getHomeCustomers(store, '', 'all');
  assert.strictEqual(list.length, 2);
});

// --- 筛选 ---
test('筛选: 有未结账单的客户', function () {
  var store = Storage.createStore(createMockBackend());
  var c1 = store.addCustomer({ name: '未结客户' });
  var c2 = store.addCustomer({ name: '已结客户' });
  store.addBill({ customerId: c1.id, total: 100, status: 'unpaid' });
  store.addBill({ customerId: c2.id, total: 200, status: 'paid' });

  var list = getHomeCustomers(store, '', 'unpaid');
  assert.strictEqual(list.length, 1);
  assert.strictEqual(list[0].name, '未结客户');
});

test('筛选: 已结清客户', function () {
  var store = Storage.createStore(createMockBackend());
  var c1 = store.addCustomer({ name: '未结客户' });
  var c2 = store.addCustomer({ name: '已结客户' });
  store.addBill({ customerId: c1.id, total: 100, status: 'unpaid' });
  store.addBill({ customerId: c2.id, total: 200, status: 'paid' });

  var list = getHomeCustomers(store, '', 'paid');
  assert.strictEqual(list.length, 1);
  assert.strictEqual(list[0].name, '已结客户');
});

test('筛选: 全部客户', function () {
  var store = Storage.createStore(createMockBackend());
  var c1 = store.addCustomer({ name: '未结' });
  var c2 = store.addCustomer({ name: '已结' });
  store.addBill({ customerId: c1.id, total: 100, status: 'unpaid' });
  store.addBill({ customerId: c2.id, total: 200, status: 'paid' });

  var list = getHomeCustomers(store, '', 'all');
  assert.strictEqual(list.length, 2);
});

// --- 统计信息 ---
test('统计: 客户卡片附加累计消费', function () {
  var store = Storage.createStore(createMockBackend());
  var c = store.addCustomer({ name: '统计客户' });
  store.addBill({ customerId: c.id, total: 150 });
  store.addBill({ customerId: c.id, total: 250 });

  var list = getHomeCustomers(store, '', 'all');
  assert.strictEqual(list[0]._total, 400);
});

test('统计: 客户卡片附加未结数量和金额', function () {
  var store = Storage.createStore(createMockBackend());
  var c = store.addCustomer({ name: '未结统计' });
  store.addBill({ customerId: c.id, total: 100, status: 'unpaid' });
  store.addBill({ customerId: c.id, total: 200, status: 'unpaid' });
  store.addBill({ customerId: c.id, total: 300, status: 'paid' });

  var list = getHomeCustomers(store, '', 'all');
  assert.strictEqual(list[0]._unpaidCount, 2);
  assert.strictEqual(list[0]._unpaidAmount, 300);
});

test('统计: 已结清客户未结数量为0', function () {
  var store = Storage.createStore(createMockBackend());
  var c = store.addCustomer({ name: '已结清' });
  store.addBill({ customerId: c.id, total: 100, status: 'paid' });

  var list = getHomeCustomers(store, '', 'all');
  assert.strictEqual(list[0]._unpaidCount, 0);
  assert.strictEqual(list[0]._unpaidAmount, 0);
});

// --- 搜索+筛选组合 ---
test('组合: 搜索关键词与筛选同时生效', function () {
  var store = Storage.createStore(createMockBackend());
  var c1 = store.addCustomer({ name: '爱肌色' });
  var c2 = store.addCustomer({ name: '爱某某' });
  var c3 = store.addCustomer({ name: '其他' });
  store.addBill({ customerId: c1.id, total: 100, status: 'unpaid' });
  store.addBill({ customerId: c2.id, total: 200, status: 'paid' });
  store.addBill({ customerId: c3.id, total: 300, status: 'unpaid' });

  // 搜索"爱" + 筛选未结 → 只有爱肌色
  var list = getHomeCustomers(store, '爱', 'unpaid');
  assert.strictEqual(list.length, 1);
  assert.strictEqual(list[0].name, '爱肌色');
});

// --- 空数据 ---
test('空数据: 无客户时返回空数组', function () {
  var store = Storage.createStore(createMockBackend());
  var list = getHomeCustomers(store, '', 'all');
  assert.strictEqual(list.length, 0);
});

console.log('\n=== 测试结果 ===');
console.log('通过: ' + passed + ', 失败: ' + failed);
if (failed > 0) {
  process.exit(1);
}
console.log('全部通过!\n');
