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

const categories = ["讲座", "比赛", "志愿活动", "文体活动", "社团活动"];
const config = {
  version: "activity-v1",
  registrationRole: "student",
  protectedRoutes: ["publish", "workspace", "admin", "profile"],
};

const seed = {
  users: [
    { id: "admin", name: "活动管理员", username: "admin", password: "123456", role: "admin", college: "信息工程学院", createdAt: new Date().toISOString() },
    { id: "student", name: "程莉晶", username: "student", password: "123456", role: "student", college: "信息工程学院", createdAt: new Date().toISOString() },
    { id: "u-zhaomin", name: "赵敏", username: "zhaomin", password: "123456", role: "student", college: "信息工程学院", createdAt: new Date().toISOString() },
  ],
  items: [
    makeActivity("a1", "前端开发经验分享讲座", "讲座", "信息工程学院", "信息楼报告厅", 120, 37, "已通过", "报名中", 1),
    makeActivity("a2", "校园程序设计比赛", "比赛", "软件协会", "实训楼机房", 60, 60, "已通过", "已满", 2),
    makeActivity("a3", "图书馆整理志愿服务", "志愿活动", "青年志愿者协会", "图书馆一楼", 30, 12, "已通过", "报名中", 3),
    makeActivity("a4", "校园羽毛球友谊赛", "文体活动", "体育部", "体育馆", 48, 21, "已通过", "报名中", 4),
    makeActivity("a5", "摄影社团招新体验", "社团活动", "摄影协会", "大学生活动中心", 80, 35, "已通过", "报名中", 5),
    makeActivity("a6", "网络安全知识讲座", "讲座", "信息工程学院", "信息楼301", 90, 18, "已通过", "报名中", 6),
    makeActivity("a7", "寝室文化创意比赛", "比赛", "学生工作处", "大学生活动中心", 50, 10, "待审核", "报名中", 7),
  ],
  requests: [],
  favorites: [{ userId: "student", itemId: "a1", createdAt: new Date().toISOString() }],
};

function makeActivity(id, title, category, organizer, location, quota, joined, auditStatus, activityStatus, day) {
  const now = Date.now() + day * 86400000;
  return {
    id,
    title,
    category,
    organizer,
    location,
    quota,
    joined,
    activityStatus,
    auditStatus,
    startTime: new Date(now + 2 * 86400000).toISOString(),
    deadline: new Date(now + 86400000).toISOString(),
    contact: "活动组织方：13800000000",
    description: "面向在校学生的校园活动，请按时到场并遵守现场安排。",
    image: "assets/site.svg",
    ownerId: "admin",
    ownerName: "活动管理员",
    createdAt: new Date(Date.now() - day * 86400000).toISOString(),
  };
}

function getActivities() {
  const user = C.currentUser();
  return C.getItems().filter((item) => item.auditStatus === "已通过" || user?.role === "admin" || item.ownerId === user?.id);
}

function filterActivities() {
  let items = getActivities();
  if (C.state.category !== "全部") items = items.filter((item) => item.category === C.state.category);
  if (C.state.status !== "全部") items = items.filter((item) => item.activityStatus === C.state.status);
  if (C.state.keyword) {
    const keyword = C.state.keyword.toLowerCase();
    items = items.filter((item) => [item.title, item.organizer, item.location, item.description].join(" ").toLowerCase().includes(keyword));
  }
  return items.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
}

function statusClass(status) {
  if (status === "报名中") return "status-active";
  if (status === "已满") return "status-full";
  if (status === "已结束") return "status-closed";
  if (status === "待审核") return "status-pending";
  return "status-processing";
}

function activityCard(item) {
  const user = C.currentUser();
  const signed = C.getRequests().some((request) => request.itemId === item.id && request.userId === user?.id && request.status === "已报名");
  return `
    <article class="data-card">
      <div class="data-card-media"><img src="${item.image}" alt="${C.escapeHtml(item.title)}" /></div>
      <div class="data-card-body">
        <span class="category-label">${C.escapeHtml(item.category)}</span>
        <h3>${C.escapeHtml(item.title)}</h3>
        <div class="card-meta"><span>${C.escapeHtml(item.organizer)}</span><span class="status ${statusClass(item.activityStatus)}">${C.escapeHtml(item.activityStatus)}</span></div>
        <div class="card-meta"><span>${C.escapeHtml(item.location)}</span><span>${item.joined}/${item.quota} 人</span></div>
        <div class="card-actions">
          <button class="secondary-button" type="button" data-action="detail" data-id="${item.id}"><i data-lucide="eye"></i>详情</button>
          <button class="secondary-button" type="button" data-action="favorite" data-id="${item.id}"><i data-lucide="heart"></i>收藏</button>
          <button class="primary-button" type="button" data-action="signup" data-id="${item.id}" ${signed || item.activityStatus !== "报名中" ? "disabled" : ""}>${signed ? "已报名" : "立即报名"}</button>
        </div>
      </div>
    </article>
  `;
}

function empty(message) {
  return `<div class="empty-state"><i data-lucide="calendar-x"></i><p>${C.escapeHtml(message)}</p></div>`;
}

function renderHome() {
  const items = filterActivities();
  document.querySelector("#homeStats").innerHTML = [
    ["报名中", items.filter((item) => item.activityStatus === "报名中").length],
    ["全部活动", C.getItems().length],
    ["累计报名", C.getItems().reduce((sum, item) => sum + Number(item.joined), 0)],
    ["我的报名", C.getRequests().filter((item) => item.userId === C.currentUser()?.id && item.status === "已报名").length],
  ].map(([label, value]) => `<div class="stat"><strong>${value}</strong><span>${label}</span></div>`).join("");
  document.querySelector("#homeGrid").innerHTML = items.length ? items.slice(0, 8).map(activityCard).join("") : empty("暂时没有活动");
  C.updateIcons();
}

function renderList() {
  const items = filterActivities();
  document.querySelector("#listDescription").textContent = `当前找到 ${items.length} 个活动`;
  document.querySelector("#categoryFilter").innerHTML = ["全部", ...categories]
    .map((category) => `<button type="button" class="${C.state.category === category ? "active" : ""}" data-filter-category="${category}">${category}</button>`)
    .join("");
  document.querySelector("#statusFilter").innerHTML = ["全部", "报名中", "已满", "已结束", "待审核"]
    .map((status) => `<button type="button" class="${C.state.status === status ? "active" : ""}" data-filter-status="${status}">${status}</button>`)
    .join("");
  document.querySelector("#listGrid").innerHTML = items.length ? items.map(activityCard).join("") : empty("没有符合条件活动");
  C.updateIcons();
}

function renderPublish() {
  document.querySelector("#itemFields").innerHTML = `
    <div class="field"><label>活动名称</label><input name="title" required /></div>
    <div class="field"><label>主办方</label><input name="organizer" required /></div>
    <div class="field"><label>活动分类</label><select name="category">${categories.map((item) => `<option>${item}</option>`).join("")}</select></div>
    <div class="field"><label>活动地点</label><input name="location" required /></div>
    <div class="field"><label>开始时间</label><input name="startTime" type="datetime-local" required /></div>
    <div class="field"><label>报名截止</label><input name="deadline" type="datetime-local" required /></div>
    <div class="field"><label>计划名额</label><input name="quota" type="number" min="1" max="500" required /></div>
    <div class="field"><label>联系方式</label><input name="contact" required /></div>
    <div class="field full"><label>活动说明</label><textarea name="description" required></textarea></div>
  `;
}

function renderWorkspace() {
  const user = C.currentUser();
  const mine = C.getItems().filter((item) => item.ownerId === user.id);
  const signups = C.getRequests().filter((item) => item.userId === user.id && item.status === "已报名");
  const rows = [
    ...mine.map((item) => ({ title: item.title, desc: `我发布的活动 · ${item.activityStatus}`, item })),
    ...signups.map((request) => ({ title: request.activityTitle, desc: "已报名活动", item: C.getItems().find((item) => item.id === request.itemId) })),
  ];
  document.querySelector("#workspaceContent").innerHTML = rows.length
    ? rows.map((row) => `
      <article class="record">
        <img src="${row.item?.image || "assets/site.svg"}" alt="" />
        <div class="record-info"><strong>${C.escapeHtml(row.title)}</strong><p>${C.escapeHtml(row.desc)}</p></div>
        <div class="record-actions">
          ${row.item ? `<button class="secondary-button" type="button" data-action="detail" data-id="${row.item.id}">查看</button>` : ""}
          ${row.desc === "已报名活动" ? `<button class="danger-button" type="button" data-action="cancel-signup" data-id="${row.item?.id}">取消报名</button>` : ""}
        </div>
      </article>
    `).join("")
    : empty("还没有发布或报名记录");
  C.updateIcons();
}

function renderAdmin() {
  if (C.currentUser()?.role !== "admin") {
    C.navigate("home");
    C.toast("没有后台管理权限");
    return;
  }
  const items = C.getItems();
  const pending = items.filter((item) => item.auditStatus === "待审核");
  document.querySelector("#adminStats").innerHTML = [
    ["待审核", pending.length],
    ["报名中", items.filter((item) => item.activityStatus === "报名中").length],
    ["已满", items.filter((item) => item.activityStatus === "已满").length],
    ["全部活动", items.length],
  ].map(([label, value]) => `<div class="stat"><strong>${value}</strong><span>${label}</span></div>`).join("");
  document.querySelector("#pendingList").innerHTML = pending.length
    ? pending.map((item) => `
      <article class="record">
        <img src="${item.image}" alt="" />
        <div class="record-info"><strong>${C.escapeHtml(item.title)}</strong><p>${C.escapeHtml(item.organizer)} · ${C.escapeHtml(item.location)}</p></div>
        <div class="record-actions">
          <button class="primary-button" type="button" data-action="approve" data-id="${item.id}">通过</button>
          <button class="danger-button" type="button" data-action="reject" data-id="${item.id}">退回</button>
        </div>
      </article>
    `).join("")
    : empty("没有待审核活动");
  document.querySelector("#adminTable").innerHTML = items.map((item) => `
    <tr>
      <td>${C.escapeHtml(item.title)}</td>
      <td>${C.escapeHtml(item.category)}</td>
      <td>${C.escapeHtml(item.ownerName)}</td>
      <td><span class="status ${statusClass(item.activityStatus)}">${C.escapeHtml(item.activityStatus)}</span></td>
      <td>${item.auditStatus === "已通过" ? `<button class="secondary-button" type="button" data-action="down" data-id="${item.id}">下架</button>` : `<button class="secondary-button" type="button" data-action="approve" data-id="${item.id}">通过</button>`}</td>
    </tr>
  `).join("");
  C.updateIcons();
}

function renderProfile() {
  const user = C.currentUser();
  document.querySelector("#profileContent").innerHTML = `
    <h2>${C.escapeHtml(user.name)}</h2>
    <p>${C.escapeHtml(user.college)} · ${user.role === "admin" ? "管理员" : "学生"}</p>
    <div class="stats-strip">
      <div class="stat"><strong>${C.getItems().filter((item) => item.ownerId === user.id).length}</strong><span>发布活动</span></div>
      <div class="stat"><strong>${C.getRequests().filter((item) => item.userId === user.id && item.status === "已报名").length}</strong><span>报名活动</span></div>
      <div class="stat"><strong>${C.getFavorites().filter((item) => item.userId === user.id).length}</strong><span>收藏活动</span></div>
    </div>
    <button type="button" class="secondary-button" data-action="logout"><i data-lucide="log-out"></i>退出登录</button>
  `;
}

function render(route) {
  document.querySelector(".brand-mark").innerHTML = '<i data-lucide="calendar-check"></i>';
  document.querySelector("#globalSearchInput").placeholder = "搜索活动名称、主办方或地点";
  document.querySelector("#appName").textContent = "校园活动报名";
  document.querySelector("#appSubtitle").textContent = "活动发布与在线报名";
  document.querySelector("[data-label='home']").textContent = "首页";
  document.querySelector("[data-label='list']").textContent = "活动大厅";
  document.querySelector("[data-label='publish']").textContent = "发布活动";
  document.querySelector("[data-label='workspace']").textContent = "我的报名";
  document.querySelector("#homeEyebrow").textContent = "校园活动";
  document.querySelector("#homeTitle").textContent = "及时找到感兴趣的活动";
  document.querySelector("#homeDescription").textContent = "浏览讲座、比赛、志愿活动和社团活动。";
  document.querySelector("#homeNotice").innerHTML = `<strong>报名提示</strong><p>报名成功后可在我的报名中查看或取消。</p><button class="primary-button" type="button" data-route="list">浏览活动</button>`;
  document.querySelector("#latestTitle").textContent = "近期活动";
  document.querySelector("#latestDescription").textContent = "按开始时间排列的活动信息";
  document.querySelector("#listTitle").textContent = "活动大厅";
  document.querySelector("#publishTitle").textContent = "发布活动";
  document.querySelector("#publishDescription").textContent = "填写活动信息后提交管理员审核。";
  document.querySelector("#workspaceTitle").textContent = "我的报名";
  document.querySelector("#workspaceDescription").textContent = "查看发布活动和已报名记录。";
  if (route === "home") renderHome();
  if (route === "list") renderList();
  if (route === "publish") renderPublish();
  if (route === "workspace") renderWorkspace();
  if (route === "admin") renderAdmin();
  if (route === "profile") renderProfile();
}

function openDetail(id) {
  const item = C.getItems().find((activity) => activity.id === id);
  if (!item) return;
  document.querySelector("#detailContent").innerHTML = `
    <h2>${C.escapeHtml(item.title)}</h2>
    <img src="${item.image}" alt="" style="width:100%;aspect-ratio:16/10;object-fit:cover;border-radius:8px" />
    <p class="category-label">${C.escapeHtml(item.category)} · ${C.escapeHtml(item.organizer)}</p>
    <p>${C.escapeHtml(item.description)}</p>
    <div class="record-info">
      <p>地点：${C.escapeHtml(item.location)}</p>
      <p>开始时间：${C.formatDateTime(item.startTime)}</p>
      <p>报名截止：${C.formatDateTime(item.deadline)}</p>
      <p>名额：${item.joined}/${item.quota}</p>
      <p>联系方式：${C.escapeHtml(item.contact)}</p>
    </div>
    <div class="form-actions">
      <button type="button" class="primary-button" data-action="signup" data-id="${item.id}">报名</button>
    </div>
  `;
  document.querySelector("#detailDialog").showModal();
  C.updateIcons();
}

function handleAction(button) {
  const { action, id } = button.dataset;
  if (action === "detail") return openDetail(id);
  if (action === "favorite") return toggleFavorite(id);
  if (action === "signup") return signup(id);
  if (action === "cancel-signup") return cancelSignup(id);
  if (action === "approve" || action === "reject" || action === "down") return updateAudit(id, action);
}

function toggleFavorite(id) {
  if (!C.requireLogin()) return;
  const user = C.currentUser();
  const favorites = C.getFavorites();
  const index = favorites.findIndex((item) => item.userId === user.id && item.itemId === id);
  if (index >= 0) favorites.splice(index, 1);
  else favorites.push({ userId: user.id, itemId: id, createdAt: new Date().toISOString() });
  C.write(C.keys.favorites, favorites);
  C.toast(index >= 0 ? "已取消收藏" : "已收藏");
  render(C.state.route);
}

function signup(id) {
  if (!C.requireLogin()) return;
  const user = C.currentUser();
  const item = C.getItems().find((activity) => activity.id === id);
  if (!item || item.activityStatus !== "报名中") return C.toast("当前不能报名");
  const requests = C.getRequests();
  if (requests.some((request) => request.itemId === id && request.userId === user.id && request.status === "已报名")) return C.toast("已经报名");
  if (item.joined >= item.quota) {
    item.activityStatus = "已满";
    C.write(C.keys.items, C.getItems().map((activity) => activity.id === id ? item : activity));
    return C.toast("名额已满");
  }
  requests.push({ id: C.uid("r"), itemId: id, activityTitle: item.title, userId: user.id, userName: user.name, status: "已报名", createdAt: new Date().toISOString() });
  item.joined += 1;
  if (item.joined >= item.quota) item.activityStatus = "已满";
  C.write(C.keys.requests, requests);
  C.write(C.keys.items, C.getItems().map((activity) => activity.id === id ? item : activity));
  C.toast("报名成功");
  document.querySelector("#detailDialog")?.close();
  render(C.state.route);
}

function cancelSignup(id) {
  const user = C.currentUser();
  const requests = C.getRequests();
  const request = requests.find((item) => item.itemId === id && item.userId === user.id && item.status === "已报名");
  if (!request) return;
  request.status = "已取消";
  const item = C.getItems().find((activity) => activity.id === id);
  if (item && item.joined > 0) item.joined -= 1;
  if (item && item.activityStatus === "已满") item.activityStatus = "报名中";
  C.write(C.keys.requests, requests);
  C.write(C.keys.items, C.getItems().map((activity) => activity.id === id ? item : activity));
  C.toast("已取消报名");
  render("workspace");
}

function updateAudit(id, action) {
  const items = C.getItems();
  const item = items.find((activity) => activity.id === id);
  if (!item) return;
  item.auditStatus = action === "approve" ? "已通过" : "已下架";
  C.write(C.keys.items, items);
  C.toast(action === "approve" ? "审核通过" : "已下架");
  render("admin");
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
  const form = new FormData(event.currentTarget);
  const quota = Number(form.get("quota"));
  const item = {
    id: C.uid("a"),
    title: form.get("title").trim(),
    organizer: form.get("organizer").trim(),
    category: form.get("category"),
    location: form.get("location").trim(),
    startTime: new Date(form.get("startTime")).toISOString(),
    deadline: new Date(form.get("deadline")).toISOString(),
    quota,
    joined: 0,
    contact: form.get("contact").trim(),
    description: form.get("description").trim(),
    image: "assets/site.svg",
    ownerId: user.id,
    ownerName: user.name,
    auditStatus: "待审核",
    activityStatus: "报名中",
    createdAt: new Date().toISOString(),
  };
  C.write(C.keys.items, [...C.getItems(), item]);
  event.currentTarget.reset();
  C.toast("活动已提交审核");
  C.navigate("workspace");
});

document.querySelector("#resetFormButton").addEventListener("click", () => document.querySelector("#itemForm").reset());

C.init({ ...config, seed, render });
