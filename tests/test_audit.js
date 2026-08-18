/**
 * tests/test_audit.js - 核对账单模块测试
 * 运行方式：node tests/test_audit.js
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

// 密码验证逻辑
var AUDIT_PASSWORD = 'Yan941207.';
function verifyPassword(input) {
  return input === AUDIT_PASSWORD;
}

console.log('\n=== 核对账单模块测试 ===\n');

// --- 密码验证 ---
test('密码: 正确密码验证通过', function () {
  assert.strictEqual(verifyPassword('Yan941207.'), true);
});

test('密码: 错误密码验证失败', function () {
  assert.strictEqual(verifyPassword('wrong'), false);
  assert.strictEqual(verifyPassword(''), false);
  assert.strictEqual(verifyPassword('yan941207.'), false); // 大小写敏感
});

test('密码: 包含末尾点号', function () {
  assert.strictEqual(verifyPassword('Yan941207'), false); // 少了点
  assert.strictEqual(verifyPassword('Yan941207.'), true);
});

// --- 利润计算 ---
test('利润: 单账单利润=营收-成本', function () {
  var projects = [
    { name: '设计费用', price: 50, cost: 20 },
    { name: '条幅', price: 28, cost: 10 }
  ];
  var bill = {
    total: 264,
    items: [
      { project: '设计费用', qty: 4, total: 180 },
      { project: '条幅', qty: 3, total: 84 }
    ]
  };
  // 成本 = 4*20 + 3*10 = 110, 利润 = 264-110 = 154
  assert.strictEqual(Calc.calcBillProfit(bill, projects), 154);
});

test('利润: 无项目匹配时成本为0', function () {
  var projects = [{ name: '设计费用', cost: 20 }];
  var bill = {
    total: 100,
    items: [{ project: '未知项目', qty: 5, total: 100 }]
  };
  assert.strictEqual(Calc.calcBillProfit(bill, projects), 100);
});

test('利润: 可能为负（成本高于营收）', function () {
  var projects = [{ name: '亏本项目', price: 10, cost: 50 }];
  var bill = {
    total: 30,
    items: [{ project: '亏本项目', qty: 3, total: 30 }]
  };
  // 成本=150, 利润=30-150=-120
  assert.strictEqual(Calc.calcBillProfit(bill, projects), -120);
});

// --- 成本计算 ---
test('成本: 多行成本合计', function () {
  var projects = [
    { name: '设计费用', cost: 20 },
    { name: '条幅', cost: 10 },
    { name: '胸卡', cost: 0.5 }
  ];
  var items = [
    { project: '设计费用', qty: 4 },
    { project: '条幅', qty: 3 },
    { project: '胸卡', qty: 100 }
  ];
  // 4*20 + 3*10 + 100*0.5 = 80+30+50 = 160
  assert.strictEqual(Calc.calcBillCost(items, projects), 160);
});

test('成本: 空明细成本为0', function () {
  assert.strictEqual(Calc.calcBillCost([], [{ name: '设计', cost: 20 }]), 0);
});

test('成本: 成本为0的项目', function () {
  var projects = [{ name: '免费项目', cost: 0 }];
  var items = [{ project: '免费项目', qty: 10 }];
  assert.strictEqual(Calc.calcBillCost(items, projects), 0);
});

// --- 汇总统计 ---
test('汇总: 多账单总营收/成本/利润', function () {
  var projects = [
    { name: '设计费用', cost: 20 },
    { name: '条幅', cost: 10 }
  ];
  var bills = [
    { total: 264, items: [{ project: '设计费用', qty: 4 }, { project: '条幅', qty: 3 }] },
    { total: 100, items: [{ project: '设计费用', qty: 2 }] }
  ];
  var s = Calc.calcSummary(bills, projects);
  assert.strictEqual(s.revenue, 364);
  // 成本 = (4*20+3*10) + (2*20) = 110 + 40 = 150
  assert.strictEqual(s.cost, 150);
  assert.strictEqual(s.profit, 214);
});

test('汇总: 空账单汇总为0', function () {
  var s = Calc.calcSummary([], []);
  assert.strictEqual(s.revenue, 0);
  assert.strictEqual(s.cost, 0);
  assert.strictEqual(s.profit, 0);
});

// --- 筛选逻辑 ---
test('筛选: 按月份筛选', function () {
  var bills = [
    { date: '2026-08-10', total: 100 },
    { date: '2026-07-30', total: 200 },
    { date: '2026-08-18', total: 300 }
  ];
  var august = bills.filter(function (b) {
    return b.date.slice(0, 7) === '2026-08';
  });
  assert.strictEqual(august.length, 2);
  assert.strictEqual(august[0].total, 100);
  assert.strictEqual(august[1].total, 300);
});

test('筛选: 按状态筛选', function () {
  var bills = [
    { status: 'paid', total: 100 },
    { status: 'unpaid', total: 200 },
    { status: 'paid', total: 300 }
  ];
  var paid = bills.filter(function (b) { return b.status === 'paid'; });
  var unpaid = bills.filter(function (b) { return b.status === 'unpaid'; });
  assert.strictEqual(paid.length, 2);
  assert.strictEqual(unpaid.length, 1);
});

test('筛选: 月份+状态组合筛选', function () {
  var bills = [
    { date: '2026-08-10', status: 'paid', total: 100 },
    { date: '2026-08-18', status: 'unpaid', total: 200 },
    { date: '2026-07-30', status: 'paid', total: 300 }
  ];
  var result = bills.filter(function (b) {
    return b.date.slice(0, 7) === '2026-08' && b.status === 'paid';
  });
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].total, 100);
});

// --- 月份选项构建 ---
test('月份: 从账单日期提取不重复月份', function () {
  function buildMonthOptions(billList) {
    var months = {};
    billList.forEach(function (b) {
      if (b.date) months[b.date.slice(0, 7)] = true;
    });
    return Object.keys(months).sort().reverse();
  }
  var bills = [
    { date: '2026-08-10' },
    { date: '2026-07-30' },
    { date: '2026-08-18' },
    { date: '2026-06-15' }
  ];
  var months = buildMonthOptions(bills);
  assert.strictEqual(months.length, 3);
  assert.strictEqual(months[0], '2026-08'); // 倒序
  assert.strictEqual(months[1], '2026-07');
  assert.strictEqual(months[2], '2026-06');
});

test('月份: 无日期的账单不生成月份', function () {
  function buildMonthOptions(billList) {
    var months = {};
    billList.forEach(function (b) {
      if (b.date) months[b.date.slice(0, 7)] = true;
    });
    return Object.keys(months);
  }
  var bills = [{ date: '' }, { date: null }];
  assert.strictEqual(buildMonthOptions(bills).length, 0);
});

// --- 账单排序 ---
test('排序: 核对账单按日期倒序', function () {
  var bills = [
    { date: '2026-01-15' },
    { date: '2026-03-20' },
    { date: '2026-02-10' }
  ];
  bills.sort(function (a, b) {
    return (b.date || '').localeCompare(a.date || '');
  });
  assert.strictEqual(bills[0].date, '2026-03-20');
  assert.strictEqual(bills[2].date, '2026-01-15');
});

// --- 综合场景 ---
test('综合: 完整核对账单数据流程', function () {
  var store = Storage.createStore(createMockBackend());
  store.addProject('设计费用', 50, 20);
  store.addProject('条幅', 28, 10);
  var c1 = store.addCustomer({ name: '爱肌色', vipType: 'vip1' });
  var c2 = store.addCustomer({ name: '澜琦', vipType: 'normal' });

  // 账单1：爱肌色，设计费+条幅
  var items1 = [
    { project: '设计费用', qty: 4, total: 180 },
    { project: '条幅', qty: 3, total: 84 }
  ];
  store.addBill({ customerId: c1.id, date: '2026-08-10', status: 'unpaid', items: items1, total: 264 });

  // 账单2：澜琦，设计费
  var items2 = [
    { project: '设计费用', qty: 2, total: 100 }
  ];
  store.addBill({ customerId: c2.id, date: '2026-08-18', status: 'paid', items: items2, total: 100 });

  var projects = store.getProjects();
  var allBills = store.getBills();
  var summary = Calc.calcSummary(allBills, projects);

  // 总营收 = 264 + 100 = 364
  assert.strictEqual(summary.revenue, 364);
  // 总成本 = (4*20+3*10) + (2*20) = 110 + 40 = 150
  assert.strictEqual(summary.cost, 150);
  // 总利润 = 364 - 150 = 214
  assert.strictEqual(summary.profit, 214);

  // 单账单利润
  assert.strictEqual(Calc.calcBillProfit(allBills[0], projects), 154);
  assert.strictEqual(Calc.calcBillProfit(allBills[1], projects), 60);
});

console.log('\n=== 测试结果 ===');
console.log('通过: ' + passed + ', 失败: ' + failed);
if (failed > 0) {
  process.exit(1);
}
console.log('全部通过!\n');
