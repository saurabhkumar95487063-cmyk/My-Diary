const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  schedule_id:  { type: mongoose.Schema.Types.ObjectId, ref: 'Schedule', required: true },
  task_date:    { type: String, required: true },
  task_label:   { type: String, default: '' },
  is_complete:  { type: Boolean, default: false },
  completed_at: { type: Date, default: null }
});

const scheduleSchema = new mongoose.Schema({
  user_id:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title:         { type: String, required: true, trim: true },
  description:   { type: String, default: '' },
  type:          { type: String, enum: ['today','daily','weekly','monthly','yearly'], required: true },
  days:          { type: [Number], default: [] },
  dates:         { type: [Number], default: [] },
  start_date:    { type: String, required: true },
  end_date:      { type: String, default: null },
  reminder_time: { type: String, default: null },
  color:         { type: String, default: '#8b5cf6' },
  created_at:    { type: Date, default: Date.now },
  updated_at:    { type: Date, default: Date.now }
});

const Schedule = mongoose.model('Schedule', scheduleSchema);
const ScheduleTask = mongoose.model('ScheduleTask', taskSchema);

module.exports = { Schedule, ScheduleTask };
