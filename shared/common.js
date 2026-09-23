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
