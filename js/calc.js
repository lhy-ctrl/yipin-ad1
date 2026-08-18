/**
 * calc.js - 纯计算逻辑模块（可在浏览器和Node.js中运行）
 * 包含：折扣计算、总价计算、成本计算、利润计算
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Calc = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  // VIP 类型常量
  var VIP = {
    NORMAL: 'normal',   // 普通客户
    VIP1: 'vip1',       // 普通VIP
    VIP2: 'vip2',       // 中级VIP
    VIP3: 'vip3'        // 高级VIP
  };

  // VIP 折扣率（仅设计费用适用）
  var VIP_DISCOUNT = {
    normal: 1.0,
    vip1: 0.9,
    vip2: 0.7,
    vip3: 0.5
  };

  // 设计费用项目名称（固定，享受VIP折扣）
  var DESIGN_PROJECT_NAME = '设计费用';

  /**
   * 金额四舍五入保留2位小数
   */
  function round2(num) {
    return Math.round(num * 100) / 100;
  }

  /**
   * 根据VIP类型计算设计费折扣后单价
   * @param {number} basePrice - 设计费标价
   * @param {string} vipType - VIP类型
   * @returns {number} 折扣后单价
   */
  function calcDesignPrice(basePrice, vipType) {
    var discount = VIP_DISCOUNT[vipType];
    if (discount === undefined) discount = 1.0;
    return round2(basePrice * discount);
  }

  /**
   * 计算单行总价
   * @param {number} qty - 数量
   * @param {number} price - 单价
   * @returns {number} 总价
   */
  function calcLineTotal(qty, price) {
    qty = parseFloat(qty) || 0;
    price = parseFloat(price) || 0;
    return round2(qty * price);
  }

  /**
   * 计算账单合计
   * @param {Array} items - 账单明细数组，每项含 total 字段
   * @returns {number} 合计金额
   */
  function calcBillTotal(items) {
    if (!items || !items.length) return 0;
    var total = 0;
    for (var i = 0; i < items.length; i++) {
      total += parseFloat(items[i].total) || 0;
    }
    return round2(total);
  }

  /**
   * 计算单行成本
   * @param {number} qty - 数量
   * @param {number} cost - 单位成本
   * @returns {number} 成本金额
   */
  function calcLineCost(qty, cost) {
    qty = parseFloat(qty) || 0;
    cost = parseFloat(cost) || 0;
    return round2(qty * cost);
  }

  /**
   * 根据项目名称从项目库查找项目
   * @param {string} projectName - 项目名称
   * @param {Array} projects - 项目库数组
   * @returns {object|null} 项目对象
   */
  function findProject(projectName, projects) {
    if (!projects || !projectName) return null;
    for (var i = 0; i < projects.length; i++) {
      if (projects[i].name === projectName) return projects[i];
    }
    return null;
  }

  /**
   * 计算账单总成本
   * @param {Array} items - 账单明细
   * @param {Array} projects - 项目库（含cost字段）
   * @returns {number} 总成本
   */
  function calcBillCost(items, projects) {
    if (!items || !items.length) return 0;
    var cost = 0;
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var proj = findProject(item.project, projects);
      var unitCost = proj ? (parseFloat(proj.cost) || 0) : 0;
      cost += calcLineCost(item.qty, unitCost);
    }
    return round2(cost);
  }

  /**
   * 计算账单利润
   * @param {object} bill - 账单对象（含total和items）
   * @param {Array} projects - 项目库
   * @returns {number} 利润金额
   */
  function calcBillProfit(bill, projects) {
    if (!bill) return 0;
    var revenue = parseFloat(bill.total) || calcBillTotal(bill.items);
    var cost = calcBillCost(bill.items, projects);
    return round2(revenue - cost);
  }

  /**
   * 计算汇总（总营收、总成本、总利润）
   * @param {Array} bills - 账单数组
   * @param {Array} projects - 项目库
   * @returns {object} { revenue, cost, profit }
   */
  function calcSummary(bills, projects) {
    var revenue = 0;
    var cost = 0;
    if (bills && bills.length) {
      for (var i = 0; i < bills.length; i++) {
        revenue += parseFloat(bills[i].total) || 0;
        cost += calcBillCost(bills[i].items, projects);
      }
    }
    return {
      revenue: round2(revenue),
      cost: round2(cost),
      profit: round2(revenue - cost)
    };
  }

  /**
   * 判断项目是否为设计费用（享受折扣）
   */
  function isDesignProject(projectName) {
    return projectName === DESIGN_PROJECT_NAME;
  }

  /**
   * 获取开单时某项目的实际单价
   * - 按项目自定义的VIP折扣率计算
   * - 普通客户不打折
   * @param {object} project - 项目对象（含price, vip1Discount, vip2Discount, vip3Discount）
   * @param {string} vipType - 客户VIP类型
   * @returns {number} 实际单价
   */
  function getUnitPrice(project, vipType) {
    if (!project) return 0;
    var basePrice = parseFloat(project.price) || 0;
    var discount = 1.0;
    if (vipType === 'vip1') discount = parseFloat(project.vip1Discount) || 1.0;
    else if (vipType === 'vip2') discount = parseFloat(project.vip2Discount) || 1.0;
    else if (vipType === 'vip3') discount = parseFloat(project.vip3Discount) || 1.0;
    return round2(basePrice * discount);
  }

  return {
    VIP: VIP,
    VIP_DISCOUNT: VIP_DISCOUNT,
    DESIGN_PROJECT_NAME: DESIGN_PROJECT_NAME,
    round2: round2,
    calcDesignPrice: calcDesignPrice,
    calcLineTotal: calcLineTotal,
    calcBillTotal: calcBillTotal,
    calcLineCost: calcLineCost,
    findProject: findProject,
    calcBillCost: calcBillCost,
    calcBillProfit: calcBillProfit,
    calcSummary: calcSummary,
    isDesignProject: isDesignProject,
    getUnitPrice: getUnitPrice
  };
});
