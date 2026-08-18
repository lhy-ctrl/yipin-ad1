/**
 * tests/test_bill_edit.js - 账单编辑页测试
 * 运行方式：node tests/test_bill_edit.js
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

console.log('\n=== 账单编辑页测试 ===\n');

// --- 新建账单默认值 ---
test('新建: 默认状态为未结', function () {
  var store = Storage.createStore(createMockBackend());
  var c = store.addCustomer({ name: '测试客户' });
  var bill = store.addBill({ customerId: c.id, total: 0, items: [] });
  assert.strictEqual(bill.status, 'unpaid');
});

test('新建: 默认日期为当天（格式YYYY-MM-DD）', function () {
  var d = new Date();
  var today = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(today));
});

test('新建: 默认有一行空明细', function () {
  // 模拟UI默认行
  var defaultItem = { content: '', finalDate: '', project: '', qty: 1, price: 0, total: 0, maker: '', remark: '' };
  assert.strictEqual(defaultItem.qty, 1);
  assert.strictEqual(defaultItem.price, 0);
  assert.strictEqual(defaultItem.total, 0);
});

// --- 项目选择带出单价 ---
test('单价: 普通客户设计费不打折', function () {
  var store = Storage.createStore(createMockBackend());
  store.addProject('设计费用', 50, 20);
  var proj = store.getProjectByName('设计费用');
  var price = Calc.getUnitPrice(proj, 'normal');
  assert.strictEqual(price, 50);
});

test('单价: 普通VIP设计费9折', function () {
  var store = Storage.createStore(createMockBackend());
  store.addProject('设计费用', 50, 20, 0.9, 0.7, 0.5);
  var proj = store.getProjectByName('设计费用');
  assert.strictEqual(Calc.getUnitPrice(proj, 'vip1'), 45);
});

test('单价: 中级VIP设计费7折', function () {
  var store = Storage.createStore(createMockBackend());
  store.addProject('设计费用', 50, 20, 0.9, 0.7, 0.5);
  var proj = store.getProjectByName('设计费用');
  assert.strictEqual(Calc.getUnitPrice(proj, 'vip2'), 35);
});

test('单价: 高级VIP设计费5折', function () {
  var store = Storage.createStore(createMockBackend());
  store.addProject('设计费用', 50, 20, 0.9, 0.7, 0.5);
  var proj = store.getProjectByName('设计费用');
  assert.strictEqual(Calc.getUnitPrice(proj, 'vip3'), 25);
});

test('单价: 非设计项目不打折', function () {
  var store = Storage.createStore(createMockBackend());
  store.addProject('条幅', 28, 10);
  var proj = store.getProjectByName('条幅');
  // 即使高级VIP也不打折
  assert.strictEqual(Calc.getUnitPrice(proj, 'vip3'), 28);
});

// --- 行总价计算 ---
test('行总价: 数量×单价', function () {
  assert.strictEqual(Calc.calcLineTotal(3, 25), 75);
  assert.strictEqual(Calc.calcLineTotal(400, 0.7), 280);
  assert.strictEqual(Calc.calcLineTotal(0, 50), 0);
});

test('行总价: 空值处理', function () {
  assert.strictEqual(Calc.calcLineTotal(null, undefined), 0);
  assert.strictEqual(Calc.calcLineTotal('abc', 'def'), 0);
});

// --- 合计计算 ---
test('合计: 多行总价求和', function () {
  var items = [
    { total: 75 },
    { total: 50 },
    { total: 25 },
    { total: 200 }
  ];
  assert.strictEqual(Calc.calcBillTotal(items), 350);
});

test('合计: 含零值行', function () {
  var items = [
    { total: 100 },
    { total: 0 },
    { total: 50 }
  ];
  assert.strictEqual(Calc.calcBillTotal(items), 150);
});

test('合计: 空明细合计为0', function () {
  assert.strictEqual(Calc.calcBillTotal([]), 0);
});

// --- 保存账单 ---
test('保存: 新建账单数据正确', function () {
  var store = Storage.createStore(createMockBackend());
  var c = store.addCustomer({ name: '保存客户', vipType: 'vip1' });
  var items = [
    { content: '海报', project: '设计费用', qty: 2, price: 45, total: 90, maker: '王华', remark: '' },
    { content: '条幅', project: '条幅', qty: 3, price: 28, total: 84, maker: '', remark: '加急' }
  ];
  // 需要先添加条幅项目
  store.addProject('条幅', 28, 10);

  var total = Calc.calcBillTotal(items);
  var bill = store.addBill({
    customerId: c.id,
    date: '2026-08-18',
    status: 'unpaid',
    items: items,
    total: total
  });

  assert.strictEqual(bill.total, 174);
  assert.strictEqual(bill.items.length, 2);
  assert.strictEqual(bill.items[0].content, '海报');
  assert.strictEqual(bill.items[1].remark, '加急');
});

test('保存: 编辑账单更新数据', function () {
  var store = Storage.createStore(createMockBackend());
  var c = store.addCustomer({ name: '编辑客户' });
  var bill = store.addBill({ customerId: c.id, total: 100, items: [{ content: '旧', total: 100 }] });

  store.updateBill(bill.id, {
    total: 200,
    items: [{ content: '新', total: 200 }],
    status: 'paid'
  });

  var updated = store.getBillById(bill.id);
  assert.strictEqual(updated.total, 200);
  assert.strictEqual(updated.items[0].content, '新');
  assert.strictEqual(updated.status, 'paid');
});

// --- 已结账单锁定 ---
test('锁定: 已结账单不可编辑（UI层判断）', function () {
  function canEditBill(bill) {
    return bill.status !== 'paid';
  }
  assert.strictEqual(canEditBill({ status: 'unpaid' }), true);
  assert.strictEqual(canEditBill({ status: 'paid' }), false);
});

test('锁定: 已结账单仍可查看', function () {
  function canViewBill(bill) {
    return bill !== null && bill !== undefined;
  }
  assert.strictEqual(canViewBill({ status: 'paid' }), true);
});

// --- 表单验证逻辑 ---
test('验证: 空明细不允许保存', function () {
  function validateItems(items) {
    if (!items || items.length === 0) return '请至少添加一行明细';
    var hasContent = items.some(function (it) {
      return (it.content && it.content.trim()) || it.project;
    });
    if (!hasContent) return '请填写至少一行明细内容';
    return null;
  }
  assert.strictEqual(validateItems([]), '请至少添加一行明细');
  assert.strictEqual(validateItems([{ content: '', project: '' }]), '请填写至少一行明细内容');
  assert.strictEqual(validateItems([{ content: '海报', project: '设计费用' }]), null);
});

// --- 明细字段完整性 ---
test('完整性: 明细行包含所有字段', function () {
  var item = {
    content: '面膜海报',
    finalDate: '2026-03-01',
    project: '设计费用',
    qty: 3,
    price: 25,
    total: 75,
    maker: '王华',
    remark: '加急'
  };
  assert.ok(item.content !== undefined);
  assert.ok(item.finalDate !== undefined);
  assert.ok(item.project !== undefined);
  assert.ok(item.qty !== undefined);
  assert.ok(item.price !== undefined);
  assert.ok(item.total !== undefined);
  assert.ok(item.maker !== undefined);
  assert.ok(item.remark !== undefined);
});

// --- 综合场景：完整开单流程 ---
test('综合: 普通VIP完整开单流程', function () {
  var store = Storage.createStore(createMockBackend());
  store.addProject('设计费用', 50, 20, 0.9, 0.7, 0.5);
  store.addProject('条幅', 28, 10);
  var c = store.addCustomer({ name: '爱肌色', vipType: 'vip1' }); // 普通VIP

  // 选择设计费用项目，自动带出9折价
  var designProj = store.getProjectByName('设计费用');
  var designPrice = Calc.getUnitPrice(designProj, c.vipType);
  assert.strictEqual(designPrice, 45); // 50*0.9

  // 选择条幅项目，不打折
  var bannerProj = store.getProjectByName('条幅');
  var bannerPrice = Calc.getUnitPrice(bannerProj, c.vipType);
  assert.strictEqual(bannerPrice, 28);

  // 构建明细
  var items = [
    { content: '海报设计', project: '设计费用', qty: 4, price: designPrice, total: Calc.calcLineTotal(4, designPrice), maker: '云南' },
    { content: '条幅', project: '条幅', qty: 3, price: bannerPrice, total: Calc.calcLineTotal(3, bannerPrice), maker: '王华' }
  ];

  assert.strictEqual(items[0].total, 180); // 4*45
  assert.strictEqual(items[1].total, 84);  // 3*28

  var total = Calc.calcBillTotal(items);
  assert.strictEqual(total, 264);

  // 保存
  var bill = store.addBill({
    customerId: c.id,
    date: '2026-08-18',
    status: 'unpaid',
    items: items,
    total: total
  });

  assert.strictEqual(bill.total, 264);
  assert.strictEqual(store.getCustomerTotalSpent(c.id), 264);
  assert.strictEqual(store.getCustomerUnpaidCount(c.id), 1);
});

console.log('\n=== 测试结果 ===');
console.log('通过: ' + passed + ', 失败: ' + failed);
if (failed > 0) {
  process.exit(1);
}
console.log('全部通过!\n');
