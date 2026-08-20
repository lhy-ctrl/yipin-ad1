/**
 * app.js - 主应用：路由、导航、页面渲染、通用工具
 */

(function () {
  'use strict';

  // ========== 全局实例 ==========
  var store = Store.createStore();

  // 数据变更标记：有未备份的变更时为true
  var hasUnsavedChanges = false;
  var syncTimer = null;
  function markChanged() {
    hasUnsavedChanges = true;
    // 异步同步到云端（非本地模式且已登录），2秒防抖
    if (typeof sessionStorage === 'undefined') return;
    var isLocalMode = sessionStorage.getItem('yipin_local_mode') === '1';
    if (!isLocalMode && typeof DataSync !== 'undefined' && DataSync.isLoggedIn()) {
      if (syncTimer) clearTimeout(syncTimer);
      syncTimer = setTimeout(function () {
        DataSync.syncToCloud();
      }, 2000);
    }
  }

  // ========== VIP 类型映射 ==========
  var VIP_LABELS = {
    normal: '普通客户',
    vip1: '普通VIP',
    vip2: '中级VIP',
    vip3: '高级VIP'
  };

  var VIP_CLASS = {
    normal: 'vip-normal',
    vip1: 'vip-vip1',
    vip2: 'vip-vip2',
    vip3: 'vip-vip3'
  };

  // ========== SVG 线性图标集（2px线条，圆角线帽，无填充） ==========
  function svgIcon(paths, size) {
    size = size || 16;
    return '<svg class="icon-inline" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + paths + '</svg>';
  }

  var ICONS = {
    users: svgIcon('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
    alertCircle: svgIcon('<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>'),
    checkCircle: svgIcon('<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>'),
    lock: svgIcon('<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'),
    upload: svgIcon('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>'),
    download: svgIcon('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>'),
    helpCircle: svgIcon('<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>'),
    fileText: svgIcon('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>'),
    printer: svgIcon('<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>'),
    image: svgIcon('<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>'),
    pencil: svgIcon('<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>'),
    plus: svgIcon('<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>'),
    search: svgIcon('<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>'),
    folder: svgIcon('<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>'),
    barChart: svgIcon('<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>'),
    archive: svgIcon('<polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/>')
  };

  // ========== 路由解析 ==========
  /**
   * 解析hash路由，返回 { name, params }
   * 支持: #/, #/customers, #/customer/:id, #/bill/:id, #/bill/:id/edit, #/customer/:id/new-bill
   */
  function parseRoute(hash) {
    hash = hash || '#/';
    var path = hash.replace(/^#/, '');
    if (path === '' || path === '/') return { name: 'home', params: {} };

    var parts = path.split('/').filter(Boolean);

    if (parts[0] === 'customers') return { name: 'customers', params: {} };
    if (parts[0] === 'projects') return { name: 'projects', params: {} };
    if (parts[0] === 'audit') return { name: 'audit', params: {} };
    if (parts[0] === 'backup') return { name: 'backup', params: {} };

    if (parts[0] === 'customer' && parts[1]) {
      if (parts[2] === 'new-bill') {
        return { name: 'new-bill', params: { customerId: parts[1] } };
      }
      return { name: 'customer-bills', params: { customerId: parts[1] } };
    }

    if (parts[0] === 'bill' && parts[1]) {
      if (parts[2] === 'edit') {
        return { name: 'bill-edit', params: { billId: parts[1] } };
      }
      return { name: 'bill-detail', params: { billId: parts[1] } };
    }

    return { name: 'home', params: {} };
  }

  // ========== 导航高亮 ==========
  function updateNavActive(routeName) {
    var items = document.querySelectorAll('.nav-item');
    var routeMap = {
      'home': 'home',
      'customer-bills': 'home',
      'bill-detail': 'home',
      'bill-edit': 'home',
      'new-bill': 'home',
      'customers': 'customers',
      'projects': 'projects',
      'audit': 'audit',
      'backup': 'backup'
    };
    var active = routeMap[routeName] || 'home';
    items.forEach(function (item) {
      if (item.getAttribute('data-route') === active) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
  }

  // ========== 通用工具 ==========
  function $(id) {
    return document.getElementById(id);
  }

  function showToast(msg, duration) {
    var toast = $('toast');
    toast.textContent = msg;
    toast.style.display = 'block';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(function () {
      toast.style.display = 'none';
    }, duration || 2000);
  }

  // 复制到剪贴板
  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(function () {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }
  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
  }

  var _modalKeyHandler = null;

  function showModal(title, bodyHtml, footerHtml, options) {
    options = options || {};
    $('modalTitle').textContent = title;
    $('modalBody').innerHTML = bodyHtml;
    $('modalFooter').innerHTML = footerHtml || '';
    $('modalOverlay').style.display = 'flex';
    if (options.modalClass) {
      $('modalBox').className = 'modal ' + options.modalClass;
    } else {
      $('modalBox').className = 'modal';
    }
    // 回车键触发确认按钮
    if (_modalKeyHandler) document.removeEventListener('keydown', _modalKeyHandler);
    _modalKeyHandler = function (e) {
      if (e.key !== 'Enter') return;
      if ($('modalOverlay').style.display !== 'flex') return;
      // 优先点击primary按钮，其次danger按钮
      var btn = $('modalFooter').querySelector('.btn-primary') || $('modalFooter').querySelector('.btn-danger');
      if (btn) {
        e.preventDefault();
        btn.click();
      }
    };
    document.addEventListener('keydown', _modalKeyHandler);
  }

  function hideModal() {
    $('modalOverlay').style.display = 'none';
    if (_modalKeyHandler) {
      document.removeEventListener('keydown', _modalKeyHandler);
      _modalKeyHandler = null;
    }
  }

  function confirmDialog(msg, onConfirm) {
    showModal('确认操作',
      '<p style="font-size:14px;color:#555;line-height:1.6;">' + msg + '</p>',
      '<button class="btn btn-default" id="confirmCancel">取消</button>' +
      '<button class="btn btn-danger" id="confirmOk">确认</button>'
    );
    $('confirmCancel').onclick = hideModal;
    $('confirmOk').onclick = function () {
      hideModal();
      onConfirm();
    };
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatMoney(num) {
    num = parseFloat(num) || 0;
    var s = num.toFixed(2);
    s = s.replace(/\.?0+$/, '');
    return s || '0';
  }

  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  function formatDateTime(isoStr) {
    if (!isoStr) return '';
    var d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0') + ' ' +
      String(d.getHours()).padStart(2, '0') + ':' +
      String(d.getMinutes()).padStart(2, '0');
  }

  // ========== 页面渲染函数（占位，后续阶段实现） ==========
  var pages = {};

  pages.home = function () {
    var currentYear = new Date().getFullYear();
    var customers = store.getCustomers();
    // 附加统计信息（仅当年）
    customers = customers.map(function (c) {
      c._total = store.getCustomerTotalSpent(c.id, currentYear);
      c._unpaidCount = store.getCustomerUnpaidCount(c.id, currentYear);
      c._unpaidAmount = store.getCustomerUnpaidAmount(c.id, currentYear);
      return c;
    }).sort(function (a, b) {
      return b._total - a._total;
    });

    var html = '<div class="page-header">' +
      '<div class="page-title">客户列表</div>' +
      '<div class="page-actions">' +
        '<input class="search-box" id="homeSearch" placeholder="搜索客户名称...">' +
        '<select class="form-select" id="homeFilter" style="width:120px;">' +
          '<option value="all">全部客户</option>' +
          '<option value="unpaid">有未结</option>' +
          '<option value="paid">已结清</option>' +
        '</select>' +
        '<button class="btn btn-primary" id="homeAddCust">' + ICONS.plus + ' 新增客户</button>' +
      '</div>' +
    '</div>';

    html += '<div id="customerGrid" class="customer-grid">';
    html += renderCustomerCards(customers);
    html += '</div>';

    $('mainContent').innerHTML = html;

    // 搜索和筛选
    function applyFilter() {
      var keyword = $('homeSearch').value.trim().toLowerCase();
      var filter = $('homeFilter').value;
      var filtered = customers.filter(function (c) {
        if (keyword && c.name.toLowerCase().indexOf(keyword) === -1) return false;
        if (filter === 'unpaid' && c._unpaidCount === 0) return false;
        if (filter === 'paid' && c._unpaidCount > 0) return false;
        return true;
      });
      $('customerGrid').innerHTML = renderCustomerCards(filtered);
      bindCardEvents();
    }

    $('homeSearch').oninput = applyFilter;
    $('homeFilter').onchange = applyFilter;

    // 新增客户
    $('homeAddCust').onclick = function () {
      showCustomerForm(null);
      // 弹窗关闭后刷新
      var origClose = hideModal;
      var checkClose = setInterval(function () {
        if ($('modalOverlay').style.display === 'none') {
          clearInterval(checkClose);
          pages.home();
        }
      }, 200);
    };

    bindCardEvents();
  };

  function renderCustomerCards(customers) {
    if (!customers || customers.length === 0) {
      return '<div class="empty-state" style="grid-column:1/-1;"><div class="empty-icon">' + ICONS.users + '</div><div class="empty-text">暂无客户，点击右上角新增</div></div>';
    }

    var html = '';
    customers.forEach(function (c) {
      var unpaidBadge = c._unpaidCount > 0
        ? '<div class="unpaid-badge">' + c._unpaidCount + '单未结</div>'
        : '';
      var statusHtml = c._unpaidCount > 0
        ? '<div class="cust-unpaid">' + ICONS.alertCircle + ' ' + c._unpaidCount + '单未结，¥' + formatMoney(c._unpaidAmount) + '</div>'
        : '<div class="cust-paid">' + ICONS.checkCircle + ' 已结清</div>';

      html += '<div class="customer-card" data-id="' + c.id + '">' +
        unpaidBadge +
        '<div class="cust-name">' + escapeHtml(c.name) + '</div>' +
        '<span class="cust-vip ' + (VIP_CLASS[c.vipType] || 'vip-normal') + '">' + (VIP_LABELS[c.vipType] || '普通客户') + '</span>' +
        '<div class="cust-total">¥' + formatMoney(c._total) + '</div>' +
        statusHtml +
        '<button class="btn btn-primary btn-sm cust-action">查看账单</button>' +
      '</div>';
    });
    return html;
  }

  function bindCardEvents() {
    document.querySelectorAll('.customer-card').forEach(function (card) {
      card.onclick = function () {
        var id = this.getAttribute('data-id');
        location.hash = '#/customer/' + id;
      };
    });
  }

  pages.customers = function () {
    var customers = store.getCustomers();
    // 按累计消费降序
    customers = customers.map(function (c) {
      c._total = store.getCustomerTotalSpent(c.id);
      return c;
    }).sort(function (a, b) {
      return b._total - a._total;
    });

    var html = '<div class="page-header">' +
      '<div class="page-title">客户管理</div>' +
      '<div class="page-actions">' +
        '<button class="btn btn-primary" id="addCustomerBtn">' + ICONS.plus + ' 新增客户</button>' +
      '</div>' +
    '</div>';

    if (customers.length === 0) {
      html += '<div class="empty-state"><div class="empty-icon">' + ICONS.users + '</div><div class="empty-text">暂无客户，点击右上角新增</div></div>';
    } else {
      html += '<table class="data-table"><thead><tr>' +
        '<th>客户名称</th><th>联系人</th><th>联系电话</th><th>地址</th><th>VIP类型</th><th>累计消费</th><th>操作</th>' +
        '</tr></thead><tbody>';
      customers.forEach(function (c) {
        html += '<tr>' +
          '<td><a class="cust-name-link" data-id="' + c.id + '" style="font-weight:600;color:#2d3142;cursor:pointer;">' + escapeHtml(c.name) + '</a></td>' +
          '<td>' + escapeHtml(c.contact) + '</td>' +
          '<td>' + escapeHtml(c.phone) + '</td>' +
          '<td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + escapeHtml(c.address || '') + '">' + escapeHtml(c.address || '') + '</td>' +
          '<td><span class="cust-vip ' + (VIP_CLASS[c.vipType] || 'vip-normal') + '">' + (VIP_LABELS[c.vipType] || '普通客户') + '</span></td>' +
          '<td style="color:#6366f1;font-weight:600;">¥' + formatMoney(c._total) + '</td>' +
          '<td>' +
            '<button class="btn-link copy-cust" data-id="' + c.id + '" title="复制联系人、电话、地址">复制</button>' +
            '<button class="btn-link edit-cust" data-id="' + c.id + '">编辑</button>' +
            '<button class="btn-link danger del-cust" data-id="' + c.id + '">删除</button>' +
          '</td>' +
        '</tr>';
      });
      html += '</tbody></table>';
    }

    $('mainContent').innerHTML = html;

    // 新增客户
    $('addCustomerBtn').onclick = function () {
      showCustomerForm(null);
    };

    // 编辑客户
    document.querySelectorAll('.edit-cust').forEach(function (btn) {
      btn.onclick = function () {
        showCustomerForm(this.getAttribute('data-id'));
      };
    });

    // 点击客户名称进入编辑
    document.querySelectorAll('.cust-name-link').forEach(function (link) {
      link.onclick = function () {
        showCustomerForm(this.getAttribute('data-id'));
      };
    });

    // 一键复制联系人、电话、地址
    document.querySelectorAll('.copy-cust').forEach(function (btn) {
      btn.onclick = function () {
        var id = this.getAttribute('data-id');
        var c = store.getCustomerById(id);
        var text = '联系人：' + (c.contact || '') + '\n电话：' + (c.phone || '') + '\n地址：' + (c.address || '');
        copyToClipboard(text);
        showToast('已复制联系人信息');
      };
    });

    // 删除客户
    document.querySelectorAll('.del-cust').forEach(function (btn) {
      btn.onclick = function () {
        var id = this.getAttribute('data-id');
        var cust = store.getCustomerById(id);
        var unpaidCount = store.getCustomerUnpaidCount(id);
        var msg = '确定删除客户「' + cust.name + '」吗？';
        if (unpaidCount > 0) {
          msg += '<br><br><span style="color:#ff4d4f;">该客户有 ' + unpaidCount + ' 单未结账单，删除后将一并删除！</span>';
        }
        confirmDialog(msg, function () {
          store.deleteCustomer(id);
          markChanged();
          showToast('客户已删除');
          pages.customers();
        });
      };
    });
  };

  // 客户表单弹窗
  function showCustomerForm(customerId) {
    var isEdit = !!customerId;
    var cust = isEdit ? store.getCustomerById(customerId) : { name: '', contact: '', phone: '', address: '', vipType: 'normal' };

    var body = '<div class="form-group">' +
        '<label class="form-label">客户名称 *</label>' +
        '<input class="form-input" id="custName" value="' + escapeHtml(cust.name) + '" placeholder="请输入客户名称">' +
      '</div>' +
      '<div class="form-row">' +
        '<div class="form-group">' +
          '<label class="form-label">联系人</label>' +
          '<input class="form-input" id="custContact" value="' + escapeHtml(cust.contact) + '" placeholder="请输入联系人">' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label">联系电话</label>' +
          '<input class="form-input" id="custPhone" value="' + escapeHtml(cust.phone) + '" placeholder="请输入联系电话">' +
        '</div>' +
      '</div>' +
      '<div class="form-group">' +
        '<label class="form-label">地址</label>' +
        '<input class="form-input" id="custAddress" value="' + escapeHtml(cust.address || '') + '" placeholder="请输入地址">' +
      '</div>' +
      '<div class="form-group">' +
        '<label class="form-label">VIP类型</label>' +
        '<select class="form-select" id="custVip">' +
          '<option value="normal"' + (cust.vipType === 'normal' ? ' selected' : '') + '>普通客户</option>' +
          '<option value="vip1"' + (cust.vipType === 'vip1' ? ' selected' : '') + '>普通VIP（设计费9折）</option>' +
          '<option value="vip2"' + (cust.vipType === 'vip2' ? ' selected' : '') + '>中级VIP（设计费7折）</option>' +
          '<option value="vip3"' + (cust.vipType === 'vip3' ? ' selected' : '') + '>高级VIP（设计费5折）</option>' +
        '</select>' +
      '</div>';

    var footer = '<button class="btn btn-default" id="custCancel">取消</button>' +
      '<button class="btn btn-primary" id="custSave">保存</button>';

    showModal(isEdit ? '编辑客户' : '新增客户', body, footer);

    $('custCancel').onclick = hideModal;
    $('custSave').onclick = function () {
      var name = $('custName').value.trim();
      if (!name) {
        showToast('请输入客户名称');
        return;
      }
      var data = {
        name: name,
        contact: $('custContact').value.trim(),
        phone: $('custPhone').value.trim(),
        address: $('custAddress').value.trim(),
        vipType: $('custVip').value
      };
      if (isEdit) {
        store.updateCustomer(customerId, data);
        showToast('客户已更新');
      } else {
        store.addCustomer(data);
        showToast('客户已添加');
      }
      markChanged();
      hideModal();
      pages.customers();
    };
  }

  pages.projects = function () {
    var projects = store.getProjects();

    var html = '<div class="page-header">' +
      '<div class="page-title">项目库</div>' +
      '<div class="page-actions">' +
        '<button class="btn btn-primary" id="addProjectBtn">' + ICONS.plus + ' 新增项目</button>' +
      '</div>' +
    '</div>';

    html += '<p style="color:#8b93a7;margin-bottom:12px;font-size:12px;">点击任意单元格可修改，失焦自动保存。折扣填数字，如 9 表示9折，10 表示不打折。</p>';

    html += '<table class="data-table" id="projectsTable"><thead><tr>' +
      '<th>项目名称</th><th>售价（元）</th><th>成本（元）</th><th>普通VIP折扣</th><th>中级VIP折扣</th><th>高级VIP折扣</th><th>操作</th>' +
      '</tr></thead><tbody id="projectsTbody">';

    projects.forEach(function (p) {
      html += renderProjectRow(p);
    });

    html += '</tbody></table>';
    html += '<button class="add-row-btn" id="addProjectRowBtn">' + ICONS.plus + ' 添加一行</button>';

    $('mainContent').innerHTML = html;

    // 绑定现有行的点击编辑
    bindProjectRowEvents();

    // 右上角新增项目（弹窗）
    $('addProjectBtn').onclick = function () {
      showProjectForm();
    };

    // 添加一行
    $('addProjectRowBtn').onclick = function () {
      addNewProjectRow();
    };
  };

  // 折扣率转折数显示（0.95 → 9.5，1.0 → 10）
  function formatDiscount(rate) {
    var val = parseFloat(rate) || 1.0;
    var d = Math.round(val * 100) / 10;
    // 去掉末尾多余的0
    return parseFloat(d.toFixed(1));
  }

  // 渲染普通项目行（文本显示，点击编辑）
  function renderProjectRow(p) {
    var d1 = p.vip1Discount !== undefined ? formatDiscount(p.vip1Discount) : 10;
    var d2 = p.vip2Discount !== undefined ? formatDiscount(p.vip2Discount) : 10;
    var d3 = p.vip3Discount !== undefined ? formatDiscount(p.vip3Discount) : 10;
    return '<tr data-id="' + p.id + '">' +
      '<td>' + projCell('name', p.id, p.name, 'text') + '</td>' +
      '<td>' + projCell('price', p.id, p.price, 'number') + '</td>' +
      '<td>' + projCell('cost', p.id, p.cost, 'number') + '</td>' +
      '<td>' + projCell('vip1Discount', p.id, d1, 'number', '折') + '</td>' +
      '<td>' + projCell('vip2Discount', p.id, d2, 'number', '折') + '</td>' +
      '<td>' + projCell('vip3Discount', p.id, d3, 'number', '折') + '</td>' +
      '<td><button class="btn-link danger del-proj" data-id="' + p.id + '">删除</button></td>' +
    '</tr>';
  }

  // 生成一个可点击编辑的单元格
  function projCell(field, id, value, type, suffix) {
    var displayVal = (value === undefined || value === null) ? '' : value;
    var suffixHtml = suffix ? '<span class="cell-suffix">' + suffix + '</span>' : '';
    var isDiscount = /Discount/.test(field);
    var stepAttr = isDiscount ? ' step="0.1" min="1" max="10"' : '';
    return '<div class="editable-cell">' +
      '<span class="proj-cell-display" data-field="' + field + '" data-id="' + id + '">' + escapeHtml(displayVal) + '</span>' +
      '<input class="form-input proj-cell-input" data-field="' + field + '" data-id="' + id + '" type="' + (type || 'text') + '" value="' + escapeHtml(displayVal) + '" style="display:none;"' + stepAttr + '>' +
      suffixHtml +
    '</div>';
  }

  // 绑定项目行的点击编辑事件
  function bindProjectRowEvents() {
    // 点击文本进入编辑
    document.querySelectorAll('.proj-cell-display').forEach(function (span) {
      span.onclick = function () {
        var input = this.nextElementSibling;
        this.style.display = 'none';
        input.style.display = 'inline-block';
        input.focus();
        input.select();
      };
    });

    // 输入框失焦保存
    document.querySelectorAll('.proj-cell-input').forEach(function (input) {
      input.onblur = function () {
        saveProjectCell(this);
      };
      input.onkeydown = function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.blur();
        }
      };
    });

    // 删除项目
    document.querySelectorAll('.del-proj').forEach(function (btn) {
      btn.onclick = function () {
        var id = this.getAttribute('data-id');
        var proj = store.getProjectById(id);
        confirmDialog('确定删除项目「' + proj.name + '」吗？', function () {
          store.deleteProject(id);
          markChanged();
          showToast('项目已删除');
          pages.projects();
        });
      };
    });
  }

  // 保存单个单元格
  function saveProjectCell(input) {
    var id = input.getAttribute('data-id');
    var field = input.getAttribute('data-field');
    var span = input.previousElementSibling;
    var val = input.value.trim();

    // 验证并保存
    if (field === 'name') {
      if (!val) {
        showToast('项目名称不能为空');
        var proj = store.getProjectById(id);
        input.value = proj ? proj.name : '';
        return;
      }
      var existing = store.getProjectByName(val);
      if (existing && existing.id !== id) {
        showToast('该项目名称已存在');
        var proj2 = store.getProjectById(id);
        input.value = proj2 ? proj2.name : '';
        return;
      }
      store.updateProject(id, { name: val });
      span.textContent = val;
    } else if (field === 'price' || field === 'cost') {
      var num = parseFloat(val);
      if (isNaN(num) || num < 0) {
        showToast('请输入有效的数字');
        var proj3 = store.getProjectById(id);
        input.value = proj3 ? proj3[field] : 0;
        return;
      }
      var update = {};
      update[field] = num;
      store.updateProject(id, update);
      span.textContent = num;
    } else if (field === 'vip1Discount' || field === 'vip2Discount' || field === 'vip3Discount') {
      var d = parseFloat(val);
      if (isNaN(d) || d < 1 || d > 10) {
        showToast('折扣请输入1-10之间的数字');
        var proj4 = store.getProjectById(id);
        var cur = proj4 ? (proj4[field] || 1.0) : 1.0;
        input.value = formatDiscount(cur);
        return;
      }
      var update2 = {};
      update2[field] = d / 10;
      store.updateProject(id, update2);
      span.textContent = formatDiscount(d / 10);
    }

    markChanged();
    // 切换回文本显示
    input.style.display = 'none';
    span.style.display = '';
  }

  // 添加新行（内联新增）
  function addNewProjectRow() {
    var tbody = $('projectsTbody');
    var tr = document.createElement('tr');
    tr.className = 'new-project-row';
    tr.innerHTML =
      '<td><input class="form-input new-name" placeholder="项目名称" style="width:100%;"></td>' +
      '<td><input class="form-input new-price" type="number" min="0" step="0.01" value="0" style="width:100%;text-align:center;"></td>' +
      '<td><input class="form-input new-cost" type="number" min="0" step="0.01" value="0" style="width:100%;text-align:center;"></td>' +
      '<td><div class="editable-cell"><input class="form-input new-d1" type="number" min="1" max="10" step="0.1" value="10"><span class="cell-suffix">折</span></div></td>' +
      '<td><div class="editable-cell"><input class="form-input new-d2" type="number" min="1" max="10" step="0.1" value="10"><span class="cell-suffix">折</span></div></td>' +
      '<td><div class="editable-cell"><input class="form-input new-d3" type="number" min="1" max="10" step="0.1" value="10"><span class="cell-suffix">折</span></div></td>' +
      '<td>' +
        '<div style="display:flex;gap:8px;align-items:center;justify-content:center;white-space:nowrap;">' +
          '<button class="btn-link save-new-proj" style="color:#10b981;">保存</button>' +
          '<button class="btn-link cancel-new-proj" style="color:#8b93a7;">取消</button>' +
        '</div>' +
      '</td>';
    tbody.appendChild(tr);

    // 聚焦到名称输入框
    tr.querySelector('.new-name').focus();

    // 保存（通过行引用，不依赖id）
    tr.querySelector('.save-new-proj').onclick = function () {
      var name = tr.querySelector('.new-name').value.trim();
      if (!name) { showToast('请输入项目名称'); return; }
      if (store.getProjectByName(name)) { showToast('该项目名称已存在'); return; }
      var price = parseFloat(tr.querySelector('.new-price').value) || 0;
      var cost = parseFloat(tr.querySelector('.new-cost').value) || 0;
      var d1 = parseFloat(tr.querySelector('.new-d1').value);
      var d2 = parseFloat(tr.querySelector('.new-d2').value);
      var d3 = parseFloat(tr.querySelector('.new-d3').value);
      if (isNaN(d1) || d1 < 1 || d1 > 10) { showToast('普通VIP折扣请输入1-10'); return; }
      if (isNaN(d2) || d2 < 1 || d2 > 10) { showToast('中级VIP折扣请输入1-10'); return; }
      if (isNaN(d3) || d3 < 1 || d3 > 10) { showToast('高级VIP折扣请输入1-10'); return; }
      store.addProject(name, price, cost, d1 / 10, d2 / 10, d3 / 10);
      markChanged();
      showToast('项目已添加');
      // 重新渲染并自动新增一行，方便连续添加
      pages.projects();
      setTimeout(addNewProjectRow, 50);
    };

    // 取消
    tr.querySelector('.cancel-new-proj').onclick = function () {
      tr.remove();
    };

    // 回车保存
    tr.querySelectorAll('input').forEach(function (inp) {
      inp.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          tr.querySelector('.save-new-proj').click();
        }
      });
    });
  }

  // 新增项目弹窗
  function showProjectForm() {
    var body = '<div class="form-group">' +
        '<label class="form-label">项目名称 *</label>' +
        '<input class="form-input" id="projName" placeholder="如：条幅制作、胸卡内芯">' +
      '</div>' +
      '<div class="form-row">' +
        '<div class="form-group">' +
          '<label class="form-label">售价（元）</label>' +
          '<input class="form-input" id="projPrice" type="number" min="0" step="0.01" value="0">' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label">成本（元）</label>' +
          '<input class="form-input" id="projCost" type="number" min="0" step="0.01" value="0">' +
        '</div>' +
      '</div>' +
      '<div style="font-size:12px;color:#8b93a7;margin-bottom:8px;">VIP折扣设置（填数字，如 9 表示9折，10 表示不打折）</div>' +
      '<div class="form-row">' +
        '<div class="form-group">' +
          '<label class="form-label">普通VIP折扣</label>' +
          '<input class="form-input" id="projD1" type="number" min="1" max="10" step="0.1" value="10">' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label">中级VIP折扣</label>' +
          '<input class="form-input" id="projD2" type="number" min="1" max="10" step="0.1" value="10">' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label">高级VIP折扣</label>' +
          '<input class="form-input" id="projD3" type="number" min="1" max="10" step="0.1" value="10">' +
        '</div>' +
      '</div>';

    var footer = '<button class="btn btn-default" id="projCancel">取消</button>' +
      '<button class="btn btn-primary" id="projSave">保存</button>';

    showModal('新增项目', body, footer);

    $('projCancel').onclick = hideModal;
    $('projSave').onclick = function () {
      var name = $('projName').value.trim();
      if (!name) {
        showToast('请输入项目名称');
        return;
      }
      // 检查重名
      if (store.getProjectByName(name)) {
        showToast('该项目名称已存在');
        return;
      }
      var price = parseFloat($('projPrice').value) || 0;
      var cost = parseFloat($('projCost').value) || 0;
      // 折数转小数
      var d1 = parseFloat($('projD1').value);
      var d2 = parseFloat($('projD2').value);
      var d3 = parseFloat($('projD3').value);
      if (isNaN(d1) || d1 < 1 || d1 > 10) { showToast('普通VIP折扣请输入1-10'); return; }
      if (isNaN(d2) || d2 < 1 || d2 > 10) { showToast('中级VIP折扣请输入1-10'); return; }
      if (isNaN(d3) || d3 < 1 || d3 > 10) { showToast('高级VIP折扣请输入1-10'); return; }
      store.addProject(name, price, cost, d1 / 10, d2 / 10, d3 / 10);
      markChanged();
      showToast('项目已添加');
      hideModal();
      pages.projects();
    };
  }

  pages.audit = function () {
    // 检查是否已通过密码验证
    if (sessionStorage.getItem('audit_authed') !== '1') {
      showPasswordModal();
      // 显示占位
      $('mainContent').innerHTML = '<div class="empty-state"><div class="empty-icon">' + ICONS.lock + '</div><div class="empty-text">请输入密码验证后查看</div></div>';
      return;
    }
    renderAuditPage();
  };

  // 密码验证弹窗
  function showPasswordModal() {
    var body = '<div class="password-modal">' +
      '<div class="lock-icon">' + ICONS.lock + '</div>' +
      '<div style="font-size:15px;margin-bottom:16px;color:#555;">请输入核对账单密码</div>' +
      '<input type="password" id="auditPwd" placeholder="请输入密码" autocomplete="off">' +
      '<div class="password-error" id="pwdError"></div>' +
    '</div>';

    var footer = '<button class="btn btn-default" id="pwdCancel">取消</button>' +
      '<button class="btn btn-primary" id="pwdConfirm">确认</button>';

    showModal('验证身份', body, footer, { modalClass: 'password-modal-wrap' });

    var pwdInput = $('auditPwd');
    setTimeout(function () { pwdInput.focus(); }, 100);

    function submitPwd() {
      var pwd = pwdInput.value;
      if (pwd === 'Yan941207.') {
        sessionStorage.setItem('audit_authed', '1');
        hideModal();
        renderAuditPage();
      } else {
        $('pwdError').textContent = '密码错误，请重试';
        pwdInput.value = '';
        pwdInput.focus();
      }
    }

    $('pwdConfirm').onclick = submitPwd;
    $('pwdCancel').onclick = function () {
      hideModal();
      location.hash = '#/';
    };

    // 回车键提交
    pwdInput.onkeydown = function (e) {
      if (e.key === 'Enter') {
        submitPwd();
      }
    };
  }

  // 渲染核对账单页面
  function renderAuditPage() {
    var bills = store.getBills();
    var projects = store.getProjects();
    var customers = store.getCustomers();
    var customerMap = {};
    customers.forEach(function (c) { customerMap[c.id] = c; });

    // 计算每张账单的成本和利润，添加年份
    var billList = bills.map(function (b) {
      var cost = Calc.calcBillCost(b.items, projects);
      var profit = Calc.calcBillProfit(b, projects);
      var cust = customerMap[b.customerId];
      // 优先用bill.year，其次从date提取，最后用createdAt
      var year = b.year;
      if (!year) {
        if (b.date) {
          var m = String(b.date).match(/(\d{4})[-/年]/);
          if (m) year = parseInt(m[1], 10);
        }
        if (!year && b.createdAt) year = new Date(b.createdAt).getFullYear();
        if (!year) year = new Date().getFullYear();
      }
      return {
        id: b.id,
        customerId: b.customerId,
        date: b.date,
        year: year,
        customerName: cust ? cust.name : '未知',
        revenue: b.total,
        cost: cost,
        profit: profit,
        status: b.status
      };
    }).sort(function (a, b) {
      return (b.date || '').localeCompare(a.date || '');
    });

    // 汇总（所有年份）
    var summary = Calc.calcSummary(bills, projects);

    var html = '<div class="page-header">' +
      '<div class="page-title">核对账单</div>' +
      '<div class="page-actions">' +
        '<select class="form-select" id="auditYearFilter" style="width:120px;">' +
          '<option value="all">全部年份</option>' +
          buildYearOptions(billList) +
        '</select>' +
        '<select class="form-select" id="auditStatusFilter" style="width:120px;">' +
          '<option value="all">全部状态</option>' +
          '<option value="paid">已结</option>' +
          '<option value="unpaid">未结</option>' +
        '</select>' +
        '<button class="btn btn-default" id="auditExportBtn">导出Excel</button>' +
        '<button class="btn btn-default" id="auditLogoutBtn">退出验证</button>' +
      '</div>' +
    '</div>';

    // 汇总卡片（所有年份总计）
    html += '<div class="summary-cards">' +
      '<div class="summary-card revenue"><div class="label">总营收</div><div class="value">¥' + formatMoney(summary.revenue) + '</div></div>' +
      '<div class="summary-card cost"><div class="label">总成本</div><div class="value">¥' + formatMoney(summary.cost) + '</div></div>' +
      '<div class="summary-card profit"><div class="label">总利润</div><div class="value">¥' + formatMoney(summary.profit) + '</div></div>' +
    '</div>';

    // 按年份分组
    var yearGroups = {};
    billList.forEach(function (b) {
      if (!yearGroups[b.year]) {
        yearGroups[b.year] = { year: b.year, bills: [], revenue: 0, cost: 0, profit: 0, customerGroups: {} };
      }
      yearGroups[b.year].bills.push(b);
      yearGroups[b.year].revenue += b.revenue;
      yearGroups[b.year].cost += b.cost;
      yearGroups[b.year].profit += b.profit;
      // 年内按客户分组
      var cg = yearGroups[b.year].customerGroups;
      if (!cg[b.customerId]) {
        cg[b.customerId] = {
          customerId: b.customerId,
          customerName: b.customerName,
          bills: [],
          revenue: 0,
          cost: 0,
          profit: 0
        };
      }
      cg[b.customerId].bills.push(b);
      cg[b.customerId].revenue += b.revenue;
      cg[b.customerId].cost += b.cost;
      cg[b.customerId].profit += b.profit;
    });
    var years = Object.values(yearGroups).sort(function (a, b) { return b.year - a.year; });

    // 按年份展示
    if (years.length === 0) {
      html += '<div class="empty-state"><div class="empty-icon">' + ICONS.fileText + '</div><div class="empty-text">暂无账单数据</div></div>';
    } else {
      years.forEach(function (yg, yi) {
        // 年份标题
        html += '<div class="audit-year-group" data-year="' + yg.year + '">' +
          '<div class="audit-year-header" data-year-group="' + yi + '" style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;background:rgba(99,102,241,0.06);border-radius:12px;margin-bottom:12px;cursor:pointer;">' +
            '<div style="font-size:18px;font-weight:700;color:#2d3142;">' +
              '<span class="year-toggle">▼</span> ' + yg.year + '年' +
              '<span style="font-size:13px;color:#8b93a7;margin-left:12px;font-weight:400;">' + yg.bills.length + '单</span>' +
            '</div>' +
            '<div style="font-size:14px;">' +
              '<span style="margin-right:16px;">营收 <strong style="color:#6366f1;">¥' + formatMoney(yg.revenue) + '</strong></span>' +
              '<span style="margin-right:16px;">成本 <strong style="color:#f59e0b;">¥' + formatMoney(yg.cost) + '</strong></span>' +
              '<span>利润 <strong style="color:' + (yg.profit >= 0 ? '#10b981' : '#ef4444') + ';">¥' + formatMoney(yg.profit) + '</strong></span>' +
            '</div>' +
          '</div>' +
          '<div class="audit-year-content" id="auditYear_' + yi + '">';

        // 年内按客户分组
        var groups = Object.values(yg.customerGroups).sort(function (a, b) { return b.revenue - a.revenue; });
        groups.forEach(function (g, gi) {
          var unpaidCount = g.bills.filter(function (b) { return b.status === 'unpaid'; }).length;
          var globalGi = yi + '_' + gi;
          html += '<div class="audit-customer-group" data-customer="' + g.customerId + '">' +
            '<div class="audit-customer-header" data-group="' + globalGi + '">' +
              '<div class="audit-customer-name">' +
                '<span class="group-toggle">▶</span> ' +
                '<a href="#/customer/' + g.customerId + '" class="audit-cust-link" onclick="event.stopPropagation();">' + escapeHtml(g.customerName) + '</a>' +
                '<span style="font-size:13px;color:#8b93a7;margin-left:8px;">' + g.bills.length + '单' + (unpaidCount > 0 ? '，' + unpaidCount + '单未结' : '') + '</span>' +
              '</div>' +
              '<div class="audit-customer-stats">' +
                '<span>营收 <strong style="color:#6366f1;">¥' + formatMoney(g.revenue) + '</strong></span>' +
                '<span>成本 <strong style="color:#f59e0b;">¥' + formatMoney(g.cost) + '</strong></span>' +
                '<span>利润 <strong style="color:' + (g.profit >= 0 ? '#10b981' : '#ef4444') + ';">¥' + formatMoney(g.profit) + '</strong></span>' +
              '</div>' +
            '</div>' +
            '<div class="audit-customer-bills" id="auditBills_' + globalGi + '" style="display:none;">' +
              '<table class="data-table audit-bill-table"><thead><tr>' +
                '<th>日期</th><th>账单金额</th><th>成本</th><th>利润</th><th>状态</th>' +
              '</tr></thead><tbody>';
          g.bills.forEach(function (b) {
            var isPaid = b.status === 'paid';
            var dateLink = isPaid
              ? '<a href="#/bill/' + b.id + '" style="color:#2d3142;font-weight:500;">' + escapeHtml(b.date) + '</a>'
              : '<a href="#/bill/' + b.id + '/edit" style="color:#6366f1;font-weight:500;">' + escapeHtml(b.date) + '</a>';
            html += '<tr data-year="' + b.year + '" data-status="' + b.status + '">' +
              '<td>' + dateLink + '</td>' +
              '<td style="color:#6366f1;font-weight:600;">¥' + formatMoney(b.revenue) + '</td>' +
              '<td style="color:#f59e0b;">¥' + formatMoney(b.cost) + '</td>' +
              '<td style="color:' + (b.profit >= 0 ? '#10b981' : '#ef4444') + ';font-weight:600;">¥' + formatMoney(b.profit) + '</td>' +
              '<td><span class="status-tag ' + (isPaid ? 'status-paid' : 'status-unpaid') + '">' +
                (isPaid ? ICONS.checkCircle + ' 已结' : ICONS.alertCircle + ' 未结') + '</span></td>' +
            '</tr>';
          });
          html += '</tbody></table></div></div>';
        });
        html += '</div></div>';
      });
    }

    $('mainContent').innerHTML = html;

    // 年份分组展开/收起
    document.querySelectorAll('.audit-year-header').forEach(function (header) {
      header.onclick = function () {
        var yi = this.getAttribute('data-year-group');
        var contentDiv = $('auditYear_' + yi);
        var toggle = this.querySelector('.year-toggle');
        if (contentDiv.style.display === 'none') {
          contentDiv.style.display = '';
          toggle.textContent = '▼';
        } else {
          contentDiv.style.display = 'none';
          toggle.textContent = '▶';
        }
      };
    });

    // 客户分组展开/收起
    document.querySelectorAll('.audit-customer-header').forEach(function (header) {
      header.onclick = function () {
        var gi = this.getAttribute('data-group');
        var billsDiv = $('auditBills_' + gi);
        var toggle = this.querySelector('.group-toggle');
        if (billsDiv.style.display === 'none') {
          billsDiv.style.display = '';
          toggle.textContent = '▼';
        } else {
          billsDiv.style.display = 'none';
          toggle.textContent = '▶';
        }
      };
    });

    // 筛选
    function applyFilter() {
      var year = $('auditYearFilter').value;
      var status = $('auditStatusFilter').value;
      var visibleRevenue = 0;
      var visibleCost = 0;

      document.querySelectorAll('.audit-year-group').forEach(function (yearGroup) {
        var yearVal = yearGroup.getAttribute('data-year');
        var yearShow = year === 'all' || yearVal === year;
        var yearHasVisible = false;

        yearGroup.querySelectorAll('.audit-customer-group').forEach(function (group) {
          var rows = group.querySelectorAll('tbody tr');
          var groupHasVisible = false;
          rows.forEach(function (row) {
            var show = true;
            if (status !== 'all' && row.getAttribute('data-status') !== status) show = false;
            row.style.display = show ? '' : 'none';
            if (show) {
              groupHasVisible = true;
              visibleRevenue += parseFloat(row.children[1].textContent.replace('¥', '')) || 0;
              visibleCost += parseFloat(row.children[2].textContent.replace('¥', '')) || 0;
            }
          });
          group.style.display = (yearShow && groupHasVisible) ? '' : 'none';
          if (yearShow && groupHasVisible) yearHasVisible = true;
        });

        yearGroup.style.display = yearHasVisible ? '' : 'none';
      });

      // 更新汇总卡片为筛选后的数据
      var cards = document.querySelectorAll('.summary-card .value');
      if (cards.length >= 3) {
        cards[0].textContent = '¥' + formatMoney(visibleRevenue);
        cards[1].textContent = '¥' + formatMoney(visibleCost);
        cards[2].textContent = '¥' + formatMoney(visibleRevenue - visibleCost);
      }
    }

    $('auditYearFilter').onchange = applyFilter;
    $('auditStatusFilter').onchange = applyFilter;

    // 退出验证
    $('auditLogoutBtn').onclick = function () {
      sessionStorage.removeItem('audit_authed');
      location.hash = '#/';
      showToast('已退出核对账单');
    };

    // 导出Excel（阶段11实现，这里先调用占位）
    $('auditExportBtn').onclick = function () {
      exportAuditExcel(billList);
    };
  }

  // 构建年份选项
  function buildYearOptions(billList) {
    var years = {};
    billList.forEach(function (b) {
      if (b.year) years[b.year] = true;
    });
    var sorted = Object.keys(years).sort().reverse();
    var html = '';
    sorted.forEach(function (y) {
      html += '<option value="' + y + '">' + y + '年</option>';
    });
    return html;
  }

  // 导出核对账单Excel（占位，阶段11完善）
  function exportAuditExcel(billList) {
    if (typeof XLSX === 'undefined') {
      showToast('Excel库加载失败，请检查网络');
      return;
    }
    var data = [['日期', '客户', '账单金额', '成本', '利润', '状态']];
    billList.forEach(function (b) {
      data.push([
        b.date,
        b.customerName,
        b.revenue,
        b.cost,
        b.profit,
        b.status === 'paid' ? '已结' : '未结'
      ]);
    });
    var ws = XLSX.utils.aoa_to_sheet(data);
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '核对账单');
    XLSX.writeFile(wb, '核对账单_' + todayStr() + '.xlsx');
    showToast('已导出Excel');
  }

  pages.backup = function () {
    var html = '<div class="page-header">' +
      '<div class="page-title">数据备份</div>' +
    '</div>';

    html += '<div class="backup-grid">' +
      // 导出
      '<div class="backup-card">' +
        '<h3>' + ICONS.upload + ' 导出Excel备份</h3>' +
        '<p style="color:#888;font-size:13px;margin-bottom:16px;">导出全部客户、账单、项目数据</p>' +
        '<button class="btn btn-primary" id="exportAllBtn">下载备份文件</button>' +
        '<div class="backup-desc">导出包含：客户信息、所有账单明细、项目库配置（含VIP折扣）</div>' +
      '</div>' +
      // 导入备份
      '<div class="backup-card">' +
        '<h3>' + ICONS.archive + ' 导入备份文件</h3>' +
        '<p style="color:#888;font-size:13px;margin-bottom:16px;">恢复之前导出的Excel备份（全量覆盖）</p>' +
        '<div class="file-input-wrapper">' +
          '<label class="file-label" for="importBackupFile">选择备份文件</label>' +
          '<input type="file" id="importBackupFile" accept=".xlsx,.xls">' +
          '<span class="file-name" id="importBackupFileName">未选择文件</span>' +
        '</div>' +
        '<button class="btn btn-warning" id="importBackupBtn" disabled>恢复备份</button>' +
        '<div class="backup-desc">恢复导出的完整备份格式<br>将覆盖当前所有客户、账单、项目数据</div>' +
      '</div>' +
      // 导入清单
      '<div class="backup-card">' +
        '<h3>' + ICONS.download + ' 导入清单数据</h3>' +
        '<p style="color:#888;font-size:13px;margin-bottom:16px;">支持导入现有清单.xlsx格式</p>' +
        '<div class="file-input-wrapper">' +
          '<label class="file-label" for="importFile">选择Excel文件</label>' +
          '<input type="file" id="importFile" accept=".xlsx,.xls">' +
          '<span class="file-name" id="importFileName">未选择文件</span>' +
        '</div>' +
        '<button class="btn btn-success" id="importBtn" disabled>开始导入</button>' +
        '<div class="backup-desc">导入前会自动备份当前数据<br>按Sheet识别为一张张账单，自动提取单位、日期、明细</div>' +
      '</div>' +
      // 云端数据同步
      '<div class="backup-card">' +
        '<h3>' + ICONS.archive + ' 云端数据同步</h3>' +
        '<p style="color:#888;font-size:13px;margin-bottom:16px;">数据自动保存到云端</p>' +
        '<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">' +
          '<button class="btn btn-primary" id="syncCloudBtn" style="font-size:13px;padding:8px 16px;">同步到云端</button>' +
          '<button class="btn btn-default" id="pullCloudBtn" style="font-size:13px;padding:8px 16px;">从云端拉取</button>' +
        '</div>' +
        '<div class="backup-desc">同步：本地覆盖云端<br>拉取：云端覆盖本地</div>' +
      '</div>' +
    '</div>';

    // 导入结果区域
    html += '<div id="importResult" style="margin-top:20px;"></div>';

    $('mainContent').innerHTML = html;

    // 导出全部
    $('exportAllBtn').onclick = function () {
      exportAllExcel();
    };

    // 文件选择
    $('importFile').onchange = function (e) {
      var file = e.target.files[0];
      if (file) {
        $('importFileName').textContent = file.name;
        $('importBtn').disabled = false;
      } else {
        $('importFileName').textContent = '未选择文件';
        $('importBtn').disabled = true;
      }
    };

    // 导入
    $('importBtn').onclick = function () {
      var file = $('importFile').files[0];
      if (!file) return;
      importExcelFile(file);
    };

    // 备份文件选择
    var backupFileInput = $('importBackupFile');
    if (backupFileInput) {
      backupFileInput.onchange = function (e) {
        var file = e.target.files[0];
        if (file) {
          $('importBackupFileName').textContent = file.name;
          $('importBackupBtn').disabled = false;
        } else {
          $('importBackupFileName').textContent = '未选择文件';
          $('importBackupBtn').disabled = true;
        }
      };
    }

    // 导入备份
    var importBackupBtn = $('importBackupBtn');
    if (importBackupBtn) {
      importBackupBtn.onclick = function () {
        var file = $('importBackupFile').files[0];
        if (!file) return;
        confirmDialog('确定恢复备份吗？当前所有数据将被覆盖！', function () {
          importBackupExcel(file);
        });
      };
    }

    // 手动同步到云端（直接覆盖，不比对）
    var syncBtn = $('syncCloudBtn');
    if (syncBtn) {
      syncBtn.onclick = async function () {
        if (typeof DataSync === 'undefined' || !DataSync.isLoggedIn()) {
          showToast('未登录云端，无法同步');
          return;
        }
        syncBtn.disabled = true;
        syncBtn.textContent = '同步中...';
        try {
          await DataSync.syncToCloud();
          var localData = store.exportAll();
          showToast('已同步到云端：' + localData.customers.length + '客户，' + localData.bills.length + '账单，' + localData.projects.length + '项目');
        } catch (e) {
          showToast('同步失败：' + e.message);
          console.error(e);
        }
        syncBtn.disabled = false;
        syncBtn.textContent = '同步到云端';
      };
    }

    // 从云端拉取数据（覆盖本地）
    var pullBtn = $('pullCloudBtn');
    if (pullBtn) {
      pullBtn.onclick = async function () {
        if (typeof DataSync === 'undefined' || !DataSync.isLoggedIn()) {
          showToast('未登录云端，无法拉取');
          return;
        }
        confirmDialog('确定从云端拉取数据吗？当前本地数据将被覆盖。', async function () {
          pullBtn.disabled = true;
          pullBtn.textContent = '拉取中...';
          try {
            var cloudData = await CloudStore.exportAll();
            store.importAll(cloudData);
            showToast('已从云端拉取：' + cloudData.customers.length + '客户，' + cloudData.bills.length + '账单，' + cloudData.projects.length + '项目');
            setTimeout(function () { pages.backup(); }, 500);
          } catch (e) {
            showToast('拉取失败：' + e.message);
            console.error(e);
          }
          pullBtn.disabled = false;
          pullBtn.textContent = '从云端拉取';
        });
      };
    }
  };

  // 导出全部数据为Excel
  function exportAllExcel() {
    if (typeof XLSX === 'undefined') {
      showToast('Excel库加载失败，请检查网络');
      return;
    }

    var wb = XLSX.utils.book_new();

    // 客户表
    var customers = store.getCustomers();
    var custData = [['客户ID', '客户名称', '联系人', '联系电话', 'VIP类型', '创建时间']];
    customers.forEach(function (c) {
      custData.push([c.id, c.name, c.contact, c.phone, c.vipType, c.createdAt]);
    });
    var ws1 = XLSX.utils.aoa_to_sheet(custData);
    XLSX.utils.book_append_sheet(wb, ws1, '客户列表');

    // 账单表
    var bills = store.getBills();
    var customerMap = {};
    customers.forEach(function (c) { customerMap[c.id] = c.name; });
    var billData = [['账单ID', '客户', '日期', '状态', '合计', '明细内容', '明细项目', '数量', '单价', '总价', '制作人', '备注']];
    bills.forEach(function (b) {
      if (b.items && b.items.length) {
        b.items.forEach(function (item) {
          billData.push([
            b.id,
            customerMap[b.customerId] || '',
            b.date,
            b.status === 'paid' ? '已结' : '未结',
            b.total,
            item.content,
            item.project,
            item.qty,
            item.price,
            item.total,
            item.maker,
            item.remark
          ]);
        });
      } else {
        billData.push([b.id, customerMap[b.customerId] || '', b.date, b.status === 'paid' ? '已结' : '未结', b.total, '', '', '', '', '', '', '']);
      }
    });
    var ws2 = XLSX.utils.aoa_to_sheet(billData);
    XLSX.utils.book_append_sheet(wb, ws2, '账单明细');

    // 项目表
    var projects = store.getProjects();
    var projData = [['项目ID', '项目名称', '售价', '成本', '普通VIP折扣', '中级VIP折扣', '高级VIP折扣']];
    projects.forEach(function (p) {
      projData.push([
        p.id, p.name, p.price, p.cost,
        p.vip1Discount !== undefined ? p.vip1Discount : 1.0,
        p.vip2Discount !== undefined ? p.vip2Discount : 1.0,
        p.vip3Discount !== undefined ? p.vip3Discount : 1.0
      ]);
    });
    var ws3 = XLSX.utils.aoa_to_sheet(projData);
    XLSX.utils.book_append_sheet(wb, ws3, '项目库');

    XLSX.writeFile(wb, '易品广告_数据备份_' + todayStr() + '.xlsx');
    showToast('备份文件已导出');
  }

  // 导入Excel文件
  function importExcelFile(file) {
    if (typeof XLSX === 'undefined') {
      showToast('Excel库加载失败，请检查网络');
      return;
    }

    showToast('正在解析文件...');

    var reader = new FileReader();
    reader.onload = function (e) {
      try {
        var data = new Uint8Array(e.target.result);
        var workbook = XLSX.read(data, { type: 'array' });
        var parsedBills = ExcelParser.parseWorkbook(workbook);

        if (parsedBills.length === 0) {
          showToast('未解析到有效账单数据');
          return;
        }

        // 显示导入预览
        showImportPreview(parsedBills);
      } catch (err) {
        showToast('解析失败：' + err.message);
        console.error(err);
      }
    };
    reader.onerror = function () {
      showToast('文件读取失败');
    };
    reader.readAsArrayBuffer(file);
  }

  // 导入备份文件（解析导出的三Sheet格式，全量覆盖）
  function importBackupExcel(file) {
    if (typeof XLSX === 'undefined') {
      showToast('Excel库加载失败，请检查网络');
      return;
    }
    showToast('正在恢复备份...');

    var reader = new FileReader();
    reader.onload = function (e) {
      try {
        var data = new Uint8Array(e.target.result);
        var workbook = XLSX.read(data, { type: 'array' });

        // 解析客户列表
        var customers = [];
        if (workbook.Sheets['客户列表']) {
          var custRows = XLSX.utils.sheet_to_json(workbook.Sheets['客户列表'], { header: 1 });
          for (var i = 1; i < custRows.length; i++) {
            var r = custRows[i];
            if (!r[1]) continue;
            customers.push({
              id: r[0] || genId('cust'),
              name: String(r[1]),
              contact: r[2] ? String(r[2]) : '',
              phone: r[3] ? String(r[3]) : '',
              address: r[4] && !/vip|normal/i.test(String(r[4])) ? String(r[4]) : '',
              vipType: r[5] ? String(r[5]) : (r[4] && /vip|normal/i.test(String(r[4])) ? String(r[4]) : 'normal'),
              createdAt: r[6] || new Date().toISOString()
            });
          }
        }

        // 解析账单明细（按账单ID分组）
        var bills = [];
        var billMap = {};
        if (workbook.Sheets['账单明细']) {
          var billRows = XLSX.utils.sheet_to_json(workbook.Sheets['账单明细'], { header: 1 });
          for (var j = 1; j < billRows.length; j++) {
            var br = billRows[j];
            var billId = br[0];
            if (!billId) continue;
            if (!billMap[billId]) {
              // 查找客户ID
              var custId = '';
              for (var ci = 0; ci < customers.length; ci++) {
                if (customers[ci].name === br[1]) { custId = customers[ci].id; break; }
              }
              billMap[billId] = {
                id: String(billId),
                customerId: custId,
                date: br[2] ? String(br[2]) : '',
                status: br[3] === '已结' ? 'paid' : 'unpaid',
                total: parseFloat(br[4]) || 0,
                items: []
              };
              bills.push(billMap[billId]);
            }
            if (br[5] || br[6]) {
              billMap[billId].items.push({
                content: br[5] ? String(br[5]) : '',
                finalDate: '',
                project: br[6] ? String(br[6]) : '',
                qty: parseFloat(br[7]) || 0,
                price: parseFloat(br[8]) || 0,
                total: parseFloat(br[9]) || 0,
                maker: br[10] ? String(br[10]) : '',
                remark: br[11] ? String(br[11]) : ''
              });
            }
          }
        }

        // 解析项目库
        var projects = [];
        if (workbook.Sheets['项目库']) {
          var projRows = XLSX.utils.sheet_to_json(workbook.Sheets['项目库'], { header: 1 });
          for (var k = 1; k < projRows.length; k++) {
            var pr = projRows[k];
            if (!pr[1]) continue;
            projects.push({
              id: pr[0] || genId('proj'),
              name: String(pr[1]),
              price: parseFloat(pr[2]) || 0,
              cost: parseFloat(pr[3]) || 0,
              vip1Discount: pr[4] !== undefined ? parseFloat(pr[4]) : 1.0,
              vip2Discount: pr[5] !== undefined ? parseFloat(pr[5]) : 1.0,
              vip3Discount: pr[6] !== undefined ? parseFloat(pr[6]) : 1.0
            });
          }
        }

        // 全量覆盖
        store.importAll({ customers: customers, bills: bills, projects: projects });
        markChanged();
        showToast('备份恢复成功：' + customers.length + '个客户，' + bills.length + '张账单，' + projects.length + '个项目');
        pages.backup();
      } catch (err) {
        showToast('恢复失败：' + err.message);
        console.error(err);
      }
    };
    reader.onerror = function () {
      showToast('文件读取失败');
    };
    reader.readAsArrayBuffer(file);
  }

  // 显示导入预览
  function showImportPreview(parsedBills) {
    // 统计客户
    var customerNames = {};
    parsedBills.forEach(function (b) {
      if (b.customerName) customerNames[b.customerName] = true;
    });

    var html = '<div class="card">' +
      '<h3 style="margin-bottom:12px;">导入预览</h3>' +
      '<p style="color:#555;margin-bottom:12px;">共解析到 <strong>' + parsedBills.length + '</strong> 张账单，涉及 <strong>' + Object.keys(customerNames).length + '</strong> 个客户</p>' +
      '<table class="data-table"><thead><tr>' +
        '<th>客户</th><th>日期</th><th>明细数</th><th>合计</th>' +
        '</tr></thead><tbody>';

    parsedBills.forEach(function (b) {
      html += '<tr>' +
        '<td>' + escapeHtml(b.customerName || '未知') + '</td>' +
        '<td>' + escapeHtml(b.date || '') + '</td>' +
        '<td>' + b.items.length + '</td>' +
        '<td style="color:#667eea;font-weight:600;">¥' + formatMoney(b.total) + '</td>' +
      '</tr>';
    });

    html += '</tbody></table>' +
      '<div style="margin-top:16px;text-align:right;">' +
        '<button class="btn btn-default" id="cancelImport">取消</button>' +
        '<button class="btn btn-primary" id="confirmImport" style="margin-left:10px;">确认导入</button>' +
      '</div>' +
    '</div>';

    $('importResult').innerHTML = html;

    $('cancelImport').onclick = function () {
      $('importResult').innerHTML = '';
    };

    $('confirmImport').onclick = function () {
      confirmImport(parsedBills);
    };
  }

  // 确认导入
  function confirmImport(parsedBills) {
    // 先备份当前数据
    var backup = store.exportAll();

    try {
      var imported = 0;
      var newCustomers = 0;

      parsedBills.forEach(function (pb) {
        // 查找或创建客户
        var customer = null;
        if (pb.customerName) {
          var customers = store.getCustomers();
          for (var i = 0; i < customers.length; i++) {
            if (customers[i].name === pb.customerName) {
              customer = customers[i];
              break;
            }
          }
          if (!customer) {
            customer = store.addCustomer({ name: pb.customerName, vipType: 'normal' });
            newCustomers++;
          }
        }

        // 创建账单
        store.addBill({
          customerId: customer ? customer.id : '',
          date: pb.date || todayStr(),
          status: 'unpaid',
          items: pb.items,
          total: pb.total
        });
        imported++;
      });

      showToast('导入成功：' + imported + '张账单，' + newCustomers + '个新客户');
      markChanged();
      $('importResult').innerHTML = '';
      $('importFile').value = '';
      $('importFileName').textContent = '未选择文件';
      $('importBtn').disabled = true;
    } catch (err) {
      // 导入失败，恢复备份
      store.importAll(backup);
      showToast('导入失败，已恢复原数据：' + err.message);
      console.error(err);
    }
  }

  pages['customer-bills'] = function (params) {
    var customer = store.getCustomerById(params.customerId);
    if (!customer) {
      $('mainContent').innerHTML = '<div class="empty-state"><div class="empty-icon">' + ICONS.helpCircle + '</div><div class="empty-text">客户不存在</div></div>';
      return;
    }

    var currentYear = new Date().getFullYear();
    var allBills = store.getBillsByCustomer(params.customerId);
    // 只显示当年账单
    var bills = allBills.filter(function (b) {
      var y = b.year;
      if (!y && b.date) {
        var m = String(b.date).match(/(\d{4})[-/年]/);
        if (m) y = parseInt(m[1], 10);
      }
      if (!y && b.createdAt) y = new Date(b.createdAt).getFullYear();
      return y === currentYear;
    });
    // 按日期倒序
    bills.sort(function (a, b) {
      return (b.date || '').localeCompare(a.date || '');
    });

    var totalSpent = store.getCustomerTotalSpent(params.customerId, currentYear);

    var html = '<button class="back-btn" onclick="location.hash=\'#/\'">← 返回客户列表</button>';
    html += '<div class="page-header">' +
      '<div>' +
        '<div class="page-title">' + escapeHtml(customer.name) +
          ' <span class="cust-vip ' + (VIP_CLASS[customer.vipType] || 'vip-normal') + '">' + (VIP_LABELS[customer.vipType] || '普通客户') + '</span>' +
        '</div>' +
        '<div style="color:#888;font-size:13px;margin-top:4px;">累计消费：<span style="color:#667eea;font-weight:600;">¥' + formatMoney(totalSpent) + '</span></div>' +
      '</div>' +
      '<div class="page-actions">' +
        '<button class="btn btn-primary" id="newBillBtn">' + ICONS.plus + ' 新建账单</button>' +
      '</div>' +
    '</div>';

    if (bills.length === 0) {
      html += '<div class="empty-state"><div class="empty-icon">' + ICONS.fileText + '</div><div class="empty-text">暂无账单，点击右上角新建</div></div>';
    } else {
      html += '<table class="data-table"><thead><tr>' +
        '<th>日期</th><th>金额</th><th>状态</th><th>操作</th>' +
        '</tr></thead><tbody>';
      bills.forEach(function (b) {
        var isPaid = b.status === 'paid';
        var dateLink = isPaid
          ? '<a href="#/bill/' + b.id + '" style="color:#2d3142;font-weight:500;">' + escapeHtml(b.date) + '</a>'
          : '<a href="#/bill/' + b.id + '/edit" style="color:#6366f1;font-weight:500;">' + escapeHtml(b.date) + '</a>';
        var amountLink = isPaid
          ? '<a href="#/bill/' + b.id + '" style="color:#2d3142;font-weight:600;">¥' + formatMoney(b.total) + '</a>'
          : '<a href="#/bill/' + b.id + '/edit" style="color:#6366f1;font-weight:600;">¥' + formatMoney(b.total) + '</a>';
        html += '<tr>' +
          '<td>' + dateLink + '</td>' +
          '<td>' + amountLink + '</td>' +
          '<td><span class="status-tag ' + (isPaid ? 'status-paid' : 'status-unpaid') + '" data-id="' + b.id + '" style="cursor:pointer;">' +
            (isPaid ? ICONS.checkCircle + ' 已结' : ICONS.alertCircle + ' 未结') +
          '</span></td>' +
          '<td>';
        if (!isPaid) {
          html += '<button class="btn-link danger del-bill" data-id="' + b.id + '">删除</button>';
        } else {
          html += '<span style="color:#a0a7ba;font-size:12px;">已锁定</span>';
        }
        html += '</td></tr>';
      });
      html += '</tbody></table>';
    }

    $('mainContent').innerHTML = html;

    // 新建账单
    $('newBillBtn').onclick = function () {
      location.hash = '#/customer/' + params.customerId + '/new-bill';
    };

    // 切换状态
    document.querySelectorAll('.status-tag').forEach(function (tag) {
      tag.onclick = function () {
        var id = this.getAttribute('data-id');
        var bill = store.getBillById(id);
        var newStatus = bill.status === 'paid' ? 'unpaid' : 'paid';
        store.updateBill(id, { status: newStatus });
        markChanged();
        showToast(newStatus === 'paid' ? '已标记为已结' : '已改为未结');
        pages['customer-bills'](params);
      };
    });

    // 删除账单
    document.querySelectorAll('.del-bill').forEach(function (btn) {
      btn.onclick = function () {
        var id = this.getAttribute('data-id');
        var bill = store.getBillById(id);
        confirmDialog('确定删除 ' + bill.date + ' 的账单（¥' + formatMoney(bill.total) + '）吗？', function () {
          store.deleteBill(id);
          markChanged();
          showToast('账单已删除');
          pages['customer-bills'](params);
        });
      };
    });
  };

  pages['bill-detail'] = function (params) {
    var bill = store.getBillById(params.billId);
    if (!bill) {
      $('mainContent').innerHTML = '<div class="empty-state"><div class="empty-icon">' + ICONS.helpCircle + '</div><div class="empty-text">账单不存在</div></div>';
      return;
    }
    var customer = store.getCustomerById(bill.customerId);
    var isPaid = bill.status === 'paid';

    var html = '<button class="back-btn no-print" onclick="location.hash=\'#/customer/' + bill.customerId + '\'">← 返回账单列表</button>';

    // 操作栏
    html += '<div class="page-header no-print">' +
      '<div class="page-title">账单详情</div>' +
      '<div class="page-actions">' +
        '<button class="btn btn-default" id="printBtn">' + ICONS.printer + ' 打印</button>' +
        '<button class="btn btn-default" id="exportJpgBtn">' + ICONS.image + ' 导出JPG</button>';
    if (!isPaid) {
      html += '<a class="btn btn-primary" href="#/bill/' + bill.id + '/edit">' + ICONS.pencil + ' 编辑</a>';
    }
    html += '</div></div>';

    // 账单内容（可打印区域）
    html += '<div class="bill-container" id="billPrintArea">';
    html += '<div class="bill-header">' +
      '<div class="bill-company">禹州市易品广告服务店</div>' +
      '<div class="bill-title">结账单</div>' +
    '</div>';

    html += '<div class="bill-meta">' +
      '<div>单位：' + escapeHtml(customer ? customer.name : '未知') +
        (customer ? '（' + (VIP_LABELS[customer.vipType] || '普通客户') + '）' : '') +
      '</div>' +
      '<div>日期：' + escapeHtml(bill.date) + '</div>' +
    '</div>';

    // 明细表
    html += '<table class="bill-table"><thead><tr>' +
      '<th>内容</th><th>定稿日期</th><th>项目</th><th>数量</th><th>单价</th><th>总价</th><th>制作人</th><th>备注</th>' +
      '</tr></thead><tbody>';

    if (bill.items && bill.items.length) {
      bill.items.forEach(function (item) {
        html += '<tr>' +
          '<td class="col-content">' + escapeHtml(item.content || '') + '</td>' +
          '<td>' + escapeHtml(item.finalDate || '') + '</td>' +
          '<td>' + escapeHtml(item.project || '') + '</td>' +
          '<td>' + (item.qty || 0) + '</td>' +
          '<td>' + formatMoney(item.price || 0) + '</td>' +
          '<td>' + formatMoney(item.total || 0) + '</td>' +
          '<td>' + escapeHtml(item.maker || '') + '</td>' +
          '<td>' + escapeHtml(item.remark || '') + '</td>' +
        '</tr>';
      });
    } else {
      html += '<tr><td colspan="8" style="padding:20px;color:#999;">暂无明细</td></tr>';
    }

    html += '<tr class="bill-total-row"><td colspan="5" style="text-align:right;">合计：</td>' +
      '<td colspan="3" style="text-align:left;">¥' + formatMoney(bill.total) + '</td></tr>';
    html += '</tbody></table>';

    html += '</div>'; // end billPrintArea

    // 状态栏
    html += '<div class="bill-status-bar no-print ' + (isPaid ? 'locked' : '') + '">' +
      '<div>' +
        (isPaid
          ? '<span class="lock-text">' + ICONS.lock + ' 该账单已结清，数据已锁定</span>'
          : '<span style="color:#f53f3f;font-weight:500;">' + ICONS.alertCircle + ' 该账单未结清</span>') +
      '</div>' +
      '<div>' +
        (isPaid
          ? '<button class="btn btn-default btn-sm" id="toggleStatusBtn">改为未结</button>'
          : '<button class="btn btn-success btn-sm" id="toggleStatusBtn">标记已结</button>') +
      '</div>' +
    '</div>';

    $('mainContent').innerHTML = html;

    // 打印
    $('printBtn').onclick = function () {
      window.print();
    };

    // 导出JPG
    $('exportJpgBtn').onclick = function () {
      if (typeof html2canvas === 'undefined') {
        showToast('图片导出库加载失败，请检查网络');
        return;
      }
      var target = $('billPrintArea');
      showToast('正在生成图片...');
      html2canvas(target, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true
      }).then(function (canvas) {
        var link = document.createElement('a');
        link.download = '账单_' + (customer ? customer.name : '') + '_' + bill.date + '.jpg';
        link.href = canvas.toDataURL('image/jpeg', 0.95);
        link.click();
        showToast('图片已导出');
      }).catch(function (err) {
        showToast('导出失败：' + err.message);
      });
    };

    // 切换状态
    $('toggleStatusBtn').onclick = function () {
      var newStatus = isPaid ? 'unpaid' : 'paid';
      store.updateBill(bill.id, { status: newStatus });
      showToast(newStatus === 'paid' ? '已标记为已结' : '已改为未结');
      pages['bill-detail'](params);
    };
  };

  pages['bill-edit'] = function (params) {
    var bill = store.getBillById(params.billId);
    if (!bill) {
      $('mainContent').innerHTML = '<div class="empty-state"><div class="empty-icon">' + ICONS.helpCircle + '</div><div class="empty-text">账单不存在</div></div>';
      return;
    }
    // 已结账单不可编辑
    if (bill.status === 'paid') {
      $('mainContent').innerHTML = '<div class="empty-state">' +
        '<div class="empty-icon">' + ICONS.lock + '</div>' +
        '<div class="empty-text">该账单已结清，数据已锁定</div>' +
        '<a class="btn btn-primary" style="margin-top:16px;" href="#/bill/' + bill.id + '">查看账单</a>' +
        '</div>';
      return;
    }
    var customer = store.getCustomerById(bill.customerId);
    renderBillEditor(customer, bill);
  };

  pages['new-bill'] = function (params) {
    var customer = store.getCustomerById(params.customerId);
    if (!customer) {
      $('mainContent').innerHTML = '<div class="empty-state"><div class="empty-icon">' + ICONS.helpCircle + '</div><div class="empty-text">客户不存在</div></div>';
      return;
    }
    var newBill = {
      id: null,
      customerId: customer.id,
      date: todayStr(),
      status: 'unpaid',
      items: [{ content: '', finalDate: '', project: '', qty: 1, price: 0, total: 0, maker: '', remark: '' }],
      total: 0
    };
    renderBillEditor(customer, newBill);
  };

  // 账单编辑器核心渲染
  function renderBillEditor(customer, bill) {
    var isEdit = !!bill.id;
    var projects = store.getProjects();

    // 项目datalist选项（可输入可选择）
    var projectDatalistOptions = '';
    projects.forEach(function (p) {
      projectDatalistOptions += '<option value="' + escapeHtml(p.name) + '">';
    });

    var html = '<button class="back-btn" onclick="location.hash=\'#/customer/' + customer.id + '\'">← 返回账单列表</button>';
    html += '<div class="page-header">' +
      '<div class="page-title">' + (isEdit ? '编辑账单' : '新建账单') + '</div>' +
      '<div class="page-actions">' +
        (isEdit ? '<a class="btn btn-default" href="#/bill/' + bill.id + '">' + ICONS.fileText + ' 查看</a>' : '') +
        '<button class="btn btn-default" id="billCancel">取消</button>' +
        '<button class="btn btn-primary" id="billSave">保存</button>' +
      '</div>' +
    '</div>';

    html += '<div class="card">' +
      '<div style="display:flex;gap:24px;margin-bottom:16px;align-items:center;">' +
        '<div><strong>客户：</strong>' + escapeHtml(customer.name) +
          ' <span class="cust-vip ' + (VIP_CLASS[customer.vipType] || 'vip-normal') + '">' + (VIP_LABELS[customer.vipType] || '普通客户') + '</span>' +
        '</div>' +
        '<div><strong>日期：</strong><input type="date" class="form-input" id="billDate" value="' + bill.date + '" style="width:160px;display:inline-block;"></div>' +
      '</div>';

    // 明细表
    html += '<table class="bill-edit-table" id="billItemsTable">' +
      '<thead><tr>' +
        '<th style="width:18%;">内容</th>' +
        '<th style="width:10%;">定稿日期</th>' +
        '<th style="width:14%;">项目</th>' +
        '<th style="width:8%;">数量</th>' +
        '<th style="width:10%;">单价</th>' +
        '<th style="width:10%;">总价</th>' +
        '<th style="width:10%;">制作人</th>' +
        '<th style="width:14%;">备注</th>' +
        '<th style="width:6%;">操作</th>' +
      '</tr></thead><tbody id="billItemsBody">';

    bill.items.forEach(function (item, idx) {
      html += renderBillItemRow(item, idx);
    });

    html += '</tbody></table>';
    // 项目可输入可选择的datalist
    html += '<datalist id="projectDatalist">' + projectDatalistOptions + '</datalist>';
    html += '<button class="add-row-btn" id="addRowBtn">' + ICONS.plus + ' 添加一行</button>';

    html += '<div class="bill-edit-summary">合计：<span id="billTotal">0</span> 元</div>';

    html += '<div style="margin-top:16px;">' +
      '<strong>账单状态：</strong>' +
      '<label style="margin-left:16px;"><input type="radio" name="billStatus" value="unpaid"' + (bill.status === 'unpaid' ? ' checked' : '') + '> 未结</label>' +
      '<label style="margin-left:16px;"><input type="radio" name="billStatus" value="paid"' + (bill.status === 'paid' ? ' checked' : '') + '> 已结</label>' +
      '</div>';

    html += '</div>';

    $('mainContent').innerHTML = html;

    // 存储当前编辑状态
    var editorState = {
      customer: customer,
      bill: bill,
      rowIndex: bill.items.length
    };

    // 绑定行事件
    bindBillRowEvents(editorState);
    recalcTotal();

    // 添加行
    $('addRowBtn').onclick = function () {
      var newItem = { content: '', finalDate: '', project: '', qty: 1, price: 0, total: 0, maker: '', remark: '' };
      bill.items.push(newItem);
      var tbody = $('billItemsBody');
      var tr = document.createElement('tr');
      tr.innerHTML = renderBillItemRow(newItem, bill.items.length - 1);
      tbody.appendChild(tr);
      bindBillRowEvents(editorState);
      recalcTotal();
    };

    // 页面内所有输入框按回车后失焦，退出编辑状态
    document.querySelectorAll('.card input, .card select').forEach(function (el) {
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.blur();
        }
      });
    });

    // 取消
    $('billCancel').onclick = function () {
      location.hash = '#/customer/' + customer.id;
    };

    // 保存
    $('billSave').onclick = function () {
      var items = collectItems();
      if (items.length === 0) {
        showToast('请至少添加一行明细');
        return;
      }
      // 校验：至少有一行有内容
      var hasContent = items.some(function (it) {
        return it.content || it.project;
      });
      if (!hasContent) {
        showToast('请填写至少一行明细内容');
        return;
      }

      var total = Calc.calcBillTotal(items);
      var status = document.querySelector('input[name="billStatus"]:checked').value;
      // 未结账单编辑保存后自动改为当天日期
      var date = (isEdit && status === 'unpaid') ? todayStr() : $('billDate').value;

      var billData = {
        customerId: customer.id,
        date: date,
        status: status,
        items: items,
        total: total
      };

      if (isEdit) {
        store.updateBill(bill.id, billData);
        showToast('账单已更新');
      } else {
        store.addBill(billData);
        showToast('账单已创建');
      }
      markChanged();
      location.hash = '#/customer/' + customer.id;
    };

    // 收集所有行数据
    function collectItems() {
      var rows = document.querySelectorAll('#billItemsBody tr');
      var items = [];
      rows.forEach(function (row) {
        var item = {
          content: row.querySelector('.it-content').value.trim(),
          finalDate: row.querySelector('.it-finaldate').value.trim(),
          project: row.querySelector('.it-project').value,
          qty: parseFloat(row.querySelector('.it-qty').value) || 0,
          price: parseFloat(row.querySelector('.it-price').value) || 0,
          total: parseFloat(row.querySelector('.it-total').textContent) || 0,
          maker: row.querySelector('.it-maker').value.trim(),
          remark: row.querySelector('.it-remark').value.trim()
        };
        items.push(item);
      });
      return items;
    }

    // 重新计算合计
    function recalcTotal() {
      var items = collectItems();
      var total = Calc.calcBillTotal(items);
      $('billTotal').textContent = formatMoney(total);
    }

    // 绑定每行的事件
    function bindBillRowEvents(state) {
      var rows = document.querySelectorAll('#billItemsBody tr');
      rows.forEach(function (row, idx) {
        if (row._bound) return;
        row._bound = true;

        var projectSel = row.querySelector('.it-project');
        var qtyInput = row.querySelector('.it-qty');
        var priceInput = row.querySelector('.it-price');
        var finalDateInput = row.querySelector('.it-finaldate');
        var totalCell = row.querySelector('.it-total');
        var delBtn = row.querySelector('.it-del');

        // 定稿日期自动转换：8/10 → 8月10日（不含年份）
        finalDateInput.onblur = function () {
          var val = this.value.trim();
          if (!val) return;
          // 已经是"X月X日"格式则不转换
          if (/^\d{1,2}月\d{1,2}日$/.test(val)) return;
          var converted = convertDateStr(val);
          if (converted) {
            this.value = converted;
          }
        };

        // 项目选择变化：自动带出原价
        projectSel.onchange = function () {
          var projName = this.value;
          if (projName) {
            var proj = store.getProjectByName(projName);
            if (proj) {
              priceInput.value = proj.price; // 显示原价
              updateLineTotal();
            }
          }
        };

        // 数量或单价变化：更新行总价（VIP按折扣计算）
        qtyInput.oninput = updateLineTotal;
        priceInput.oninput = updateLineTotal;

        function updateLineTotal() {
          var qty = parseFloat(qtyInput.value) || 0;
          var price = parseFloat(priceInput.value) || 0;
          var discount = getProjectDiscount(projectSel.value, state.customer.vipType);
          var lineTotal = Calc.calcLineTotal(qty, price) * discount;
          totalCell.textContent = formatMoney(lineTotal) + ' 元';
          recalcTotal();
        }

        // 删除行
        if (delBtn) {
          delBtn.onclick = function () {
            var allRows = document.querySelectorAll('#billItemsBody tr');
            if (allRows.length <= 1) {
              showToast('至少保留一行');
              return;
            }
            row.remove();
            recalcTotal();
          };
        }
      });
    }
  }

  // 获取项目对指定VIP类型的折扣率
  function getProjectDiscount(projectName, vipType) {
    if (!projectName || vipType === 'normal') return 1.0;
    var proj = store.getProjectByName(projectName);
    if (!proj) return 1.0;
    if (vipType === 'vip1') return parseFloat(proj.vip1Discount) || 1.0;
    if (vipType === 'vip2') return parseFloat(proj.vip2Discount) || 1.0;
    if (vipType === 'vip3') return parseFloat(proj.vip3Discount) || 1.0;
    return 1.0;
  }

  // 定稿日期转换：8/10 或 8.10 或 2026年8月10日 → 8月10日（不含年份）
  function convertDateStr(val) {
    // 已有中文日期格式：去掉年份
    var yMatch = val.match(/^\d{4}年(\d{1,2})月(\d{1,2})日$/);
    if (yMatch) {
      return yMatch[1] + '月' + yMatch[2] + '日';
    }
    // 数字格式：8/10、8.10、8-10
    var m = val.match(/^(\d{1,2})[\/\.\-](\d{1,2})$/);
    if (m) {
      var month = parseInt(m[1], 10);
      var day = parseInt(m[2], 10);
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        return month + '月' + day + '日';
      }
    }
    return null;
  }

  // 渲染单行明细
  function renderBillItemRow(item, idx) {
    var finalDate = item.finalDate || '';
    // 统一格式化为不含年份的"X月X日"
    if (finalDate) {
      var converted = convertDateStr(finalDate);
      if (converted) finalDate = converted;
    }
    // 如果项目匹配项目库，单价显示原价
    var displayPrice = item.price || 0;
    if (item.project) {
      var proj = store.getProjectByName(item.project);
      if (proj) displayPrice = proj.price;
    }
    return '<tr>' +
      '<td class="col-content"><input class="it-content" value="' + escapeHtml(item.content || '') + '" placeholder="物料内容"></td>' +
      '<td><input class="it-finaldate" value="' + escapeHtml(finalDate) + '" placeholder=""></td>' +
      '<td><input class="it-project" list="projectDatalist" value="' + escapeHtml(item.project || '') + '" placeholder="输入或选择"></td>' +
      '<td><input class="it-qty" type="number" min="0" step="1" value="' + (item.qty || 1) + '"></td>' +
      '<td><input class="it-price" type="number" min="0" step="0.01" value="' + displayPrice + '" style="width:70px;display:inline-block;vertical-align:middle;"><span style="font-size:12px;color:#8b93a7;margin-left:4px;display:inline-block;vertical-align:middle;">元</span></td>' +
      '<td class="row-total it-total">' + formatMoney(item.total || 0) + ' 元</td>' +
      '<td><input class="it-maker" value="' + escapeHtml(item.maker || '') + '" placeholder="制作人"></td>' +
      '<td><input class="it-remark" value="' + escapeHtml(item.remark || '') + '" placeholder="备注"></td>' +
      '<td><button class="del-btn it-del">&times;</button></td>' +
    '</tr>';
  }

  // ========== 路由分发 ==========
  function router() {
    var route = parseRoute(location.hash);
    updateNavActive(route.name);
    var fn = pages[route.name];
    if (fn) {
      fn(route.params);
    } else {
      pages.home({});
    }
    window.scrollTo(0, 0);
  }

  // ========== 登录页面 ==========
  function renderLoginPage() {
    var html = '<div class="login-container">' +
      '<div class="login-card">' +
        '<div class="login-logo">' +
          '<img src="assets/logo.jpg" alt="易品广告">' +
        '</div>' +
        '<h1 class="login-title">易品广告</h1>' +
        '<p class="login-subtitle">记账开单系统</p>' +
        '<div class="login-form">' +
          '<div class="form-group">' +
            '<label class="form-label">访问密码</label>' +
            '<input class="form-input" id="loginPassword" type="password" placeholder="请输入访问密码">' +
          '</div>' +
          '<div id="loginError" style="color:#ef4444;font-size:13px;margin-bottom:12px;display:none;"></div>' +
          '<button class="btn btn-primary" id="loginBtn" style="width:100%;">进入系统</button>' +
        '</div>' +
        '<p class="login-tip">数据已云端存储，安全不丢失</p>' +
      '</div>' +
    '</div>';

    document.body.innerHTML = html;

    // 登录事件
    var doLogin = async function () {
      var password = $('loginPassword').value;
      var errorEl = $('loginError');
      if (!password) {
        errorEl.textContent = '请输入访问密码';
        errorEl.style.display = 'block';
        return;
      }
      // 验证访问密码
      var correctPwd = typeof SB !== 'undefined' ? SB.accessPassword : 'Yan941207.';
      if (password !== correctPwd) {
        errorEl.textContent = '密码错误';
        errorEl.style.display = 'block';
        return;
      }
      // 密码正确，设置认证标记
      sessionStorage.setItem('yipin_authed', '1');
      location.reload();
    };

    $('loginBtn').onclick = doLogin;
    $('loginPassword').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') doLogin();
    });
  }

  // ========== 初始化 ==========
  async function init() {
    // 弹窗关闭
    $('modalClose').onclick = hideModal;
    $('modalOverlay').onclick = function (e) {
      if (e.target === $('modalOverlay')) hideModal();
    };

    // 全局：所有输入框点击时默认全选
    document.addEventListener('focusin', function (e) {
      var tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') {
        // 延迟一帧确保焦点已进入，再全选
        setTimeout(function () {
          try { e.target.select(); } catch (err) {}
        }, 0);
      }
    });

    // 密码验证检查
    if (typeof sessionStorage === 'undefined') return; // Node测试环境跳过
    var isAuthenticated = sessionStorage.getItem('yipin_authed') === '1';
    if (!isAuthenticated) {
      renderLoginPage();
      return;
    }

    // 先初始化路由和页面（不等待云端）
    // 登出按钮
    var logoutBtn = $('logoutBtn');
    if (logoutBtn) {
      logoutBtn.onclick = function () {
        confirmDialog('确定退出登录吗？', function () {
          sessionStorage.removeItem('yipin_authed');
          if (typeof DataSync !== 'undefined') DataSync.logout();
          location.reload();
        });
      };
    }

    // 路由监听
    window.addEventListener('hashchange', router);

    // 初始路由
    if (!location.hash) {
      location.hash = '#/';
    } else {
      router();
    }

    // 隐藏页面加载动画
    var loader = $('pageLoader');
    if (loader) {
      loader.style.opacity = '0';
      setTimeout(function () { loader.style.display = 'none'; }, 300);
    }

    // 后台异步：云端登录和拉取数据，不阻塞页面显示
    var sbConfigured = typeof SB !== 'undefined' && SB.email && SB.email !== 'your-email@example.com';
    if (sbConfigured && typeof DataSync !== 'undefined') {
      (async function () {
        try {
          if (!DataSync.isLoggedIn()) {
            var result = await DataSync.login(SB.email, SB.sbPassword);
            if (!result.success) {
              console.warn('云端登录失败，使用本地模式');
              return;
            }
          }
          // 登录成功，从云端拉取最新数据
          if (DataSync.isLoggedIn()) {
            await DataSync.loadFromCloud();
            // 数据拉取完成后，刷新当前页面
            router();
            console.log('云端数据已同步');
          }
        } catch (e) {
          console.warn('云端同步失败，使用本地数据', e);
        }
      })();
    }
  }

  // DOM就绪后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ========== 导出供测试 ==========
  if (typeof module === 'object' && module.exports) {
    module.exports = {
      parseRoute: parseRoute,
      VIP_LABELS: VIP_LABELS,
      VIP_CLASS: VIP_CLASS,
      formatMoney: formatMoney,
      escapeHtml: escapeHtml,
      todayStr: todayStr
    };
  }

  // 暴露给全局（供页面函数扩展使用）
  window.App = {
    store: store,
    pages: pages,
    parseRoute: parseRoute,
    VIP_LABELS: VIP_LABELS,
    VIP_CLASS: VIP_CLASS,
    showToast: showToast,
    showModal: showModal,
    hideModal: hideModal,
    confirmDialog: confirmDialog,
    escapeHtml: escapeHtml,
    formatMoney: formatMoney,
    todayStr: todayStr,
    $: $,
    router: router
  };
})();
