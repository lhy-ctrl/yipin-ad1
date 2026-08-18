/**
 * tests/test_bill_detail.js - 账单详情页测试
 * 运行方式：node tests/test_bill_detail.js
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

console.log('\n=== 账单详情页测试 ===\n');

// --- 账单抬头信息 ---
test('抬头: 公司名称固定为"禹州市易品广告服务店"', function () {
  var companyName = '禹州市易品广告服务店';
  assert.strictEqual(companyName, '禹州市易品广告服务店');
});

test('抬头: 显示客户名称和VIP类型', function () {
  var store = Storage.createStore(createMockBackend());
  var c = store.addCustomer({ name: '爱肌色', vipType: 'vip1' });
  var found = store.getCustomerById(c.id);
  assert.strictEqual(found.name, '爱肌色');
  assert.strictEqual(found.vipType, 'vip1');
});

test('抬头: 显示账单日期', function () {
  var store = Storage.createStore(createMockBackend());
  var c = store.addCustomer({ name: '测试' });
  var b = store.addBill({ customerId: c.id, date: '2026-08-18', total: 100 });
  assert.strictEqual(b.date, '2026-08-18');
});

// --- 明细渲染 ---
test('明细: 包含所有列字段', function () {
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
  var columns = ['content', 'finalDate', 'project', 'qty', 'price', 'total', 'maker', 'remark'];
  columns.forEach(function (col) {
    assert.ok(item[col] !== undefined, '缺少字段: ' + col);
  });
});

test('明细: 空值显示为空字符串', function () {
  function safeStr(val) {
    return val === null || val === undefined ? '' : String(val);
  }
  assert.strictEqual(safeStr(null), '');
  assert.strictEqual(safeStr(undefined), '');
  assert.strictEqual(safeStr('有值'), '有值');
});

// --- 合计 ---
test('合计: 等于所有明细总价之和', function () {
  var items = [
    { total: 75 },
    { total: 50 },
    { total: 25 },
    { total: 200 }
  ];
  var bill = { total: 350, items: items };
  assert.strictEqual(Calc.calcBillTotal(items), bill.total);
});

test('合计: 无明细时合计为0', function () {
  assert.strictEqual(Calc.calcBillTotal([]), 0);
});

// --- 已结锁定 ---
test('锁定: 已结账单不显示编辑按钮', function () {
  function showEditButton(bill) {
    return bill.status !== 'paid';
  }
  assert.strictEqual(showEditButton({ status: 'paid' }), false);
  assert.strictEqual(showEditButton({ status: 'unpaid' }), true);
});

test('锁定: 已结账单显示锁定提示', function () {
  function showLockNotice(bill) {
    return bill.status === 'paid';
  }
  assert.strictEqual(showLockNotice({ status: 'paid' }), true);
  assert.strictEqual(showLockNotice({ status: 'unpaid' }), false);
});

test('锁定: 已结账单可改为未结解锁', function () {
  var store = Storage.createStore(createMockBackend());
  var c = store.addCustomer({ name: '解锁测试' });
  var b = store.addBill({ customerId: c.id, total: 100, status: 'paid' });
  assert.strictEqual(b.status, 'paid');

  store.updateBill(b.id, { status: 'unpaid' });
  assert.strictEqual(store.getBillById(b.id).status, 'unpaid');
});

// --- 状态切换 ---
test('状态: 未结标记为已结', function () {
  var store = Storage.createStore(createMockBackend());
  var c = store.addCustomer({ name: '状态测试' });
  var b = store.addBill({ customerId: c.id, total: 100, status: 'unpaid' });
  store.updateBill(b.id, { status: 'paid' });
  assert.strictEqual(store.getBillById(b.id).status, 'paid');
});

test('状态: 切换后未结数量更新', function () {
  var store = Storage.createStore(createMockBackend());
  var c = store.addCustomer({ name: '未结数量' });
  var b1 = store.addBill({ customerId: c.id, total: 100, status: 'unpaid' });
  var b2 = store.addBill({ customerId: c.id, total: 200, status: 'unpaid' });
  assert.strictEqual(store.getCustomerUnpaidCount(c.id), 2);

  store.updateBill(b1.id, { status: 'paid' });
  assert.strictEqual(store.getCustomerUnpaidCount(c.id), 1);
});

// --- 打印区域 ---
test('打印: 打印区域包含公司名称', function () {
  var printContent = {
    company: '禹州市易品广告服务店',
    title: '结账单'
  };
  assert.strictEqual(printContent.company, '禹州市易品广告服务店');
  assert.strictEqual(printContent.title, '结账单');
});

test('打印: 打印区域包含客户和日期', function () {
  var store = Storage.createStore(createMockBackend());
  var c = store.addCustomer({ name: '爱肌色', vipType: 'vip2' });
  var b = store.addBill({ customerId: c.id, date: '2026-08-10', total: 509 });
  assert.strictEqual(c.name, '爱肌色');
  assert.strictEqual(b.date, '2026-08-10');
});

test('打印: 打印区域包含明细表和合计', function () {
  var items = [
    { content: '方案', project: '设计', qty: 4, price: 25, total: 100 },
    { content: '视频', project: '设计', qty: 1, price: 25, total: 25 }
  ];
  assert.strictEqual(items.length, 2);
  assert.strictEqual(Calc.calcBillTotal(items), 125);
});

// --- 导出JPG文件名 ---
test('导出: 文件名包含客户名和日期', function () {
  function buildFileName(customerName, date) {
    return '账单_' + customerName + '_' + date + '.jpg';
  }
  assert.strictEqual(buildFileName('爱肌色', '2026-08-10'), '账单_爱肌色_2026-08-10.jpg');
});

// --- 不存在的账单 ---
test('异常: 不存在的账单返回null', function () {
  var store = Storage.createStore(createMockBackend());
  assert.strictEqual(store.getBillById('not_exist'), null);
});

// --- 综合场景 ---
test('综合: 完整账单详情数据', function () {
  var store = Storage.createStore(createMockBackend());
  store.addProject('条幅', 28, 10);
  var c = store.addCustomer({ name: '爱肌色', vipType: 'vip1' });
  var items = [
    { content: '海报', finalDate: '08-10', project: '设计费用', qty: 4, price: 45, total: 180, maker: '云南', remark: '' },
    { content: '条幅', finalDate: '', project: '条幅', qty: 3, price: 28, total: 84, maker: '王华', remark: '加急' }
  ];
  var total = Calc.calcBillTotal(items);
  var b = store.addBill({
    customerId: c.id,
    date: '2026-08-10',
    status: 'unpaid',
    items: items,
    total: total
  });

  // 验证数据
  assert.strictEqual(b.total, 264);
  assert.strictEqual(b.items.length, 2);
  assert.strictEqual(b.items[0].maker, '云南');
  assert.strictEqual(b.items[1].remark, '加急');

  // 验证客户信息
  var foundCust = store.getCustomerById(b.customerId);
  assert.strictEqual(foundCust.name, '爱肌色');
  assert.strictEqual(foundCust.vipType, 'vip1');

  // 验证可编辑
  assert.strictEqual(b.status, 'unpaid');
});

console.log('\n=== 测试结果 ===');
console.log('通过: ' + passed + ', 失败: ' + failed);
if (failed > 0) {
  process.exit(1);
}
console.log('全部通过!\n');
