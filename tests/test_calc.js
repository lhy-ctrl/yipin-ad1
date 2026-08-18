/**
 * tests/test_calc.js - 计算逻辑单元测试
 * 运行方式：node tests/test_calc.js
 */

var assert = require('assert');
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

console.log('\n=== calc.js 计算逻辑测试 ===\n');

// --- round2 ---
test('round2: 正常四舍五入', function () {
  assert.strictEqual(Calc.round2(10.125), 10.13);
  assert.strictEqual(Calc.round2(10.124), 10.12);
  assert.strictEqual(Calc.round2(0), 0);
});

// --- calcDesignPrice ---
test('calcDesignPrice: 普通客户不打折', function () {
  assert.strictEqual(Calc.calcDesignPrice(50, 'normal'), 50);
});

test('calcDesignPrice: 普通VIP 9折', function () {
  assert.strictEqual(Calc.calcDesignPrice(50, 'vip1'), 45);
});

test('calcDesignPrice: 中级VIP 7折', function () {
  assert.strictEqual(Calc.calcDesignPrice(50, 'vip2'), 35);
});

test('calcDesignPrice: 高级VIP 5折', function () {
  assert.strictEqual(Calc.calcDesignPrice(50, 'vip3'), 25);
});

test('calcDesignPrice: 未知VIP类型默认不打折', function () {
  assert.strictEqual(Calc.calcDesignPrice(50, 'unknown'), 50);
});

test('calcDesignPrice: 非整数价格折扣', function () {
  assert.strictEqual(Calc.calcDesignPrice(28.5, 'vip1'), 25.65);
});

// --- calcLineTotal ---
test('calcLineTotal: 正常乘法', function () {
  assert.strictEqual(Calc.calcLineTotal(3, 25), 75);
});

test('calcLineTotal: 小数乘法', function () {
  assert.strictEqual(Calc.calcLineTotal(400, 0.7), 280);
});

test('calcLineTotal: 空值返回0', function () {
  assert.strictEqual(Calc.calcLineTotal(null, undefined), 0);
});

test('calcLineTotal: 字符串数字', function () {
  assert.strictEqual(Calc.calcLineTotal('4', '25'), 100);
});

// --- calcBillTotal ---
test('calcBillTotal: 多行合计', function () {
  var items = [
    { total: 75 },
    { total: 50 },
    { total: 25 }
  ];
  assert.strictEqual(Calc.calcBillTotal(items), 150);
});

test('calcBillTotal: 空数组返回0', function () {
  assert.strictEqual(Calc.calcBillTotal([]), 0);
  assert.strictEqual(Calc.calcBillTotal(null), 0);
});

test('calcBillTotal: 含空值行', function () {
  var items = [
    { total: 100 },
    { total: null },
    { total: 50 }
  ];
  assert.strictEqual(Calc.calcBillTotal(items), 150);
});

// --- calcLineCost ---
test('calcLineCost: 正常成本计算', function () {
  assert.strictEqual(Calc.calcLineCost(10, 5), 50);
});

test('calcLineCost: 空值返回0', function () {
  assert.strictEqual(Calc.calcLineCost(undefined, null), 0);
});

// --- findProject ---
test('findProject: 找到项目', function () {
  var projects = [
    { name: '设计费用', price: 50, cost: 20 },
    { name: '条幅', price: 28, cost: 10 }
  ];
  var p = Calc.findProject('设计费用', projects);
  assert.strictEqual(p.price, 50);
  assert.strictEqual(p.cost, 20);
});

test('findProject: 未找到返回null', function () {
  var projects = [{ name: '设计费用', price: 50 }];
  assert.strictEqual(Calc.findProject('不存在', projects), null);
});

// --- calcBillCost ---
test('calcBillCost: 多行成本合计', function () {
  var items = [
    { project: '设计费用', qty: 4 },
    { project: '条幅', qty: 3 }
  ];
  var projects = [
    { name: '设计费用', price: 50, cost: 20 },
    { name: '条幅', price: 28, cost: 10 }
  ];
  // 4*20 + 3*10 = 80 + 30 = 110
  assert.strictEqual(Calc.calcBillCost(items, projects), 110);
});

test('calcBillCost: 项目不在库中成本为0', function () {
  var items = [{ project: '未知项目', qty: 10 }];
  var projects = [{ name: '设计费用', cost: 20 }];
  assert.strictEqual(Calc.calcBillCost(items, projects), 0);
});

// --- calcBillProfit ---
test('calcBillProfit: 利润=营收-成本', function () {
  var bill = {
    total: 509,
    items: [
      { project: '设计费用', qty: 4, total: 200 },
      { project: '条幅', qty: 3, total: 84 }
    ]
  };
  var projects = [
    { name: '设计费用', price: 50, cost: 20 },
    { name: '条幅', price: 28, cost: 10 }
  ];
  // 成本 = 4*20 + 3*10 = 110, 利润 = 509 - 110 = 399
  assert.strictEqual(Calc.calcBillProfit(bill, projects), 399);
});

test('calcBillProfit: 空账单返回0', function () {
  assert.strictEqual(Calc.calcBillProfit(null, []), 0);
});

// --- calcSummary ---
test('calcSummary: 多账单汇总', function () {
  var bills = [
    { total: 509, items: [{ project: '设计费用', qty: 4 }] },
    { total: 300, items: [{ project: '条幅', qty: 10 }] }
  ];
  var projects = [
    { name: '设计费用', price: 50, cost: 20 },
    { name: '条幅', price: 28, cost: 10 }
  ];
  var s = Calc.calcSummary(bills, projects);
  assert.strictEqual(s.revenue, 809);
  // 成本 = 4*20 + 10*10 = 80 + 100 = 180
  assert.strictEqual(s.cost, 180);
  assert.strictEqual(s.profit, 629);
});

test('calcSummary: 空账单数组', function () {
  var s = Calc.calcSummary([], []);
  assert.strictEqual(s.revenue, 0);
  assert.strictEqual(s.cost, 0);
  assert.strictEqual(s.profit, 0);
});

// --- isDesignProject ---
test('isDesignProject: 设计费用为true', function () {
  assert.strictEqual(Calc.isDesignProject('设计费用'), true);
});

test('isDesignProject: 其他项目为false', function () {
  assert.strictEqual(Calc.isDesignProject('条幅'), false);
});

// --- getUnitPrice ---
test('getUnitPrice: 设计费用普通VIP打9折', function () {
  var project = { name: '设计费用', price: 50, vip1Discount: 0.9 };
  assert.strictEqual(Calc.getUnitPrice(project, 'vip1'), 45);
});

test('getUnitPrice: 设计费用高级VIP打5折', function () {
  var project = { name: '设计费用', price: 50, vip3Discount: 0.5 };
  assert.strictEqual(Calc.getUnitPrice(project, 'vip3'), 25);
});

test('getUnitPrice: 非设计项目不打折', function () {
  var project = { name: '条幅', price: 28 };
  assert.strictEqual(Calc.getUnitPrice(project, 'vip3'), 28);
});

test('getUnitPrice: 空项目返回0', function () {
  assert.strictEqual(Calc.getUnitPrice(null, 'vip1'), 0);
});

// --- 综合场景测试 ---
test('综合: 爱肌色普通VIP设计费账单', function () {
  // 模拟Sheet9: 设计费用项目，普通VIP
  var project = { name: '设计费用', price: 50, cost: 20, vip1Discount: 0.9 };
  var vipType = 'vip1'; // 普通VIP 9折
  var unitPrice = Calc.getUnitPrice(project, vipType);
  assert.strictEqual(unitPrice, 45); // 50 * 0.9

  var items = [
    { project: '设计费用', qty: 4, price: unitPrice, total: Calc.calcLineTotal(4, unitPrice) },
    { project: '设计费用', qty: 1, price: unitPrice, total: Calc.calcLineTotal(1, unitPrice) }
  ];
  var billTotal = Calc.calcBillTotal(items);
  assert.strictEqual(billTotal, 225); // 4*45 + 1*45 = 225

  var projects = [project];
  var cost = Calc.calcBillCost(items, projects);
  assert.strictEqual(cost, 100); // 5*20 = 100

  var profit = Calc.calcBillProfit({ total: billTotal, items: items }, projects);
  assert.strictEqual(profit, 125); // 225 - 100
});

console.log('\n=== 测试结果 ===');
console.log('通过: ' + passed + ', 失败: ' + failed);
if (failed > 0) {
  process.exit(1);
}
console.log('全部通过!\n');
