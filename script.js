"use strict";

// --- State Management ---
const STORAGE_KEY = "FocusGridData";

// Default state structure used if no data is found in localStorage
const defaultData = {
    tasks: [],
    habits: [],
    weeklyPlanner: { Mon: [], Tue: [], Wed: [], Thu: [], Fri: [], Sat: [], Sun: [] },
    theme: "light",
    lastActiveDate: getTodayString()
};

let appData = loadData();

/**
 * Loads the application data from the browser's localStorage.
 * If data exists, it parses the JSON and merges it with the defaultData
 * to ensure all required fields are present, even for returning users.
 * @returns {Object} The application data state
 */
function loadData() {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (data) {
            const parsed = JSON.parse(data);
            return { ...defaultData, ...parsed, weeklyPlanner: { ...defaultData.weeklyPlanner, ...(parsed.weeklyPlanner || {}) } };
        }
    } catch (e) {
        console.error("Failed to parse localStorage data", e);
    }
    return defaultData;
}

/**
 * Serializes the current application state (appData) into JSON and
 * saves it to localStorage. It also triggers a progress bar update
 * because saving usually implies a state change (like a task being checked).
 */
function saveData() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
        updateProgress();
    } catch (e) {
        console.error("Failed to save to localStorage", e);
    }
}

function getTodayString() {
    return new Date().toISOString().split('T')[0];
}

/**
 * Generates a unique identifier for new tasks and habits.
 * Uses the secure crypto API if available, otherwise falls back to a math-based random string.
 * @returns {string} A unique ID string
 */
function generateId() {
    return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// --- Daily Reset Logic ---
/**
 * Checks if the user is logging in on a new day compared to their last active date.
 * If a new day has started, it resets daily habit checkboxes and breaks streaks
 * for habits that were not completed the day before.
 */
function checkDailyReset() {
    const today = getTodayString();
    if (appData.lastActiveDate !== today) {
        // It's a new day!
        
        // Reset Habit Daily Status and Check Streaks
        appData.habits.forEach(habit => {
            if (!habit.completedToday) {
                // If it wasn't completed yesterday, streak breaks
                // Note: To be perfectly accurate, we should check if difference > 1 day
                // For simplicity, we assume login everyday or it breaks.
                habit.streak = 0;
            }
            habit.completedToday = false;
        });

        // Optionally, one could clear completed daily tasks here
        // appData.tasks = appData.tasks.filter(t => !t.completed);

        appData.lastActiveDate = today;
        saveData();
    }
}

// --- DOM Elements ---
const themeToggle = document.getElementById('theme-toggle');
const taskForm = document.getElementById('task-form');
const taskInput = document.getElementById('task-input');
const taskList = document.getElementById('task-list');
const taskFilterBtns = document.querySelectorAll('.filter-btn');

const habitForm = document.getElementById('habit-form');
const habitInput = document.getElementById('habit-input');
const habitList = document.getElementById('habit-list');

const progressBar = document.getElementById('progress-bar');
const progressPercentage = document.getElementById('progress-percentage');
const dailyQuote = document.getElementById('daily-quote');

const addDayTaskBtns = document.querySelectorAll('.add-day-task');
const weeklyModal = document.getElementById('weekly-modal');
const closeModalBtn = document.getElementById('close-modal');
const weeklyForm = document.getElementById('weekly-form');
const weeklyInput = document.getElementById('weekly-input');
const modalDayLabel = document.getElementById('modal-day-label');

let currentFilter = 'all'; // all, pending, completed
let activeModalDay = null;

// --- Quotes ---
const quotes = [
    "The secret of getting ahead is getting started.",
    "Don't watch the clock; do what it does. Keep going.",
    "Focus on being productive instead of busy.",
    "Small daily improvements lead to stunning results.",
    "You don't have to see the whole staircase, just take the first step.",
    "Your future is created by what you do today, not tomorrow."
];

// --- Initialization ---
function init() {
    checkDailyReset();
    applyTheme(appData.theme);
    
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }

    // Only run dashboard-specific init if dashboard elements exist
    if (taskList && habitList) {
        setRandomQuote();
        renderTasks();
        renderHabits();
        renderWeeklyPlanner();
        updateProgress();
        setupDashboardEventListeners();
    }
}

function setRandomQuote() {
    if (dailyQuote) {
        const quote = quotes[Math.floor(Math.random() * quotes.length)];
        dailyQuote.textContent = quote;
    }
}

// --- Theming ---
function applyTheme(theme) {
    if (theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        if (themeToggle) themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
    } else {
        document.documentElement.removeAttribute('data-theme');
        if (themeToggle) themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
    }
}

function toggleTheme() {
    appData.theme = appData.theme === 'light' ? 'dark' : 'light';
    applyTheme(appData.theme);
    saveData();
}

// --- UI Utilities ---
/**
 * A security utility function to safely create DOM elements and attach classes/text.
 * This ensures we never use innerHTML with user input, preventing Cross-Site Scripting (XSS).
 * @param {string} tag - The HTML tag to create (e.g., 'div', 'span')
 * @param {Array} classNames - Array of CSS class strings
 * @param {string} textContent - Safe text content to inject
 * @returns {HTMLElement} The created DOM element
 */
function createSafeElement(tag, classNames = [], textContent = '') {
    const el = document.createElement(tag);
    if (classNames.length) el.classList.add(...classNames);
    if (textContent) el.textContent = textContent;
    return el;
}

// --- Task Tracker ---
/**
 * Renders the task list to the DOM based on the currently selected filter
 * (All, Pending, Completed). Safely creates DOM elements for each task.
 */
function renderTasks() {
    if (!taskList) return;
    taskList.innerHTML = '';
    
    let filteredTasks = appData.tasks;
    if (currentFilter === 'pending') {
        filteredTasks = appData.tasks.filter(t => !t.completed);
    } else if (currentFilter === 'completed') {
        filteredTasks = appData.tasks.filter(t => t.completed);
    }

    if (filteredTasks.length === 0) {
        taskList.appendChild(createSafeElement('p', ['empty-state'], 'No tasks found.'));
        return;
    }

    filteredTasks.forEach(task => {
        const li = createSafeElement('li', ['list-item']);
        if (task.completed) li.classList.add('completed');

        const contentDiv = createSafeElement('div', ['item-content']);
        
        const checkbox = createSafeElement('input', ['custom-checkbox']);
        checkbox.type = 'checkbox';
        checkbox.checked = task.completed;
        checkbox.addEventListener('change', () => toggleTask(task.id));

        const span = createSafeElement('span', ['item-text'], task.text);
        
        contentDiv.appendChild(checkbox);
        contentDiv.appendChild(span);

        const deleteBtn = createSafeElement('button', ['delete-btn']);
        deleteBtn.innerHTML = '<i class="fas fa-trash"></i>'; // Safe as it's static icon
        deleteBtn.setAttribute('aria-label', 'Delete task');
        deleteBtn.addEventListener('click', () => deleteTask(task.id));

        li.appendChild(contentDiv);
        li.appendChild(deleteBtn);
        taskList.appendChild(li);
    });
}

function addTask(text) {
    if (!text.trim()) return;
    const newTask = {
        id: generateId(),
        text: text.trim(),
        completed: false,
        createdAt: Date.now()
    };
    appData.tasks.push(newTask);
    saveData();
    renderTasks();
}

function toggleTask(id) {
    const task = appData.tasks.find(t => t.id === id);
    if (task) {
        task.completed = !task.completed;
        saveData();
        renderTasks();
    }
}

function deleteTask(id) {
    appData.tasks = appData.tasks.filter(t => t.id !== id);
    saveData();
    renderTasks();
}

// --- Habit Tracker ---
/**
 * Renders the habit list to the DOM. Displays the habit name, a checkbox for
 * daily completion, and a dynamic streak badge (🔥) that tracks consecutive days.
 */
function renderHabits() {
    if (!habitList) return;
    habitList.innerHTML = '';

    if (appData.habits.length === 0) {
        habitList.appendChild(createSafeElement('p', ['empty-state'], 'No habits added yet.'));
        return;
    }

    appData.habits.forEach(habit => {
        const li = createSafeElement('li', ['list-item']);
        if (habit.completedToday) li.classList.add('completed');

        const contentDiv = createSafeElement('div', ['item-content']);
        
        const checkbox = createSafeElement('input', ['custom-checkbox']);
        checkbox.type = 'checkbox';
        checkbox.checked = habit.completedToday;
        checkbox.addEventListener('change', () => toggleHabit(habit.id));

        const span = createSafeElement('span', ['item-text'], habit.name);
        
        contentDiv.appendChild(checkbox);
        contentDiv.appendChild(span);

        const actionDiv = document.createElement('div');
        actionDiv.style.display = 'flex';
        actionDiv.style.alignItems = 'center';
        actionDiv.style.gap = '0.5rem';

        const streakBadge = createSafeElement('span', ['streak-badge']);
        streakBadge.innerHTML = `<i class="fas fa-fire"></i> ${habit.streak}`;

        const deleteBtn = createSafeElement('button', ['delete-btn']);
        deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
        deleteBtn.setAttribute('aria-label', 'Delete habit');
        deleteBtn.addEventListener('click', () => deleteHabit(habit.id));

        actionDiv.appendChild(streakBadge);
        actionDiv.appendChild(deleteBtn);

        li.appendChild(contentDiv);
        li.appendChild(actionDiv);
        habitList.appendChild(li);
    });
}

function addHabit(name) {
    if (!name.trim()) return;
    const newHabit = {
        id: generateId(),
        name: name.trim(),
        streak: 0,
        completedToday: false,
        createdAt: Date.now()
    };
    appData.habits.push(newHabit);
    saveData();
    renderHabits();
}

function toggleHabit(id) {
    const habit = appData.habits.find(h => h.id === id);
    if (habit) {
        habit.completedToday = !habit.completedToday;
        if (habit.completedToday) {
            habit.streak += 1;
        } else {
            habit.streak = Math.max(0, habit.streak - 1);
        }
        saveData();
        renderHabits();
    }
}

function deleteHabit(id) {
    appData.habits = appData.habits.filter(h => h.id !== id);
    saveData();
    renderHabits();
}

// --- Weekly Planner ---
/**
 * Renders the 7-day weekly planner grid.
 * Iterates through each day and renders any tasks assigned to that specific day.
 */
function renderWeeklyPlanner() {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    
    days.forEach(day => {
        const dayCol = document.querySelector(`.day-col[data-day="${day}"] .day-tasks`);
        if (!dayCol) return;
        
        dayCol.innerHTML = '';
        const tasks = appData.weeklyPlanner[day] || [];
        
        tasks.forEach(task => {
            const li = createSafeElement('li', ['weekly-task-item']);
            if (task.completed) li.classList.add('completed');

            const checkbox = createSafeElement('input', ['custom-checkbox']);
            checkbox.type = 'checkbox';
            checkbox.checked = task.completed;
            checkbox.addEventListener('change', () => toggleWeeklyTask(day, task.id));

            const span = createSafeElement('span', ['item-text'], task.text);
            if(task.completed) {
                span.style.textDecoration = 'line-through';
                span.style.color = 'var(--text-muted)';
            }

            const deleteBtn = createSafeElement('button', ['delete-btn']);
            deleteBtn.style.padding = '0.2rem';
            deleteBtn.innerHTML = '<i class="fas fa-times"></i>';
            deleteBtn.addEventListener('click', () => deleteWeeklyTask(day, task.id));

            li.appendChild(checkbox);
            li.appendChild(span);
            li.appendChild(deleteBtn);
            
            dayCol.appendChild(li);
        });
    });
}

function addWeeklyTask(day, text) {
    if (!text.trim()) return;
    if (!appData.weeklyPlanner[day]) appData.weeklyPlanner[day] = [];
    
    appData.weeklyPlanner[day].push({
        id: generateId(),
        text: text.trim(),
        completed: false
    });
    
    saveData();
    renderWeeklyPlanner();
}

function toggleWeeklyTask(day, id) {
    const task = appData.weeklyPlanner[day].find(t => t.id === id);
    if (task) {
        task.completed = !task.completed;
        saveData();
        renderWeeklyPlanner();
    }
}

function deleteWeeklyTask(day, id) {
    appData.weeklyPlanner[day] = appData.weeklyPlanner[day].filter(t => t.id !== id);
    saveData();
    renderWeeklyPlanner();
}

function openModal(day) {
    if (!weeklyModal) return;
    activeModalDay = day;
    modalDayLabel.textContent = day;
    weeklyInput.value = '';
    weeklyModal.classList.add('active');
    weeklyInput.focus();
}

function closeModal() {
    if (!weeklyModal) return;
    weeklyModal.classList.remove('active');
    activeModalDay = null;
}

// --- Progress Dashboard ---
/**
 * Calculates the total daily progress percentage by adding all tasks and habits,
 * and comparing them against the number of completed items.
 * Updates the visual progress bar width and the percentage text dynamically.
 */
function updateProgress() {
    if (!progressPercentage || !progressBar) return;
    
    let totalItems = appData.tasks.length + appData.habits.length;
    let completedItems = 0;

    completedItems += appData.tasks.filter(t => t.completed).length;
    completedItems += appData.habits.filter(h => h.completedToday).length;

    let percentage = 0;
    if (totalItems > 0) {
        percentage = Math.round((completedItems / totalItems) * 100);
    }

    progressPercentage.textContent = `${percentage}%`;
    progressBar.style.width = `${percentage}%`;
}

// --- Event Listeners ---
function setupDashboardEventListeners() {
    // Tasks
    if (taskForm) {
        taskForm.addEventListener('submit', (e) => {
            e.preventDefault();
            addTask(taskInput.value);
            taskInput.value = '';
        });
    }

    if (taskFilterBtns) {
        taskFilterBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                taskFilterBtns.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                currentFilter = e.target.dataset.filter;
                renderTasks();
            });
        });
    }

    // Habits
    if (habitForm) {
        habitForm.addEventListener('submit', (e) => {
            e.preventDefault();
            addHabit(habitInput.value);
            habitInput.value = '';
        });
    }

    // Weekly Planner
    if (addDayTaskBtns) {
        addDayTaskBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const day = e.target.closest('.day-col').dataset.day;
                openModal(day);
            });
        });
    }

    if (weeklyForm) {
        weeklyForm.addEventListener('submit', (e) => {
            e.preventDefault();
            if (activeModalDay) {
                addWeeklyTask(activeModalDay, weeklyInput.value);
                closeModal();
            }
        });
    }

    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', closeModal);
    }
    
    // Close modal on outside click
    if (weeklyModal) {
        weeklyModal.addEventListener('click', (e) => {
            if (e.target === weeklyModal) {
                closeModal();
            }
        });
    }
}

// Start the app
document.addEventListener('DOMContentLoaded', init);

// --- Disable Inspect Element ---
document.addEventListener('contextmenu', function(e) {
    e.preventDefault();
});

document.addEventListener('keydown', function(e) {
    // Prevent F12
    if (e.key === 'F12') {
        e.preventDefault();
    }
    // Prevent Ctrl+Shift+I (Inspect) and Ctrl+Shift+J (Console) and Ctrl+U (View Source)
    if (e.ctrlKey && (e.key === 'u' || e.key === 'U')) {
        e.preventDefault();
    }
    if (e.ctrlKey && e.shiftKey && (e.key === 'i' || e.key === 'I' || e.key === 'j' || e.key === 'J' || e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
    }
});
