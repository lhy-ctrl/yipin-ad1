/**
 * excel_parser.js - Excel导入解析工具（纯函数，可测试）
 * 解析广告图文店的清单.xlsx格式
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ExcelParser = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  /**
   * Excel日期序列号转YYYY-MM-DD
   * Excel日期从1899-12-30开始（兼容1900闰年bug）
   */
  function excelDateToStr(serial) {
    if (serial === null || serial === undefined || serial === '') return '';
    if (typeof serial === 'string') {
      // 已经是字符串日期
      if (/^\d{4}-\d{2}-\d{2}/.test(serial)) return serial.slice(0, 10);
      // 尝试解析数字字符串
      var n = parseFloat(serial);
      if (!isNaN(n)) serial = n;
      else return serial;
    }
    if (typeof serial !== 'number') return String(serial);
    if (serial < 1) return '';
    var ms = Math.round((serial - 25569) * 86400 * 1000);
    var d = new Date(ms);
    if (isNaN(d.getTime())) return String(serial);
    return d.getUTCFullYear() + '-' +
      String(d.getUTCMonth() + 1).padStart(2, '0') + '-' +
      String(d.getUTCDate()).padStart(2, '0');
  }

  /**
   * 从二维数组中查找包含指定关键词的行
   * 返回 { rowIndex, colIndex } 或 null
   */
  function findCell(data, keyword) {
    for (var r = 0; r < data.length; r++) {
      var row = data[r] || [];
      for (var c = 0; c < row.length; c++) {
        var cell = row[c];
        if (cell !== null && cell !== undefined && String(cell).indexOf(keyword) >= 0) {
          return { row: r, col: c };
        }
      }
    }
    return null;
  }

  /**
   * 从行中提取"关键词：值"格式的值
   */
  function extractValueFromRow(row, keyword) {
    for (var c = 0; c < row.length; c++) {
      var cell = row[c];
      if (cell !== null && cell !== undefined && String(cell).indexOf(keyword) >= 0) {
        // 关键词在当前单元格，值可能在当前单元格冒号后，或下一个单元格
        var str = String(cell);
        var idx = str.indexOf(keyword);
        var after = str.substring(idx + keyword.length).replace(/[：:]/, '').trim();
        if (after) return after;
        // 查找下一个非空单元格
        for (var nc = c + 1; nc < row.length; nc++) {
          if (row[nc] !== null && row[nc] !== undefined && String(row[nc]).trim()) {
            return String(row[nc]).trim();
          }
        }
      }
    }
    return '';
  }

  /**
   * 解析单个Sheet为账单数据
   * @param {Array} sheetData - 二维数组
   * @returns {object} { customerName, date, items, total }
   */
  function parseSheet(sheetData) {
    if (!sheetData || !sheetData.length) return null;

    var result = {
      customerName: '',
      date: '',
      items: [],
      total: 0
    };

    // 查找单位（客户名）
    var unitPos = findCell(sheetData, '单位');
    if (unitPos) {
      result.customerName = extractValueFromRow(sheetData[unitPos.row], '单位');
    }

    // 查找日期
    var datePos = findCell(sheetData, '日期');
    if (datePos) {
      var dateVal = extractValueFromRow(sheetData[datePos.row], '日期');
      result.date = excelDateToStr(dateVal);
    }

    // 查找表头行（包含"内容"的行）
    var headerPos = findCell(sheetData, '内容');
    if (!headerPos) return result;

    var headerRow = sheetData[headerPos.row] || [];

    // 确定各列索引
    var colMap = {};
    for (var c = 0; c < headerRow.length; c++) {
      var h = headerRow[c];
      if (h === null || h === undefined) continue;
      var hs = String(h).trim();
      if (hs === '内容') colMap.content = c;
      else if (hs === '定稿日期') colMap.finalDate = c;
      else if (hs === '项目') colMap.project = c;
      else if (hs === '数量') colMap.qty = c;
      else if (hs === '单价') colMap.price = c;
      else if (hs === '总价') colMap.total = c;
      else if (hs === '制作人') colMap.maker = c;
      else if (hs === '备注') colMap.remark = c;
    }

    // 从表头下一行开始读取明细
    for (var r = headerPos.row + 1; r < sheetData.length; r++) {
      var row = sheetData[r] || [];

      // 检查是否是合计行
      var hasTotal = false;
      for (var tc = 0; tc < row.length; tc++) {
        if (row[tc] !== null && row[tc] !== undefined && String(row[tc]).indexOf('合计') >= 0) {
          hasTotal = true;
          // 提取合计金额
          for (var tv = tc + 1; tv < row.length; tv++) {
            if (row[tv] !== null && row[tv] !== undefined && !isNaN(parseFloat(row[tv]))) {
              result.total = parseFloat(row[tv]);
              break;
            }
          }
          break;
        }
      }
      if (hasTotal) break;

      // 检查是否是空行（所有单元格都空）
      var isEmpty = true;
      for (var ec = 0; ec < row.length; ec++) {
        if (row[ec] !== null && row[ec] !== undefined && String(row[ec]).trim()) {
          isEmpty = false;
          break;
        }
      }
      if (isEmpty) continue;

      // 读取明细行
      var item = {
        content: colMap.content !== undefined ? String(row[colMap.content] || '').trim() : '',
        finalDate: colMap.finalDate !== undefined ? excelDateToStr(row[colMap.finalDate]) : '',
        project: colMap.project !== undefined ? String(row[colMap.project] || '').trim() : '',
        qty: colMap.qty !== undefined ? (parseFloat(row[colMap.qty]) || 0) : 0,
        price: colMap.price !== undefined ? (parseFloat(row[colMap.price]) || 0) : 0,
        total: colMap.total !== undefined ? (parseFloat(row[colMap.total]) || 0) : 0,
        maker: colMap.maker !== undefined ? String(row[colMap.maker] || '').trim() : '',
        remark: colMap.remark !== undefined ? String(row[colMap.remark] || '').trim() : ''
      };

      // 至少有内容或项目才保留
      if (item.content || item.project) {
        // 如果总价为空但有数量和单价，计算总价
        if (!item.total && item.qty && item.price) {
          item.total = Math.round(item.qty * item.price * 100) / 100;
        }
        result.items.push(item);
      }
    }

    // 如果没找到合计行，从明细计算
    if (!result.total && result.items.length) {
      var sum = 0;
      result.items.forEach(function (it) { sum += it.total || 0; });
      result.total = Math.round(sum * 100) / 100;
    }

    return result;
  }

  /**
   * 解析整个工作簿
   * @param {object} workbook - SheetJS workbook对象
   * @returns {Array} 账单数据数组
   */
  function parseWorkbook(workbook) {
    var bills = [];
    if (!workbook || !workbook.SheetNames) return bills;

    workbook.SheetNames.forEach(function (sheetName) {
      var ws = workbook.Sheets[sheetName];
      if (!ws) return;
      // 转换为二维数组，保留原始值（raw:true）
      var data = window.XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
      var parsed = parseSheet(data);
      if (parsed && (parsed.customerName || parsed.items.length)) {
        bills.push(parsed);
      }
    });

    return bills;
  }

  return {
    excelDateToStr: excelDateToStr,
    findCell: findCell,
    extractValueFromRow: extractValueFromRow,
    parseSheet: parseSheet,
    parseWorkbook: parseWorkbook
  };
});
