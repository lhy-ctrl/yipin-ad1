/**
 * tests/test_customers.js - 客户管理模块测试
 * 运行方式：node tests/test_customers.js
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

console.log('\n=== 客户管理模块测试 ===\n');

// --- 客户排序（按累计消费降序）---
test('客户排序: 按累计消费金额降序排列', function () {
  var store = Storage.createStore(createMockBackend());
  var c1 = store.addCustomer({ name: '消费低' });
  var c2 = store.addCustomer({ name: '消费中' });
  var c3 = store.addCustomer({ name: '消费高' });

  store.addBill({ customerId: c1.id, total: 100 });
  store.addBill({ customerId: c2.id, total: 500 });
  store.addBill({ customerId: c3.id, total: 1000 });

  var customers = store.getCustomers().map(function (c) {
    c._total = store.getCustomerTotalSpent(c.id);
    return c;
  }).sort(function (a, b) { return b._total - a._total; });

  assert.strictEqual(customers[0].name, '消费高');
  assert.strictEqual(customers[1].name, '消费中');
  assert.strictEqual(customers[2].name, '消费低');
});

test('客户排序: 无账单客户排最后', function () {
  var store = Storage.createStore(createMockBackend());
  var c1 = store.addCustomer({ name: '有账单' });
  var c2 = store.addCustomer({ name: '无账单' });
  store.addBill({ customerId: c1.id, total: 300 });

  var customers = store.getCustomers().map(function (c) {
    c._total = store.getCustomerTotalSpent(c.id);
    return c;
  }).sort(function (a, b) { return b._total - a._total; });

  assert.strictEqual(customers[0].name, '有账单');
  assert.strictEqual(customers[1].name, '无账单');
  assert.strictEqual(customers[1]._total, 0);
});

// --- VIP类型 ---
test('VIP: 新增客户默认普通客户', function () {
  var store = Storage.createStore(createMockBackend());
  var c = store.addCustomer({ name: '默认VIP' });
  assert.strictEqual(c.vipType, 'normal');
});

test('VIP: 四种VIP类型均可设置', function () {
  var store = Storage.createStore(createMockBackend());
  var types = ['normal', 'vip1', 'vip2', 'vip3'];
  types.forEach(function (t) {
    var c = store.addCustomer({ name: '客户' + t, vipType: t });
    assert.strictEqual(c.vipType, t);
  });
});

test('VIP: 更新客户VIP类型', function () {
  var store = Storage.createStore(createMockBackend());
  var c = store.addCustomer({ name: '升级客户', vipType: 'normal' });
  store.updateCustomer(c.id, { vipType: 'vip3' });
  assert.strictEqual(store.getCustomerById(c.id).vipType, 'vip3');
});

// --- 客户表单验证逻辑 ---
test('表单验证: 客户名称不能为空', function () {
  // 模拟表单验证逻辑
  function validateCustomerForm(name) {
    if (!name || !name.trim()) return '请输入客户名称';
    return null;
  }
  assert.strictEqual(validateCustomerForm(''), '请输入客户名称');
  assert.strictEqual(validateCustomerForm('   '), '请输入客户名称');
  assert.strictEqual(validateCustomerForm('爱肌色'), null);
});

test('表单验证: 客户名称去除首尾空格', function () {
  function sanitizeName(name) {
    return (name || '').trim();
  }
  assert.strictEqual(sanitizeName('  爱肌色  '), '爱肌色');
  assert.strictEqual(sanitizeName('爱肌色'), '爱肌色');
});

// --- 客户CRUD联动 ---
test('CRUD: 新增客户后列表包含该客户', function () {
  var store = Storage.createStore(createMockBackend());
  assert.strictEqual(store.getCustomers().length, 0);
  store.addCustomer({ name: '新增测试', contact: '张三', phone: '123' });
  assert.strictEqual(store.getCustomers().length, 1);
  assert.strictEqual(store.getCustomers()[0].name, '新增测试');
});

test('CRUD: 编辑客户后信息更新', function () {
  var store = Storage.createStore(createMockBackend());
  var c = store.addCustomer({ name: '旧名', contact: '旧联系人', phone: '111' });
  store.updateCustomer(c.id, { name: '新名', contact: '新联系人', phone: '222' });
  var updated = store.getCustomerById(c.id);
  assert.strictEqual(updated.name, '新名');
  assert.strictEqual(updated.contact, '新联系人');
  assert.strictEqual(updated.phone, '222');
});

test('CRUD: 删除客户后列表移除', function () {
  var store = Storage.createStore(createMockBackend());
  var c = store.addCustomer({ name: '待删除' });
  assert.strictEqual(store.getCustomers().length, 1);
  store.deleteCustomer(c.id);
  assert.strictEqual(store.getCustomers().length, 0);
});

test('CRUD: 删除不存在的客户返回false', function () {
  var store = Storage.createStore(createMockBackend());
  assert.strictEqual(store.deleteCustomer('not_exist'), false);
});

// --- 删除客户级联删除账单 ---
test('级联: 删除客户同时删除其所有账单', function () {
  var store = Storage.createStore(createMockBackend());
  var c1 = store.addCustomer({ name: '客户A' });
  var c2 = store.addCustomer({ name: '客户B' });
  store.addBill({ customerId: c1.id, total: 100 });
  store.addBill({ customerId: c1.id, total: 200 });
  store.addBill({ customerId: c2.id, total: 300 });

  assert.strictEqual(store.getBills().length, 3);
  store.deleteCustomer(c1.id);
  assert.strictEqual(store.getBills().length, 1);
  assert.strictEqual(store.getBills()[0].customerId, c2.id);
});

// --- 客户统计 ---
test('统计: 客户累计消费包含所有账单', function () {
  var store = Storage.createStore(createMockBackend());
  var c = store.addCustomer({ name: '统计客户' });
  store.addBill({ customerId: c.id, total: 100.5 });
  store.addBill({ customerId: c.id, total: 200.25 });
  store.addBill({ customerId: c.id, total: 50 });
  assert.strictEqual(store.getCustomerTotalSpent(c.id), 350.75);
});

test('统计: 未结账单数量和金额', function () {
  var store = Storage.createStore(createMockBackend());
  var c = store.addCustomer({ name: '未结统计' });
  store.addBill({ customerId: c.id, total: 100, status: 'unpaid' });
  store.addBill({ customerId: c.id, total: 200, status: 'paid' });
  store.addBill({ customerId: c.id, total: 300, status: 'unpaid' });
  assert.strictEqual(store.getCustomerUnpaidCount(c.id), 2);
  assert.strictEqual(store.getCustomerUnpaidAmount(c.id), 400);
});

test('统计: 全部已结客户未结数量为0', function () {
  var store = Storage.createStore(createMockBackend());
  var c = store.addCustomer({ name: '已结清' });
  store.addBill({ customerId: c.id, total: 100, status: 'paid' });
  assert.strictEqual(store.getCustomerUnpaidCount(c.id), 0);
  assert.strictEqual(store.getCustomerUnpaidAmount(c.id), 0);
});

// --- 数据完整性 ---
test('完整性: 客户ID唯一', function () {
  var store = Storage.createStore(createMockBackend());
  var ids = {};
  for (var i = 0; i < 20; i++) {
    var c = store.addCustomer({ name: '客户' + i });
    assert.ok(!ids[c.id], 'ID重复: ' + c.id);
    ids[c.id] = true;
  }
  assert.strictEqual(Object.keys(ids).length, 20);
});

test('完整性: 客户字段完整', function () {
  var store = Storage.createStore(createMockBackend());
  var c = store.addCustomer({ name: '完整客户', contact: '联系人', phone: '138', vipType: 'vip2' });
  assert.ok(c.id);
  assert.strictEqual(c.name, '完整客户');
  assert.strictEqual(c.contact, '联系人');
  assert.strictEqual(c.phone, '138');
  assert.strictEqual(c.vipType, 'vip2');
  assert.ok(c.createdAt);
});

console.log('\n=== 测试结果 ===');
console.log('通过: ' + passed + ', 失败: ' + failed);
if (failed > 0) {
  process.exit(1);
}
console.log('全部通过!\n');
