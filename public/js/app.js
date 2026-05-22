/* ─── State ─── */
const state = {
  user: null,
  projects: [],
  currentProject: null,
  currentTask: null,
};

/* ─── Utils ─── */
function $(id) { return document.getElementById(id); }
function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}
function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('uk-UA', { day: '2-digit', month: 'short', year: 'numeric' });
}
function isOverdue(d) {
  if (!d) return false;
  return new Date(d) < new Date();
}
function avatar(name) { return (name || '?')[0].toUpperCase(); }

function showToast(msg, type = 'success') {
  const t = $('toast');
  t.textContent = msg;
  t.className = `toast ${type}`;
  t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), 3000);
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
}

function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  $('view-' + id).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navItem = document.querySelector(`[data-view="${id}"]`);
  if (navItem) navItem.classList.add('active');
}

/* ─── Modal ─── */
function openModal(title, bodyHTML) {
  $('modal-title').textContent = title;
  $('modal-body').innerHTML = bodyHTML;
  $('modal-overlay').classList.remove('hidden');
}
function closeModal() { $('modal-overlay').classList.add('hidden'); }
$('modal-close').onclick = closeModal;
$('modal-overlay').onclick = e => { if (e.target === $('modal-overlay')) closeModal(); };

/* ─── Auth ─── */
document.querySelectorAll('.auth-tab').forEach(tab => {
  tab.onclick = () => {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    tab.classList.add('active');
    $('form-' + tab.dataset.tab).classList.add('active');
  };
});

$('form-login').onsubmit = async e => {
  e.preventDefault();
  const err = $('login-error');
  err.classList.add('hidden');
  try {
    const data = await api.login($('login-email').value, $('login-password').value);
    api.setToken(data.accessToken);
    state.user = data.user;
    await initApp();
  } catch (ex) {
    err.textContent = ex.message;
    err.classList.remove('hidden');
  }
};

$('form-register').onsubmit = async e => {
  e.preventDefault();
  const err = $('reg-error');
  err.classList.add('hidden');
  try {
    const data = await api.register($('reg-email').value, $('reg-password').value, $('reg-name').value);
    api.setToken(data.accessToken);
    state.user = data.user;
    await initApp();
  } catch (ex) {
    err.textContent = ex.message;
    err.classList.remove('hidden');
  }
};

$('btn-logout').onclick = () => {
  api.setToken(null);
  state.user = null;
  state.projects = [];
  showScreen('screen-auth');
};

/* ─── Init ─── */
async function initApp() {
  showScreen('screen-app');
  $('user-name').textContent = state.user.name;
  $('user-email').textContent = state.user.email;
  $('user-avatar').textContent = avatar(state.user.name);
  await loadProjects();
  showDashboard();
}

/* ─── Projects ─── */
function toArray(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.items)) return data.items;
  if (data && Array.isArray(data.projects)) return data.projects;
  if (data && Array.isArray(data.tasks)) return data.tasks;
  if (data && Array.isArray(data.comments)) return data.comments;
  if (data && Array.isArray(data.data)) return data.data;
  return [];
}

async function loadProjects() {
  try {
    const data = await api.getProjects();
    state.projects = toArray(data);
    renderSidebarProjects();
  } catch {
    state.projects = [];
  }
}

function renderSidebarProjects() {
  const list = $('sidebar-project-list');
  list.innerHTML = '';
  state.projects.slice(0, 8).forEach(p => {
    const item = el('div', 'sidebar-project-item');
    item.innerHTML = `<span class="sidebar-project-dot"></span>${p.name}`;
    item.onclick = () => openProject(p.id);
    list.appendChild(item);
  });
}

/* ─── Dashboard ─── */
async function showDashboard() {
  showView('dashboard');
  await loadProjects();

  $('stat-projects').textContent = state.projects.length;

  let totalActive = 0, totalDone = 0, totalOverdue = 0;
  for (const p of state.projects.slice(0, 5)) {
    try {
      const stats = await api.getProjectStats(p.id);
      totalActive += (stats.IN_PROGRESS || 0) + (stats.TODO || 0) + (stats.IN_REVIEW || 0);
      totalDone += stats.DONE || 0;
    } catch {}
  }
  // Count overdue from all tasks
  for (const p of state.projects.slice(0, 5)) {
    try {
      const data = await api.getTasks(p.id, { pageSize: 100 });
      const tasks = toArray(data.tasks !== undefined ? data.tasks : data);
      tasks.forEach(t => { if (isOverdue(t.dueDate) && t.status !== 'DONE') totalOverdue++; });
    } catch {}
  }
  $('stat-tasks-active').textContent = totalActive;
  $('stat-tasks-done').textContent = totalDone;
  $('stat-tasks-overdue').textContent = totalOverdue;

  const grid = $('dashboard-projects');
  grid.innerHTML = '';
  if (!state.projects.length) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-state-icon">◎</div><div class="empty-state-text">Немає проєктів. Створіть перший!</div></div>`;
    return;
  }
  state.projects.slice(0, 6).forEach(p => grid.appendChild(projectCard(p)));
}

function projectCard(p) {
  const card = el('div', 'project-card');
  card.innerHTML = `
    <div class="project-card-name">${p.name}</div>
    <div class="project-card-desc">${p.description || 'Без опису'}</div>
    <div class="project-card-footer">
      <span class="project-card-date">${formatDate(p.createdAt)}</span>
      <span class="project-card-badge">${p._count?.tasks ?? '0'} задач</span>
    </div>`;
  card.onclick = () => openProject(p.id);
  return card;
}

/* ─── Projects View ─── */
async function showProjects() {
  showView('projects');
  await loadProjects();
  const list = $('projects-list');
  list.innerHTML = '';
  if (!state.projects.length) {
    list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">◉</div><div class="empty-state-text">Немає проєктів</div></div>`;
    return;
  }
  state.projects.forEach(p => list.appendChild(projectCard(p)));
}

function modalNewProject() {
  openModal('Новий проєкт', `
    <div class="field"><label>Назва</label><input id="m-proj-name" placeholder="Назва проєкту" /></div>
    <div class="field"><label>Опис</label><textarea id="m-proj-desc" placeholder="Опис (необов'язково)"></textarea></div>
    <div class="modal-actions">
      <button class="btn-secondary" id="m-proj-cancel">Скасувати</button>
      <button class="btn-primary" id="m-proj-submit">Створити</button>
    </div>`);
  $('m-proj-cancel').onclick = closeModal;
  $('m-proj-submit').onclick = async () => {
    const name = $('m-proj-name').value.trim();
    if (!name) return;
    try {
      await api.createProject({ name, description: $('m-proj-desc').value.trim() || undefined });
      closeModal();
      showToast('Проєкт створено');
      await loadProjects();
      showProjects();
    } catch (ex) { showToast(ex.message, 'error'); }
  };
}

$('btn-new-project').onclick = modalNewProject;
$('btn-new-project-sidebar').onclick = modalNewProject;

/* ─── Project Detail ─── */
async function openProject(id) {
  showView('project-detail');
  try {
    const p = await api.getProject(id);
    state.currentProject = p;
    $('project-detail-title').textContent = p.name;
    $('project-detail-meta').innerHTML = `
      <div class="meta-chip">📁 ${p.name}</div>
      ${p.description ? `<div class="meta-chip">📝 ${p.description}</div>` : ''}
      <div class="meta-chip">📅 ${formatDate(p.createdAt)}</div>`;

    await loadTasks(id);
    highlightSidebarProject(id);
  } catch (ex) { showToast(ex.message, 'error'); }
}

function highlightSidebarProject(id) {
  document.querySelectorAll('.sidebar-project-item').forEach((item, i) => {
    item.classList.toggle('active', state.projects[i]?.id === id);
  });
}

async function loadTasks(projectId) {
  ['TODO','IN_PROGRESS','IN_REVIEW','DONE'].forEach(s => {
    $('col-' + s).innerHTML = '';
    $('count-' + s).textContent = '0';
  });
  try {
    const data = await api.getTasks(projectId, { pageSize: 100 });
    const tasks = toArray(data.tasks !== undefined ? data.tasks : data);
    const counts = { TODO: 0, IN_PROGRESS: 0, IN_REVIEW: 0, DONE: 0 };
    tasks.forEach(t => {
      const col = $('col-' + t.status);
      if (col) { col.appendChild(taskCard(t)); counts[t.status] = (counts[t.status] || 0) + 1; }
    });
    Object.entries(counts).forEach(([s, c]) => {
      const el = $('count-' + s);
      if (el) el.textContent = c;
    });
    if (!tasks.length) {
      $('col-TODO').innerHTML = `<div class="empty-state" style="padding:24px 8px"><div class="empty-state-icon" style="font-size:24px">◎</div><div class="empty-state-text">Немає задач</div></div>`;
    }
    // Setup drag & drop after tasks are loaded
    setupDragDrop();
  } catch (ex) { showToast(ex.message, 'error'); }
}

function taskCard(t) {
  const card = el('div', 'task-card');
  const overdue = isOverdue(t.dueDate) && t.status !== 'DONE';
  card.setAttribute('draggable', 'true');
  card.dataset.taskId = t.id;
  card.innerHTML = `
    <div class="task-card-title">${t.title}</div>
    <div class="task-card-meta">
      <span class="priority-badge priority-${t.priority}">${priorityLabel(t.priority)}</span>
      ${t.dueDate ? `<span class="due-date ${overdue ? 'overdue' : ''}">${overdue ? '⚠ ' : '📅 '}${formatDate(t.dueDate)}</span>` : '<span class="due-date no-date">Без дедлайну</span>'}
    </div>
    ${t.assignee ? `<div class="task-card-assignee"><span class="assignee-avatar">${avatar(t.assignee.name)}</span>${t.assignee.name}</div>` : ''}`;
  card.onclick = () => openTask(t.id);
  return card;
}

function priorityLabel(p) {
  return { LOW: 'Низький', MEDIUM: 'Середній', HIGH: 'Високий', URGENT: 'Терміновий' }[p] || p;
}

$('btn-back-projects').onclick = showProjects;

$('btn-delete-project').onclick = async () => {
  if (!state.currentProject) return;
  if (!confirm(`Видалити проєкт "${state.currentProject.name}"? Всі задачі будуть видалені.`)) return;
  try {
    await api.deleteProject(state.currentProject.id);
    showToast('Проєкт видалено');
    state.currentProject = null;
    await loadProjects();
    showProjects();
  } catch (ex) { showToast(ex.message, 'error'); }
};

/* ─── Load members helper ─── */
/* ─── Assignee nickname search ─── */
function buildAssigneeField(fieldId = 'assignee-input', currentName = '') {
  return `
    <div class="assignee-search-wrap">
      <input id="${fieldId}" placeholder="Введіть нікнейм (ім'я)..." value="${currentName}" autocomplete="off" />
      <div class="assignee-hints" id="${fieldId}-hints"></div>
      <div class="assignee-selected" id="${fieldId}-result"></div>
    </div>`;
}

function setupAssigneeSearch(inputId, onSelect) {
  const input = $(inputId);
  const hints = $(`${inputId}-hints`);
  const result = $(`${inputId}-result`);
  let selectedId = null;
  let debounceTimer = null;

  input.oninput = () => {
    selectedId = null;
    result.innerHTML = '';
    clearTimeout(debounceTimer);
    const q = input.value.trim();
    if (!q) { hints.innerHTML = ''; return; }
    debounceTimer = setTimeout(async () => {
      try {
        const data = await api.searchUsers(q);
        const users = data.users || [];
        if (!users.length) {
          hints.innerHTML = `<div class="hint-item hint-empty">Користувача не знайдено</div>`;
          return;
        }
        hints.innerHTML = users.map(u =>
          `<div class="hint-item" data-id="${u.id}" data-name="${u.name}">${u.name}</div>`
        ).join('');
        hints.querySelectorAll('.hint-item[data-id]').forEach(item => {
          item.onclick = () => {
            selectedId = item.dataset.id;
            input.value = item.dataset.name;
            hints.innerHTML = '';
            result.innerHTML = `<span class="assignee-chip">✓ ${item.dataset.name}</span>`;
            if (onSelect) onSelect(selectedId);
          };
        });
      } catch {}
    }, 300);
  };

  // Return getter for selected id
  return () => selectedId;
}

$('btn-new-task').onclick = async () => {
  if (!state.currentProject) return;
  openModal('Нова задача', `
    <div class="field"><label>Назва</label><input id="m-task-title" placeholder="Назва задачі" /></div>
    <div class="field"><label>Опис</label><textarea id="m-task-desc" placeholder="Опис (необов'язково)"></textarea></div>
    <div class="field"><label>Пріоритет</label>
      <select id="m-task-priority">
        <option value="LOW">Низький</option>
        <option value="MEDIUM" selected>Середній</option>
        <option value="HIGH">Високий</option>
        <option value="URGENT">Терміновий</option>
      </select>
    </div>
    <div class="field"><label>Виконавець</label>${buildAssigneeField('m-task-assignee-input')}</div>
    <div class="field"><label>Дедлайн</label><input type="date" id="m-task-due" /></div>
    <div class="modal-actions">
      <button class="btn-secondary" id="m-task-cancel">Скасувати</button>
      <button class="btn-primary" id="m-task-submit">Створити</button>
    </div>`);
  $('m-task-cancel').onclick = closeModal;
  const getAssigneeId = setupAssigneeSearch('m-task-assignee-input');
  $('m-task-submit').onclick = async () => {
    const title = $('m-task-title').value.trim();
    if (!title) return;
    const inputVal = $('m-task-assignee-input').value.trim();
    let assigneeId = getAssigneeId();
    // Якщо вписано але не вибрано зі списку — спробуємо знайти точний збіг
    if (inputVal && !assigneeId) {
      try {
        const data = await api.searchUsers(inputVal);
        const exact = (data.users || []).find(u => u.name.toLowerCase() === inputVal.toLowerCase());
        if (!exact) { showToast('Користувача з таким ніком не знайдено', 'error'); return; }
        assigneeId = exact.id;
      } catch { showToast('Помилка пошуку користувача', 'error'); return; }
    }
    try {
      await api.createTask(state.currentProject.id, {
        title,
        description: $('m-task-desc').value.trim() || undefined,
        priority: $('m-task-priority').value,
        assigneeId: assigneeId || undefined,
        dueDate: $('m-task-due').value || undefined,
      });
      closeModal();
      showToast('Задачу створено');
      await loadTasks(state.currentProject.id);
    } catch (ex) { showToast(ex.message, 'error'); }
  };
};

/* ─── Drag & Drop ─── */
function setupDragDrop() {
  let draggedId = null;

  document.querySelectorAll('.task-card').forEach(card => {
    card.addEventListener('dragstart', e => {
      draggedId = card.dataset.taskId;
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      document.querySelectorAll('.kanban-cards').forEach(col => col.classList.remove('drag-over'));
    });
  });

  document.querySelectorAll('.kanban-cards').forEach(col => {
    col.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      document.querySelectorAll('.kanban-cards').forEach(c => c.classList.remove('drag-over'));
      col.classList.add('drag-over');
    });
    col.addEventListener('dragleave', () => col.classList.remove('drag-over'));
    col.addEventListener('drop', async e => {
      e.preventDefault();
      col.classList.remove('drag-over');
      const newStatus = col.closest('.kanban-col').dataset.status;
      if (!draggedId || !newStatus) return;
      try {
        await api.updateTask(draggedId, { status: newStatus });
        showToast('Статус оновлено');
        await loadTasks(state.currentProject.id);
      } catch (ex) { showToast(ex.message, 'error'); }
    });
  });
}

/* ─── Task Detail ─── */
async function openTask(id) {
  showView('task-detail');
  try {
    const t = await api.getTask(id);
    state.currentTask = t;
    renderTaskDetail(t);
    await loadComments(id);
  } catch (ex) { showToast(ex.message, 'error'); }
}

function renderTaskDetail(t) {
  const overdue = isOverdue(t.dueDate) && t.status !== 'DONE';

  $('task-detail-title').textContent = t.title;
  $('task-detail-desc').textContent = t.description || 'Без опису';

  $('task-status-row').innerHTML = `
    <span class="status-badge status-${t.status}">${statusLabel(t.status)}</span>
    <span class="priority-badge priority-${t.priority}">${priorityLabel(t.priority)}</span>`;

  $('task-detail-meta').innerHTML = `
    <div class="meta-item"><div class="meta-item-label">Дедлайн</div><div class="meta-item-value ${overdue ? 'overdue-text' : ''}">${overdue ? '⚠ ' : ''}${formatDate(t.dueDate)}</div></div>
    <div class="meta-item"><div class="meta-item-label">Статус</div><div class="meta-item-value">${statusLabel(t.status)}</div></div>
    <div class="meta-item"><div class="meta-item-label">Виконавець</div><div class="meta-item-value">${t.assignee?.name || '—'}</div></div>
    <div class="meta-item"><div class="meta-item-label">Автор</div><div class="meta-item-value">${t.createdBy?.name || t.creator?.name || '—'}</div></div>`;

  // Status change buttons
  const statuses = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'];
  const statusBtns = el('div', 'status-change-row');
  statusBtns.innerHTML = '<div class="status-change-label">Змінити статус:</div>';
  statuses.forEach(s => {
    const btn = el('button', `status-btn status-btn-${s}${t.status === s ? ' active' : ''}`);
    btn.textContent = statusLabel(s);
    btn.onclick = async () => {
      if (t.status === s) return;
      try {
        const updated = await api.updateTask(t.id, { status: s });
        state.currentTask = { ...t, ...updated };
        renderTaskDetail(state.currentTask);
        showToast('Статус оновлено');
      } catch (ex) { showToast(ex.message, 'error'); }
    };
    statusBtns.appendChild(btn);
  });

  // Insert status buttons after task-status-row
  const existingStatusBtns = document.querySelector('.status-change-row');
  if (existingStatusBtns) existingStatusBtns.remove();
  $('task-status-row').after(statusBtns);
}

function statusLabel(s) {
  return { TODO: 'Todo', IN_PROGRESS: 'В процесі', IN_REVIEW: 'На перевірці', DONE: 'Готово' }[s] || s;
}

$('btn-back-project').onclick = () => {
  if (state.currentProject) openProject(state.currentProject.id);
  else showProjects();
};

$('btn-delete-task').onclick = async () => {
  if (!state.currentTask) return;
  if (!confirm('Видалити задачу?')) return;
  try {
    await api.deleteTask(state.currentTask.id);
    showToast('Задачу видалено');
    if (state.currentProject) await openProject(state.currentProject.id);
    else showProjects();
  } catch (ex) { showToast(ex.message, 'error'); }
};

// Edit task button — added dynamically next to delete
function addEditButton() {
  if ($('btn-edit-task')) return;
  const editBtn = el('button', 'btn-secondary');
  editBtn.id = 'btn-edit-task';
  editBtn.textContent = '✏ Редагувати';
  editBtn.onclick = () => modalEditTask();
  $('btn-delete-task').before(editBtn);
}

async function modalEditTask() {
  const t = state.currentTask;
  if (!t) return;
  const dueVal = t.dueDate ? new Date(t.dueDate).toISOString().split('T')[0] : '';
  const currentAssigneeName = t.assignee?.name || '';
  openModal('Редагувати задачу', `
    <div class="field"><label>Назва</label><input id="m-edit-title" value="${t.title.replace(/"/g, '&quot;')}" /></div>
    <div class="field"><label>Опис</label><textarea id="m-edit-desc">${t.description || ''}</textarea></div>
    <div class="field"><label>Пріоритет</label>
      <select id="m-edit-priority">
        <option value="LOW"${t.priority==='LOW'?' selected':''}>Низький</option>
        <option value="MEDIUM"${t.priority==='MEDIUM'?' selected':''}>Середній</option>
        <option value="HIGH"${t.priority==='HIGH'?' selected':''}>Високий</option>
        <option value="URGENT"${t.priority==='URGENT'?' selected':''}>Терміновий</option>
      </select>
    </div>
    <div class="field"><label>Виконавець</label>${buildAssigneeField('m-edit-assignee-input', currentAssigneeName)}</div>
    <div class="field"><label>Дедлайн</label><input type="date" id="m-edit-due" value="${dueVal}" /></div>
    <div class="modal-actions">
      <button class="btn-secondary" id="m-edit-cancel">Скасувати</button>
      <button class="btn-primary" id="m-edit-submit">Зберегти</button>
    </div>`);
  // Show current assignee chip if set
  if (currentAssigneeName) {
    $('m-edit-assignee-input-result').innerHTML = `<span class="assignee-chip">✓ ${currentAssigneeName}</span>`;
  }
  $('m-edit-cancel').onclick = closeModal;
  let currentAssigneeId = t.assigneeId;
  const getEditAssigneeId = setupAssigneeSearch('m-edit-assignee-input', id => { currentAssigneeId = id; });
  $('m-edit-submit').onclick = async () => {
    const title = $('m-edit-title').value.trim();
    if (!title) return;
    const inputVal = $('m-edit-assignee-input').value.trim();
    let assigneeId = getEditAssigneeId() || currentAssigneeId;
    // If user cleared the field — remove assignee
    if (!inputVal) assigneeId = null;
    // If changed name but didn't pick from list
    if (inputVal && inputVal !== currentAssigneeName && !getEditAssigneeId()) {
      try {
        const data = await api.searchUsers(inputVal);
        const exact = (data.users || []).find(u => u.name.toLowerCase() === inputVal.toLowerCase());
        if (!exact) { showToast('Користувача з таким ніком не знайдено', 'error'); return; }
        assigneeId = exact.id;
      } catch { showToast('Помилка пошуку користувача', 'error'); return; }
    }
    try {
      const updated = await api.updateTask(t.id, {
        title,
        description: $('m-edit-desc').value.trim() || undefined,
        priority: $('m-edit-priority').value,
        assigneeId: assigneeId,
        dueDate: $('m-edit-due').value || null,
      });
      state.currentTask = { ...t, ...updated };
      closeModal();
      renderTaskDetail(state.currentTask);
      addEditButton();
      showToast('Задачу оновлено');
    } catch (ex) { showToast(ex.message, 'error'); }
  };
}

// Patch openTask to add edit button
const _origOpenTask = openTask;
async function openTask(id) {
  showView('task-detail');
  // Remove old edit button if switching tasks
  const old = $('btn-edit-task');
  if (old) old.remove();
  try {
    const t = await api.getTask(id);
    state.currentTask = t;
    renderTaskDetail(t);
    addEditButton();
    await loadComments(id);
  } catch (ex) { showToast(ex.message, 'error'); }
}

/* ─── Comments ─── */
async function loadComments(taskId) {
  const list = $('comments-list');
  list.innerHTML = '';
  try {
    const data = await api.getComments(taskId);
    const comments = toArray(data.comments !== undefined ? data.comments : data);
    if (!comments.length) {
      list.innerHTML = `<div class="empty-state" style="padding:20px 0"><div class="empty-state-text">Немає коментарів</div></div>`;
      return;
    }
    comments.forEach(c => {
      const item = el('div', 'comment-item');
      item.innerHTML = `
        <div class="comment-avatar">${avatar(c.author?.name)}</div>
        <div class="comment-body">
          <div class="comment-header">
            <span class="comment-author">${c.author?.name || '?'}</span>
            <span class="comment-date">${formatDate(c.createdAt)}</span>
          </div>
          <div class="comment-text">${c.content}</div>
        </div>`;
      list.appendChild(item);
    });
  } catch {}
}

$('btn-add-comment').onclick = async () => {
  const text = $('comment-text').value.trim();
  if (!text || !state.currentTask) return;
  try {
    await api.createComment(state.currentTask.id, text);
    $('comment-text').value = '';
    await loadComments(state.currentTask.id);
    showToast('Коментар додано');
  } catch (ex) { showToast(ex.message, 'error'); }
};

/* ─── My Tasks ─── */
async function showMyTasks() {
  showView('my-tasks');
  const list = $('my-tasks-list');
  list.innerHTML = `<div class="empty-state"><div class="spinner"></div></div>`;
  try {
    await loadProjects();
    const projects = Array.isArray(state.projects) ? state.projects : [];
    const allTasks = [];
    for (const p of projects) {
      try {
        const data = await api.getTasks(p.id, { pageSize: 50 });
        const tasks = toArray(data.tasks !== undefined ? data.tasks : data);
        tasks.forEach(t => allTasks.push({ ...t, projectName: p.name }));
      } catch {}
    }
    list.innerHTML = '';
    if (!allTasks.length) {
      list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">◎</div><div class="empty-state-text">Немає задач</div></div>`;
      return;
    }
    // Sort: overdue first, then by priority
    const prioOrder = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    allTasks.sort((a, b) => {
      const aOver = isOverdue(a.dueDate) && a.status !== 'DONE' ? 0 : 1;
      const bOver = isOverdue(b.dueDate) && b.status !== 'DONE' ? 0 : 1;
      if (aOver !== bOver) return aOver - bOver;
      return (prioOrder[a.priority] || 2) - (prioOrder[b.priority] || 2);
    });
    allTasks.forEach(t => {
      const overdue = isOverdue(t.dueDate) && t.status !== 'DONE';
      const item = el('div', 'task-list-item');
      item.innerHTML = `
        <span class="priority-badge priority-${t.priority}">${priorityLabel(t.priority)}</span>
        <span class="task-list-title">${t.title}</span>
        <span class="due-date ${overdue ? 'overdue' : ''}">${overdue ? '⚠ ' : ''}${formatDate(t.dueDate)}</span>
        <span class="status-badge status-${t.status}">${statusLabel(t.status)}</span>
        <span class="task-list-project">${t.projectName}</span>`;
      item.onclick = () => openTask(t.id);
      list.appendChild(item);
    });
  } catch (ex) { showToast(ex.message, 'error'); list.innerHTML = ''; }
}

/* ─── Nav ─── */
document.querySelectorAll('.nav-item').forEach(item => {
  item.onclick = () => {
    const view = item.dataset.view;
    if (view === 'dashboard') showDashboard();
    else if (view === 'projects') showProjects();
    else if (view === 'my-tasks') showMyTasks();
  };
});

/* ─── Auto-login ─── */
(async () => {
  if (api.getToken()) {
    try {
      const data = await api.me();
      state.user = data.user || data;
      await initApp();
    } catch { api.setToken(null); }
  }
})();
