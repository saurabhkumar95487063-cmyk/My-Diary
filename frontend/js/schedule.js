/* ============================================================
   SCHEDULE.JS — Schedules CRUD, task toggle, rendering
   ============================================================ */

let allSchedules = [];

/* ============================================================
   LOAD & RENDER SCHEDULES
   ============================================================ */
async function loadSchedules(searchTerm = '') {
  try {
    let url = `${API}/schedules`;
    const params = [];
    const searchVal = searchTerm || (document.getElementById('scheduleSearch')?.value.trim() || '');
    if (searchVal) params.push(`search=${encodeURIComponent(searchVal)}`);
    if (AppState.scheduleTypeFilter && AppState.scheduleTypeFilter !== 'all') params.push(`type=${AppState.scheduleTypeFilter}`);
    if (AppState.scheduleStatusFilter && AppState.scheduleStatusFilter !== 'all') params.push(`status=${AppState.scheduleStatusFilter}`);
    if (params.length) url += '?' + params.join('&');

    const res = await apiFetch(url);
    allSchedules = res.data;
    renderSchedules();
    updateSchedulesBadge();
  } catch (err) {
    showToast('Failed to load schedules: ' + err.message, 'error');
  }
}

function renderSchedules() {
  const list = document.getElementById('schedulesList');
  const empty = document.getElementById('schedulesEmpty');

  list.innerHTML = '';

  if (allSchedules.length === 0) {
    if (empty) empty.style.display = 'block';
    return;
  }

  if (empty) empty.style.display = 'none';
  allSchedules.forEach(s => list.appendChild(createScheduleCard(s)));
}

function createScheduleCard(s) {
  const card = document.createElement('div');
  card.className = 'schedule-card';
  card.style.setProperty('--schedule-color', s.color || '#8b5cf6');
  card.dataset.id = s.id;

  const typeIcons = { today: '⭐', daily: '📆', weekly: '📅', monthly: '🗓️', yearly: '🎯' };
  const typeIcon = typeIcons[s.type] || '🗓️';
  const typeLabel = s.type ? s.type.charAt(0).toUpperCase() + s.type.slice(1) : '';
  const pct = s.stats?.percent || 0;
  const dateRange = s.start_date
    ? `${formatDate(s.start_date)}${s.end_date ? ' → ' + formatDate(s.end_date) : ''}`
    : '';

  card.innerHTML = `
    <div class="schedule-card-header">
      <div>
        <div class="schedule-card-title">${escapeHtml(s.title)}</div>
        ${s.description ? `<div class="schedule-card-desc">${escapeHtml(s.description)}</div>` : ''}
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0">
        <button class="btn-icon edit-sched" data-id="${s.id}" title="Edit"><i class="fa fa-pen"></i></button>
        <button class="btn-icon danger delete-sched" data-id="${s.id}" title="Delete"><i class="fa fa-trash"></i></button>
      </div>
    </div>
    <div class="schedule-meta">
      <span class="schedule-badge badge-${s.type}">${typeIcon} ${typeLabel}</span>
      ${dateRange ? `<span class="schedule-date-range">📅 ${dateRange}</span>` : ''}
      ${s.reminder_time ? `<span class="schedule-date-range" style="color:var(--amber);font-weight:600">🔔 ${s.reminder_time}</span>` : ''}
      <span class="schedule-date-range">📋 ${s.stats?.total || 0} tasks</span>
    </div>
    <div class="progress-wrap">
      <div class="progress-track">
        <div class="progress-fill" style="width:${pct}%"></div>
      </div>
      <span class="progress-pct">${pct}%</span>
    </div>
    <div class="schedule-card-actions">
      <span style="font-size:0.78rem;color:var(--text-muted)">
        ✅ ${s.stats?.completed || 0} done &nbsp;|&nbsp; 🕐 ${s.stats?.incomplete || 0} pending
      </span>
      <button class="btn btn-sm" style="margin-left:auto;" data-id="${s.id}" id="viewBtn-${s.id}">
        <i class="fa fa-eye"></i> View Tasks
      </button>
    </div>
  `;

  // View tasks
  card.querySelector(`#viewBtn-${s.id}`).addEventListener('click', (e) => {
    e.stopPropagation();
    openScheduleDetail(s.id);
  });

  // Edit
  card.querySelector('.edit-sched').addEventListener('click', (e) => {
    e.stopPropagation();
    openEditSchedule(s.id);
  });

  // Delete
  card.querySelector('.delete-sched').addEventListener('click', (e) => {
    e.stopPropagation();
    showConfirm('Delete Schedule', `Delete "${s.title}" and all its tasks?`, () => deleteSchedule(s.id));
  });

  return card;
}

function updateSchedulesBadge() {
  const count = allSchedules.length;
  const el = document.getElementById('schedulesBadge');
  if (el) el.textContent = count;
  const heroBadge = document.getElementById('heroSchedulesBadge');
  if (heroBadge) heroBadge.textContent = count;
  const heroSchedulesCountBadge = document.getElementById('heroSchedulesCountBadge');
  if (heroSchedulesCountBadge) heroSchedulesCountBadge.textContent = count;
}

/* ============================================================
   SCHEDULE SEARCH & FILTERS
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  const scheduleSearchInput = document.getElementById('scheduleSearch');
  const clearScheduleSearchBtn = document.getElementById('clearScheduleSearch');
  let schedSearchTimeout = null;

  if (scheduleSearchInput) {
    scheduleSearchInput.addEventListener('input', () => {
      const val = scheduleSearchInput.value.trim();
      if (clearScheduleSearchBtn) clearScheduleSearchBtn.classList.toggle('visible', val.length > 0);
      clearTimeout(schedSearchTimeout);
      schedSearchTimeout = setTimeout(() => loadSchedules(val), 300);
    });
  }

  if (clearScheduleSearchBtn) {
    clearScheduleSearchBtn.addEventListener('click', () => {
      if (scheduleSearchInput) scheduleSearchInput.value = '';
      clearScheduleSearchBtn.classList.remove('visible');
      loadSchedules();
    });
  }
});

document.querySelectorAll('#schedulesPage [data-filter]').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('#schedulesPage [data-filter]').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    AppState.scheduleTypeFilter = chip.dataset.filter;
    loadSchedules();
  });
});

document.querySelectorAll('#schedulesPage [data-status]').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('#schedulesPage [data-status]').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    AppState.scheduleStatusFilter = chip.dataset.status;
    loadSchedules();
  });
});

/* ============================================================
   ADD SCHEDULE MODAL
   ============================================================ */
['addScheduleBtn', 'addScheduleBtnFromNotes', 'addScheduleBtnFromToolbar', 'addScheduleBtnFromEmpty', 'addScheduleBtnFromBottom'].forEach(id => {
  const btn = document.getElementById(id);
  if (btn) {
    btn.addEventListener('click', () => {
      AppState.editingScheduleId = null;
      document.getElementById('scheduleModalTitle').textContent = 'New Schedule';
      document.getElementById('scheduleTitleInput').value = '';
      document.getElementById('scheduleDescInput').value = '';
      document.getElementById('scheduleTypeSelect').value = 'daily';
      document.getElementById('scheduleStartDate').value = todayISO();
      document.getElementById('scheduleEndDate').value = '';
      document.getElementById('scheduleTime').value = '';
      AppState.selectedScheduleColor = '#8b5cf6';
      AppState.selectedDays = [];
      AppState.selectedDates = [];
      document.querySelectorAll('#scheduleColorPicker .color-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.color === '#8b5cf6');
      });
      resetDayPicker();
      updateScheduleTypeUI();
      openModal('scheduleModal');
      setTimeout(() => document.getElementById('scheduleTitleInput').focus(), 100);
    });
  }
});

document.getElementById('scheduleModalClose').addEventListener('click', () => closeModal('scheduleModal'));
document.getElementById('scheduleModalCancel').addEventListener('click', () => closeModal('scheduleModal'));
document.getElementById('scheduleModalSave').addEventListener('click', saveSchedule);

/* ============================================================
   SCHEDULE TYPE TOGGLE
   ============================================================ */
document.getElementById('scheduleTypeSelect').addEventListener('change', updateScheduleTypeUI);

function updateScheduleTypeUI() {
  const type = document.getElementById('scheduleTypeSelect').value;
  document.getElementById('weeklyOptions').style.display = type === 'weekly' ? 'block' : 'none';
  document.getElementById('monthlyOptions').style.display = type === 'monthly' ? 'block' : 'none';
}

/* ---- Day Picker ---- */
document.querySelectorAll('.day-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    btn.classList.toggle('selected');
    const day = parseInt(btn.dataset.day);
    if (btn.classList.contains('selected')) {
      if (!AppState.selectedDays.includes(day)) AppState.selectedDays.push(day);
    } else {
      AppState.selectedDays = AppState.selectedDays.filter(d => d !== day);
    }
  });
});

function resetDayPicker() {
  document.querySelectorAll('.day-btn').forEach(b => b.classList.remove('selected'));
  AppState.selectedDays = [];
}

/* ---- Month Date Picker ---- */
function buildMonthDatePicker() {
  const container = document.getElementById('monthDatePicker');
  container.innerHTML = '';
  for (let i = 1; i <= 31; i++) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'date-num-btn';
    btn.textContent = i;
    btn.dataset.date = i;
    btn.addEventListener('click', () => {
      btn.classList.toggle('selected');
      const d = parseInt(btn.dataset.date);
      if (btn.classList.contains('selected')) {
        if (!AppState.selectedDates.includes(d)) AppState.selectedDates.push(d);
      } else {
        AppState.selectedDates = AppState.selectedDates.filter(x => x !== d);
      }
    });
    container.appendChild(btn);
  }
}
buildMonthDatePicker();

/* ============================================================
   SAVE SCHEDULE
   ============================================================ */
async function saveSchedule() {
  const title = document.getElementById('scheduleTitleInput').value.trim();
  const description = document.getElementById('scheduleDescInput').value.trim();
  const type = document.getElementById('scheduleTypeSelect').value;
  const start_date = document.getElementById('scheduleStartDate').value;
  const end_date = document.getElementById('scheduleEndDate').value;
  const reminder_time = document.getElementById('scheduleTime').value || null;
  const color = AppState.selectedScheduleColor;

  if (!title) {
    showToast('Please enter a title!', 'error');
    document.getElementById('scheduleTitleInput').focus();
    return;
  }
  if (!start_date) {
    showToast('Please select a start date!', 'error');
    return;
  }
  if (end_date && end_date < start_date) {
    showToast('End date must be after start date!', 'error');
    return;
  }

  const btn = document.getElementById('scheduleModalSave');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Creating...';

  try {
    if (AppState.editingScheduleId) {
      await apiFetch(`${API}/schedules/${AppState.editingScheduleId}`, {
        method: 'PUT',
        body: JSON.stringify({ title, description, color, reminder_time })
      });
      showToast('Schedule updated! 📅', 'success');
    } else {
      const body = {
        title, description, type, start_date, color, reminder_time,
        days: AppState.selectedDays,
        dates: AppState.selectedDates
      };
      if (end_date) body.end_date = end_date;
      await apiFetch(`${API}/schedules`, { method: 'POST', body: JSON.stringify(body) });
      showToast('Schedule created! 🗓️', 'success');
    }
    closeModal('scheduleModal');
    loadSchedules();
  } catch (err) {
    showToast('Failed: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa fa-save"></i> Save Schedule';
  }
}

/* ============================================================
   EDIT SCHEDULE
   ============================================================ */
async function openEditSchedule(id) {
  try {
    const res = await apiFetch(`${API}/schedules/${id}`);
    const s = res.data;
    AppState.editingScheduleId = id;
    document.getElementById('scheduleModalTitle').textContent = 'Edit Schedule';
    document.getElementById('scheduleTitleInput').value = s.title;
    document.getElementById('scheduleDescInput').value = s.description || '';
    document.getElementById('scheduleTypeSelect').value = s.type;
    document.getElementById('scheduleTypeSelect').disabled = true; // can't change type on edit
    document.getElementById('scheduleStartDate').value = s.start_date;
    document.getElementById('scheduleEndDate').value = s.end_date || '';
    document.getElementById('scheduleTime').value = s.reminder_time || '';
    document.getElementById('scheduleModalSave').innerHTML = '<i class="fa fa-save"></i> Update Schedule';
    AppState.selectedScheduleColor = s.color || '#8b5cf6';
    document.querySelectorAll('#scheduleColorPicker .color-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.color === s.color);
    });
    updateScheduleTypeUI();
    openModal('scheduleModal');
  } catch (err) {
    showToast('Failed to load: ' + err.message, 'error');
  }
}

/* ============================================================
   ALARM SOUND & SCHEDULER SYSTEM
   ============================================================ */
let audioCtx = null;
let alarmInterval = null;
const triggeredAlarmsToday = {};

function playAlarmSound() {
  stopAlarmSound();
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    alarmInterval = setInterval(() => {
      if (!audioCtx) return;
      const now = audioCtx.currentTime;
      
      // High-low beeping alarm tone
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, now);
      osc1.frequency.setValueAtTime(659.25, now + 0.15);
      gain1.gain.setValueAtTime(0.3, now);
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      
      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      osc1.start(now);
      osc1.stop(now + 0.3);
    }, 500);
  } catch (err) {
    console.error('AudioContext error:', err);
  }
}

function stopAlarmSound() {
  if (alarmInterval) {
    clearInterval(alarmInterval);
    alarmInterval = null;
  }
  if (audioCtx) {
    try { audioCtx.close(); } catch(e){}
    audioCtx = null;
  }
  closeModal('alarmRingModal');
}

// Alarm checking background timer
function startAlarmChecker() {
  setInterval(() => {
    if (!allSchedules || allSchedules.length === 0) return;
    const now = new Date();
    const currentHHMM = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    const todayKey = now.toISOString().split('T')[0];

    allSchedules.forEach(s => {
      if (s.reminder_time) {
        const schedTime = s.reminder_time.substring(0, 5);
        const alarmKey = `${s.id}_${todayKey}_${schedTime}`;

        if (schedTime === currentHHMM && !triggeredAlarmsToday[alarmKey]) {
          triggeredAlarmsToday[alarmKey] = true;
          triggerAlarm(s);
        }
      }
    });
  }, 4000);
}

function triggerAlarm(s) {
  playAlarmSound();
  const titleEl = document.getElementById('alarmTitle');
  const timeEl = document.getElementById('alarmTimeText');
  const descEl = document.getElementById('alarmDescText');
  if (titleEl) titleEl.textContent = `⏰ ${s.title}`;
  if (timeEl) timeEl.textContent = `Alarm Time: ${s.reminder_time}`;
  if (descEl) descEl.textContent = s.description || 'Time for your scheduled diary task!';
  openModal('alarmRingModal');

  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(`⏰ Schedule Alarm: ${s.title}`, {
      body: s.description || `Alarm set for ${s.reminder_time}`,
    });
  } else if ("Notification" in window && Notification.permission !== "denied") {
    Notification.requestPermission();
  }
}

// Start alarm checker
startAlarmChecker();

// Reset type select when modal closes
document.getElementById('scheduleModalClose').addEventListener('click', () => {
  document.getElementById('scheduleTypeSelect').disabled = false;
  document.getElementById('scheduleModalSave').innerHTML = '<i class="fa fa-save"></i> Save Schedule';
});
document.getElementById('scheduleModalCancel').addEventListener('click', () => {
  document.getElementById('scheduleTypeSelect').disabled = false;
  document.getElementById('scheduleModalSave').innerHTML = '<i class="fa fa-save"></i> Save Schedule';
});

/* ============================================================
   DELETE SCHEDULE
   ============================================================ */
async function deleteSchedule(id) {
  try {
    await apiFetch(`${API}/schedules/${id}`, { method: 'DELETE' });
    showToast('Schedule deleted 🗑️', 'info');
    // Close detail modal if open
    closeModal('scheduleDetailModal');
    loadSchedules();
  } catch (err) {
    showToast('Failed to delete: ' + err.message, 'error');
  }
}

/* ============================================================
   SCHEDULE DETAIL MODAL (View Tasks)
   ============================================================ */
async function openScheduleDetail(id) {
  try {
    const res = await apiFetch(`${API}/schedules/${id}`);
    const s = res.data;
    AppState.viewingScheduleId = id;

    document.getElementById('detailTitle').textContent = s.title;
    const typeIcons = { today: '⭐', daily: '📆', weekly: '📅', monthly: '🗓️', yearly: '🎯' };
    const dateRange = s.start_date ? `${formatDate(s.start_date)}${s.end_date ? ' → ' + formatDate(s.end_date) : ''}` : '';
    document.getElementById('detailSubtitle').textContent = `${typeIcons[s.type]} ${s.type} schedule${dateRange ? ' · ' + dateRange : ''}`;
    document.getElementById('detailModalHeader').style.borderLeftColor = s.color || '#8b5cf6';

    // Stats
    const st = s.stats || { total: 0, completed: 0, incomplete: 0, percent: 0 };
    document.getElementById('detailStats').innerHTML = `
      <div class="stat-item"><div class="stat-val">${st.total}</div><div class="stat-lbl">Total</div></div>
      <div class="stat-item"><div class="stat-val" style="background:linear-gradient(135deg,#10b981,#34d399);-webkit-background-clip:text;-webkit-text-fill-color:transparent">${st.completed}</div><div class="stat-lbl">Done</div></div>
      <div class="stat-item"><div class="stat-val" style="background:linear-gradient(135deg,#f59e0b,#fbbf24);-webkit-background-clip:text;-webkit-text-fill-color:transparent">${st.incomplete}</div><div class="stat-lbl">Pending</div></div>
      <div class="stat-item"><div class="stat-val">${st.percent}%</div><div class="stat-lbl">Complete</div></div>
    `;
    document.getElementById('detailProgressBar').style.width = `${st.percent}%`;

    // Tasks
    const tasksEl = document.getElementById('detailTasksList');
    tasksEl.innerHTML = '';
    if (!s.tasks || s.tasks.length === 0) {
      tasksEl.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><h3>No tasks yet</h3></div>';
    } else {
      s.tasks.forEach(task => {
        const item = document.createElement('div');
        item.className = `task-item${task.is_complete ? ' complete' : ''}`;
        item.dataset.taskId = task.id;
        item.innerHTML = `
          <button class="task-toggle" data-task-id="${task.id}" title="${task.is_complete ? 'Mark incomplete' : 'Mark complete'}">
            ${task.is_complete ? '<i class="fa fa-check"></i>' : ''}
          </button>
          <span class="task-label">${escapeHtml(task.task_label || task.task_date)}</span>
          <span class="task-date-badge">${formatDate(task.task_date)}</span>
        `;
        item.querySelector('.task-toggle').addEventListener('click', () => toggleTask(task.id, id));
        tasksEl.appendChild(item);
      });
    }

    // Delete btn
    document.getElementById('detailDeleteBtn').onclick = () => {
      showConfirm('Delete Schedule', `Delete "${s.title}" and all its tasks?`, () => deleteSchedule(id));
    };

    openModal('scheduleDetailModal');
  } catch (err) {
    showToast('Failed to load schedule: ' + err.message, 'error');
  }
}

document.getElementById('detailModalClose').addEventListener('click', () => closeModal('scheduleDetailModal'));
document.getElementById('detailModalClose2').addEventListener('click', () => closeModal('scheduleDetailModal'));

/* ============================================================
   TOGGLE TASK
   ============================================================ */
async function toggleTask(taskId, scheduleId) {
  try {
    await apiFetch(`${API}/schedules/task/${taskId}/toggle`, { method: 'PATCH' });
    // Refresh detail modal
    await openScheduleDetail(scheduleId);
    // Also refresh card in background
    loadSchedules();
  } catch (err) {
    showToast('Failed to update task: ' + err.message, 'error');
  }
}
