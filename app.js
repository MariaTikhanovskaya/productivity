const todayLabel = document.querySelector("#today-label");
const taskCount = document.querySelector("#task-count");
const taskGroups = document.querySelector("#task-groups");
const doneSection = document.querySelector("#done-section");
const doneList = document.querySelector("#done-list");
const doneCount = document.querySelector("#done-count");
const toggleDoneButton = document.querySelector("#toggle-done-button");
const taskForm = document.querySelector("#task-form");
const taskInput = document.querySelector("#task-input");
const taskCategoryPreview = document.querySelector("#task-category-preview");
const authForm = document.querySelector("#auth-form");
const emailInput = document.querySelector("#email-input");
const authStatus = document.querySelector("#auth-status");
const signInButton = document.querySelector("#sign-in-button");
const heroSignOutButton = document.querySelector("#hero-sign-out-button");
const authSection = document.querySelector(".auth");
const composerSection = document.querySelector(".composer");
const listSection = document.querySelector(".list");
const groupTemplate = document.querySelector("#group-template");
const taskTemplate = document.querySelector("#task-template");
const supabaseUrl = window.APP_CONFIG?.supabaseUrl?.trim();
const supabaseAnonKey = window.APP_CONFIG?.supabaseAnonKey?.trim();
const supabaseClient = supabaseUrl && supabaseAnonKey
  ? window.supabase.createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: "daily-todo-organizer-auth"
    }
  })
  : null;

let tasks = [];
let currentUser = null;
let supportsCategoryColumn = true;
let showingDoneTasks = false;

renderToday();
initializeApp();

taskForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const text = taskInput.value.trim();
  if (!text) {
    return;
  }

  createTask(text);
});

taskInput.addEventListener("input", () => {
  const text = taskInput.value.trim();
  if (!text) {
    taskCategoryPreview.textContent = "New tasks will be labeled as work or personal automatically.";
    return;
  }

  const category = inferCategory(text);
  taskCategoryPreview.textContent = `This looks like a ${category} task.`;
});

toggleDoneButton.addEventListener("click", () => {
  showingDoneTasks = !showingDoneTasks;
  renderTasks();
});

function renderToday() {
  todayLabel.textContent = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  }).format(new Date());
}

function renderTasks() {
  const openTasks = tasks
    .filter((task) => !task.completedOn)
    .sort(compareTasks);
  const completedTasks = tasks
    .filter((task) => task.completedOn)
    .sort((a, b) => (b.completedOn || "").localeCompare(a.completedOn || "") || a.text.localeCompare(b.text));

  taskGroups.innerHTML = "";
  doneList.innerHTML = "";
  taskCount.textContent = `${openTasks.length} open ${openTasks.length === 1 ? "task" : "tasks"}`;
  doneCount.textContent = `${completedTasks.length} done ${completedTasks.length === 1 ? "task" : "tasks"}`;
  toggleDoneButton.textContent = showingDoneTasks ? "Hide done tasks" : "Done tasks";
  doneSection.classList.toggle("hidden", !showingDoneTasks);

  if (openTasks.length === 0) {
    const emptyState = document.createElement("p");
    emptyState.className = "empty-state";
    emptyState.textContent = "Nothing is waiting for today.";
    taskGroups.append(emptyState);
  }

  const groupedTasks = groupBy(openTasks, (task) => task.createdOn);

  Object.entries(groupedTasks).forEach(([createdOn, group]) => {
    const groupNode = groupTemplate.content.firstElementChild.cloneNode(true);
    const title = groupNode.querySelector(".group-title");
    const meta = groupNode.querySelector(".group-meta");
    const workList = groupNode.querySelector('[data-category="work"] .task-list');
    const personalList = groupNode.querySelector('[data-category="personal"] .task-list');
    const workColumn = groupNode.querySelector('[data-category="work"]');
    const personalColumn = groupNode.querySelector('[data-category="personal"]');
    const isToday = createdOn === formatDateKey(new Date());

    title.textContent = isToday ? "Created today" : `Started ${formatReadableDate(createdOn)}`;
    meta.textContent = `${group.length} ${group.length === 1 ? "task" : "tasks"}`;

    group.forEach((task) => {
      const category = task.category || inferCategory(task.text);
      const taskNode = buildTaskNode(task, category);

      if (category === "work") {
        workList.append(taskNode);
      } else {
        personalList.append(taskNode);
      }
    });

    workColumn.classList.toggle("hidden", workList.children.length === 0);
    personalColumn.classList.toggle("hidden", personalList.children.length === 0);

    taskGroups.append(groupNode);
  });

  if (completedTasks.length === 0) {
    const emptyDoneState = document.createElement("p");
    emptyDoneState.className = "empty-state";
    emptyDoneState.textContent = "No tasks have been completed yet.";
    doneList.append(emptyDoneState);
  } else {
    completedTasks.forEach((task) => {
      const category = task.category || inferCategory(task.text);
      doneList.append(buildTaskNode(task, category, true));
    });
  }

  clearError();
}

function buildTaskNode(task, category, isComplete = false) {
  const taskNode = taskTemplate.content.firstElementChild.cloneNode(true);
  const checkbox = taskNode.querySelector(".task-checkbox");
  const text = taskNode.querySelector(".task-text");
  const badge = taskNode.querySelector(".task-category-badge");
  const deleteButton = taskNode.querySelector(".delete-button");

  checkbox.checked = isComplete;
  checkbox.addEventListener("change", () => toggleTaskCompletion(task.id, !isComplete));
  text.textContent = task.text;
  badge.textContent = category;
  badge.dataset.category = category;
  deleteButton.addEventListener("click", () => deleteTask(task.id));
  taskNode.classList.toggle("is-complete", isComplete);

  return taskNode;
}

function groupBy(items, getKey) {
  return items.reduce((groups, item) => {
    const key = getKey(item);
    groups[key] ??= [];
    groups[key].push(item);
    return groups;
  }, {});
}

function compareTasks(a, b) {
  const byDate = a.createdOn.localeCompare(b.createdOn);
  if (byDate !== 0) {
    return byDate;
  }

  const byCategory = categoryRank(a.category || inferCategory(a.text)) - categoryRank(b.category || inferCategory(b.text));
  if (byCategory !== 0) {
    return byCategory;
  }

  return a.text.localeCompare(b.text);
}

function categoryRank(category) {
  return category === "work" ? 0 : 1;
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatReadableDate(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  }).format(new Date(year, month - 1, day));
}

function renderError(message) {
  taskCount.textContent = message;
}

function clearError() {
  if (taskCount.textContent?.startsWith("Could not")) {
    const openTasks = tasks.filter((task) => !task.completedOn);
    taskCount.textContent = `${openTasks.length} open ${openTasks.length === 1 ? "task" : "tasks"}`;
  }
}

async function initializeApp() {
  bindAuthEvents();
  renderAuthCheckingState();

  if (!supabaseClient) {
    renderConfigurationError();
    return;
  }

  const {
    data: { session }
  } = await supabaseClient.auth.getSession();

  currentUser = session?.user ?? null;
  updateAuthUi();

  if (currentUser) {
    await loadTasks();
  } else {
    renderSignedOutState();
    renderTasks();
  }

  supabaseClient.auth.onAuthStateChange(async (_event, session) => {
    currentUser = session?.user ?? null;
    updateAuthUi();

    if (currentUser) {
      await loadTasks();
      return;
    }

    renderSignedOutState();
    tasks = [];
    renderTasks();
  });
}

function bindAuthEvents() {
  authForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!supabaseClient) {
      renderConfigurationError();
      return;
    }

    const email = emailInput.value.trim();
    if (!email) {
      return;
    }

    setAuthPending(true);

    const { error } = await supabaseClient.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: buildRedirectUrl()
      }
    });

    setAuthPending(false);

    if (error) {
      authStatus.textContent = error.message;
      return;
    }

    authStatus.textContent = `Magic link sent to ${email}. Open it on any device where you want access.`;
  });

  heroSignOutButton.addEventListener("click", async () => {
    if (!supabaseClient) {
      return;
    }

    await supabaseClient.auth.signOut();
  });
}

async function loadTasks() {
  if (!supabaseClient || !currentUser) {
    return;
  }

  taskCount.textContent = "Loading tasks...";

  let query = supabaseClient
    .from("tasks")
    .select("id, text, category, created_on, completed_on, inserted_at")
    .order("created_on", { ascending: true })
    .order("category", { ascending: true })
    .order("inserted_at", { ascending: true });

  let { data, error } = await query;

  if (isMissingCategoryColumn(error)) {
    supportsCategoryColumn = false;
    ({ data, error } = await supabaseClient
      .from("tasks")
      .select("id, text, created_on, completed_on, inserted_at")
      .order("created_on", { ascending: true })
      .order("inserted_at", { ascending: true }));
  }

  if (error) {
    tasks = [];
    taskGroups.innerHTML = "";
    renderError("Could not load tasks from Supabase.");
    return;
  }

  tasks = data.map((task) => ({
    id: task.id,
    text: task.text,
    category: task.category || inferCategory(task.text),
    createdOn: task.created_on,
    completedOn: task.completed_on
  }));
  renderTasks();
}

async function createTask(text) {
  if (!supabaseClient || !currentUser) {
    authStatus.textContent = "Sign in before adding tasks.";
    return;
  }

  const category = inferCategory(text);
  let payload = {
    user_id: currentUser.id,
    text,
    category,
    created_on: formatDateKey(new Date())
  };
  let selectColumns = "id, text, category, created_on, completed_on";
  let { data, error } = await supabaseClient
    .from("tasks")
    .insert(payload)
    .select(selectColumns)
    .single();

  if (isMissingCategoryColumn(error)) {
    supportsCategoryColumn = false;
    payload = {
      user_id: currentUser.id,
      text,
      created_on: formatDateKey(new Date())
    };
    selectColumns = "id, text, created_on, completed_on";
    ({ data, error } = await supabaseClient
      .from("tasks")
      .insert(payload)
      .select(selectColumns)
      .single());
  }

  if (error) {
    renderError("Could not save the new task.");
    return;
  }

  tasks.unshift({
    id: data.id,
    text: data.text,
    category: data.category,
    createdOn: data.created_on,
    completedOn: data.completed_on
  });
  renderTasks();
  taskForm.reset();
  taskInput.focus();
}

async function toggleTaskCompletion(taskId, shouldComplete) {
  if (!supabaseClient || !currentUser) {
    return;
  }

  const completedOn = shouldComplete ? formatDateKey(new Date()) : null;
  const { error } = await supabaseClient
    .from("tasks")
    .update({ completed_on: completedOn })
    .eq("id", taskId)
    .eq("user_id", currentUser.id);

  if (error) {
    renderError(`Could not mark that task as ${shouldComplete ? "complete" : "open"}.`);
    return;
  }

  tasks = tasks.map((task) => task.id === taskId ? { ...task, completedOn } : task);
  renderTasks();
}

async function deleteTask(taskId) {
  if (!supabaseClient || !currentUser) {
    return;
  }

  const { error } = await supabaseClient
    .from("tasks")
    .delete()
    .eq("id", taskId)
    .eq("user_id", currentUser.id);

  if (error) {
    renderError("Could not delete that task.");
    return;
  }

  tasks = tasks.filter((task) => task.id !== taskId);
  renderTasks();
}

function updateAuthUi() {
  const signedIn = Boolean(currentUser);

  composerSection.classList.toggle("disabled-section", !signedIn);
  listSection.classList.toggle("disabled-section", !signedIn);
  taskInput.disabled = !signedIn;
  heroSignOutButton.classList.toggle("hidden", !signedIn);
  authForm.classList.toggle("hidden", signedIn);
  authSection.classList.toggle("hidden", signedIn);

  if (signedIn) {
    return;
  }

  renderSignedOutState();
}

function renderAuthCheckingState() {
  authStatus.textContent = "Checking sign-in state...";
  composerSection.classList.add("disabled-section");
  listSection.classList.add("disabled-section");
  taskInput.disabled = true;
  heroSignOutButton.classList.add("hidden");
  authSection.classList.remove("hidden");
  authForm.classList.add("hidden");
}

function renderSignedOutState() {
  authStatus.textContent = "Sign in with a magic link to sync your tasks across devices.";
  composerSection.classList.add("disabled-section");
  listSection.classList.add("disabled-section");
  taskInput.disabled = true;
  heroSignOutButton.classList.add("hidden");
  authForm.classList.remove("hidden");
  authSection.classList.remove("hidden");
}

function renderConfigurationError() {
  authStatus.textContent = "Add your Supabase URL and anon key in config.js before using the app.";
  signInButton.disabled = true;
  composerSection.classList.add("disabled-section");
  listSection.classList.add("disabled-section");
  taskGroups.innerHTML = "";
  taskCount.textContent = "Supabase is not configured yet.";
}

function setAuthPending(isPending) {
  signInButton.disabled = isPending;
  signInButton.textContent = isPending ? "Sending..." : "Email me a link";
}

function buildRedirectUrl() {
  const url = new URL(window.location.href);
  url.hash = "";
  url.search = "";
  return url.toString();
}

function inferCategory(text) {
  const normalized = text.toLowerCase();
  const workKeywords = [
    "meeting", "email", "client", "project", "deck", "slide", "invoice", "budget", "team",
    "manager", "work", "office", "presentation", "report", "deadline", "follow up", "follow-up",
    "review", "jira", "ticket", "deploy", "code", "pr ", "pull request", "roadmap", "vendor"
  ];
  const personalKeywords = [
    "doctor", "dentist", "gym", "groceries", "grocery", "mom", "dad", "family", "kids", "school",
    "laundry", "dinner", "cook", "clean", "birthday", "friend", "bank", "rent", "pharmacy",
    "walk", "pet", "dog", "cat", "home", "apartment", "shopping", "call mom", "call dad"
  ];

  const workScore = scoreKeywords(normalized, workKeywords);
  const personalScore = scoreKeywords(normalized, personalKeywords);

  if (workScore === personalScore) {
    return workScore > 0 ? "work" : "personal";
  }

  return workScore > personalScore ? "work" : "personal";
}

function scoreKeywords(text, keywords) {
  return keywords.reduce((score, keyword) => score + (text.includes(keyword) ? 1 : 0), 0);
}

function isMissingCategoryColumn(error) {
  return Boolean(
    error && (
      error.code === "42703" ||
      error.message?.toLowerCase().includes("category")
    )
  );
}
