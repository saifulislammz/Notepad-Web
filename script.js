// DOM Elements
const notesList = document.getElementById('notesList');
const noteEditor = document.getElementById('noteEditor');
const welcomeScreen = document.getElementById('welcomeScreen');
const noteTitle = document.getElementById('noteTitle');
const noteContent = document.getElementById('noteContent');
const saveNoteBtn = document.getElementById('saveNoteBtn');
const closeEditorBtn = document.getElementById('closeEditorBtn');
const searchInput = document.getElementById('searchInput');
const lineCount = document.getElementById('lineCount');
const charCount = document.getElementById('charCount');
const wordCount = document.getElementById('wordCount');
const undoBtn = document.getElementById('undoBtn');
const redoBtn = document.getElementById('redoBtn');
const zoomInBtn = document.getElementById('zoomInBtn');
const zoomOutBtn = document.getElementById('zoomOutBtn');
const exportTxtBtn = document.getElementById('exportTxtBtn');
const importTxtInput = document.getElementById('importTxtInput');
const deleteModal = document.getElementById('deleteModal');
const cancelDeleteBtn = document.getElementById('cancelDelete');
const confirmDeleteBtn = document.getElementById('confirmDelete');
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeSettings = document.getElementById('closeSettings');
const themeSelect = document.getElementById('themeSelect');
const fontSelect = document.getElementById('fontSelect');
const autoSaveToggle = document.getElementById('autoSaveToggle');
const spellCheckToggle = document.getElementById('spellCheckToggle');

// State
let notes = JSON.parse(localStorage.getItem('notes') || '[]');
let currentNoteId = null;
let isEditorTransitioning = false;
let currentSearchTerm = '';
let undoStack = [];
let redoStack = [];
let currentFontSize = parseInt(localStorage.getItem('notepad_font_size') || '15');
let noteToDelete = null;
const MIN_FONT_SIZE = 12;
const MAX_FONT_SIZE = 24;

// Settings State
let settings = JSON.parse(localStorage.getItem('notepad_settings') || JSON.stringify({
    theme: 'dark',
    font: 'Arial',
    autoSave: true,
    spellCheck: true
}));

// Event Listeners
saveNoteBtn.addEventListener('click', saveNote);
closeEditorBtn.addEventListener('click', closeEditor);
searchInput.addEventListener('input', handleSearch);
noteContent.addEventListener('input', handleNoteContentChange);
undoBtn.addEventListener('click', undo);
redoBtn.addEventListener('click', redo);
zoomInBtn.addEventListener('click', zoomIn);
zoomOutBtn.addEventListener('click', zoomOut);
exportTxtBtn.addEventListener('click', exportToTxt);
importTxtInput.addEventListener('change', importFromTxt);
cancelDeleteBtn.addEventListener('click', () => hideDeleteModal());
confirmDeleteBtn.addEventListener('click', confirmDeleteNote);
settingsBtn.addEventListener('click', showSettings);
closeSettings.addEventListener('click', hideSettings);
themeSelect.addEventListener('change', handleThemeChange);
fontSelect.addEventListener('change', handleFontChange);
autoSaveToggle.addEventListener('change', handleAutoSave);
spellCheckToggle.addEventListener('change', handleSpellCheck);

// Add keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.target === noteContent) {
        if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            undo();
        } else if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'Z')) {
            e.preventDefault();
            redo();
        } else if (e.ctrlKey && e.key === '=') {
            e.preventDefault();
            zoomIn();
        } else if (e.ctrlKey && e.key === '-') {
            e.preventDefault();
            zoomOut();
        } else if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            exportToTxt();
        }
    }
});

// Delete Modal Functions
function showDeleteModal(id, event) {
    if (event) {
        event.stopPropagation();
    }
    
    noteToDelete = id;
    deleteModal.classList.remove('hidden');
    setTimeout(() => deleteModal.classList.add('show'), 10);
}

function hideDeleteModal() {
    deleteModal.classList.remove('show');
    setTimeout(() => {
        deleteModal.classList.add('hidden');
        noteToDelete = null;
    }, 300);
}

async function confirmDeleteNote() {
    if (noteToDelete === null) return;
    
    const noteElement = document.querySelector(`[data-note-id="${noteToDelete}"]`);
    if (noteElement) {
        noteElement.style.transform = 'translateX(-100px)';
        noteElement.style.opacity = '0';
        await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    notes = notes.filter(note => note.id !== noteToDelete);
    localStorage.setItem('notes', JSON.stringify(notes));
    
    if (currentNoteId === noteToDelete) {
        closeEditor();
    }
    
    hideDeleteModal();
    renderNotes(currentSearchTerm);
    showNotification('Note deleted successfully');
}

// File Import/Export Functions
function exportToTxt() {
    // Get the note title, replace invalid file name characters with spaces
    const title = (noteTitle.value.trim() || 'Untitled Note')
        .replace(/[/\\?%*:|"<>]/g, ' ') // Replace invalid file name characters with space
        .trim(); // Trim any leading/trailing spaces
    const content = noteContent.value;
    
    // Create a Blob containing the note content
    const blob = new Blob([content], { type: 'text/plain' });
    
    // Create a temporary link element
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${title}.txt`;
    
    // Simulate click to trigger download
    document.body.appendChild(link);
    link.click();
    
    // Clean up
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    
    // Show success indicator
    showNotification('Note exported successfully!');
}

function importFromTxt(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (file.type !== 'text/plain') {
        showNotification('Please select a .txt file', 'error');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const content = e.target.result;
        // Get file name without .txt extension and clean it
        const fileName = file.name
            .replace(/\.txt$/i, '') // Remove .txt extension case-insensitive
            .replace(/[/\\?%*:|"<>]/g, ' ') // Replace invalid characters with space
            .trim(); // Trim any leading/trailing spaces
        
        // Create new note with imported content
        noteTitle.value = fileName;
        noteContent.value = content;
        
        // Update undo/redo stacks and stats
        undoStack = [];
        redoStack = [];
        updateUndoRedoButtons();
        updateNoteStats();
        
        showNotification('File imported successfully!');
    };
    
    reader.onerror = function() {
        showNotification('Error reading file', 'error');
    };
    
    reader.readAsText(file);
    
    // Reset file input
    event.target.value = '';
}

function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.className = `fixed bottom-4 right-4 px-4 py-2 rounded-lg shadow-lg slide-in ${
        type === 'success' ? 'bg-green-500' : 'bg-red-500'
    } text-white`;
    
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
    }, 2000);
}

// Utility Functions
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function animateElement(element, className, duration = 300) {
    return new Promise(resolve => {
        element.classList.add(className);
        setTimeout(() => {
            element.classList.remove(className);
            resolve();
        }, duration);
    });
}

// Note Stats Function
function updateNoteStats() {
    const content = noteContent.value;
    const lines = content.split('\n').length;
    const chars = content.length;
    const words = content.trim() === '' ? 0 : content.trim().split(/\s+/).length;

    lineCount.textContent = lines;
    charCount.textContent = chars;
    wordCount.textContent = words;
}

// Undo/Redo Functions
function handleNoteContentChange(event) {
    updateNoteStats();
    
    // Don't add to undo stack if change was from undo/redo
    if (event.inputType === 'historyUndo' || event.inputType === 'historyRedo') {
        return;
    }

    // Add current state to undo stack
    undoStack.push(noteContent.value);
    // Clear redo stack when new changes are made
    redoStack = [];
    
    updateUndoRedoButtons();
    
    if (settings.autoSave) {
        clearTimeout(autoSaveTimeout);
        autoSaveTimeout = setTimeout(() => {
            saveNote();
        }, 2000);
    }
}

function updateUndoRedoButtons() {
    undoBtn.disabled = undoStack.length === 0;
    redoBtn.disabled = redoStack.length === 0;
}

function undo() {
    if (undoStack.length === 0) return;
    
    // Save current state to redo stack
    redoStack.push(noteContent.value);
    // Get previous state
    const previousState = undoStack.pop();
    // Update content
    noteContent.value = previousState;
    updateNoteStats();
    updateUndoRedoButtons();
}

function redo() {
    if (redoStack.length === 0) return;
    
    // Save current state to undo stack
    undoStack.push(noteContent.value);
    // Get next state
    const nextState = redoStack.pop();
    // Update content
    noteContent.value = nextState;
    updateNoteStats();
    updateUndoRedoButtons();
}

function zoomIn() {
    if (currentFontSize < MAX_FONT_SIZE) {
        currentFontSize = Math.min(currentFontSize + 2, MAX_FONT_SIZE);
        noteContent.style.fontSize = `${currentFontSize}px`;
        localStorage.setItem('notepad_font_size', currentFontSize.toString());
        zoomInBtn.disabled = currentFontSize >= MAX_FONT_SIZE;
        zoomOutBtn.disabled = false;
    }
}

function zoomOut() {
    if (currentFontSize > MIN_FONT_SIZE) {
        currentFontSize = Math.max(currentFontSize - 2, MIN_FONT_SIZE);
        noteContent.style.fontSize = `${currentFontSize}px`;
        localStorage.setItem('notepad_font_size', currentFontSize.toString());
        zoomOutBtn.disabled = currentFontSize <= MIN_FONT_SIZE;
        zoomInBtn.disabled = false;
    }
}

// Search Function
function handleSearch(event) {
    currentSearchTerm = event.target.value.toLowerCase().trim();
    renderNotes(currentSearchTerm);
}

// Main Functions
async function createNewNote() {
    if (isEditorTransitioning) return;
    isEditorTransitioning = true;

    currentNoteId = null;
    noteTitle.value = '';
    noteContent.value = '';
    undoStack = [];
    redoStack = [];
    updateUndoRedoButtons();
    updateNoteStats();
    
    welcomeScreen.style.opacity = '0';
    welcomeScreen.style.transform = 'translateY(20px)';
    await new Promise(resolve => setTimeout(resolve, 300));
    welcomeScreen.classList.add('hidden');
    
    noteEditor.classList.remove('hidden');
    await new Promise(resolve => setTimeout(resolve, 50));
    noteEditor.style.opacity = '1';
    noteEditor.style.transform = 'translateY(0)';
    
    noteTitle.focus();
    isEditorTransitioning = false;
}

async function saveNote() {
    const title = noteTitle.value.trim();
    const content = noteContent.value.trim();
    
    if (!title && !content) return;

    const timestamp = new Date().toISOString();
    const saveButton = saveNoteBtn;
    
    // Animate save button
    saveButton.classList.add('scale-95', 'opacity-70');
    setTimeout(() => saveButton.classList.remove('scale-95', 'opacity-70'), 150);
    
    if (currentNoteId === null) {
        // New note
        const newNote = {
            id: Date.now(),
            title: title || 'Untitled Note',
            content,
            timestamp,
            lastEdited: timestamp
        };
        notes.unshift(newNote);
        currentNoteId = newNote.id;
    } else {
        // Update existing note
        const noteIndex = notes.findIndex(note => note.id === currentNoteId);
        if (noteIndex !== -1) {
            notes[noteIndex] = {
                ...notes[noteIndex],
                title: title || 'Untitled Note',
                content,
                lastEdited: timestamp
            };
        }
    }

    localStorage.setItem('notes', JSON.stringify(notes));
    
    showNotification('Note saved successfully!');

    // Close editor and refresh notes list
    await closeEditor();
    await renderNotes(currentSearchTerm);
}

async function deleteNote(id, event) {
    showDeleteModal(id, event);
}

async function editNote(id) {
    if (isEditorTransitioning) return;
    
    const note = notes.find(note => note.id === id);
    if (!note) return;
    
    currentNoteId = note.id;
    noteTitle.value = note.title;
    noteContent.value = note.content;
    
    // Show editor with animation
    isEditorTransitioning = true;
    welcomeScreen.style.opacity = '0';
    welcomeScreen.style.transform = 'translateY(-20px)';
    
    setTimeout(() => {
        welcomeScreen.classList.add('hidden');
        noteEditor.classList.remove('hidden');
        setTimeout(() => {
            noteEditor.style.opacity = '1';
            noteEditor.style.transform = 'translateY(0)';
            noteContent.focus();
            isEditorTransitioning = false;
            undoStack = [];
            redoStack = [];
            updateUndoRedoButtons();
            updateNoteStats();
        }, 50);
    }, 300);
}

async function closeEditor() {
    if (isEditorTransitioning) return;
    isEditorTransitioning = true;

    noteEditor.style.opacity = '0';
    noteEditor.style.transform = 'translateY(20px)';
    await new Promise(resolve => setTimeout(resolve, 300));
    noteEditor.classList.add('hidden');
    
    // Always show welcome screen when editor is closed
    welcomeScreen.classList.remove('hidden');
    welcomeScreen.style.opacity = '1';
    welcomeScreen.style.transform = 'translateY(0)';
    
    currentNoteId = null;
    noteTitle.value = '';
    noteContent.value = '';
    undoStack = [];
    redoStack = [];
    updateUndoRedoButtons();
    updateNoteStats();
    isEditorTransitioning = false;
}

function filterNotes(searchTerm) {
    if (!searchTerm) return notes;
    return notes.filter(note => 
        note.title.toLowerCase().includes(searchTerm) ||
        note.content.toLowerCase().includes(searchTerm)
    );
}

function formatDate(dateString) {
    const options = { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleDateString('en-US', options);
}

async function renderNotes(searchTerm = '') {
    const filteredNotes = filterNotes(searchTerm);

    if (filteredNotes.length === 0) {
        notesList.innerHTML = searchTerm ? `
            <div class="text-center py-8 text-gray-500">
                <p>No notes found for "${searchTerm}"</p>
            </div>
        ` : '';
    } else {
        notesList.innerHTML = filteredNotes.map(note => `
            <div class="note-item bg-[#2a2a2a] rounded-lg p-3 hover:bg-[#333] transition-all duration-200 cursor-pointer group"
                 data-note-id="${note.id}"
                 onclick="editNote(${note.id})">
                <div class="flex justify-between items-start">
                    <h3 class="text-sm font-medium mb-1 truncate flex-1">${note.title}</h3>
                    <button onclick="showDeleteModal(${note.id}, event)" 
                        class="text-red-500 opacity-0 group-hover:opacity-100 transition-all duration-200 hover:text-red-400 transform hover:scale-110">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
                        </svg>
                    </button>
                </div>
                <p class="text-xs text-gray-500 truncate">${note.content}</p>
                <p class="text-xs text-gray-600 mt-2">${formatDate(note.lastEdited)}</p>
            </div>
        `).join('');

        // Add slide-in animation to notes
        const noteItems = notesList.querySelectorAll('.note-item');
        noteItems.forEach((item, index) => {
            item.style.opacity = '0';
            item.style.transform = 'translateX(20px)';
            setTimeout(() => {
                item.style.opacity = '1';
                item.style.transform = 'translateX(0)';
            }, index * 50);
        });
    }

    // Show welcome screen only if editor is hidden
    if (noteEditor.classList.contains('hidden')) {
        welcomeScreen.classList.remove('hidden');
        welcomeScreen.style.opacity = '1';
        welcomeScreen.style.transform = 'translateY(0)';
    } else {
        welcomeScreen.classList.add('hidden');
    }
}

// Settings Functions
function showSettings() {
    settingsModal.classList.remove('hidden');
    setTimeout(() => settingsModal.classList.add('show'), 10);
    loadSettings();
}

function hideSettings() {
    settingsModal.classList.remove('show');
    setTimeout(() => settingsModal.classList.add('hidden'), 300);
}

function loadSettings() {
    // Load theme
    themeSelect.value = settings.theme;
    
    // Load other settings
    fontSelect.value = settings.font;
    autoSaveToggle.checked = settings.autoSave;
    spellCheckToggle.checked = settings.spellCheck;
    
    // Apply settings
    applyTheme();
    applyFont();
    applySpellCheck();
}

function handleThemeChange() {
    settings.theme = themeSelect.value;
    applyTheme();
    saveSettings();
}

function handleFontChange() {
    settings.font = fontSelect.value;
    applyFont();
    saveSettings();
}

function handleAutoSave() {
    settings.autoSave = autoSaveToggle.checked;
    saveSettings();
}

function handleSpellCheck() {
    settings.spellCheck = spellCheckToggle.checked;
    applySpellCheck();
    saveSettings();
}

function applyTheme() {
    const root = document.documentElement;
    const body = document.body;
    
    if (settings.theme === 'light') {
        body.style.backgroundColor = '#ffffff';
        body.style.color = '#333333';
        root.style.setProperty('--bg-color', '#ffffff');
        root.style.setProperty('--text-color', '#333333');
        root.style.setProperty('--border-color', '#dddddd');
    } else {
        body.style.backgroundColor = '#1a1a1a';
        body.style.color = '#cccccc';
        root.style.setProperty('--bg-color', '#1a1a1a');
        root.style.setProperty('--text-color', '#cccccc');
        root.style.setProperty('--border-color', '#333333');
    }
}

function applyFont() {
    noteContent.style.fontFamily = settings.font;
}

function applySpellCheck() {
    noteContent.spellcheck = settings.spellCheck;
}

function saveSettings() {
    localStorage.setItem('notepad_settings', JSON.stringify(settings));
}

// Initialize settings
loadSettings();

// Initialize
noteEditor.style.opacity = '0';
noteEditor.style.transform = 'translateY(20px)';
welcomeScreen.style.opacity = '1';
welcomeScreen.style.transform = 'translateY(0)';
updateUndoRedoButtons();
noteContent.style.fontSize = `${currentFontSize}px`;
zoomInBtn.disabled = currentFontSize >= MAX_FONT_SIZE;
zoomOutBtn.disabled = currentFontSize <= MIN_FONT_SIZE;
renderNotes();