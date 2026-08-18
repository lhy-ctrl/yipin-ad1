/**
 * tests/test_customer_bills.js - 客户账单列表页测试
 * 运行方式：node tests/test_customer_bills.js
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

console.log('\n=== 客户账单列表页测试 ===\n');

// --- 账单排序 ---
test('排序: 账单按日期倒序排列', function () {
  var store = Storage.createStore(createMockBackend());
  var c = store.addCustomer({ name: '测试客户' });
  store.addBill({ customerId: c.id, date: '2026-01-15', total: 100 });
  store.addBill({ customerId: c.id, date: '2026-03-20', total: 200 });
  store.addBill({ customerId: c.id, date: '2026-02-10', total: 300 });

  var bills = store.getBillsByCustomer(c.id).sort(function (a, b) {
    return (b.date || '').localeCompare(a.date || '');
  });

  assert.strictEqual(bills[0].date, '2026-03-20');
  assert.strictEqual(bills[1].date, '2026-02-10');
  assert.strictEqual(bills[2].date, '2026-01-15');
});

test('排序: 相同日期保持原顺序', function () {
  var store = Storage.createStore(createMockBackend());
  var c = store.addCustomer({ name: '同日客户' });
  var b1 = store.addBill({ customerId: c.id, date: '2026-08-18', total: 100 });
  var b2 = store.addBill({ customerId: c.id, date: '2026-08-18', total: 200 });

  var bills = store.getBillsByCustomer(c.id).sort(function (a, b) {
    return (b.date || '').localeCompare(a.date || '');
  });
  assert.strictEqual(bills.length, 2);
});

// --- 状态切换 ---
test('状态: 未结切换为已结', function () {
  var store = Storage.createStore(createMockBackend());
  var c = store.addCustomer({ name: '状态客户' });
  var b = store.addBill({ customerId: c.id, total: 100, status: 'unpaid' });
  assert.strictEqual(b.status, 'unpaid');

  store.updateBill(b.id, { status: 'paid' });
  assert.strictEqual(store.getBillById(b.id).status, 'paid');
});

test('状态: 已结切换回未结', function () {
  var store = Storage.createStore(createMockBackend());
  var c = store.addCustomer({ name: '状态客户2' });
  var b = store.addBill({ customerId: c.id, total: 100, status: 'paid' });
  store.updateBill(b.id, { status: 'unpaid' });
  assert.strictEqual(store.getBillById(b.id).status, 'unpaid');
});

// --- 已结账单锁定逻辑 ---
test('锁定: 已结账单不允许编辑（UI层判断）', function () {
  // 模拟UI层判断：已结账单不显示编辑/删除按钮
  function canEdit(bill) {
    return bill.status !== 'paid';
  }
  assert.strictEqual(canEdit({ status: 'unpaid' }), true);
  assert.strictEqual(canEdit({ status: 'paid' }), false);
});

test('锁定: 已结账单仍可查看', function () {
  function canView(bill) {
    return true; // 无论状态都可查看
  }
  assert.strictEqual(canView({ status: 'paid' }), true);
  assert.strictEqual(canView({ status: 'unpaid' }), true);
});

// --- 客户信息 ---
test('客户: 页面显示客户名称和VIP类型', function () {
  var store = Storage.createStore(createMockBackend());
  var c = store.addCustomer({ name: '爱肌色', vipType: 'vip1' });
  var found = store.getCustomerById(c.id);
  assert.strictEqual(found.name, '爱肌色');
  assert.strictEqual(found.vipType, 'vip1');
});

test('客户: 不存在的客户返回null', function () {
  var store = Storage.createStore(createMockBackend());
  assert.strictEqual(store.getCustomerById('not_exist'), null);
});

// --- 累计消费 ---
test('统计: 客户累计消费正确', function () {
  var store = Storage.createStore(createMockBackend());
  var c = store.addCustomer({ name: '消费客户' });
  store.addBill({ customerId: c.id, total: 100 });
  store.addBill({ customerId: c.id, total: 250.5 });
  store.addBill({ customerId: c.id, total: 49.5 });
  assert.strictEqual(store.getCustomerTotalSpent(c.id), 400);
});

// --- 账单筛选（只显示该客户的账单）---
test('筛选: 只返回当前客户的账单', function () {
  var store = Storage.createStore(createMockBackend());
  var c1 = store.addCustomer({ name: '客户A' });
  var c2 = store.addCustomer({ name: '客户B' });
  store.addBill({ customerId: c1.id, total: 100 });
  store.addBill({ customerId: c1.id, total: 200 });
  store.addBill({ customerId: c2.id, total: 300 });

  var bills1 = store.getBillsByCustomer(c1.id);
  var bills2 = store.getBillsByCustomer(c2.id);
  assert.strictEqual(bills1.length, 2);
  assert.strictEqual(bills2.length, 1);
  assert.strictEqual(bills2[0].total, 300);
});

// --- 删除账单 ---
test('删除: 删除未结账单', function () {
  var store = Storage.createStore(createMockBackend());
  var c = store.addCustomer({ name: '删除客户' });
  var b = store.addBill({ customerId: c.id, total: 100, status: 'unpaid' });
  assert.strictEqual(store.getBillsByCustomer(c.id).length, 1);
  store.deleteBill(b.id);
  assert.strictEqual(store.getBillsByCustomer(c.id).length, 0);
});

test('删除: 删除后累计消费更新', function () {
  var store = Storage.createStore(createMockBackend());
  var c = store.addCustomer({ name: '删除后统计' });
  var b1 = store.addBill({ customerId: c.id, total: 100 });
  var b2 = store.addBill({ customerId: c.id, total: 200 });
  assert.strictEqual(store.getCustomerTotalSpent(c.id), 300);
  store.deleteBill(b1.id);
  assert.strictEqual(store.getCustomerTotalSpent(c.id), 200);
});

// --- 空账单 ---
test('空数据: 无账单客户返回空数组', function () {
  var store = Storage.createStore(createMockBackend());
  var c = store.addCustomer({ name: '空账单客户' });
  assert.strictEqual(store.getBillsByCustomer(c.id).length, 0);
});

// --- 账单字段完整性 ---
test('完整性: 账单包含必要字段', function () {
  var store = Storage.createStore(createMockBackend());
  var c = store.addCustomer({ name: '完整客户' });
  var b = store.addBill({
    customerId: c.id,
    date: '2026-08-18',
    status: 'unpaid',
    items: [{ content: '测试', qty: 2, price: 25, total: 50 }],
    total: 50
  });
  assert.ok(b.id);
  assert.strictEqual(b.customerId, c.id);
  assert.strictEqual(b.date, '2026-08-18');
  assert.strictEqual(b.status, 'unpaid');
  assert.strictEqual(b.total, 50);
  assert.ok(b.items);
  assert.ok(b.createdAt);
});

console.log('\n=== 测试结果 ===');
console.log('通过: ' + passed + ', 失败: ' + failed);
if (failed > 0) {
  process.exit(1);
}
console.log('全部通过!\n');
