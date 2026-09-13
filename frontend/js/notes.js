/* ============================================================
   NOTES.JS — Notes CRUD, rendering, filters, search
   ============================================================ */

let allNotes = [];

/* ============================================================
   LOAD & RENDER NOTES
   ============================================================ */
async function loadNotes(searchTerm = '') {
  try {
    const url = searchTerm
      ? `${API}/notes?search=${encodeURIComponent(searchTerm)}`
      : `${API}/notes`;
    const res = await apiFetch(url);
    allNotes = res.data;
    renderNotes();
    updateNotesBadge();
  } catch (err) {
    showToast('Failed to load notes: ' + err.message, 'error');
  }
}

function renderNotes() {
  const grid = document.getElementById('notesGrid');
  const empty = document.getElementById('notesEmpty');
  let notes = [...allNotes];

  // Apply filter
  if (AppState.noteFilter === 'pinned') {
    notes = notes.filter(n => n.pinned);
  }

  grid.innerHTML = '';

  if (notes.length === 0) {
    if (empty) empty.style.display = 'block';
    return;
  }

  if (empty) empty.style.display = 'none';
  notes.forEach(note => grid.appendChild(createNoteCard(note)));
}

function createNoteCard(note) {
  const card = document.createElement('div');
  card.className = `note-card${note.pinned ? ' pinned' : ''}`;
  card.style.setProperty('--note-color', note.color || '#6366f1');
  card.dataset.id = note.id;

  const body = note.body ? note.body.replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';

  card.innerHTML = `
    <div class="note-card-title">${escapeHtml(note.title)}</div>
    <div class="note-card-body">${body || '<span style="color:var(--text-muted);font-style:italic">No content</span>'}</div>
    <div class="note-card-footer">
      <span class="note-date">${formatDate(note.updated_at)}</span>
      <div class="note-actions">
        <button class="btn-icon pin${note.pinned ? ' active' : ''}" data-id="${note.id}" title="${note.pinned ? 'Unpin' : 'Pin'}">📌</button>
        <button class="btn-icon edit" data-id="${note.id}" title="Edit"><i class="fa fa-pen"></i></button>
        <button class="btn-icon danger delete" data-id="${note.id}" title="Delete"><i class="fa fa-trash"></i></button>
      </div>
    </div>
  `;

  // Card click (open edit)
  card.addEventListener('click', (e) => {
    if (!e.target.closest('.note-actions')) {
      openEditNote(note.id);
    }
  });

  // Pin
  card.querySelector('.pin').addEventListener('click', async (e) => {
    e.stopPropagation();
    await togglePin(note.id);
  });

  // Edit
  card.querySelector('.edit').addEventListener('click', (e) => {
    e.stopPropagation();
    openEditNote(note.id);
  });

  // Delete
  card.querySelector('.delete').addEventListener('click', (e) => {
    e.stopPropagation();
    showConfirm('Delete Note', `Delete "${note.title}"? This cannot be undone.`, () => deleteNote(note.id));
  });

  return card;
}

function updateNotesBadge() {
  const count = allNotes.length;
  const el = document.getElementById('notesBadge');
  if (el) el.textContent = count;
  const heroBadge = document.getElementById('heroNotesBadge');
  if (heroBadge) heroBadge.textContent = count;
  const heroNotesCountBadge = document.getElementById('heroNotesCountBadge');
  if (heroNotesCountBadge) heroNotesCountBadge.textContent = count;
}

/* ============================================================
   SEARCH
   ============================================================ */
const noteSearchInput = document.getElementById('noteSearch');
const clearNoteSearchBtn = document.getElementById('clearNoteSearch');
let searchTimeout = null;

noteSearchInput.addEventListener('input', () => {
  const val = noteSearchInput.value.trim();
  clearNoteSearchBtn.classList.toggle('visible', val.length > 0);
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => loadNotes(val), 300);
});

clearNoteSearchBtn.addEventListener('click', () => {
  noteSearchInput.value = '';
  clearNoteSearchBtn.classList.remove('visible');
  loadNotes();
});

/* ============================================================
   FILTER
   ============================================================ */
document.querySelectorAll('#notesPage .chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('#notesPage .chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    AppState.noteFilter = chip.dataset.filter;
    renderNotes();
  });
});

/* ============================================================
   ADD NOTE MODAL
   ============================================================ */
['addNoteBtn', 'addNoteBtnFromSchedules', 'addNoteBtnFromToolbar', 'addNoteBtnFromEmpty'].forEach(id => {
  const btn = document.getElementById(id);
  if (btn) {
    btn.addEventListener('click', () => {
      AppState.editingNoteId = null;
      document.getElementById('noteModalTitle').textContent = 'New Note';
      document.getElementById('noteTitleInput').value = '';
      document.getElementById('noteBodyInput').value = '';
      // Reset color
      AppState.selectedNoteColor = '#6366f1';
      document.querySelectorAll('#noteColorPicker .color-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.color === '#6366f1');
      });
      openModal('noteModal');
      setTimeout(() => document.getElementById('noteTitleInput').focus(), 100);
    });
  }
});

document.getElementById('noteModalClose').addEventListener('click', () => closeModal('noteModal'));
document.getElementById('noteModalCancel').addEventListener('click', () => closeModal('noteModal'));

document.getElementById('noteModalSave').addEventListener('click', saveNote);

/* ============================================================
   EDIT NOTE
   ============================================================ */
async function openEditNote(id) {
  try {
    const res = await apiFetch(`${API}/notes/${id}`);
    const note = res.data;
    AppState.editingNoteId = id;
    document.getElementById('noteModalTitle').textContent = 'Edit Note';
    document.getElementById('noteTitleInput').value = note.title;
    document.getElementById('noteBodyInput').value = note.body || '';
    AppState.selectedNoteColor = note.color || '#6366f1';
    document.querySelectorAll('#noteColorPicker .color-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.color === note.color);
    });
    openModal('noteModal');
    setTimeout(() => document.getElementById('noteTitleInput').focus(), 100);
  } catch (err) {
    showToast('Failed to load note: ' + err.message, 'error');
  }
}

/* ============================================================
   SAVE NOTE
   ============================================================ */
async function saveNote() {
  const title = document.getElementById('noteTitleInput').value.trim();
  const body = document.getElementById('noteBodyInput').value.trim();
  const color = AppState.selectedNoteColor;

  if (!title) {
    showToast('Please enter a title!', 'error');
    document.getElementById('noteTitleInput').focus();
    return;
  }

  const btn = document.getElementById('noteModalSave');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Saving...';

  try {
    if (AppState.editingNoteId) {
      await apiFetch(`${API}/notes/${AppState.editingNoteId}`, {
        method: 'PUT',
        body: JSON.stringify({ title, body, color })
      });
      showToast('Note updated! ✏️', 'success');
    } else {
      await apiFetch(`${API}/notes`, {
        method: 'POST',
        body: JSON.stringify({ title, body, color })
      });
      showToast('Note saved! 📝', 'success');
    }
    closeModal('noteModal');
    loadNotes(noteSearchInput.value.trim());
  } catch (err) {
    showToast('Failed to save: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa fa-save"></i> Save Note';
  }
}

/* ============================================================
   DELETE NOTE
   ============================================================ */
async function deleteNote(id) {
  try {
    await apiFetch(`${API}/notes/${id}`, { method: 'DELETE' });
    showToast('Note deleted 🗑️', 'info');
    loadNotes(noteSearchInput.value.trim());
  } catch (err) {
    showToast('Failed to delete: ' + err.message, 'error');
  }
}

/* ============================================================
   TOGGLE PIN
   ============================================================ */
async function togglePin(id) {
  try {
    await apiFetch(`${API}/notes/${id}/pin`, { method: 'PATCH' });
    loadNotes(noteSearchInput.value.trim());
  } catch (err) {
    showToast('Failed to pin note: ' + err.message, 'error');
  }
}

/* ============================================================
   KEYBOARD SHORTCUT: Ctrl+Enter to save
   ============================================================ */
document.getElementById('noteBodyInput').addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'Enter') saveNote();
});
document.getElementById('noteTitleInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('noteBodyInput').focus();
});

/* ============================================================
   UTILITY
   ============================================================ */
function escapeHtml(str) {
  return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
