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

const categories = ["教材书籍", "考试资料", "课外读物", "其他图书"];
const config = {
  version: "book-v1",
  registrationRole: "student",
  protectedRoutes: ["publish", "workspace", "admin", "profile"],
};

const seed = {
  users: [
    { id: "admin", name: "图书管理员", username: "admin", password: "123456", role: "admin", college: "信息工程学院", createdAt: new Date().toISOString() },
    { id: "student", name: "冯慧茹", username: "student", password: "123456", role: "student", college: "信息工程学院", createdAt: new Date().toISOString() },
    { id: "u-liming", name: "李明", username: "liming", password: "123456", role: "student", college: "信息工程学院", createdAt: new Date().toISOString() },
  ],
  items: [
    makeBook("b1", "高等数学教材", "教材书籍", "同济大学数学系", "借阅", "九成新", "图书馆北门", "有少量笔记，没有缺页。", "u-liming", "已通过", "可借", 1),
    makeBook("b2", "计算机网络复习资料", "考试资料", "课程组", "赠送", "八成新", "信息楼一楼", "包含知识点整理和往年题型。", "student", "已通过", "可借", 2),
    makeBook("b3", "JavaScript程序设计", "教材书籍", "李明", "借阅", "九成新", "图书馆二楼", "课程教材，适合前端入门。", "u-liming", "已通过", "可借", 3),
    makeBook("b4", "大学英语四级词汇", "考试资料", "外语教学组", "低价转让", "八成新", "一号宿舍楼下", "书角有轻微磨损，内页完整。", "student", "已通过", "已借出", 4),
    makeBook("b5", "计算机组成原理", "教材书籍", "王老师", "借阅", "七成新", "信息楼三楼", "适合课程复习，有重点标记。", "u-liming", "已通过", "可借", 5),
    makeBook("b6", "软件工程导论", "教材书籍", "张老师", "借阅", "九成新", "图书馆一楼", "教材保存较好。", "student", "已通过", "可借", 6),
    makeBook("b7", "数据库学习笔记", "课外读物", "课程小组", "赠送", "八成新", "二号宿舍楼", "手写笔记和例题整理。", "u-liming", "已通过", "可借", 7),
    makeBook("b8", "Python基础教程", "课外读物", "赵同学", "借阅", "九成新", "操场东侧", "适合零基础阅读。", "student", "待审核", "可借", 8),
  ],
  requests: [],
  favorites: [{ userId: "student", itemId: "b1", createdAt: new Date().toISOString() }],
};

function makeBook(id, title, category, author, shareType, condition, location, description, ownerId, auditStatus, borrowStatus, day) {
  const names = { student: "冯慧茹", "u-liming": "李明" };
  return {
    id,
    title,
    category,
    author,
    shareType,
    condition,
    location,
    description,
    contact: ownerId === "student" ? "13800000000" : "微信 liming2024",
    image: "assets/site.svg",
    ownerId,
    ownerName: names[ownerId],
    auditStatus,
    borrowStatus,
    createdAt: new Date(Date.now() - day * 86400000).toISOString(),
  };
}

function visibleBooks() {
  const user = C.currentUser();
  return C.getItems().filter((book) => book.auditStatus === "已通过" || user?.role === "admin" || book.ownerId === user?.id);
}

function filterBooks() {
  let books = visibleBooks();
  if (C.state.category !== "全部") books = books.filter((book) => book.category === C.state.category);
  if (C.state.status !== "全部") books = books.filter((book) => book.borrowStatus === C.state.status);
  if (C.state.keyword) {
    const keyword = C.state.keyword.toLowerCase();
    books = books.filter((book) =>
      [book.title, book.author, book.description, book.location].join(" ").toLowerCase().includes(keyword),
    );
  }
  return books.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function statusClass(status) {
  if (status === "可借") return "status-active";
  if (status === "已借出") return "status-sold";
  if (status === "待审核") return "status-pending";
  return "status-closed";
}

function itemCard(book) {
  const user = C.currentUser();
  const favorite = C.getFavorites().some((item) => item.userId === user?.id && item.itemId === book.id);
  return `
    <article class="data-card">
      <div class="data-card-media"><img src="${book.image}" alt="${C.escapeHtml(book.title)}" /></div>
      <div class="data-card-body">
        <span class="category-label">${C.escapeHtml(book.category)}</span>
        <h3>${C.escapeHtml(book.title)}</h3>
        <div class="card-meta">
          <span>${C.escapeHtml(book.author)}</span>
          <span class="status ${statusClass(book.borrowStatus)}">${C.escapeHtml(book.borrowStatus)}</span>
        </div>
        <div class="card-meta">
          <span>${C.escapeHtml(book.condition)}</span>
          <span>${C.escapeHtml(book.location)}</span>
        </div>
        <div class="card-actions">
          <button class="secondary-button" type="button" data-action="detail" data-id="${book.id}">
            <i data-lucide="eye"></i>详情
          </button>
          <button class="secondary-button" type="button" data-action="favorite" data-id="${book.id}">
            <i data-lucide="heart"></i>${favorite ? "取消收藏" : "收藏"}
          </button>
          ${
            book.ownerId !== user?.id && book.borrowStatus === "可借"
              ? `<button class="primary-button" type="button" data-action="borrow" data-id="${book.id}">
                  <i data-lucide="hand-heart"></i>申请借阅
                </button>`
              : ""
          }
        </div>
      </div>
    </article>
  `;
}

function empty(message) {
  return `<div class="empty-state"><i data-lucide="book-open"></i><p>${C.escapeHtml(message)}</p></div>`;
}

function renderHome() {
  const books = filterBooks();
  document.querySelector("#homeStats").innerHTML = [
    ["在借图书", books.filter((book) => book.borrowStatus === "可借").length],
    ["图书总数", C.getItems().length],
    ["借阅申请", C.getRequests().length],
    ["收藏记录", C.getFavorites().length],
  ]
    .map(([label, value]) => `<div class="stat"><strong>${value}</strong><span>${label}</span></div>`)
    .join("");
  document.querySelector("#homeGrid").innerHTML = books.length
    ? books.slice(0, 8).map(itemCard).join("")
    : empty("暂时没有图书");
  C.updateIcons();
}

function renderList() {
  const books = filterBooks();
  document.querySelector("#listDescription").textContent = `当前找到 ${books.length} 本图书`;
  document.querySelector("#categoryFilter").innerHTML = ["全部", ...categories]
    .map((category) => `<button type="button" class="${C.state.category === category ? "active" : ""}" data-filter-category="${category}">${category}</button>`)
    .join("");
  document.querySelector("#statusFilter").innerHTML = ["全部", "可借", "已借出", "待审核"]
    .map((status) => `<button type="button" class="${C.state.status === status ? "active" : ""}" data-filter-status="${status}">${status}</button>`)
    .join("");
  document.querySelector("#listGrid").innerHTML = books.length ? books.map(itemCard).join("") : empty("没有符合条件的图书");
  C.updateIcons();
}

function renderPublish() {
  document.querySelector("#itemFields").innerHTML = `
    <div class="field"><label>图书名称</label><input name="title" required /></div>
    <div class="field"><label>作者或出版社</label><input name="author" required /></div>
    <div class="field"><label>图书分类</label><select name="category">${categories.map((item) => `<option>${item}</option>`).join("")}</select></div>
    <div class="field"><label>分享方式</label><select name="shareType"><option>借阅</option><option>赠送</option><option>低价转让</option></select></div>
    <div class="field"><label>新旧程度</label><select name="condition"><option>九成新</option><option>八成新</option><option>七成新</option><option>有使用痕迹</option></select></div>
    <div class="field"><label>交易地点</label><input name="location" required /></div>
    <div class="field full"><label>联系方式</label><input name="contact" required /></div>
    <div class="field full"><label>图书说明</label><textarea name="description" required></textarea></div>
  `;
}

function renderWorkspace() {
  const user = C.currentUser();
  const items = C.getItems().filter((item) => item.ownerId === user.id);
  const requests = C.getRequests().filter((item) => item.userId === user.id);
  const rows = [
    ...items.map((item) => ({ title: item.title, desc: `我的发布 · ${item.borrowStatus}`, item })),
    ...requests.map((request) => ({ title: request.bookTitle, desc: `借阅申请 · ${request.status}`, request })),
  ];
  document.querySelector("#workspaceContent").innerHTML = rows.length
    ? rows.map((row) => `
      <article class="record">
        <img src="${row.item?.image || "assets/site.svg"}" alt="" />
        <div class="record-info"><strong>${C.escapeHtml(row.title)}</strong><p>${C.escapeHtml(row.desc)}</p></div>
        <div class="record-actions">
          ${row.item ? `<button class="secondary-button" type="button" data-action="detail" data-id="${row.item.id}">查看</button>` : ""}
        </div>
      </article>
    `).join("")
    : empty("还没有发布或借阅记录");
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
    ["已通过", items.filter((item) => item.auditStatus === "已通过").length],
    ["可借", items.filter((item) => item.borrowStatus === "可借").length],
    ["全部图书", items.length],
  ].map(([label, value]) => `<div class="stat"><strong>${value}</strong><span>${label}</span></div>`).join("");
  document.querySelector("#pendingList").innerHTML = pending.length
    ? pending.map((item) => `
      <article class="record">
        <img src="${item.image}" alt="" />
        <div class="record-info"><strong>${C.escapeHtml(item.title)}</strong><p>${C.escapeHtml(item.category)} · ${C.escapeHtml(item.ownerName)}</p></div>
        <div class="record-actions">
          <button class="primary-button" type="button" data-action="approve" data-id="${item.id}">通过</button>
          <button class="danger-button" type="button" data-action="reject" data-id="${item.id}">退回</button>
        </div>
      </article>
    `).join("")
    : empty("没有待审核图书");
  document.querySelector("#adminTable").innerHTML = items.map((item) => `
    <tr>
      <td>${C.escapeHtml(item.title)}</td>
      <td>${C.escapeHtml(item.category)}</td>
      <td>${C.escapeHtml(item.ownerName)}</td>
      <td><span class="status ${statusClass(item.borrowStatus)}">${C.escapeHtml(item.borrowStatus)}</span></td>
      <td>${item.auditStatus === "已通过" ? `<button class="secondary-button" type="button" data-action="down" data-id="${item.id}">下架</button>` : `<button class="secondary-button" type="button" data-action="approve" data-id="${item.id}">通过</button>`}</td>
    </tr>
  `).join("");
  C.updateIcons();
}

function renderProfile() {
  const user = C.currentUser();
  const owned = C.getItems().filter((item) => item.ownerId === user.id).length;
  const requests = C.getRequests().filter((item) => item.userId === user.id).length;
  const favorites = C.getFavorites().filter((item) => item.userId === user.id).length;
  document.querySelector("#profileContent").innerHTML = `
    <h2>${C.escapeHtml(user.name)}</h2>
    <p>${C.escapeHtml(user.college)} · ${user.role === "admin" ? "管理员" : "学生"}</p>
    <div class="stats-strip">
      <div class="stat"><strong>${owned}</strong><span>发布图书</span></div>
      <div class="stat"><strong>${requests}</strong><span>借阅申请</span></div>
      <div class="stat"><strong>${favorites}</strong><span>收藏图书</span></div>
      <div class="stat"><strong>${C.getRequests().filter((r) => C.getItems().find((b) => b.id === r.itemId)?.ownerId === user.id).length}</strong><span>收到申请</span></div>
    </div>
    <button type="button" class="secondary-button" data-action="logout"><i data-lucide="log-out"></i>退出登录</button>
  `;
}

function render(route) {
  document.querySelector(".brand-mark").innerHTML = '<i data-lucide="book-open"></i>';
  document.querySelector("#globalSearchInput").placeholder = "搜索书名、作者或地点";
  const user = C.currentUser();
  document.querySelector("#appName").textContent = "校园图书分享";
  document.querySelector("#appSubtitle").textContent = "图书借阅与共享";
  document.querySelector("[data-label='home']").textContent = "首页";
  document.querySelector("[data-label='list']").textContent = "全部图书";
  document.querySelector("[data-label='publish']").textContent = "发布图书";
  document.querySelector("[data-label='workspace']").textContent = "我的记录";
  document.querySelector("#homeEyebrow").textContent = "校园图书循环";
  document.querySelector("#homeTitle").textContent = "让闲置教材继续被阅读";
  document.querySelector("#homeDescription").textContent = "发布、查找和申请借阅校内图书。";
  document.querySelector("#homeNotice").innerHTML = `<strong>借阅说明</strong><p>借阅申请提交后，由图书发布者联系确认。</p><button class="primary-button" type="button" data-route="publish">发布图书</button>`;
  document.querySelector("#latestTitle").textContent = "最新图书";
  document.querySelector("#latestDescription").textContent = "最近发布的教材和复习资料";
  document.querySelector("#listTitle").textContent = "全部图书";
  document.querySelector("#publishTitle").textContent = "发布图书";
  document.querySelector("#publishDescription").textContent = "填写图书信息后提交管理员审核。";
  document.querySelector("#workspaceTitle").textContent = "我的记录";
  document.querySelector("#workspaceDescription").textContent = "查看发布图书和借阅申请。";
  if (route === "home") renderHome();
  if (route === "list") renderList();
  if (route === "publish") renderPublish();
  if (route === "workspace") renderWorkspace();
  if (route === "admin") renderAdmin();
  if (route === "profile") renderProfile();
}

function openDetail(id) {
  const book = C.getItems().find((item) => item.id === id);
  if (!book) return;
  document.querySelector("#detailContent").innerHTML = `
    <h2>${C.escapeHtml(book.title)}</h2>
    <img src="${book.image}" alt="" style="width:100%;aspect-ratio:16/10;object-fit:cover;border-radius:8px" />
    <p class="category-label">${C.escapeHtml(book.category)} · ${C.escapeHtml(book.shareType)}</p>
    <p>${C.escapeHtml(book.description)}</p>
    <div class="record-info">
      <p>作者：${C.escapeHtml(book.author)}</p>
      <p>成色：${C.escapeHtml(book.condition)}</p>
      <p>地点：${C.escapeHtml(book.location)}</p>
      <p>联系方式：${C.escapeHtml(book.contact)}</p>
      <p>状态：${C.escapeHtml(book.borrowStatus)}</p>
    </div>
    <div class="form-actions">
      <button type="button" class="secondary-button" data-action="favorite" data-id="${book.id}">收藏/取消收藏</button>
      ${book.borrowStatus === "可借" ? `<button type="button" class="primary-button" data-action="borrow" data-id="${book.id}">申请借阅</button>` : ""}
    </div>
  `;
  document.querySelector("#detailDialog").showModal();
  C.updateIcons();
}

function handleAction(button) {
  const { action, id } = button.dataset;
  if (action === "detail") return openDetail(id);
  if (action === "favorite") return toggleFavorite(id);
  if (action === "borrow") return borrowBook(id);
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

function borrowBook(id) {
  if (!C.requireLogin()) return;
  const user = C.currentUser();
  const book = C.getItems().find((item) => item.id === id);
  if (!book || book.borrowStatus !== "可借") return C.toast("当前图书不能借阅");
  const requests = C.getRequests();
  if (requests.some((item) => item.itemId === id && item.userId === user.id && item.status === "待处理")) return C.toast("已经提交过申请");
  requests.push({ id: C.uid("r"), itemId: id, bookTitle: book.title, userId: user.id, userName: user.name, status: "待处理", createdAt: new Date().toISOString() });
  C.write(C.keys.requests, requests);
  book.borrowStatus = "申请中";
  C.write(C.keys.items, C.getItems().map((item) => item.id === id ? book : item));
  C.toast("借阅申请已提交");
  document.querySelector("#detailDialog")?.close();
  render(C.state.route);
}

function updateAudit(id, action) {
  const items = C.getItems();
  const item = items.find((book) => book.id === id);
  if (!item) return;
  if (action === "approve") item.auditStatus = "已通过";
  if (action === "reject" || action === "down") item.auditStatus = "已下架";
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
  const item = {
    id: C.uid("b"),
    title: form.get("title").trim(),
    author: form.get("author").trim(),
    category: form.get("category"),
    shareType: form.get("shareType"),
    condition: form.get("condition"),
    location: form.get("location").trim(),
    contact: form.get("contact").trim(),
    description: form.get("description").trim(),
    image: "assets/site.svg",
    ownerId: user.id,
    ownerName: user.name,
    auditStatus: "待审核",
    borrowStatus: "可借",
    createdAt: new Date().toISOString(),
  };
  C.write(C.keys.items, [...C.getItems(), item]);
  event.currentTarget.reset();
  C.toast("图书已提交审核");
  C.navigate("workspace");
});

document.querySelector("#resetFormButton").addEventListener("click", () => document.querySelector("#itemForm").reset());

C.init({ ...config, seed, render });
