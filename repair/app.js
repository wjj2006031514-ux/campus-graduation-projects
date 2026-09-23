(function () {
  const site = document.body.dataset.site;
  if (!site) return;

  const keys = {
    users: `${site}Users`,
    items: `${site}Items`,
    requests: `${site}Requests`,
    favorites: `${site}Favorites`,
    session: `${site}Session`,
    version: `${site}Version`,
  };

  const state = {
    route: location.hash.replace(/^#\//, "") || "home",
    keyword: "",
    category: "全部",
    status: "全部",
  };

  let config = null;
  let renderHandler = () => {};

  function read(key, fallback) {
    try {
      const text = localStorage.getItem(key);
      return text ? JSON.parse(text) : fallback;
    } catch {
      return fallback;
    }
  }

  function write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function getUsers() {
    return read(keys.users, []);
  }

  function getItems() {
    return read(keys.items, []);
  }

  function getRequests() {
    return read(keys.requests, []);
  }

  function getFavorites() {
    return read(keys.favorites, []);
  }

  function currentUser() {
    const id = localStorage.getItem(keys.session);
    return getUsers().find((user) => user.id === id) || null;
  }

  function setSession(id) {
    localStorage.setItem(keys.session, id);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function uid(prefix) {
    return `${prefix}${Date.now()}${Math.floor(Math.random() * 1000)}`;
  }

  function formatTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
      date.getDate(),
    ).padStart(2, "0")}`;
  }

  function formatDateTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return `${formatTime(date)} ${String(date.getHours()).padStart(2, "0")}:${String(
      date.getMinutes(),
    ).padStart(2, "0")}`;
  }

  function toast(message) {
    const element = document.querySelector("#toast");
    if (!element) return;
    element.textContent = message;
    element.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => element.classList.remove("show"), 2200);
  }

  function updateIcons() {
    if (window.lucide) window.lucide.createIcons();
  }

  function openAuth(tab = "login") {
    const dialog = document.querySelector("#authDialog");
    switchAuth(tab);
    if (dialog && !dialog.open) dialog.showModal();
    updateIcons();
  }

  function switchAuth(tab) {
    document.querySelectorAll("[data-auth-tab]").forEach((button) => {
      button.classList.toggle("active", button.dataset.authTab === tab);
    });
    document.querySelector("#loginForm").hidden = tab !== "login";
    document.querySelector("#registerForm").hidden = tab !== "register";
  }

  function requireLogin(message = "请先登录后再操作") {
    if (currentUser()) return true;
    openAuth("login");
    toast(message);
    return false;
  }

  function logout() {
    localStorage.removeItem(keys.session);
    location.hash = "#/home";
    render();
  }

  function navigate(route) {
    location.hash = `#/${route}`;
  }

  function renderHeader() {
    const user = currentUser();
    const area = document.querySelector("#headerActions");
    if (!area) return;
    if (!user) {
      area.innerHTML = `
        <button type="button" class="secondary-button" data-action="open-login">
          <i data-lucide="log-in"></i>登录 / 注册
        </button>
      `;
    } else {
      area.innerHTML = `
        <button type="button" class="secondary-button" data-route="profile">
          <i data-lucide="user-round"></i>${escapeHtml(user.name)}
        </button>
        <button type="button" class="secondary-button" data-action="logout">
          <i data-lucide="log-out"></i><span class="logout-label">退出</span>
        </button>
      `;
    }

    document.querySelectorAll("[data-roles]").forEach((element) => {
      const roles = element.dataset.roles.split(",");
      element.hidden = !user || !roles.includes(user.role);
    });
  }

  function login(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const username = form.username.value.trim();
    const password = form.password.value;
    const user = getUsers().find((item) => item.username === username && item.password === password);
    if (!user) {
      toast("用户名或密码错误");
      return;
    }
    setSession(user.id);
    form.reset();
    document.querySelector("#authDialog")?.close();
    toast(`欢迎回来，${user.name}`);
    render();
  }

  function register(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const users = getUsers();
    const username = form.username.value.trim();
    if (users.some((item) => item.username === username)) {
      toast("用户名已经存在");
      return;
    }
    if (form.password.value !== form.confirmPassword.value) {
      toast("两次输入的密码不一致");
      return;
    }
    const user = {
      id: uid("u"),
      name: form.name.value.trim(),
      username,
      password: form.password.value,
      college: form.college?.value.trim() || "信息工程学院",
      role: config.registrationRole || "student",
      createdAt: new Date().toISOString(),
    };
    users.push(user);
    write(keys.users, users);
    setSession(user.id);
    form.reset();
    document.querySelector("#authDialog")?.close();
    toast("注册成功");
    render();
  }

  function confirmAction(title, message, action) {
    const dialog = document.querySelector("#confirmDialog");
    document.querySelector("#confirmTitle").textContent = title;
    document.querySelector("#confirmMessage").textContent = message;
    dialog.dataset.action = "pending";
    dialog.pendingAction = action;
    dialog.showModal();
  }

  function seedIfNeeded(seed) {
    const currentVersion = localStorage.getItem(keys.version);
    if (currentVersion !== config.version) {
      write(keys.users, seed.users);
      write(keys.items, seed.items);
      write(keys.requests, seed.requests || []);
      write(keys.favorites, seed.favorites || []);
      localStorage.setItem(keys.version, config.version);
    }
  }

  function render() {
    state.route = location.hash.replace(/^#\//, "") || "home";
    const protectedRoutes = config.protectedRoutes || [];
    if (protectedRoutes.includes(state.route) && !currentUser()) {
      location.hash = "#/home";
      openAuth("login");
      toast("请先登录后再访问");
      return;
    }
    document.querySelectorAll(".view").forEach((view) => view.classList.remove("active"));
    document.querySelector(`#view-${state.route}`)?.classList.add("active");
    document.querySelectorAll(".nav-row [data-route]").forEach((button) => {
      button.classList.toggle("active", button.dataset.route === state.route);
    });
    renderHeader();
    renderHandler(state.route);
    updateIcons();
  }

  document.addEventListener("click", (event) => {
    const routeButton = event.target.closest("[data-route]");
    if (routeButton) {
      navigate(routeButton.dataset.route);
      return;
    }
    const closeButton = event.target.closest("[data-close-dialog]");
    if (closeButton) {
      document.querySelector(`#${closeButton.dataset.closeDialog}`)?.close();
      return;
    }
    const tabButton = event.target.closest("[data-auth-tab]");
    if (tabButton) {
      switchAuth(tabButton.dataset.authTab);
      return;
    }
    if (event.target.closest("[data-action='open-login']")) {
      openAuth("login");
      return;
    }
    if (event.target.closest("[data-action='logout']")) {
      logout();
    }
  });

  window.addEventListener("hashchange", render);
  document.querySelector("#loginForm")?.addEventListener("submit", login);
  document.querySelector("#registerForm")?.addEventListener("submit", register);
  document.querySelector("#confirmActionButton")?.addEventListener("click", () => {
    const dialog = document.querySelector("#confirmDialog");
    if (typeof dialog.pendingAction === "function") dialog.pendingAction();
    dialog.pendingAction = null;
    dialog.close();
  });
  document.querySelector("#confirmCancelButton")?.addEventListener("click", () => {
    const dialog = document.querySelector("#confirmDialog");
    dialog.pendingAction = null;
    dialog.close();
  });

  window.Campus = {
    site,
    keys,
    state,
    read,
    write,
    getUsers,
    getItems,
    getRequests,
    getFavorites,
    currentUser,
    setSession,
    escapeHtml,
    uid,
    formatTime,
    formatDateTime,
    toast,
    openAuth,
    requireLogin,
    confirmAction,
    navigate,
    render,
    updateIcons,
    init(options) {
      config = options;
      renderHandler = options.render;
      seedIfNeeded(options.seed);
      window.Campus.config = config;
      if (!location.hash) location.hash = "#/home";
      render();
    },
  };
})();


const C = window.Campus;

const categories = ["水电维修", "门锁门窗", "网络设备", "照明设备", "其他故障"];
const config = {
  version: "repair-v1",
  registrationRole: "student",
  protectedRoutes: ["publish", "workspace", "admin", "profile"],
};

const users = [
  { id: "admin", name: "维修管理员", username: "admin", password: "123456", role: "admin", college: "后勤管理处", createdAt: new Date().toISOString() },
  { id: "worker", name: "维修员张师傅", username: "worker", password: "123456", role: "worker", college: "后勤管理处", createdAt: new Date().toISOString() },
  { id: "student", name: "陈雪蒙", username: "student", password: "123456", role: "student", college: "信息工程学院", createdAt: new Date().toISOString() },
];

const seed = {
  users,
  items: [
    makeRepair("r1", "student", "1号楼", "302", "水电维修", "普通", "洗手池下方水管缓慢漏水。", "待处理", null, 1),
    makeRepair("r2", "student", "2号楼", "116", "照明设备", "普通", "宿舍灯管闪烁，偶尔无法点亮。", "待维修", "worker", 2),
    makeRepair("r3", "student", "3号楼", "508", "网络设备", "紧急", "网口松动，连接后频繁断网。", "维修中", "worker", 3),
    makeRepair("r4", "student", "4号楼", "201", "门锁门窗", "普通", "门锁转动不顺畅，需要用力才能打开。", "待确认", "worker", 4),
    makeRepair("r5", "student", "5号楼", "407", "其他故障", "普通", "衣柜柜门合页松动。", "已完成", "worker", 5),
  ],
  requests: [
    { id: "p1", repairId: "r2", operatorId: "admin", status: "待维修", content: "已指派维修员张师傅处理。", createdAt: new Date(Date.now() - 86400000).toISOString() },
    { id: "p2", repairId: "r3", operatorId: "worker", status: "维修中", content: "已到场检查，正在更换网口模块。", createdAt: new Date().toISOString() },
    { id: "p3", repairId: "r4", operatorId: "worker", status: "待确认", content: "门锁已调整，请学生确认是否恢复正常。", createdAt: new Date().toISOString() },
  ],
  favorites: [],
};

function makeRepair(id, studentId, building, room, category, urgency, description, status, workerId, day) {
  return {
    id,
    studentId,
    studentName: "陈雪蒙",
    building,
    room,
    category,
    urgency,
    description,
    contact: "13800000000",
    image: "assets/site.svg",
    status,
    workerId,
    workerName: workerId ? "维修员张师傅" : "",
    auditStatus: "已通过",
    createdAt: new Date(Date.now() - day * 86400000).toISOString(),
  };
}

function getRepairs() {
  const user = C.currentUser();
  if (!user || user.role === "admin") return C.getItems();
  if (user.role === "worker") return C.getItems().filter((item) => item.workerId === user.id);
  return C.getItems().filter((item) => item.studentId === user.id);
}

function filterRepairs() {
  let items = getRepairs();
  if (C.state.category !== "全部") items = items.filter((item) => item.category === C.state.category);
  if (C.state.status !== "全部") items = items.filter((item) => item.status === C.state.status);
  if (C.state.keyword) {
    const keyword = C.state.keyword.toLowerCase();
    items = items.filter((item) => [item.building, item.room, item.category, item.description].join(" ").toLowerCase().includes(keyword));
  }
  return items.sort((a, b) => {
    if (a.urgency !== b.urgency) return a.urgency === "紧急" ? -1 : 1;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
}

function statusClass(status) {
  return {
    待处理: "status-pending",
    待维修: "status-assigned",
    维修中: "status-processing",
    待确认: "status-full",
    已完成: "status-completed",
    已退回: "status-cancelled",
  }[status] || "status-closed";
}

function repairCard(item) {
  const user = C.currentUser();
  const canConfirm = user?.role === "student" && item.studentId === user.id && item.status === "待确认";
  const canStart = user?.role === "worker" && item.workerId === user.id && item.status === "待维修";
  const canFinish = user?.role === "worker" && item.workerId === user.id && item.status === "维修中";
  const canAssign = user?.role === "admin" && item.status === "待处理";
  return `
    <article class="data-card">
      <div class="data-card-media"><img src="${item.image}" alt="${C.escapeHtml(item.category)}" /></div>
      <div class="data-card-body">
        <span class="category-label">${C.escapeHtml(item.category)}</span>
        <h3>${C.escapeHtml(item.building)} ${C.escapeHtml(item.room)} · ${C.escapeHtml(item.description)}</h3>
        <div class="card-meta"><span>${C.escapeHtml(item.urgency)}</span><span class="status ${statusClass(item.status)}">${C.escapeHtml(item.status)}</span></div>
        <div class="card-meta"><span>${C.formatTime(item.createdAt)}</span><span>${C.escapeHtml(item.workerName || "未派单")}</span></div>
        <div class="card-actions">
          <button class="secondary-button" type="button" data-action="detail" data-id="${item.id}"><i data-lucide="eye"></i>详情</button>
          ${canAssign ? `<button class="primary-button" type="button" data-action="assign" data-id="${item.id}">派单</button>` : ""}
          ${canStart ? `<button class="primary-button" type="button" data-action="start" data-id="${item.id}">开始维修</button>` : ""}
          ${canFinish ? `<button class="primary-button" type="button" data-action="finish" data-id="${item.id}">完成维修</button>` : ""}
          ${canConfirm ? `<button class="primary-button" type="button" data-action="confirm" data-id="${item.id}">确认修好</button>` : ""}
        </div>
      </div>
    </article>
  `;
}

function empty(message) {
  return `<div class="empty-state"><i data-lucide="wrench"></i><p>${C.escapeHtml(message)}</p></div>`;
}

function renderHome() {
  const items = filterRepairs();
  document.querySelector("#homeStats").innerHTML = [
    ["待处理", C.getItems().filter((item) => item.status === "待处理").length],
    ["维修中", C.getItems().filter((item) => item.status === "维修中").length],
    ["待确认", C.getItems().filter((item) => item.status === "待确认").length],
    ["已完成", C.getItems().filter((item) => item.status === "已完成").length],
  ].map(([label, value]) => `<div class="stat"><strong>${value}</strong><span>${label}</span></div>`).join("");
  document.querySelector("#homeGrid").innerHTML = items.length ? items.slice(0, 8).map(repairCard).join("") : empty("暂时没有报修记录");
  C.updateIcons();
}

function renderList() {
  const items = filterRepairs();
  document.querySelector("#listDescription").textContent = `当前找到 ${items.length} 条报修记录`;
  document.querySelector("#categoryFilter").innerHTML = ["全部", ...categories]
    .map((category) => `<button type="button" class="${C.state.category === category ? "active" : ""}" data-filter-category="${category}">${category}</button>`)
    .join("");
  document.querySelector("#statusFilter").innerHTML = ["全部", "待处理", "待维修", "维修中", "待确认", "已完成"]
    .map((status) => `<button type="button" class="${C.state.status === status ? "active" : ""}" data-filter-status="${status}">${status}</button>`)
    .join("");
  document.querySelector("#listGrid").innerHTML = items.length ? items.map(repairCard).join("") : empty("没有符合条件记录");
  C.updateIcons();
}

function renderPublish() {
  const user = C.currentUser();
  if (user?.role !== "student") {
    document.querySelector("#itemFields").innerHTML = `<div class="empty-state">只有学生账号可以提交报修。</div>`;
    return;
  }
  document.querySelector("#itemFields").innerHTML = `
    <div class="field"><label>宿舍楼栋</label><input name="building" required /></div>
    <div class="field"><label>房间号</label><input name="room" required /></div>
    <div class="field"><label>故障分类</label><select name="category">${categories.map((item) => `<option>${item}</option>`).join("")}</select></div>
    <div class="field"><label>紧急程度</label><select name="urgency"><option>普通</option><option>紧急</option></select></div>
    <div class="field full"><label>联系方式</label><input name="contact" required /></div>
    <div class="field full"><label>故障说明</label><textarea name="description" required></textarea></div>
  `;
}

function renderWorkspace() {
  const user = C.currentUser();
  const rows = getRepairs();
  document.querySelector("#workspaceContent").innerHTML = rows.length
    ? rows.map((item) => `
      <article class="record">
        <img src="${item.image}" alt="" />
        <div class="record-info">
          <strong>${C.escapeHtml(item.building)} ${C.escapeHtml(item.room)} · ${C.escapeHtml(item.category)}</strong>
          <p>${C.escapeHtml(item.description)}</p>
          <p><span class="status ${statusClass(item.status)}">${C.escapeHtml(item.status)}</span> ${C.formatTime(item.createdAt)}</p>
        </div>
        <div class="record-actions">
          <button class="secondary-button" type="button" data-action="detail" data-id="${item.id}">查看进度</button>
          ${user.role === "worker" && item.status === "待维修" ? `<button class="primary-button" type="button" data-action="start" data-id="${item.id}">开始维修</button>` : ""}
          ${user.role === "worker" && item.status === "维修中" ? `<button class="primary-button" type="button" data-action="finish" data-id="${item.id}">完成维修</button>` : ""}
          ${user.role === "student" && item.status === "待确认" ? `<button class="primary-button" type="button" data-action="confirm" data-id="${item.id}">确认修好</button>` : ""}
        </div>
      </article>
    `).join("")
    : empty("没有相关报修记录");
  C.updateIcons();
}

function renderAdmin() {
  if (C.currentUser()?.role !== "admin") {
    C.navigate("home");
    C.toast("没有后台管理权限");
    return;
  }
  const items = C.getItems();
  const pending = items.filter((item) => item.status === "待处理");
  document.querySelector("#adminStats").innerHTML = [
    ["待派单", pending.length],
    ["维修中", items.filter((item) => item.status === "维修中").length],
    ["待确认", items.filter((item) => item.status === "待确认").length],
    ["已完成", items.filter((item) => item.status === "已完成").length],
  ].map(([label, value]) => `<div class="stat"><strong>${value}</strong><span>${label}</span></div>`).join("");
  document.querySelector("#pendingList").innerHTML = pending.length
    ? pending.map((item) => `
      <article class="record">
        <img src="${item.image}" alt="" />
        <div class="record-info"><strong>${C.escapeHtml(item.building)} ${C.escapeHtml(item.room)}</strong><p>${C.escapeHtml(item.description)}</p></div>
        <div class="record-actions">
          <button class="primary-button" type="button" data-action="assign" data-id="${item.id}">派给维修员</button>
          <button class="danger-button" type="button" data-action="reject" data-id="${item.id}">退回</button>
        </div>
      </article>
    `).join("")
    : empty("没有待派单记录");
  document.querySelector("#adminTable").innerHTML = items.map((item) => `
    <tr>
      <td>${C.escapeHtml(item.building)} ${C.escapeHtml(item.room)} · ${C.escapeHtml(item.category)}</td>
      <td>${C.escapeHtml(item.category)}</td>
      <td>${C.escapeHtml(item.studentName)}</td>
      <td><span class="status ${statusClass(item.status)}">${C.escapeHtml(item.status)}</span></td>
      <td>${item.status === "待处理" ? `<button class="secondary-button" type="button" data-action="assign" data-id="${item.id}">派单</button>` : ""}</td>
    </tr>
  `).join("");
  C.updateIcons();
}

function renderProfile() {
  const user = C.currentUser();
  const items = getRepairs();
  document.querySelector("#profileContent").innerHTML = `
    <h2>${C.escapeHtml(user.name)}</h2>
    <p>${C.escapeHtml(user.college)} · ${user.role === "admin" ? "管理员" : user.role === "worker" ? "维修人员" : "学生"}</p>
    <div class="stats-strip">
      <div class="stat"><strong>${items.length}</strong><span>相关报修</span></div>
      <div class="stat"><strong>${items.filter((item) => item.status === "维修中").length}</strong><span>维修中</span></div>
      <div class="stat"><strong>${items.filter((item) => item.status === "已完成").length}</strong><span>已完成</span></div>
    </div>
    <button type="button" class="secondary-button" data-action="logout"><i data-lucide="log-out"></i>退出登录</button>
  `;
}

function render(route) {
  document.querySelector(".brand-mark").innerHTML = '<i data-lucide="wrench"></i>';
  document.querySelector("#globalSearchInput").placeholder = "搜索楼栋、房间或故障类型";
  const user = C.currentUser();
  document.querySelector("#appName").textContent = "校园宿舍报修";
  document.querySelector("#appSubtitle").textContent = "故障提交与维修进度";
  document.querySelector("[data-label='home']").textContent = "首页";
  document.querySelector("[data-label='list']").textContent = "报修记录";
  document.querySelector("[data-label='publish']").textContent = "我要报修";
  document.querySelector("[data-label='workspace']").textContent = user?.role === "worker" ? "维修任务" : "我的报修";
  document.querySelector("#homeEyebrow").textContent = "宿舍维修服务";
  document.querySelector("#homeTitle").textContent = "快速提交宿舍故障";
  document.querySelector("#homeDescription").textContent = "填写楼栋、房间和故障说明，查看维修处理进度。";
  document.querySelector("#homeNotice").innerHTML = `<strong>报修流程</strong><p>提交报修、管理员派单、维修人员处理、学生确认。</p><button class="primary-button" type="button" data-route="publish">提交报修</button>`;
  document.querySelector("#latestTitle").textContent = "最近报修";
  document.querySelector("#latestDescription").textContent = "紧急报修优先显示";
  document.querySelector("#listTitle").textContent = "报修记录";
  document.querySelector("#publishTitle").textContent = "提交报修";
  document.querySelector("#publishDescription").textContent = "填写宿舍位置和故障说明。";
  document.querySelector("#workspaceTitle").textContent = user?.role === "worker" ? "维修任务" : "我的报修";
  document.querySelector("#workspaceDescription").textContent = "查看任务状态和维修进度。";
  if (user?.role !== "student") document.querySelector("[data-route='publish']").hidden = true;
  else document.querySelector("[data-route='publish']").hidden = false;
  if (route === "home") renderHome();
  if (route === "list") renderList();
  if (route === "publish") renderPublish();
  if (route === "workspace") renderWorkspace();
  if (route === "admin") renderAdmin();
  if (route === "profile") renderProfile();
}

function openDetail(id) {
  const item = C.getItems().find((repair) => repair.id === id);
  if (!item) return;
  const logs = C.getRequests().filter((log) => log.repairId === id);
  document.querySelector("#detailContent").innerHTML = `
    <h2>${C.escapeHtml(item.building)} ${C.escapeHtml(item.room)} · ${C.escapeHtml(item.category)}</h2>
    <img src="${item.image}" alt="" style="width:100%;aspect-ratio:16/10;object-fit:cover;border-radius:8px" />
    <p>${C.escapeHtml(item.description)}</p>
    <div class="record-info">
      <p>提交人：${C.escapeHtml(item.studentName)}</p>
      <p>紧急程度：${C.escapeHtml(item.urgency)}</p>
      <p>联系方式：${C.escapeHtml(item.contact)}</p>
      <p>指派维修：${C.escapeHtml(item.workerName || "未派单")}</p>
      <p>当前状态：${C.escapeHtml(item.status)}</p>
    </div>
    <h3>进度记录</h3>
    <div class="record-list">
      ${logs.length ? logs.map((log) => `<article class="record"><div class="record-info"><strong>${C.escapeHtml(log.status)}</strong><p>${C.escapeHtml(log.content)}</p><p>${C.formatDateTime(log.createdAt)}</p></div></article>`).join("") : empty("暂无进度")}
    </div>
  `;
  document.querySelector("#detailDialog").showModal();
  C.updateIcons();
}

function updateStatus(id, status, content) {
  const items = C.getItems();
  const item = items.find((repair) => repair.id === id);
  if (!item) return;
  item.status = status;
  C.write(C.keys.items, items);
  C.write(C.keys.requests, [...C.getRequests(), { id: C.uid("p"), repairId: id, operatorId: C.currentUser()?.id, status, content, createdAt: new Date().toISOString() }]);
  C.toast(content);
  render(C.state.route);
}

function handleAction(button) {
  const { action, id } = button.dataset;
  if (action === "detail") return openDetail(id);
  if (action === "assign") return updateStatus(id, "待维修", "已指派维修员张师傅处理。");
  if (action === "start") return updateStatus(id, "维修中", "维修人员已开始处理。");
  if (action === "finish") return updateStatus(id, "待确认", "维修已完成，等待学生确认。");
  if (action === "confirm") return updateStatus(id, "已完成", "学生已确认维修完成。");
  if (action === "reject") return updateStatus(id, "已退回", "报修信息被退回，请补充说明。");
}

document.addEventListener("click", (event) => {
  const actionButton = event.target.closest("[data-action]");
  if (actionButton) handleAction(actionButton);
  const categoryButton = event.target.closest("[data-filter-category]");
  if (categoryButton) {
    C.state.category = categoryButton.dataset.filterCategory;
    renderList();
  }
  const statusButton = event.target.closest("[data-filter-status]");
  if (statusButton) {
    C.state.status = statusButton.dataset.filterStatus;
    renderList();
  }
});

document.querySelector("#globalSearchForm").addEventListener("submit", (event) => {
  event.preventDefault();
  C.state.keyword = document.querySelector("#globalSearchInput").value.trim();
  C.navigate("list");
});

document.querySelector("#itemForm").addEventListener("submit", (event) => {
  event.preventDefault();
  if (!C.requireLogin()) return;
  const user = C.currentUser();
  if (user.role !== "student") return C.toast("当前账号不能提交报修");
  const form = new FormData(event.currentTarget);
  const item = {
    id: C.uid("r"),
    studentId: user.id,
    studentName: user.name,
    building: form.get("building").trim(),
    room: form.get("room").trim(),
    category: form.get("category"),
    urgency: form.get("urgency"),
    contact: form.get("contact").trim(),
    description: form.get("description").trim(),
    image: "assets/site.svg",
    status: "待处理",
    workerId: "",
    workerName: "",
    auditStatus: "已通过",
    createdAt: new Date().toISOString(),
  };
  C.write(C.keys.items, [...C.getItems(), item]);
  event.currentTarget.reset();
  C.toast("报修已提交");
  C.navigate("workspace");
});

document.querySelector("#resetFormButton").addEventListener("click", () => document.querySelector("#itemForm").reset());

C.init({ ...config, seed, render });
