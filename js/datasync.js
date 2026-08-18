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
        var hasCloudData = cloudData.customers.length > 0 || cloudData.bills.length > 0 || cloudData.projects.length > 0;
        var hasLocalData = localData.customers.length > 0 || localData.bills.length > 0 || localData.projects.length > 0;

        if (hasCloudData && !hasLocalData) {
          // 云端有数据，本地为空，拉取到本地
          store.importAll(cloudData);
          console.log('已从云端同步数据：' + cloudData.customers.length + '客户，' + cloudData.bills.length + '账单，' + cloudData.projects.length + '项目');
        } else if (hasCloudData && hasLocalData) {
          // 两边都有数据，比较客户数量，用数据多的一方
          if (cloudData.customers.length >= localData.customers.length) {
            store.importAll(cloudData);
            console.log('云端数据较新，已拉取：' + cloudData.customers.length + '客户');
          } else {
            console.log('本地数据较多，同步到云端');
            await this.syncToCloud();
          }
        } else if (!hasCloudData && hasLocalData) {
          // 云端为空，本地有数据，同步本地到云端
          console.log('云端为空，同步本地数据到云端');
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
        // 安全保护：本地数据为空时不同步，防止清空云端
        if (data.customers.length === 0 && data.bills.length === 0 && data.projects.length === 0) {
          console.warn('[同步] 本地数据为空，跳过同步以保护云端数据');
          this.isSyncing = false;
          return;
        }
        console.log('[同步] 开始：' + data.customers.length + '客户，' + data.bills.length + '账单，' + data.projects.length + '项目');

        step = '清空账单表';
        await CloudStore.sb.clear('bills');
        step = '清空客户表';
        await CloudStore.sb.clear('customers');
        step = '清空项目表';
        await CloudStore.sb.clear('projects');

        step = '插入客户数据';
        for (var i = 0; i < data.customers.length; i++) {
          var c = data.customers[i];
          await CloudStore.sb.insert('customers', {
            id: c.id, name: c.name, contact: c.contact || '', phone: c.phone || '',
            address: c.address || '', vip_type: c.vipType || 'normal'
          });
        }
        step = '插入账单数据';
        for (var j = 0; j < data.bills.length; j++) {
          var b = data.bills[j];
          // 确保有year字段
          var billYear = b.year;
          if (!billYear && b.date) {
            var m = String(b.date).match(/(\d{4})[-/年]/);
            if (m) billYear = parseInt(m[1], 10);
          }
          if (!billYear && b.createdAt) billYear = new Date(b.createdAt).getFullYear();
          if (!billYear) billYear = new Date().getFullYear();
          await CloudStore.sb.insert('bills', {
            id: b.id, customer_id: b.customerId, date: b.date || '',
            year: billYear,
            status: b.status || 'unpaid', total: b.total || 0, items: b.items || []
          });
        }
        step = '插入项目数据';
        for (var k = 0; k < data.projects.length; k++) {
          var p = data.projects[k];
          await CloudStore.sb.insert('projects', {
            id: p.id, name: p.name, price: p.price || 0, cost: p.cost || 0,
            vip1_discount: p.vip1Discount || 1.0, vip2_discount: p.vip2Discount || 1.0, vip3_discount: p.vip3Discount || 1.0
          });
        }
        console.log('[同步] 完成');
      } catch (e) {
        console.error('[同步] 失败在步骤：' + step, e);
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
