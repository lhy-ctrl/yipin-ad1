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
        var hasCloudData = cloudData.customers.length > 0 || cloudData.bills.length > 0 || cloudData.projects.length > 0;
        if (hasCloudData) {
          // 云端有数据，拉取到本地
          store.importAll(cloudData);
          console.log('已从云端同步数据：' + cloudData.customers.length + '客户，' + cloudData.bills.length + '账单，' + cloudData.projects.length + '项目');
        } else {
          // 云端为空，把本地数据同步到云端
          console.log('云端为空，同步本地数据到云端');
          await this.syncToCloud();
        }
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
          await CloudStore.sb.insert('bills', {
            id: b.id, customer_id: b.customerId, date: b.date || '',
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
