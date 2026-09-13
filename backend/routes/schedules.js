const express = require('express');
const router = express.Router();
const { db, uuidv4 } = require('../database');
const auth = require('../middleware/auth');

// All routes protected
router.use(auth);

// Helper: get schedule with tasks + stats (scoped to user)
function getScheduleWithStats(id, userId) {
  const s = db.get('schedules').find({ id, user_id: userId }).value();
  if (!s) return null;
  const tasks = db.get('schedule_tasks').filter({ schedule_id: id }).sortBy('task_date').value();
  const total = tasks.length;
  const completed = tasks.filter(t => t.is_complete).length;
  return {
    ...s,
    tasks,
    stats: { total, completed, incomplete: total - completed, percent: total ? Math.round((completed / total) * 100) : 0 }
  };
}

// GET all schedules (user only)
router.get('/', (req, res) => {
  try {
    const { type, status, search } = req.query;
    let schedules = db.get('schedules').filter({ user_id: req.user.id }).sortBy('created_at').reverse().value();
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      schedules = schedules.filter(s =>
        (s.title && s.title.toLowerCase().includes(q)) ||
        (s.description && s.description.toLowerCase().includes(q))
      );
    }
    if (type && type !== 'all') schedules = schedules.filter(s => s.type === type);
    let result = schedules.map(s => getScheduleWithStats(s.id, req.user.id));
    if (status === 'complete')   result = result.filter(s => s.stats.total > 0 && s.stats.incomplete === 0);
    else if (status === 'incomplete') result = result.filter(s => s.stats.incomplete > 0);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET single schedule
router.get('/:id', (req, res) => {
  try {
    const s = getScheduleWithStats(req.params.id, req.user.id);
    if (!s) return res.status(404).json({ success: false, message: 'Schedule not found' });
    res.json({ success: true, data: s });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST create schedule
router.post('/', (req, res) => {
  try {
    const { title, description = '', type, days = [], dates = [], start_date, end_date, color = '#8b5cf6', reminder_time = null } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ success: false, message: 'Title is required' });
    if (!type || !['today', 'daily', 'weekly', 'monthly', 'yearly'].includes(type)) return res.status(400).json({ success: false, message: 'Type must be today, daily, weekly, monthly, or yearly' });
    if (!start_date) return res.status(400).json({ success: false, message: 'Start date is required' });

    const schedId = uuidv4();
    const schedule = {
      id: schedId,
      user_id: req.user.id,
      title: title.trim(),
      description,
      type, days, dates,
      start_date,
      end_date: end_date || null,
      reminder_time: reminder_time || null,
      color,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    db.get('schedules').push(schedule).write();

    const taskDates = generateTaskDates(type, start_date, end_date, days, dates);
    taskDates.forEach(t => {
      db.get('schedule_tasks').push({
        id: uuidv4(),
        schedule_id: schedId,
        task_date: t.date,
        task_label: t.label,
        is_complete: false,
        completed_at: null
      }).write();
    });

    const result = getScheduleWithStats(schedId, req.user.id);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT update schedule
router.put('/:id', (req, res) => {
  try {
    const s = db.get('schedules').find({ id: req.params.id, user_id: req.user.id }).value();
    if (!s) return res.status(404).json({ success: false, message: 'Schedule not found' });
    const { title, description, color, reminder_time } = req.body;
    const updates = { updated_at: new Date().toISOString() };
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (color !== undefined) updates.color = color;
    if (reminder_time !== undefined) updates.reminder_time = reminder_time;
    db.get('schedules').find({ id: req.params.id }).assign(updates).write();
    const result = getScheduleWithStats(req.params.id, req.user.id);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE schedule
router.delete('/:id', (req, res) => {
  try {
    const s = db.get('schedules').find({ id: req.params.id, user_id: req.user.id }).value();
    if (!s) return res.status(404).json({ success: false, message: 'Schedule not found' });
    db.get('schedule_tasks').remove({ schedule_id: req.params.id }).write();
    db.get('schedules').remove({ id: req.params.id }).write();
    res.json({ success: true, message: 'Schedule deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH toggle task (verify task belongs to user's schedule)
router.patch('/task/:taskId/toggle', (req, res) => {
  try {
    const task = db.get('schedule_tasks').find({ id: req.params.taskId }).value();
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });
    // Security: verify the task's schedule belongs to this user
    const schedule = db.get('schedules').find({ id: task.schedule_id, user_id: req.user.id }).value();
    if (!schedule) return res.status(403).json({ success: false, message: 'Access denied' });
    const newStatus = !task.is_complete;
    db.get('schedule_tasks').find({ id: req.params.taskId }).assign({
      is_complete: newStatus,
      completed_at: newStatus ? new Date().toISOString() : null
    }).write();
    const updated = db.get('schedule_tasks').find({ id: req.params.taskId }).value();
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Task date helpers ──────────────────────────────────────
function toLocalDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function generateTaskDates(type, start_date, end_date, days, dates) {
  const tasks = [];
  const start = new Date(start_date + 'T00:00:00');
  const end = end_date ? new Date(end_date + 'T00:00:00') : new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  if (type === 'today') {
    tasks.push({ date: toLocalDateStr(start), label: `Today's Goal — ${start.toDateString()}` });
  } else if (type === 'daily') {
    const cur = new Date(start);
    let count = 0;
    while (cur <= end && count < 365) {
      tasks.push({ date: toLocalDateStr(cur), label: `Daily Task — ${cur.toDateString()}` });
      cur.setDate(cur.getDate() + 1);
      count++;
    }
  } else if (type === 'weekly') {
    const selectedDays = days.length > 0 ? days.map(d => parseInt(d)) : [1];
    const cur = new Date(start);
    let count = 0;
    while (cur <= end && count < 365) {
      if (selectedDays.includes(cur.getDay())) {
        tasks.push({ date: toLocalDateStr(cur), label: `${dayNames[cur.getDay()]} — ${cur.toDateString()}` });
        count++;
      }
      cur.setDate(cur.getDate() + 1);
    }
  } else if (type === 'monthly') {
    const selectedDates = dates.length > 0 ? dates.map(d => parseInt(d)) : [1];
    const cur = new Date(start);
    let count = 0;
    while (cur <= end && count < 365) {
      if (selectedDates.includes(cur.getDate())) {
        tasks.push({ date: toLocalDateStr(cur), label: `Monthly Task — ${cur.toDateString()}` });
        count++;
      }
      cur.setDate(cur.getDate() + 1);
    }
  } else if (type === 'yearly') {
    const cur = new Date(start);
    const endYearly = end_date ? new Date(end_date + 'T00:00:00') : new Date(start.getFullYear() + 5, start.getMonth(), start.getDate());
    let count = 0;
    while (cur <= endYearly && count < 10) {
      tasks.push({ date: toLocalDateStr(cur), label: `Yearly Milestone — ${cur.getFullYear()}` });
      cur.setFullYear(cur.getFullYear() + 1);
      count++;
    }
  }
  return tasks;
}

module.exports = router;
