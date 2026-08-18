/**
 * Supabase 云端数据层
 * 封装所有数据库操作，异步API
 */
(function (global) {
  'use strict';

  // ========== 配置（用户填入自己的Supabase项目信息） ==========
  var SUPABASE_URL = 'https://crqagywpczislvhgkvyl.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_kt0i7s9sXG-232EaFMmcVA_qAplLykO';
  // Supabase 认证用户（在Supabase后台创建的邮箱密码）
  var SUPABASE_EMAIL = '1073616877@qq.com';
  var SUPABASE_PASSWORD = 'xizdI0-moshub-koksym';
  // 网页访问密码
  var ACCESS_PASSWORD = 'Yan941207.';

  // ========== Supabase 客户端（使用原生fetch，不依赖官方库） ==========
  var SB = {
    url: SUPABASE_URL,
    key: SUPABASE_ANON_KEY,
    email: SUPABASE_EMAIL,
    sbPassword: SUPABASE_PASSWORD,
    accessPassword: ACCESS_PASSWORD,
    token: null,

    // 设置认证token
    setToken: function (token) {
      this.token = token;
      // 持久化到localStorage
      if (token) {
        localStorage.setItem('yipin_sb_token', token);
      } else {
        localStorage.removeItem('yipin_sb_token');
      }
    },

    // 获取存储的token
    getToken: function () {
      return this.token || localStorage.getItem('yipin_sb_token');
    },

    // 构建请求头
    headers: function () {
      var h = {
        'apikey': this.key,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      };
      var t = this.getToken();
      if (t) h['Authorization'] = 'Bearer ' + t;
      return h;
    },

    // ========== Auth 认证 ==========
    // 登录（邮箱密码）
    signIn: async function (email, password) {
      var res = await fetch(this.url + '/auth/v1/token?grant_type=password', {
        method: 'POST',
        headers: {
          'apikey': this.key,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: email, password: password })
      });
      var data = await res.json();
      if (data.access_token) {
        this.setToken(data.access_token);
        // 保存refresh_token和过期时间
        if (data.refresh_token) {
          try { sessionStorage.setItem('sb_refresh_token', data.refresh_token); } catch(e) {}
        }
        if (data.expires_in) {
          var expireAt = Date.now() + (data.expires_in - 60) * 1000; // 提前60秒刷新
          try { sessionStorage.setItem('sb_token_expire', String(expireAt)); } catch(e) {}
        }
        return { success: true, user: data.user };
      }
      return { success: false, error: data.error_description || data.msg || '登录失败' };
    },

    // 刷新token
    refreshToken: async function () {
      var refreshTokenStr = null;
      try { refreshTokenStr = sessionStorage.getItem('sb_refresh_token'); } catch(e) {}
      if (refreshTokenStr) {
        try {
          var res = await fetch(this.url + '/auth/v1/token?grant_type=refresh_token', {
            method: 'POST',
            headers: {
              'apikey': this.key,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ refresh_token: refreshTokenStr })
          });
          var data = await res.json();
          if (data.access_token) {
            this.setToken(data.access_token);
            if (data.refresh_token) {
              try { sessionStorage.setItem('sb_refresh_token', data.refresh_token); } catch(e) {}
            }
            if (data.expires_in) {
              var expireAt = Date.now() + (data.expires_in - 60) * 1000;
              try { sessionStorage.setItem('sb_token_expire', String(expireAt)); } catch(e) {}
            }
            return true;
          }
        } catch (e) {
          console.warn('refresh_token刷新失败，尝试用密码重新登录', e);
        }
      }
      // refresh_token不存在或失败，用邮箱密码重新登录
      try {
        var loginRes = await fetch(this.url + '/auth/v1/token?grant_type=password', {
          method: 'POST',
          headers: {
            'apikey': this.key,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ email: this.email, password: this.sbPassword })
        });
        var loginData = await loginRes.json();
        if (loginData.access_token) {
          this.setToken(loginData.access_token);
          if (loginData.refresh_token) {
            try { sessionStorage.setItem('sb_refresh_token', loginData.refresh_token); } catch(e) {}
          }
          if (loginData.expires_in) {
            var exp = Date.now() + (loginData.expires_in - 60) * 1000;
            try { sessionStorage.setItem('sb_token_expire', String(exp)); } catch(e) {}
          }
          return true;
        }
      } catch (e) {
        console.error('重新登录失败', e);
      }
      return false;
    },

    // 确保token有效（过期前自动刷新）
    ensureToken: async function () {
      var expireAt = null;
      try { expireAt = parseInt(sessionStorage.getItem('sb_token_expire') || '0', 10); } catch(e) {}
      // 没有过期记录（旧版本登录）或已过期，都刷新
      if (!expireAt || Date.now() > expireAt) {
        return await this.refreshToken();
      }
      return true;
    },

    // 登出
    signOut: function () {
      this.setToken(null);
      try {
        sessionStorage.removeItem('sb_refresh_token');
        sessionStorage.removeItem('sb_token_expire');
      } catch(e) {}
    },

    // 检查是否已登录
    isLoggedIn: function () {
      return !!this.getToken();
    },

    // ========== 通用请求（自动处理token过期刷新） ==========
    _request: async function (url, options) {
      await this.ensureToken();
      options.headers = this.headers();
      // 超时保护：30秒
      var controller = new AbortController();
      var timeoutId = setTimeout(function () { controller.abort(); }, 30000);
      options.signal = controller.signal;
      try {
        var res = await fetch(url, options);
      } finally {
        clearTimeout(timeoutId);
      }
      // 401且是JWT过期，刷新token后重试一次
      if (res.status === 401) {
        var refreshed = await this.refreshToken();
        if (refreshed) {
          options.headers = this.headers();
          var controller2 = new AbortController();
          var timeoutId2 = setTimeout(function () { controller2.abort(); }, 30000);
          options.signal = controller2.signal;
          try {
            res = await fetch(url, options);
          } finally {
            clearTimeout(timeoutId2);
          }
        }
      }
      return res;
    },

    // ========== 通用CRUD ==========
    // 查询表
    select: async function (table, query) {
      var url = this.url + '/rest/v1/' + table;
      if (query) url += '?' + query;
      try {
        var res = await this._request(url, { headers: this.headers() });
        if (!res.ok) throw new Error('查询失败(' + table + '): ' + res.status);
        return await res.json();
      } catch (e) {
        if (e.message && e.message.indexOf('查询失败') >= 0) throw e;
        throw new Error('查询失败(' + table + '): ' + e.message + ' [URL: ' + url + ']');
      }
    },

    // 插入
    insert: async function (table, data) {
      var url = this.url + '/rest/v1/' + table;
      try {
        var res = await this._request(url, {
          method: 'POST',
          headers: this.headers(),
          body: JSON.stringify(data)
        });
        if (!res.ok) {
          var errText = await res.text();
          throw new Error('插入失败(' + table + '): ' + res.status + ' ' + errText);
        }
        var text = await res.text();
        return text ? JSON.parse(text) : data;
      } catch (e) {
        if (e.message && e.message.indexOf('插入失败') >= 0) throw e;
        throw new Error('插入失败(' + table + '): ' + e.message + ' [URL: ' + url + ']');
      }
    },

    // 更新
    update: async function (table, id, data) {
      var url = this.url + '/rest/v1/' + table + '?id=eq.' + encodeURIComponent(id);
      var res = await this._request(url, {
        method: 'PATCH',
        headers: this.headers(),
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('更新失败: ' + res.status);
      return await res.json();
    },

    // 删除
    remove: async function (table, id) {
      var url = this.url + '/rest/v1/' + table + '?id=eq.' + encodeURIComponent(id);
      var res = await this._request(url, {
        method: 'DELETE',
        headers: this.headers()
      });
      if (!res.ok) throw new Error('删除失败: ' + res.status);
      return true;
    },

    // 清空表
    clear: async function (table) {
      var url = this.url + '/rest/v1/' + table + '?id=not.is.null';
      try {
        var res = await this._request(url, {
          method: 'DELETE',
          headers: this.headers()
        });
        if (!res.ok) throw new Error('清空失败(' + table + '): ' + res.status + ' ' + (await res.text()));
        return true;
      } catch (e) {
        if (e.message && e.message.indexOf('清空失败') >= 0) throw e;
        throw new Error('清空失败(' + table + '): ' + e.message + ' [URL: ' + url + ']');
      }
    }
  };

  // ========== 业务数据封装 ==========
  // 从日期字符串提取年份
  function extractYear(dateStr, createdAt) {
    if (dateStr) {
      var m = String(dateStr).match(/(\d{4})[-/年]/);
      if (m) return parseInt(m[1], 10);
    }
    if (createdAt) return new Date(createdAt).getFullYear();
    return new Date().getFullYear();
  }

  var CloudStore = {
    sb: SB,

    // ---- 客户 ----
    getCustomers: async function () {
      var rows = await SB.select('customers', 'select=*&order=created_at.desc');
      return rows.map(function (r) {
        return {
          id: r.id, name: r.name, contact: r.contact || '',
          phone: r.phone || '', address: r.address || '',
          vipType: r.vip_type || 'normal', createdAt: r.created_at
        };
      });
    },
    getCustomerById: async function (id) {
      var rows = await SB.select('customers', 'id=eq.' + encodeURIComponent(id));
      if (!rows.length) return null;
      var r = rows[0];
      return { id: r.id, name: r.name, contact: r.contact || '', phone: r.phone || '', address: r.address || '', vipType: r.vip_type || 'normal', createdAt: r.created_at };
    },
    getCustomerByName: async function (name) {
      var rows = await SB.select('customers', 'name=eq.' + encodeURIComponent(name));
      if (!rows.length) return null;
      var r = rows[0];
      return { id: r.id, name: r.name, contact: r.contact || '', phone: r.phone || '', address: r.address || '', vipType: r.vip_type || 'normal', createdAt: r.created_at };
    },
    addCustomer: async function (name, contact, phone, vipType, address) {
      var id = 'cust_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
      await SB.insert('customers', {
        id: id, name: name, contact: contact || '', phone: phone || '',
        address: address || '', vip_type: vipType || 'normal'
      });
      return { id: id, name: name, contact: contact || '', phone: phone || '', address: address || '', vipType: vipType || 'normal' };
    },
    updateCustomer: async function (id, data) {
      var update = {};
      if (data.name !== undefined) update.name = data.name;
      if (data.contact !== undefined) update.contact = data.contact;
      if (data.phone !== undefined) update.phone = data.phone;
      if (data.address !== undefined) update.address = data.address;
      if (data.vipType !== undefined) update.vip_type = data.vipType;
      await SB.update('customers', id, update);
      return true;
    },
    deleteCustomer: async function (id) {
      // 先删除该客户的所有账单
      var bills = await SB.select('bills', 'customer_id=eq.' + encodeURIComponent(id) + '&select=id');
      for (var i = 0; i < bills.length; i++) {
        await SB.remove('bills', bills[i].id);
      }
      await SB.remove('customers', id);
      return true;
    },

    // ---- 账单 ----
    getBills: async function () {
      var rows = await SB.select('bills', 'select=*&order=created_at.desc');
      return rows.map(function (r) {
        return { id: r.id, customerId: r.customer_id, date: r.date || '', year: r.year || extractYear(r.date, r.created_at), status: r.status || 'unpaid', total: parseFloat(r.total) || 0, items: r.items || [], createdAt: r.created_at };
      });
    },
    getBillById: async function (id) {
      var rows = await SB.select('bills', 'id=eq.' + encodeURIComponent(id));
      if (!rows.length) return null;
      var r = rows[0];
      return { id: r.id, customerId: r.customer_id, date: r.date || '', year: r.year || extractYear(r.date, r.created_at), status: r.status || 'unpaid', total: parseFloat(r.total) || 0, items: r.items || [], createdAt: r.created_at };
    },
    getBillsByCustomer: async function (customerId) {
      var rows = await SB.select('bills', 'customer_id=eq.' + encodeURIComponent(customerId) + '&order=created_at.desc');
      return rows.map(function (r) {
        return { id: r.id, customerId: r.customer_id, date: r.date || '', year: r.year || extractYear(r.date, r.created_at), status: r.status || 'unpaid', total: parseFloat(r.total) || 0, items: r.items || [], createdAt: r.created_at };
      });
    },
    addBill: async function (bill) {
      var id = bill.id || ('bill_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6));
      var billYear = bill.year || extractYear(bill.date, null);
      await SB.insert('bills', {
        id: id, customer_id: bill.customerId, date: bill.date || '',
        year: billYear,
        status: bill.status || 'unpaid', total: bill.total || 0,
        items: bill.items || []
      });
      return { id: id, customerId: bill.customerId, date: bill.date || '', year: billYear, status: bill.status || 'unpaid', total: bill.total || 0, items: bill.items || [] };
    },
    updateBill: async function (id, data) {
      var update = {};
      if (data.customerId !== undefined) update.customer_id = data.customerId;
      if (data.date !== undefined) { update.date = data.date; update.year = extractYear(data.date, null); }
      if (data.status !== undefined) update.status = data.status;
      if (data.total !== undefined) update.total = data.total;
      if (data.items !== undefined) update.items = data.items;
      await SB.update('bills', id, update);
      return true;
    },
    deleteBill: async function (id) {
      await SB.remove('bills', id);
      return true;
    },

    // ---- 项目 ----
    getProjects: async function () {
      var rows = await SB.select('projects', 'select=*&order=created_at.desc');
      return rows.map(function (r) {
        return {
          id: r.id, name: r.name, price: parseFloat(r.price) || 0,
          cost: parseFloat(r.cost) || 0,
          vip1Discount: parseFloat(r.vip1_discount) || 1.0,
          vip2Discount: parseFloat(r.vip2_discount) || 1.0,
          vip3Discount: parseFloat(r.vip3_discount) || 1.0
        };
      });
    },
    getProjectById: async function (id) {
      var rows = await SB.select('projects', 'id=eq.' + encodeURIComponent(id));
      if (!rows.length) return null;
      var r = rows[0];
      return { id: r.id, name: r.name, price: parseFloat(r.price) || 0, cost: parseFloat(r.cost) || 0, vip1Discount: parseFloat(r.vip1_discount) || 1.0, vip2Discount: parseFloat(r.vip2_discount) || 1.0, vip3Discount: parseFloat(r.vip3_discount) || 1.0 };
    },
    getProjectByName: async function (name) {
      var rows = await SB.select('projects', 'name=eq.' + encodeURIComponent(name));
      if (!rows.length) return null;
      var r = rows[0];
      return { id: r.id, name: r.name, price: parseFloat(r.price) || 0, cost: parseFloat(r.cost) || 0, vip1Discount: parseFloat(r.vip1_discount) || 1.0, vip2Discount: parseFloat(r.vip2_discount) || 1.0, vip3Discount: parseFloat(r.vip3_discount) || 1.0 };
    },
    addProject: async function (name, price, cost, vip1Discount, vip2Discount, vip3Discount) {
      var id = 'proj_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
      await SB.insert('projects', {
        id: id, name: name, price: price || 0, cost: cost || 0,
        vip1_discount: vip1Discount || 1.0, vip2_discount: vip2Discount || 1.0, vip3_discount: vip3Discount || 1.0
      });
      return { id: id, name: name, price: price || 0, cost: cost || 0, vip1Discount: vip1Discount || 1.0, vip2Discount: vip2Discount || 1.0, vip3Discount: vip3Discount || 1.0 };
    },
    updateProject: async function (id, data) {
      var update = {};
      if (data.name !== undefined) update.name = data.name;
      if (data.price !== undefined) update.price = data.price;
      if (data.cost !== undefined) update.cost = data.cost;
      if (data.vip1Discount !== undefined) update.vip1_discount = data.vip1Discount;
      if (data.vip2Discount !== undefined) update.vip2_discount = data.vip2Discount;
      if (data.vip3Discount !== undefined) update.vip3_discount = data.vip3Discount;
      await SB.update('projects', id, update);
      return true;
    },
    deleteProject: async function (id) {
      await SB.remove('projects', id);
      return true;
    },

    // ---- 全量导出/导入 ----
    exportAll: async function () {
      var [customers, bills, projects] = await Promise.all([
        this.getCustomers(), this.getBills(), this.getProjects()
      ]);
      return { customers: customers, bills: bills, projects: projects };
    },
    importAll: async function (data) {
      // 清空后全量导入
      await SB.clear('bills');
      await SB.clear('customers');
      await SB.clear('projects');
      if (data.customers) {
        for (var i = 0; i < data.customers.length; i++) {
          var c = data.customers[i];
          await SB.insert('customers', { id: c.id, name: c.name, contact: c.contact || '', phone: c.phone || '', address: c.address || '', vip_type: c.vipType || 'normal' });
        }
      }
      if (data.bills) {
        for (var j = 0; j < data.bills.length; j++) {
          var b = data.bills[j];
          await SB.insert('bills', { id: b.id, customer_id: b.customerId, date: b.date || '', year: b.year || extractYear(b.date, b.createdAt), status: b.status || 'unpaid', total: b.total || 0, items: b.items || [] });
        }
      }
      if (data.projects) {
        for (var k = 0; k < data.projects.length; k++) {
          var p = data.projects[k];
          await SB.insert('projects', { id: p.id, name: p.name, price: p.price || 0, cost: p.cost || 0, vip1_discount: p.vip1Discount || 1.0, vip2_discount: p.vip2Discount || 1.0, vip3_discount: p.vip3Discount || 1.0 });
        }
      }
      return true;
    },
    clearAll: async function () {
      await SB.clear('bills');
      await SB.clear('customers');
      await SB.clear('projects');
      return true;
    },

    // ---- 自动备份 ----
    autoBackup: async function () {
      var data = await this.exportAll();
      await SB.insert('backups', {
        data: data,
        customer_count: data.customers.length,
        bill_count: data.bills.length,
        project_count: data.projects.length
      });
      return true;
    },
    getAutoBackupInfo: async function () {
      var rows = await SB.select('backups', 'select=*&order=created_at.desc&limit=1');
      if (!rows.length) return null;
      var r = rows[0];
      return { backedUpAt: r.created_at, customerCount: r.customer_count, billCount: r.bill_count, projectCount: r.project_count, data: r.data };
    },
    restoreAutoBackup: async function () {
      var info = await this.getAutoBackupInfo();
      if (!info) return false;
      await this.importAll(info.data);
      return true;
    }
  };

  global.CloudStore = CloudStore;
  global.SB = SB;
})(typeof window !== 'undefined' ? window : this);
