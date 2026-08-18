/**
 * storage.js - 数据存储层
 * 封装 localStorage 的 CRUD 操作，支持注入存储后端以便测试
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Store = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  var KEYS = {
    CUSTOMERS: 'yipin_customers',
    BILLS: 'yipin_bills',
    PROJECTS: 'yipin_projects',
    AUTO_BACKUP: 'yipin_auto_backup'
  };

  // 默认项目：无（用户自行添加）
  var DEFAULT_PROJECTS = [];

  /**
   * 生成唯一ID
   */
  function genId(prefix) {
    return (prefix || 'id') + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
  }

  /**
   * 创建存储实例
   * @param {object} backend - 存储后端，需实现 getItem/setItem/removeItem
   */
  function createStore(backend) {
    if (!backend) {
      if (typeof localStorage !== 'undefined') {
        backend = localStorage;
      } else {
        // 内存后端（兜底）
        var mem = {};
        backend = {
          getItem: function (k) { return mem[k] || null; },
          setItem: function (k, v) { mem[k] = v; },
          removeItem: function (k) { delete mem[k]; }
        };
      }
    }

    function _read(key, defaultValue) {
      try {
        var raw = backend.getItem(key);
        if (raw === null || raw === undefined) return defaultValue;
        return JSON.parse(raw);
      } catch (e) {
        return defaultValue;
      }
    }

    function _write(key, value) {
      backend.setItem(key, JSON.stringify(value));
    }

    // ========== 项目库 ==========
    function getProjects() {
      var projects = _read(KEYS.PROJECTS, null);
      if (!projects) {
        projects = JSON.parse(JSON.stringify(DEFAULT_PROJECTS));
        _write(KEYS.PROJECTS, projects);
      }
      // 兼容旧数据：补充折扣字段，默认1.0（不打折）
      var changed = false;
      projects.forEach(function (p) {
        if (p.vip1Discount === undefined) { p.vip1Discount = 1.0; changed = true; }
        if (p.vip2Discount === undefined) { p.vip2Discount = 1.0; changed = true; }
        if (p.vip3Discount === undefined) { p.vip3Discount = 1.0; changed = true; }
      });
      if (changed) saveProjects(projects);
      return projects;
    }

    function saveProjects(projects) {
      _write(KEYS.PROJECTS, projects);
    }

    function addProject(name, price, cost, vip1Discount, vip2Discount, vip3Discount) {
      var projects = getProjects();
      var proj = {
        id: genId('proj'),
        name: name,
        price: parseFloat(price) || 0,
        cost: parseFloat(cost) || 0,
        vip1Discount: vip1Discount !== undefined ? parseFloat(vip1Discount) : 1.0,
        vip2Discount: vip2Discount !== undefined ? parseFloat(vip2Discount) : 1.0,
        vip3Discount: vip3Discount !== undefined ? parseFloat(vip3Discount) : 1.0
      };
      projects.push(proj);
      saveProjects(projects);
      return proj;
    }

    function updateProject(id, updates) {
      var projects = getProjects();
      for (var i = 0; i < projects.length; i++) {
        if (projects[i].id === id) {
          if (updates.name !== undefined) projects[i].name = updates.name;
          if (updates.price !== undefined) projects[i].price = parseFloat(updates.price) || 0;
          if (updates.cost !== undefined) projects[i].cost = parseFloat(updates.cost) || 0;
          if (updates.vip1Discount !== undefined) projects[i].vip1Discount = parseFloat(updates.vip1Discount) || 1.0;
          if (updates.vip2Discount !== undefined) projects[i].vip2Discount = parseFloat(updates.vip2Discount) || 1.0;
          if (updates.vip3Discount !== undefined) projects[i].vip3Discount = parseFloat(updates.vip3Discount) || 1.0;
          saveProjects(projects);
          return projects[i];
        }
      }
      return null;
    }

    function deleteProject(id) {
      var projects = getProjects();
      for (var i = 0; i < projects.length; i++) {
        if (projects[i].id === id) {
          projects.splice(i, 1);
          saveProjects(projects);
          return true;
        }
      }
      return false;
    }

    function getProjectById(id) {
      var projects = getProjects();
      for (var i = 0; i < projects.length; i++) {
        if (projects[i].id === id) return projects[i];
      }
      return null;
    }

    function getProjectByName(name) {
      var projects = getProjects();
      for (var i = 0; i < projects.length; i++) {
        if (projects[i].name === name) return projects[i];
      }
      return null;
    }

    // ========== 客户 ==========
    function getCustomers() {
      return _read(KEYS.CUSTOMERS, []);
    }

    function saveCustomers(customers) {
      _write(KEYS.CUSTOMERS, customers);
    }

    function addCustomer(data) {
      var customers = getCustomers();
      var customer = {
        id: genId('cust'),
        name: data.name || '',
        contact: data.contact || '',
        phone: data.phone || '',
        address: data.address || '',
        vipType: data.vipType || 'normal',
        createdAt: new Date().toISOString()
      };
      customers.push(customer);
      saveCustomers(customers);
      return customer;
    }

    function updateCustomer(id, updates) {
      var customers = getCustomers();
      for (var i = 0; i < customers.length; i++) {
        if (customers[i].id === id) {
          if (updates.name !== undefined) customers[i].name = updates.name;
          if (updates.contact !== undefined) customers[i].contact = updates.contact;
          if (updates.phone !== undefined) customers[i].phone = updates.phone;
          if (updates.address !== undefined) customers[i].address = updates.address;
          if (updates.vipType !== undefined) customers[i].vipType = updates.vipType;
          saveCustomers(customers);
          return customers[i];
        }
      }
      return null;
    }

    function deleteCustomer(id) {
      var customers = getCustomers();
      for (var i = 0; i < customers.length; i++) {
        if (customers[i].id === id) {
          customers.splice(i, 1);
          saveCustomers(customers);
          // 同时删除该客户的所有账单
          var bills = getBills();
          bills = bills.filter(function (b) { return b.customerId !== id; });
          saveBills(bills);
          return true;
        }
      }
      return false;
    }

    function getCustomerById(id) {
      var customers = getCustomers();
      for (var i = 0; i < customers.length; i++) {
        if (customers[i].id === id) return customers[i];
      }
      return null;
    }

    // ========== 账单 ==========
    function getBills() {
      return _read(KEYS.BILLS, []);
    }

    function saveBills(bills) {
      _write(KEYS.BILLS, bills);
    }

    function addBill(data) {
      var bills = getBills();
      var bill = {
        id: genId('bill'),
        customerId: data.customerId,
        date: data.date || new Date().toISOString().slice(0, 10),
        status: data.status || 'unpaid',
        items: data.items || [],
        total: data.total || 0,
        createdAt: new Date().toISOString()
      };
      bills.push(bill);
      saveBills(bills);
      return bill;
    }

    function updateBill(id, updates) {
      var bills = getBills();
      for (var i = 0; i < bills.length; i++) {
        if (bills[i].id === id) {
          if (updates.customerId !== undefined) bills[i].customerId = updates.customerId;
          if (updates.date !== undefined) bills[i].date = updates.date;
          if (updates.status !== undefined) bills[i].status = updates.status;
          if (updates.items !== undefined) bills[i].items = updates.items;
          if (updates.total !== undefined) bills[i].total = updates.total;
          saveBills(bills);
          return bills[i];
        }
      }
      return null;
    }

    function deleteBill(id) {
      var bills = getBills();
      for (var i = 0; i < bills.length; i++) {
        if (bills[i].id === id) {
          bills.splice(i, 1);
          saveBills(bills);
          return true;
        }
      }
      return false;
    }

    function getBillById(id) {
      var bills = getBills();
      for (var i = 0; i < bills.length; i++) {
        if (bills[i].id === id) return bills[i];
      }
      return null;
    }

    function getBillsByCustomer(customerId) {
      var bills = getBills();
      return bills.filter(function (b) { return b.customerId === customerId; });
    }

    /**
     * 计算客户累计消费
     */
    function getCustomerTotalSpent(customerId) {
      var bills = getBillsByCustomer(customerId);
      var total = 0;
      for (var i = 0; i < bills.length; i++) {
        total += parseFloat(bills[i].total) || 0;
      }
      return Math.round(total * 100) / 100;
    }

    /**
     * 获取客户未结账单数量
     */
    function getCustomerUnpaidCount(customerId) {
      var bills = getBillsByCustomer(customerId);
      var count = 0;
      for (var i = 0; i < bills.length; i++) {
        if (bills[i].status === 'unpaid') count++;
      }
      return count;
    }

    /**
     * 获取客户未结账单总金额
     */
    function getCustomerUnpaidAmount(customerId) {
      var bills = getBillsByCustomer(customerId);
      var total = 0;
      for (var i = 0; i < bills.length; i++) {
        if (bills[i].status === 'unpaid') {
          total += parseFloat(bills[i].total) || 0;
        }
      }
      return Math.round(total * 100) / 100;
    }

    // ========== 全量数据 ==========
    function exportAll() {
      return {
        customers: getCustomers(),
        bills: getBills(),
        projects: getProjects(),
        exportedAt: new Date().toISOString()
      };
    }

    function importAll(data) {
      if (data.customers) saveCustomers(data.customers);
      if (data.bills) saveBills(data.bills);
      if (data.projects) saveProjects(data.projects);
    }

    function clearAll() {
      backend.removeItem(KEYS.CUSTOMERS);
      backend.removeItem(KEYS.BILLS);
      backend.removeItem(KEYS.PROJECTS);
    }

    // ========== 自动备份 ==========
    function autoBackup() {
      var snapshot = {
        customers: getCustomers(),
        bills: getBills(),
        projects: getProjects(),
        backedUpAt: new Date().toISOString()
      };
      _write(KEYS.AUTO_BACKUP, snapshot);
      return snapshot.backedUpAt;
    }

    function getAutoBackupInfo() {
      var backup = _read(KEYS.AUTO_BACKUP, null);
      if (!backup) return null;
      return {
        backedUpAt: backup.backedUpAt,
        customerCount: (backup.customers || []).length,
        billCount: (backup.bills || []).length,
        projectCount: (backup.projects || []).length
      };
    }

    function restoreAutoBackup() {
      var backup = _read(KEYS.AUTO_BACKUP, null);
      if (!backup) return false;
      if (backup.customers) saveCustomers(backup.customers);
      if (backup.bills) saveBills(backup.bills);
      if (backup.projects) saveProjects(backup.projects);
      return true;
    }

    return {
      KEYS: KEYS,
      DEFAULT_PROJECTS: DEFAULT_PROJECTS,
      genId: genId,
      // 项目
      getProjects: getProjects,
      saveProjects: saveProjects,
      addProject: addProject,
      updateProject: updateProject,
      deleteProject: deleteProject,
      getProjectById: getProjectById,
      getProjectByName: getProjectByName,
      // 客户
      getCustomers: getCustomers,
      saveCustomers: saveCustomers,
      addCustomer: addCustomer,
      updateCustomer: updateCustomer,
      deleteCustomer: deleteCustomer,
      getCustomerById: getCustomerById,
      getCustomerTotalSpent: getCustomerTotalSpent,
      getCustomerUnpaidCount: getCustomerUnpaidCount,
      getCustomerUnpaidAmount: getCustomerUnpaidAmount,
      // 账单
      getBills: getBills,
      saveBills: saveBills,
      addBill: addBill,
      updateBill: updateBill,
      deleteBill: deleteBill,
      getBillById: getBillById,
      getBillsByCustomer: getBillsByCustomer,
      // 全量
      exportAll: exportAll,
      importAll: importAll,
      clearAll: clearAll,
      autoBackup: autoBackup,
      getAutoBackupInfo: getAutoBackupInfo,
      restoreAutoBackup: restoreAutoBackup
    };
  }

  return { createStore: createStore, KEYS: KEYS, DEFAULT_PROJECTS: DEFAULT_PROJECTS };
});
