document.addEventListener('DOMContentLoaded', () => {

    // --- SERVICE WORKER & NOTIFICATIONS ---
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('Service Worker registered', reg))
            .catch(err => console.error('Service Worker registration failed', err));
    }
    const enableNotificationsBtn = document.getElementById('enable-notifications-btn');
    enableNotificationsBtn.addEventListener('click', () => {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                enableNotificationsBtn.textContent = 'Reminders On';
                enableNotificationsBtn.disabled = true;
                showNotification('Reminders Enabled!', 'You will now receive daily reminders.');
            }
        });
    });
    function showNotification(title, body) {
        if (Notification.permission === 'granted') {
            navigator.serviceWorker.ready.then(reg => {
                reg.showNotification(title, {
                    body: body, icon: '/icons/icon-192x192.png',
                    badge: '/icons/icon-192x192.png', vibrate: [200, 100, 200]
                });
            });
        }
    }
    
    // --- THEME (DARK/LIGHT MODE) ---
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const themeMeta = document.getElementById('theme-color-meta');
    let currentTheme = 'dark'; // Global var for chart colors
    function checkTheme() {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'light') {
            document.body.classList.add('light-mode');
            themeToggleBtn.textContent = '🌙';
            themeMeta.content = '#ffffff';
            currentTheme = 'light';
        } else {
            document.body.classList.remove('light-mode');
            themeToggleBtn.textContent = '☀️';
            themeMeta.content = '#1e1e1e';
            currentTheme = 'dark';
        }
    }
    themeToggleBtn.addEventListener('click', () => {
        document.body.classList.toggle('light-mode');
        if (document.body.classList.contains('light-mode')) {
            localStorage.setItem('theme', 'light');
            themeToggleBtn.textContent = '🌙';
            themeMeta.content = '#ffffff';
            currentTheme = 'light';
        } else {
            localStorage.setItem('theme', 'dark');
            themeToggleBtn.textContent = '☀️';
            themeMeta.content = '#1e1e1e';
            currentTheme = 'dark';
        }
        renderStats(); // Re-render stats for chart color update
    });

    // --- REVISION LOGIC ---
    const REVISION_SCHEDULE = [1, 3, 7, 14, 30, 60]; 
    function getISODate(dateObj) {
        return dateObj.toISOString().split('T')[0];
    }
    function calculateNextRevisionDate(lastRevisedDateStr, revisionLevel) {
        const lastDate = new Date(lastRevisedDateStr.replace(/-/g, '/'));
        const daysToAdd = REVISION_SCHEDULE[Math.min(revisionLevel, REVISION_SCHEDULE.length - 1)];
        lastDate.setDate(lastDate.getDate() + daysToAdd);
        return getISODate(lastDate);
    }

    // --- IndexedDB SETUP ---
    const DB_NAME = 'RevisionAppDB';
    const DB_VERSION = 1;
    let db;
    async function initDB() {
        db = await idb.openDB(DB_NAME, DB_VERSION, {
            upgrade(db) {
                if (!db.objectStoreNames.contains('subjects')) {
                    db.createObjectStore('subjects', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'key' });
                }
                if (!db.objectStoreNames.contains('stats')) {
                    db.createObjectStore('stats', { keyPath: 'date' });
                }
            },
        });
        console.log("Database initialized");
    }

    // --- DASHBOARD & STATS ---
    const totalRevisionsEl = document.getElementById('stat-total-revisions');
    const currentStreakEl = document.getElementById('stat-current-streak');
    const completionChartTextEl = document.getElementById('completion-chart-text');
    let overallChart, revisionChart; // Store chart instances

    async function renderStats() {
        const stats = await db.getAll('stats');
        const subjects = await db.getAll('subjects');

        // 1. Calculate & Render Text Stats
        totalRevisionsEl.textContent = stats.length;
        currentStreakEl.textContent = calculateStreak(stats);

        // 2. Calculate Completion
        let totalTopics = 0;
        let completedTopics = 0;
        subjects.forEach(subject => {
            totalTopics += subject.topics.length;
            subject.topics.forEach(topic => {
                if (topic.isComplete) completedTopics++;
            });
        });
        const completionPercent = (totalTopics === 0) ? 0 : Math.round((completedTopics / totalTopics) * 100);
        
        // 3. Calculate Revision History (Last 7 days)
        const history = calculateRevisionHistory(stats);

        // 4. Render Charts
        renderCompletionChart(completionPercent);
        renderRevisionChart(history.labels, history.data);
    }
    
    function renderCompletionChart(percent) {
        const ctx = document.getElementById('overall-completion-chart').getContext('2d');
        const chartTextColor = (currentTheme === 'light') ? '#1c1c1e' : '#f0f0f0';
        const chartTrackColor = (currentTheme === 'light') ? '#dcdcdc' : '#3a3a3c';

        completionChartTextEl.textContent = `${percent}%`;

        if (overallChart) {
            overallChart.destroy(); // Destroy old chart before re-drawing
        }
        overallChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                datasets: [{
                    data: [percent, 100 - percent],
                    backgroundColor: ['#34c759', chartTrackColor],
                    borderWidth: 0,
                    borderRadius: 5,
                }]
            },
            options: {
                responsive: true,
                cutout: '75%',
                plugins: {
                    legend: { display: false },
                    tooltip: { enabled: false }
                },
                animation: {
                    animateScale: true,
                    animateRotate: true
                }
            }
        });
    }

    function renderRevisionChart(labels, data) {
        const ctx = document.getElementById('revision-history-chart').getContext('2d');
        const chartGridColor = (currentTheme === 'light') ? '#dcdcdc' : '#3a3a3c';
        const chartLabelColor = (currentTheme === 'light') ? '#6a6a6a' : '#8e8e93';

        if (revisionChart) {
            revisionChart.destroy(); // Destroy old chart
        }
        revisionChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Revisions',
                    data: data,
                    backgroundColor: 'rgba(0, 122, 255, 0.1)',
                    borderColor: '#007aff',
                    borderWidth: 2,
                    tension: 0.3,
                    fill: true,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { 
                            color: chartLabelColor,
                            precision: 0 // No decimal points
                        },
                        grid: { color: chartGridColor }
                    },
                    x: {
                        ticks: { color: chartLabelColor },
                        grid: { display: false }
                    }
                }
            }
        });
    }

    function calculateRevisionHistory(stats) {
        let labels = [];
        let data = [0, 0, 0, 0, 0, 0, 0]; // 7 days
        let day = new Date();
        
        for (let i = 6; i >= 0; i--) {
            // Get date string for the last 7 days
            let date = new Date(day.getFullYear(), day.getMonth(), day.getDate() - i);
            let dateString = getISODate(date);
            
            // Set labels (e.g., "Today", "Yest.", "Mon")
            if (i === 0) labels.push('Today');
            else if (i === 1) labels.push('Yest.');
            else labels.push(date.toLocaleDateString('en-US', { weekday: 'short' }));
            
            // Find stats for this date
            const stat = stats.find(s => s.date === dateString);
            if (stat) {
                // Note: Our current stat logic only adds one entry per day
                // To count *all* revisions, we'd need to store stats differently
                // For now, we'll just log "1" if a revision happened that day
                data[6 - i] = 1; // This shows *days* of activity, not total revisions
            }
        }
        // A more advanced stat store would track total revisions per day
        // For now, this shows a simple activity streak
        return { labels, data };
    }

    function calculateStreak(stats) {
        if (stats.length === 0) return 0;
        const dates = stats.map(s => s.date).sort().reverse();
        let streak = 0;
        let today = new Date();
        let yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);
        const mostRecentDate = new Date(dates[0].replace(/-/g, '/'));
        if (getISODate(today) === dates[0] || getISODate(yesterday) === dates[0]) {
            streak = 1;
            let lastDate = mostRecentDate;
            for (let i = 1; i < dates.length; i++) {
                let currentDate = new Date(dates[i].replace(/-/g, '/'));
                let expectedDate = new Date(lastDate);
                expectedDate.setDate(lastDate.getDate() - 1);
                if (getISODate(currentDate) === getISODate(expectedDate)) {
                    streak++;
                    lastDate = currentDate;
                } else if (getISODate(currentDate) !== getISODate(lastDate)) {
                    break;
                }
            }
        }
        return streak;
    }

    async function addCompletionStat() {
        const today = getISODate(new Date());
        try {
            await db.put('stats', { date: today });
        } catch (e) {
            console.warn('Stat for today already exists.', e);
        }
    }


    // --- UI RENDERING (Async) ---
    const subjectsContainer = document.getElementById('subjects-container');
    const todayRevisionsList = document.getElementById('today-revisions-list');

    async function renderUI() {
        const subjects = await db.getAll('subjects');
        subjectsContainer.innerHTML = ''; 
        const today = new Date();
        today.setHours(0, 0, 0, 0); 
        let todayRevisions = [];

        subjects.forEach(subject => {
            const subjectCard = document.createElement('div');
            subjectCard.className = 'subject-card';
            
            let totalTopics = subject.topics.length;
            let completedTopics = 0;
            subject.topics.forEach(topic => {
                if (topic.isComplete) completedTopics++;
            });
            const subjectPercent = (totalTopics === 0) ? 0 : Math.round((completedTopics / totalTopics) * 100);

            let topicListHTML = '';
            subject.topics.forEach((topic) => {
                const nextRevisionDate = new Date(topic.nextRevisionDate.replace(/-/g, '/'));
                nextRevisionDate.setHours(0,0,0,0);
                const isDue = nextRevisionDate <= today;
                
                if (isDue) {
                    todayRevisions.push({ subject: subject.name, topic: topic.name });
                }

                topicListHTML += `
                    <div class="topic-item">
                        <div class="topic-info">
                            <input 
                                type="checkbox" 
                                class="topic-complete-checkbox" 
                                data-subject-id="${subject.id}" 
                                data-topic-id="${topic.id}"
                                ${topic.isComplete ? 'checked' : ''}
                            >
                            <div>
                                <strong>${topic.name}</strong>
                                <span class="${isDue ? 'due' : ''}">
                                    Next Revision: ${topic.nextRevisionDate} (Level ${topic.revisionLevel})
                                </span>
                            </div>
                        </div>
                        <div class="topic-actions">
                            <button class="revise-btn" data-subject-id="${subject.id}" data-topic-id="${topic.id}">Revise Now</button>
                            <button class="delete-btn" data-subject-id="${subject.id}" data-topic-id="${topic.id}">Delete</button>
                        </div>
                    </div>
                `;
            });

            subjectCard.innerHTML = `
                <h2>
                    <span>${subject.name}</span>
                    <span class="subject-percentage">${subjectPercent}%</span>
                    <button class="delete-btn delete-subject-btn" data-subject-id="${subject.id}">Delete</button>
                </h2>
                <div class="topic-list">
                    ${topicListHTML || '<p>No topics added yet.</p>'}
                </div>
                <div class="form-group add-topic-form">
                    <input type="text" class="add-topic-name" placeholder="New topic name">
                    <input type="date" class="add-topic-date" title="Set start/revised date" value="${getISODate(new Date())}">
                    <button class="add-topic-btn" data-subject-id="${subject.id}">Add Topic</button>
                </div>
            `;
            const deleteBtn = subjectCard.querySelector('.delete-subject-btn');
            deleteBtn.addEventListener('click', handleDeleteSubject);
            subjectsContainer.appendChild(subjectCard);
        });
        renderTodayRevisions(todayRevisions);
    }

    function renderTodayRevisions(revisions) {
        todayRevisionsList.innerHTML = '';
        if (revisions.length === 0) {
            todayRevisionsList.innerHTML = '<li>All caught up! 🎉</li>';
            return;
        }
        revisions.forEach(rev => {
            const li = document.createElement('li');
            li.innerHTML = `${rev.topic} <span>(from ${rev.subject})</span>`;
            todayRevisionsList.appendChild(li);
        });
    }

    async function checkDailyReminders() {
        const subjects = await db.getAll('subjects');
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let dueCount = 0;
        subjects.forEach(subject => {
            subject.topics.forEach(topic => {
                const nextRevisionDate = new Date(topic.nextRevisionDate.replace(/-/g, '/'));
                nextRevisionDate.setHours(0,0,0,0);
                if (nextRevisionDate <= today) {
                    dueCount++;
                }
            });
        });

        if (dueCount > 0) {
            showNotification(
                'Revisions Due!',
                `You have ${dueCount} topic(s) to revise today.`
            );
        }
    }

    // --- EVENT LISTENERS (Async CRUD) ---
    document.getElementById('add-subject-btn').addEventListener('click', async () => {
        const subjectNameInput = document.getElementById('subject-name-input');
        const subjectName = subjectNameInput.value.trim();
        if (subjectName) {
            const newSubject = { id: Date.now(), name: subjectName, topics: [] };
            await db.add('subjects', newSubject);
            await renderUI();
            subjectNameInput.value = '';
        }
    });

    async function handleDeleteSubject(e) {
        const subjectId = parseInt(e.target.dataset.subjectId);
        const subject = await db.get('subjects', subjectId);
        if (confirm(`Are you sure you want to delete "${subject.name}" and all its topics?`)) {
            await db.delete('subjects', subjectId);
            await renderUI();
            await renderStats(); // Update stats
        }
    }

    subjectsContainer.addEventListener('click', async (e) => {
        const target = e.target;
        const subjectId = parseInt(target.dataset.subjectId);
        if (!subjectId) return;

        // Add Topic
        if (target.classList.contains('add-topic-btn')) {
            const topicNameInput = target.previousElementSibling.previousElementSibling;
            const topicDateInput = target.previousElementSibling;
            const topicName = topicNameInput.value.trim();
            const lastRevisedDate = topicDateInput.value; 
            if (topicName && lastRevisedDate) {
                const newTopic = {
                    id: Date.now(), name: topicName,
                    lastRevised: lastRevisedDate, revisionLevel: 0,
                    nextRevisionDate: calculateNextRevisionDate(lastRevisedDate, 0),
                    isComplete: false 
                };
                const subject = await db.get('subjects', subjectId);
                subject.topics.push(newTopic);
                await db.put('subjects', subject);
                await renderUI();
                await renderStats();
            }
        }
        
        // Handle Checkbox Click
        if (target.classList.contains('topic-complete-checkbox')) {
            const topicId = parseInt(target.dataset.topicId);
            const subject = await db.get('subjects', subjectId);
            const topicIndex = subject.topics.findIndex(t => t.id === topicId);
            if (topicIndex > -1) {
                subject.topics[topicIndex].isComplete = target.checked;
                await db.put('subjects', subject);
                await renderUI(); 
                await renderStats(); 
            }
        }

        const topicId = parseInt(target.dataset.topicId);
        if (!topicId) return;
        
        // Revise Topic
        if (target.classList.contains('revise-btn')) {
            const subject = await db.get('subjects', subjectId);
            const topicIndex = subject.topics.findIndex(t => t.id === topicId);
            if (topicIndex > -1) {
                let topic = subject.topics[topicIndex];
                topic.lastRevised = getISODate(new Date());
                topic.revisionLevel += 1;
                topic.nextRevisionDate = calculateNextRevisionDate(topic.lastRevised, topic.revisionLevel);
                topic.isComplete = true;
                await db.put('subjects', subject);
                await addCompletionStat(); 
                await renderUI();
                await renderStats(); 
            }
        }

        // Delete Topic
        if (target.classList.contains('delete-btn') && !target.classList.contains('delete-subject-btn')) {
            if (confirm(`Are you sure you want to delete this topic?`)) {
                const subject = await db.get('subjects', subjectId);
                subject.topics = subject.topics.filter(t => t.id !== topicId);
                await db.put('subjects', subject);
                await renderUI();
                await renderStats();
            }
        }
    });

    // --- POMODORO TIMER ---
    const timerDisplay = document.getElementById('timer-display');
    const startPauseBtn = document.getElementById('start-pause-btn');
    const resetBtn = document.getElementById('reset-btn');
    const timerStatus = document.getElementById('timer-status');
    const pomodoroFocusOverlay = document.getElementById('pomodoro-focus-overlay');
    const focusTimerDisplay = document.getElementById('focus-timer-display');
    const focusTimerStatus = document.getElementById('focus-timer-status');
    const exitFocusBtn = document.getElementById('exit-focus-btn');
    let pomodoroConfig = { work: 25, break: 5 };
    let timerInterval = null;
    let isPaused = true;
    let isWorkSession = true;
    let isInFocusMode = false;
    let timeLeft = pomodoroConfig.work * 60;
    const alarm = new Audio('/audio/alarm.mp3');
    alarm.loop = true;

    function stopAlarm() { alarm.pause(); alarm.currentTime = 0; }
    function updateTimerDisplay() {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        const timeString = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        timerDisplay.textContent = timeString;
        focusTimerDisplay.textContent = timeString;
    }
    function enterFocusMode() {
        isInFocusMode = true;
        document.body.classList.add('content-hidden');
        pomodoroFocusOverlay.style.display = 'flex';
        const newStatus = isWorkSession ? 'Time to Work!' : 'Time for a Break!';
        focusTimerStatus.textContent = newStatus;
    }
    function exitFocusMode() {
        isInFocusMode = false;
        document.body.classList.remove('content-hidden');
        pomodoroFocusOverlay.style.display = 'none';
        stopAlarm();
    }
    function startTimer() {
        stopAlarm();
        isPaused = false;
        startPauseBtn.textContent = 'Pause';
        if (!isInFocusMode) enterFocusMode();
        timerInterval = setInterval(() => {
            timeLeft--;
            updateTimerDisplay();
            if (timeLeft < 0) {
                clearInterval(timerInterval);
                alarm.play();
                isWorkSession = !isWorkSession;
                timeLeft = (isWorkSession ? pomodoroConfig.work : pomodoroConfig.break) * 60;
                const newStatus = isWorkSession ? 'Time to Work!' : 'Time for a Break!';
                timerStatus.textContent = newStatus;
                focusTimerStatus.textContent = newStatus;
                startPauseBtn.textContent = 'Start';
                isPaused = true;
                updateTimerDisplay();
            }
        }, 1000);
    }
    function pauseTimer() {
        isPaused = true;
        startPauseBtn.textContent = 'Start';
        clearInterval(timerInterval);
    }
    function resetTimer() {
        stopAlarm();
        clearInterval(timerInterval);
        isPaused = true;
        isWorkSession = true;
        timeLeft = pomodoroConfig.work * 60; 
        updateTimerDisplay();
        timerStatus.textContent = 'Time to Work!';
        startPauseBtn.textContent = 'Start';
        if (isInFocusMode) exitFocusMode();
    }
    startPauseBtn.addEventListener('click', () => { (isPaused) ? startTimer() : pauseTimer(); });
    resetBtn.addEventListener('click', resetTimer);
    pomodoroFocusOverlay.addEventListener('click', (e) => {
        if (e.target.id === 'exit-focus-btn') return; 
        (isPaused) ? startTimer() : pauseTimer();
    });
    exitFocusBtn.addEventListener('click', () => { pauseTimer(); exitFocusMode(); });

    // --- SETTINGS LOGIC ---
    const workMinutesInput = document.getElementById('work-minutes-input');
    const breakMinutesInput = document.getElementById('break-minutes-input');
    const saveSettingsBtn = document.getElementById('save-settings-btn');

    async function loadSettings() {
        let settings = await db.get('settings', 'pomodoro');
        if (!settings) {
            settings = { key: 'pomodoro', work: 25, break: 5 };
            await db.put('settings', settings);
        }
        pomodoroConfig.work = settings.work;
        pomodoroConfig.break = settings.break;
        workMinutesInput.value = settings.work;
        breakMinutesInput.value = settings.break;
        if (isPaused) {
            timeLeft = pomodoroConfig.work * 60;
            updateTimerDisplay();
        }
    }
    saveSettingsBtn.addEventListener('click', async () => {
        const newWork = parseInt(workMinutesInput.value);
        const newBreak = parseInt(breakMinutesInput.value);
        if (newWork > 0 && newBreak > 0) {
            pomodoroConfig.work = newWork;
            pomodoroConfig.break = newBreak;
            await db.put('settings', { key: 'pomodoro', work: newWork, break: newBreak });
            resetTimer(); 
            alert('Settings saved!');
        } else {
            alert('Please enter valid numbers greater than 0.');
        }
    });

    // --- INITIALIZATION ---
    async function init() {
        checkTheme();
        await initDB();
        await loadSettings();
        await renderStats();
        await renderUI();
        await checkDailyReminders();
    }

    init();
});
