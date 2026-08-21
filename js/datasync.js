/**
 * 数据同步层
 * 登录后从云端拉取数据到localStorage，数据变更后异步同步到云端
 */
(function (global) {
  'use strict';

  // 创建store实例（操作同一个localStorage，与app.js中的store数据一致）
  var store = global.Store ? global.Store.createStore() : null;

  var DataSync = {
    isSyncing: false,
    pendingSync: false,

    // 登录并拉取云端数据
    login: async function (email, password) {
      var result = await CloudStore.sb.signIn(email, password);
      if (!result.success) return result;
      // 登录成功，检查云端是否有数据
      try {
        var cloudData = await CloudStore.exportAll();
        var localData = store.exportAll();
        var cloudCount = cloudData.customers.length + cloudData.bills.length + cloudData.projects.length;
        var localCount = localData.customers.length + localData.bills.length + localData.projects.length;
        // 云端数据异常检查：有账单但无客户
        var cloudAbnormal = cloudData.bills.length > 0 && cloudData.customers.length === 0;
        var hasCloudData = cloudCount > 0 && !cloudAbnormal;
        var hasLocalData = localCount > 0;

        if (hasCloudData && !hasLocalData) {
          // 云端有数据，本地为空，拉取到本地
          store.importAll(cloudData);
          console.log('已从云端同步数据：' + cloudData.customers.length + '客户，' + cloudData.bills.length + '账单，' + cloudData.projects.length + '项目');
        } else if (hasCloudData && hasLocalData) {
          // 两边都有数据，用数据总量多的一方
          if (cloudCount >= localCount) {
            store.importAll(cloudData);
            console.log('云端数据较多，已拉取：' + cloudCount + '条');
          } else {
            console.log('本地数据较多，同步到云端：' + localCount + '条');
            await this.syncToCloud();
          }
        } else if (!hasCloudData && hasLocalData) {
          // 云端为空或异常，本地有数据，同步本地到云端
          console.log('云端为空/异常，同步本地数据到云端：' + localCount + '条');
          await this.syncToCloud();
        }
        // 两边都为空，什么都不做
      } catch (e) {
        console.warn('云端数据同步失败，使用本地数据', e);
      }
      return { success: true };
    },

    // 登出
    logout: function () {
      CloudStore.sb.signOut();
    },

    // 检查登录状态
    isLoggedIn: function () {
      return CloudStore.sb.isLoggedIn();
    },

    // 从云端拉取全量数据到localStorage
    loadFromCloud: async function () {
      var data = await CloudStore.exportAll();
      // 导入到localStorage（覆盖）
      store.importAll(data);
      console.log('已从云端同步数据：' + data.customers.length + '客户，' + data.bills.length + '账单，' + data.projects.length + '项目');
    },

    // 把localStorage数据同步到云端（全量覆盖）
    syncToCloud: async function () {
      if (this.isSyncing) {
        this.pendingSync = true;
        return;
      }
      if (!this.isLoggedIn()) return;

      this.isSyncing = true;
      var step = '开始';
      try {
        step = '读取本地数据';
        var data = store.exportAll();
        // 安全保护：本地数据异常时不同步，防止清空云端
        var allEmpty = data.customers.length === 0 && data.bills.length === 0 && data.projects.length === 0;
        var hasBillsNoCustomer = data.bills.length > 0 && data.customers.length === 0;
        if (allEmpty) {
          console.warn('[同步] 本地数据全空，跳过同步以保护云端数据');
          this.isSyncing = false;
          return;
        }
        if (hasBillsNoCustomer) {
          console.warn('[同步] 本地有账单但无客户，数据异常，跳过同步');
          this.isSyncing = false;
          return;
        }
        console.log('[同步] 开始：' + data.customers.length + '客户，' + data.bills.length + '账单，' + data.projects.length + '项目');

        // 同步前先备份云端数据，失败可恢复
        step = '备份云端数据';
        var cloudBackup = null;
        try {
          cloudBackup = await CloudStore.exportAll();
        } catch (e) {
          console.warn('[同步] 云端备份失败，继续同步', e);
        }

        // 组装批量数据
        step = '组装数据';
        var customersBatch = data.customers.map(function (c) {
          return {
            id: c.id, name: c.name, contact: c.contact || '', phone: c.phone || '',
            address: c.address || '', vip_type: c.vipType || 'normal'
          };
        });
        var billsBatch = data.bills.map(function (b) {
          var billYear = b.year;
          if (!billYear && b.date) {
            var m = String(b.date).match(/(\d{4})[-/年]/);
            if (m) billYear = parseInt(m[1], 10);
          }
          if (!billYear && b.createdAt) billYear = new Date(b.createdAt).getFullYear();
          if (!billYear) billYear = new Date().getFullYear();
          return {
            id: b.id, customer_id: b.customerId, date: b.date || '',
            year: billYear,
            status: b.status || 'unpaid', total: b.total || 0, items: b.items || []
          };
        });
        var projectsBatch = data.projects.map(function (p) {
          return {
            id: p.id, name: p.name, price: p.price || 0, cost: p.cost || 0,
            vip1_discount: p.vip1Discount || 1.0, vip2_discount: p.vip2Discount || 1.0, vip3_discount: p.vip3Discount || 1.0
          };
        });

        step = '清空账单表';
        await CloudStore.sb.clear('bills');
        step = '清空客户表';
        await CloudStore.sb.clear('customers');
        step = '清空项目表';
        await CloudStore.sb.clear('projects');

        step = '批量插入客户';
        if (customersBatch.length > 0) await CloudStore.sb.insert('customers', customersBatch);
        step = '批量插入账单';
        if (billsBatch.length > 0) await CloudStore.sb.insert('bills', billsBatch);
        step = '批量插入项目';
        if (projectsBatch.length > 0) await CloudStore.sb.insert('projects', projectsBatch);
        console.log('[同步] 完成');
      } catch (e) {
        console.error('[同步] 失败在步骤：' + step, e);
        // 同步失败，恢复云端备份
        if (cloudBackup) {
          try {
            console.warn('[同步] 正在恢复云端数据...');
            await CloudStore.importAll(cloudBackup);
            console.warn('[同步] 云端数据已恢复');
          } catch (restoreErr) {
            console.error('[同步] 云端数据恢复失败', restoreErr);
          }
        }
        this.isSyncing = false;
        throw new Error(step + ': ' + e.message);
      }
      this.isSyncing = false;
      if (this.pendingSync) {
        this.pendingSync = false;
        this.syncToCloud();
      }
    },

    // 自动备份到云端
    backupToCloud: async function () {
      if (!this.isLoggedIn()) return false;
      try {
        await CloudStore.autoBackup();
        return true;
      } catch (e) {
        console.error('云端备份失败', e);
        return false;
      }
    }
  };

  global.DataSync = DataSync;
})(typeof window !== 'undefined' ? window : this);
