/**
 * tests/run_all.js - 运行全部测试
 * 运行方式：node tests/run_all.js
 */

var fs = require('fs');
var path = require('path');
var { execSync } = require('child_process');

var testDir = __dirname;
var files = fs.readdirSync(testDir).filter(function (f) {
  return f.startsWith('test_') && f.endsWith('.js');
}).sort();

console.log('========================================');
console.log('  易品广告记账开单系统 - 全部测试');
console.log('========================================\n');

var totalPassed = 0;
var totalFailed = 0;
var failedSuites = [];

files.forEach(function (file) {
  console.log('--- 运行: ' + file + ' ---');
  try {
    var output = execSync('node "' + path.join(testDir, file) + '"', { encoding: 'utf8' });
    console.log(output);
    // 提取通过/失败数
    var passMatch = output.match(/通过:\s*(\d+)/);
    var failMatch = output.match(/失败:\s*(\d+)/);
    if (passMatch) totalPassed += parseInt(passMatch[1]);
    if (failMatch) totalFailed += parseInt(failMatch[1]);
  } catch (e) {
    console.log(e.stdout || '');
    console.log('  ✗ 测试套件运行失败: ' + file + '\n');
    failedSuites.push(file);
    totalFailed++;
  }
});

console.log('========================================');
console.log('  全部测试汇总');
console.log('========================================');
console.log('  测试套件: ' + files.length + ' 个');
console.log('  通过: ' + totalPassed + ' 个');
console.log('  失败: ' + totalFailed + ' 个');
if (failedSuites.length) {
  console.log('  失败套件: ' + failedSuites.join(', '));
}
console.log('========================================');

if (totalFailed > 0) {
  process.exit(1);
}
console.log('\n🎉 全部测试通过!\n');
