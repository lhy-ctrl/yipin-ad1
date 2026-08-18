/**
 * tests/test_excel_parser.js - Excel导入解析测试
 * 运行方式：node tests/test_excel_parser.js
 */

var assert = require('assert');
var ExcelParser = require('../js/excel_parser.js');

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

console.log('\n=== Excel导入解析测试 ===\n');

// --- 日期转换 ---
test('日期: Excel序列号转日期字符串', function () {
  // 46079 应该对应 2026-01-04 左右
  var result = ExcelParser.excelDateToStr(46079);
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(result), '格式应为YYYY-MM-DD，实际: ' + result);
});

test('日期: 字符串日期直接返回', function () {
  assert.strictEqual(ExcelParser.excelDateToStr('2026-03-13'), '2026-03-13');
  assert.strictEqual(ExcelParser.excelDateToStr('2026-03-13 00:00:00'), '2026-03-13');
});

test('日期: 空值返回空字符串', function () {
  assert.strictEqual(ExcelParser.excelDateToStr(null), '');
  assert.strictEqual(ExcelParser.excelDateToStr(undefined), '');
  assert.strictEqual(ExcelParser.excelDateToStr(''), '');
});

test('日期: 数字字符串转为日期', function () {
  var result = ExcelParser.excelDateToStr('46079');
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(result));
});

// --- findCell ---
test('findCell: 找到关键词位置', function () {
  var data = [
    ['', '', '标题'],
    ['', '单位：', '爱肌色'],
    ['内容', '数量', '单价']
  ];
  var pos = ExcelParser.findCell(data, '单位');
  assert.strictEqual(pos.row, 1);
  assert.strictEqual(pos.col, 1);
});

test('findCell: 未找到返回null', function () {
  var data = [['a', 'b'], ['c', 'd']];
  assert.strictEqual(ExcelParser.findCell(data, '不存在'), null);
});

// --- extractValueFromRow ---
test('extractValue: 从冒号后提取值', function () {
  var row = ['', '单位：', '爱肌色', '', '日期：', '2026-03-13'];
  assert.strictEqual(ExcelParser.extractValueFromRow(row, '单位'), '爱肌色');
  assert.strictEqual(ExcelParser.extractValueFromRow(row, '日期'), '2026-03-13');
});

test('extractValue: 值在同一单元格冒号后', function () {
  var row = ['单位：爱肌色'];
  assert.strictEqual(ExcelParser.extractValueFromRow(row, '单位'), '爱肌色');
});

test('extractValue: 中文冒号', function () {
  var row = ['单位：', '测试客户'];
  assert.strictEqual(ExcelParser.extractValueFromRow(row, '单位'), '测试客户');
});

// --- parseSheet 基础格式（6列：内容、定稿日期、数量、单价、总价、备注）---
test('parseSheet: 基础格式解析', function () {
  var data = [
    ['', '', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', '', ''],
    ['', '', '禹州市易品广告服务店结账单', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', '', ''],
    ['', '单位：', '爱肌色', '', '', '日期：', '2026-03-13 00:00:00', '', ''],
    ['', '内容', '定稿日期', '数量', '单价', '总价', '备注', '', ''],
    ['', '面膜、开门红', 46079, 3, 25, 75, '', '', ''],
    ['', '文化衫', '', 1, 25, 25, '', '', ''],
    ['', '', '', '', '', '', '', '', ''],
    ['', '', '', '', '合计：', 100, '', '', '']
  ];

  var result = ExcelParser.parseSheet(data);
  assert.strictEqual(result.customerName, '爱肌色');
  assert.strictEqual(result.date, '2026-03-13');
  assert.strictEqual(result.items.length, 2);
  assert.strictEqual(result.items[0].content, '面膜、开门红');
  assert.strictEqual(result.items[0].qty, 3);
  assert.strictEqual(result.items[0].price, 25);
  assert.strictEqual(result.items[0].total, 75);
  assert.strictEqual(result.items[1].content, '文化衫');
  assert.strictEqual(result.total, 100);
});

// --- parseSheet 带项目和制作人列（Sheet9格式）---
test('parseSheet: 带项目和制作人列', function () {
  var data = [
    ['', '', '', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', '', '', ''],
    ['', '', '禹州市易品广告服务店结账单', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', '', '', ''],
    ['', '单位：', '爱肌色', '', '', '', '日期：', '2026-08-10', '', ''],
    ['', '内容', '定稿日期', '项目', '数量', '单价', '总价', '制作人', '', ''],
    ['', '方案', 46237, '设计', 4, 25, 100, '云南', '', ''],
    ['', '视频', 46237, '设计', 1, 25, 25, '王华', '', ''],
    ['', '', '', '', '', '合计：', 125, '', '', '']
  ];

  var result = ExcelParser.parseSheet(data);
  assert.strictEqual(result.customerName, '爱肌色');
  assert.strictEqual(result.items.length, 2);
  assert.strictEqual(result.items[0].project, '设计');
  assert.strictEqual(result.items[0].maker, '云南');
  assert.strictEqual(result.items[1].project, '设计');
  assert.strictEqual(result.items[1].maker, '王华');
  assert.strictEqual(result.total, 125);
});

// --- parseSheet 合计行在不同位置 ---
test('parseSheet: 无合计行时从明细计算', function () {
  var data = [
    ['', '', '结账单'],
    ['', '单位：', '测试客户'],
    ['', '内容', '数量', '单价', '总价'],
    ['', '项目A', 2, 50, 100],
    ['', '项目B', 3, 30, 90]
  ];

  var result = ExcelParser.parseSheet(data);
  assert.strictEqual(result.items.length, 2);
  assert.strictEqual(result.total, 190); // 100+90
});

// --- parseSheet 空行跳过 ---
test('parseSheet: 跳过空行', function () {
  var data = [
    ['', '', '结账单'],
    ['', '单位：', '客户A'],
    ['', '内容', '数量', '总价'],
    ['', '项目A', 2, 100],
    ['', '', '', ''],
    ['', '项目B', 3, 150],
    ['', '', '', '合计：', 250]
  ];

  var result = ExcelParser.parseSheet(data);
  assert.strictEqual(result.items.length, 2);
  assert.strictEqual(result.total, 250);
});

// --- parseSheet 总价为空时自动计算 ---
test('parseSheet: 总价为空时用数量×单价计算', function () {
  var data = [
    ['', '', '结账单'],
    ['', '单位：', '客户A'],
    ['', '内容', '数量', '单价', '总价'],
    ['', '项目A', 4, 25, ''],
    ['', '', '', '合计：', 100]
  ];

  var result = ExcelParser.parseSheet(data);
  assert.strictEqual(result.items.length, 1);
  assert.strictEqual(result.items[0].total, 100); // 4*25
});

// --- parseSheet 无表头返回空 ---
test('parseSheet: 无内容表头返回空items', function () {
  var data = [
    ['', '', '结账单'],
    ['', '单位：', '客户A'],
    ['', '无表头', '数据']
  ];

  var result = ExcelParser.parseSheet(data);
  assert.strictEqual(result.items.length, 0);
});

// --- parseSheet 空数据 ---
test('parseSheet: 空数据返回null', function () {
  assert.strictEqual(ExcelParser.parseSheet(null), null);
  assert.strictEqual(ExcelParser.parseSheet([]), null);
});

// --- parseSheet 定稿日期Excel序列号 ---
test('parseSheet: 定稿日期序列号转换', function () {
  var data = [
    ['', '', '结账单'],
    ['', '单位：', '客户A'],
    ['', '内容', '定稿日期', '数量', '总价'],
    ['', '项目A', 46079, 2, 100],
    ['', '', '', '合计：', 100]
  ];

  var result = ExcelParser.parseSheet(data);
  assert.strictEqual(result.items.length, 1);
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(result.items[0].finalDate), '定稿日期应转换为日期格式');
});

// --- parseSheet 备注列 ---
test('parseSheet: 备注列正确读取', function () {
  var data = [
    ['', '', '结账单'],
    ['', '单位：', '客户A'],
    ['', '内容', '数量', '单价', '总价', '备注'],
    ['', '项目A', 2, 50, 100, '加急'],
    ['', '', '', '', '合计：', 100]
  ];

  var result = ExcelParser.parseSheet(data);
  assert.strictEqual(result.items[0].remark, '加急');
});

// --- 综合：模拟完整清单.xlsx的一个Sheet ---
test('综合: 完整Sheet解析（模拟Sheet1）', function () {
  // 模拟清单.xlsx Sheet1的结构
  var data = [
    ['', '', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', '', ''],
    ['', '', '禹州市易品广告服务店结账单', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', '', ''],
    ['', '单位：', '爱肌色', '', '', '日期：', '2026-03-13 00:00:00', '', ''],
    ['', '内容', '定稿日期', '数量', '单价', '总价', '备注', '', ''],
    ['', '面膜、开门红', 46079, 3, 25, 75, '', '', ''],
    ['', '太原智美之旅', '', 2, 25, 50, '', '', ''],
    ['', '文化衫', '', 1, 25, 25, '', '', ''],
    ['', '2026爱肌色精英培训会', '', 1, 25, 25, '', '', ''],
    ['', '换新颜、植树节', '3.1-3.10', 8, 25, 200, '', '', ''],
    ['', '胸卡内芯', '物料', 400, 90, 90, '', '', ''],
    ['', '卡套', '', 400, 0.7, 280, '', '', ''],
    ['', '水晶标', '', 200, '', 120, '', '', ''],
    ['', 'A3哑粉纸 喜报', '', 200, '', 180, '', '', ''],
    ['', '会场侧翼', '', 20, 25, 500, '', '', ''],
    ['', '拱门、异形牌', '', 4, 25, 100, '', '', ''],
    ['', '手举牌x2、话筒、手卡', '4+6+1+1', 12, 25, 300, '', '', ''],
    ['', '一楼打卡处', '', 3, 25, 75, '', '', ''],
    ['', '展示区、讲台', '', 6, 25, 150, '', '', ''],
    ['', '大屏侧翼', '', 2, 25, 50, '', '', ''],
    ['', '打卡处、路标、盒子', '', 6, 25, 150, '', '', ''],
    ['', '签到墙', '', 1, 25, 25, '', '', ''],
    ['', '奖牌工作证', '', 5, 25, 125, '', '', ''],
    ['', '手举牌、台卡、指引牌x2', '', 4, 25, 100, '', '', ''],
    ['', '', '', '', '', '', '', '', ''],
    ['', '', '', '', '合计：', 2620, '', '', '']
  ];

  var result = ExcelParser.parseSheet(data);
  assert.strictEqual(result.customerName, '爱肌色');
  assert.strictEqual(result.date, '2026-03-13');
  assert.strictEqual(result.items.length, 19);
  assert.strictEqual(result.total, 2620);
  // 验证几个关键行
  assert.strictEqual(result.items[0].content, '面膜、开门红');
  assert.strictEqual(result.items[0].qty, 3);
  assert.strictEqual(result.items[5].content, '胸卡内芯');
  assert.strictEqual(result.items[5].qty, 400);
  assert.strictEqual(result.items[6].content, '卡套');
  assert.strictEqual(result.items[6].price, 0.7);
  assert.strictEqual(result.items[6].total, 280);
});

console.log('\n=== 测试结果 ===');
console.log('通过: ' + passed + ', 失败: ' + failed);
if (failed > 0) {
  process.exit(1);
}
console.log('全部通过!\n');
