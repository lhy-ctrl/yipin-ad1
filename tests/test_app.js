/**
 * tests/test_app.js - 应用框架测试（路由解析、工具函数）
 * 运行方式：node tests/test_app.js
 */

var assert = require('assert');

// 模拟浏览器环境
global.location = { hash: '#/' };
global.window = {
  addEventListener: function () {},
  scrollTo: function () {},
  location: global.location
};
global.document = {
  readyState: 'complete',
  getElementById: function () { return { onclick: null, style: {}, className: '', textContent: '', innerHTML: '' }; },
  querySelectorAll: function () { return []; },
  createElement: function () { return { textContent: '', innerHTML: '' }; },
  addEventListener: function () {}
};
global.self = global;

// 加载依赖并挂载到全局（模拟浏览器script标签顺序）
global.Calc = require('../js/calc.js');
global.Store = require('../js/storage.js');
var App = require('../js/app.js');

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

console.log('\n=== app.js 应用框架测试 ===\n');

// --- 路由解析 ---
test('路由: 空hash解析为主页', function () {
  var r = App.parseRoute('');
  assert.strictEqual(r.name, 'home');
});

test('路由: #/ 解析为主页', function () {
  var r = App.parseRoute('#/');
  assert.strictEqual(r.name, 'home');
});

test('路由: #/customers', function () {
  var r = App.parseRoute('#/customers');
  assert.strictEqual(r.name, 'customers');
});

test('路由: #/projects', function () {
  var r = App.parseRoute('#/projects');
  assert.strictEqual(r.name, 'projects');
});

test('路由: #/audit', function () {
  var r = App.parseRoute('#/audit');
  assert.strictEqual(r.name, 'audit');
});

test('路由: #/backup', function () {
  var r = App.parseRoute('#/backup');
  assert.strictEqual(r.name, 'backup');
});

test('路由: #/customer/:id', function () {
  var r = App.parseRoute('#/customer/cust_123');
  assert.strictEqual(r.name, 'customer-bills');
  assert.strictEqual(r.params.customerId, 'cust_123');
});

test('路由: #/customer/:id/new-bill', function () {
  var r = App.parseRoute('#/customer/cust_123/new-bill');
  assert.strictEqual(r.name, 'new-bill');
  assert.strictEqual(r.params.customerId, 'cust_123');
});

test('路由: #/bill/:id', function () {
  var r = App.parseRoute('#/bill/bill_456');
  assert.strictEqual(r.name, 'bill-detail');
  assert.strictEqual(r.params.billId, 'bill_456');
});

test('路由: #/bill/:id/edit', function () {
  var r = App.parseRoute('#/bill/bill_456/edit');
  assert.strictEqual(r.name, 'bill-edit');
  assert.strictEqual(r.params.billId, 'bill_456');
});

test('路由: 未知路由回退到主页', function () {
  var r = App.parseRoute('#/unknown/path');
  assert.strictEqual(r.name, 'home');
});

// --- VIP 标签映射 ---
test('VIP标签: normal', function () {
  assert.strictEqual(App.VIP_LABELS.normal, '普通客户');
});

test('VIP标签: vip1', function () {
  assert.strictEqual(App.VIP_LABELS.vip1, '普通VIP');
});

test('VIP标签: vip2', function () {
  assert.strictEqual(App.VIP_LABELS.vip2, '中级VIP');
});

test('VIP标签: vip3', function () {
  assert.strictEqual(App.VIP_LABELS.vip3, '高级VIP');
});

// --- formatMoney ---
test('formatMoney: 整数', function () {
  assert.strictEqual(App.formatMoney(100), '100');
});

test('formatMoney: 一位小数', function () {
  assert.strictEqual(App.formatMoney(100.5), '100.5');
});

test('formatMoney: 两位小数', function () {
  assert.strictEqual(App.formatMoney(100.25), '100.25');
});

test('formatMoney: 去除末尾零', function () {
  assert.strictEqual(App.formatMoney(100.20), '100.2');
  assert.strictEqual(App.formatMoney(100.00), '100');
});

test('formatMoney: 空值返回0', function () {
  assert.strictEqual(App.formatMoney(null), '0');
  assert.strictEqual(App.formatMoney(undefined), '0');
});

// --- escapeHtml ---
test('escapeHtml: 转义特殊字符', function () {
  assert.ok(App.escapeHtml('<script>').indexOf('<script>') === -1);
  assert.ok(App.escapeHtml('<script>').indexOf('&lt;') >= 0);
});

test('escapeHtml: 空值返回空字符串', function () {
  assert.strictEqual(App.escapeHtml(null), '');
  assert.strictEqual(App.escapeHtml(undefined), '');
});

// --- todayStr ---
test('todayStr: 返回YYYY-MM-DD格式', function () {
  var s = App.todayStr();
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(s));
});

console.log('\n=== 测试结果 ===');
console.log('通过: ' + passed + ', 失败: ' + failed);
if (failed > 0) {
  process.exit(1);
}
console.log('全部通过!\n');
