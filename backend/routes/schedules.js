const express = require('express');
const router = express.Router();
const { Schedule, ScheduleTask } = require('../models/Schedule');
const auth = require('../middleware/auth');

// All routes protected
router.use(auth);

// Helper: get schedule with tasks + stats
async function getScheduleWithStats(id, userId) {
  const s = await Schedule.findOne({ _id: id, user_id: userId }).lean();
  if (!s) return null;
  const tasks = await ScheduleTask.find({ schedule_id: id }).sort({ task_date: 1 }).lean();
  const total = tasks.length;
  const completed = tasks.filter(t => t.is_complete).length;
  return {
    ...s,
    id: s._id,
    tasks: tasks.map(t => ({ ...t, id: t._id })),
    stats: { total, completed, incomplete: total - completed, percent: total ? Math.round((completed / total) * 100) : 0 }
  };
}

// GET all schedules
router.get('/', async (req, res) => {
  try {
    const { type, status, search } = req.query;
    const query = { user_id: req.user.id };
    if (search && search.trim()) {
      query.$or = [
        { title:       { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    if (type && type !== 'all') query.type = type;
    const schedules = await Schedule.find(query).sort({ created_at: -1 }).lean();
    let result = await Promise.all(schedules.map(s => getScheduleWithStats(s._id, req.user.id)));
    if (status === 'complete')   result = result.filter(s => s.stats.total > 0 && s.stats.incomplete === 0);
    else if (status === 'incomplete') result = result.filter(s => s.stats.incomplete > 0);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET single schedule
router.get('/:id', async (req, res) => {
  try {
    const s = await getScheduleWithStats(req.params.id, req.user.id);
    if (!s) return res.status(404).json({ success: false, message: 'Schedule not found' });
    res.json({ success: true, data: s });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST create schedule
router.post('/', async (req, res) => {
  try {
    const { title, description = '', type, days = [], dates = [], start_date, end_date, color = '#8b5cf6', reminder_time = null } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ success: false, message: 'Title is required' });
    if (!type || !['today','daily','weekly','monthly','yearly'].includes(type)) return res.status(400).json({ success: false, message: 'Invalid type' });
    if (!start_date) return res.status(400).json({ success: false, message: 'Start date is required' });

    const schedule = await Schedule.create({
      user_id: req.user.id,
      title: title.trim(),
      description, type, days, dates,
      start_date,
      end_date: end_date || null,
      reminder_time: reminder_time || null,
      color
    });

    const taskDates = generateTaskDates(type, start_date, end_date, days, dates);
    if (taskDates.length > 0) {
      await ScheduleTask.insertMany(taskDates.map(t => ({
        schedule_id: schedule._id,
        task_date:   t.date,
        task_label:  t.label,
        is_complete: false
      })));
    }

    const result = await getScheduleWithStats(schedule._id, req.user.id);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT update schedule
router.put('/:id', async (req, res) => {
  try {
    const { title, description, color, reminder_time } = req.body;
    const updates = { updated_at: new Date() };
    if (title        !== undefined) updates.title        = title;
    if (description  !== undefined) updates.description  = description;
    if (color        !== undefined) updates.color        = color;
    if (reminder_time !== undefined) updates.reminder_time = reminder_time;
    const updated = await Schedule.findOneAndUpdate(
      { _id: req.params.id, user_id: req.user.id },
      updates, { new: true }
    );
    if (!updated) return res.status(404).json({ success: false, message: 'Schedule not found' });
    const result = await getScheduleWithStats(req.params.id, req.user.id);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE schedule
router.delete('/:id', async (req, res) => {
  try {
    const s = await Schedule.findOne({ _id: req.params.id, user_id: req.user.id });
    if (!s) return res.status(404).json({ success: false, message: 'Schedule not found' });
    await ScheduleTask.deleteMany({ schedule_id: req.params.id });
    await Schedule.deleteOne({ _id: req.params.id });
    res.json({ success: true, message: 'Schedule deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH toggle task
router.patch('/task/:taskId/toggle', async (req, res) => {
  try {
    const task = await ScheduleTask.findById(req.params.taskId);
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });
    const schedule = await Schedule.findOne({ _id: task.schedule_id, user_id: req.user.id });
    if (!schedule) return res.status(403).json({ success: false, message: 'Access denied' });
    task.is_complete  = !task.is_complete;
    task.completed_at = task.is_complete ? new Date() : null;
    await task.save();
    res.json({ success: true, data: { ...task.toObject(), id: task._id } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Task date generators ──────────────────────────────────────
function toLocalDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function generateTaskDates(type, start_date, end_date, days, dates) {
  const tasks = [];
  const start = new Date(start_date + 'T00:00:00');
  const end   = end_date ? new Date(end_date + 'T00:00:00') : new Date(start.getTime() + 30*24*60*60*1000);
  const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

  if (type === 'today') {
    tasks.push({ date: toLocalDateStr(start), label: `Today's Goal — ${start.toDateString()}` });
  } else if (type === 'daily') {
    const cur = new Date(start); let count = 0;
    while (cur <= end && count < 365) { tasks.push({ date: toLocalDateStr(cur), label: `Daily Task — ${cur.toDateString()}` }); cur.setDate(cur.getDate()+1); count++; }
  } else if (type === 'weekly') {
    const sel = days.length > 0 ? days.map(Number) : [1];
    const cur = new Date(start); let count = 0;
    while (cur <= end && count < 365) { if (sel.includes(cur.getDay())) { tasks.push({ date: toLocalDateStr(cur), label: `${dayNames[cur.getDay()]} — ${cur.toDateString()}` }); count++; } cur.setDate(cur.getDate()+1); }
  } else if (type === 'monthly') {
    const sel = dates.length > 0 ? dates.map(Number) : [1];
    const cur = new Date(start); let count = 0;
    while (cur <= end && count < 365) { if (sel.includes(cur.getDate())) { tasks.push({ date: toLocalDateStr(cur), label: `Monthly Task — ${cur.toDateString()}` }); count++; } cur.setDate(cur.getDate()+1); }
  } else if (type === 'yearly') {
    const endY = end_date ? new Date(end_date+'T00:00:00') : new Date(start.getFullYear()+5, start.getMonth(), start.getDate());
    const cur = new Date(start); let count = 0;
    while (cur <= endY && count < 10) { tasks.push({ date: toLocalDateStr(cur), label: `Yearly Milestone — ${cur.getFullYear()}` }); cur.setFullYear(cur.getFullYear()+1); count++; }
  }
  return tasks;
}

module.exports = router;
