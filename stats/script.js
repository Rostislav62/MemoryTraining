let cards = { single_digits: [], double_digits: [] };
let currentCardIndex = 0;
let currentCards = [];
let isMemorizationMode = true;
let isAutoPlay = false;
let autoPlayTimeout = null;
let answerTimeout = null;
let selectedLetter = null;
let selectedWord = null;
let stats = {
    correct: 0,
    incorrect: 0,
    timeout: 0,
    attempts: [],
    history: JSON.parse(localStorage.getItem('statsHistory')) || []
};
let streak = 0;
let timerInterval = null;
let currentLanguage = localStorage.getItem('language') || 'ru';

function loadLanguage() {
    console.log('Loading language:', currentLanguage);
    fetch(`../i18n/${currentLanguage}.json`)
        .then(response => {
            if (!response.ok) throw new Error(`Failed to load translations: ../i18n/${currentLanguage}.json`);
            return response.json();
        })
        .then(translations => {
            const elements = document.querySelectorAll('[data-i18n]');
            elements.forEach(element => {
                const key = element.getAttribute('data-i18n');
                // Пропускаем theme-button, language-text и элементы без перевода
                if (element.id !== 'theme-button' && element.id !== 'language-text' && translations[key]) {
                    element.textContent = translations[key];
                }
            });
            const modeTitle = document.getElementById('mode-title');
            const modeButton = document.getElementById('mode-button');
            const autoButton = document.getElementById('auto-button');
            if (modeTitle) modeTitle.textContent = translations[isMemorizationMode ? 'training' : 'testing'] || 'Training';
            if (modeButton) modeButton.title = translations[isMemorizationMode ? 'switch_to_testing' : 'switch_to_training'] || 'Switch Mode';
            if (autoButton) autoButton.title = translations[isAutoPlay ? 'stop_autoplay' : 'start_autoplay'] || 'Auto-play';
        })
        .catch(error => {
            console.error('Error loading translations:', error);
            const cardDigit = document.getElementById('card-digit');
            if (cardDigit) cardDigit.textContent = 'Error loading translations';
        });
    fetch(`../Flashcards/cards_${currentLanguage}.json`)
        .then(response => {
            if (!response.ok) throw new Error(`Failed to load cards: ../Flashcards/cards_${currentLanguage}.json`);
            return response.json();
        })
        .then(data => {
            cards = data;
            const savedSettings = JSON.parse(localStorage.getItem('settings')) || {
                rangeStart: 0,
                rangeEnd: 9,
                order: 'sequential',
                displayTime: 2000,
                answerTime: 5000
            };
            currentCards = cards.single_digits.slice(savedSettings.rangeStart, savedSettings.rangeEnd + 1);
            if (savedSettings.order === 'random') {
                currentCards = currentCards.sort(() => Math.random() - 0.5);
            }
            currentCardIndex = 0;
            updateStatsDisplay();
            loadTheme();
            showCard();
        })
        .catch(error => {
            console.error('Error loading cards:', error);
            const cardDigit = document.getElementById('card-digit');
            if (cardDigit) cardDigit.textContent = 'Error loading data';
        });
}

function updateRange() {
    const start = parseInt(document.getElementById('range-start')?.value || 0);
    const end = parseInt(document.getElementById('range-end')?.value || 9);
    const order = document.querySelector('input[name="order"]:checked')?.value || 'sequential';
    const displayTime = parseInt(document.getElementById('delay-select')?.value || 2000);
    const answerTime = parseInt(document.getElementById('answer-time-select')?.value || 5000);

    localStorage.setItem('settings', JSON.stringify({
        rangeStart: start,
        rangeEnd: end,
        order: order,
        displayTime: displayTime,
        answerTime: answerTime
    }));

    currentCards = [];
    if (start <= 9 && end <= 9) {
        currentCards = cards.single_digits.slice(start, end + 1);
    } else {
        const singleDigits = start <= 9 ? cards.single_digits.slice(start, Math.min(end + 1, 10)) : [];
        const doubleDigits = cards.double_digits.filter(card => {
            const num = parseInt(card.number);
            return num >= Math.max(start, 0) && num <= end;
        });
        currentCards = [...singleDigits, ...doubleDigits];
    }

    if (order === 'random') {
        currentCards = currentCards.sort(() => Math.random() - 0.5);
    }

    currentCardIndex = 0;
    stats.correct = 0;
    stats.incorrect = 0;
    stats.timeout = 0;
    stats.attempts = [];
    streak = 0;
    updateStatsDisplay();
    stopAutoPlay();
    stopAnswerTimer();
    stopTimer();
    showCard();
    closeModal();
}

function showCard() {
    const optionsContainer = document.getElementById('options-container');
    if (optionsContainer) optionsContainer.innerHTML = '';
    stopAnswerTimer();
    const cardDigit = document.getElementById('card-digit');
    const cardText = document.getElementById('card-text');
    const cardImage = document.getElementById('card-image');
    const nextButton = document.getElementById('next-button');
    const autoButton = document.getElementById('auto-button');
    const feedback = document.getElementById('feedback');

    if (currentCards.length === 0) {
        if (cardDigit) cardDigit.textContent = 'No cards in range';
        if (cardText) cardText.textContent = '';
        if (cardImage) {
            cardImage.src = '';
            cardImage.style.display = 'none';
        }
        if (optionsContainer) optionsContainer.innerHTML = '';
        if (nextButton) nextButton.style.display = 'none';
        if (autoButton) autoButton.style.display = 'block';
        if (feedback) feedback.textContent = '';
        const timer = document.getElementById('timer');
        if (timer) timer.textContent = '';
        return;
    }

    const card = currentCards[currentCardIndex];
    console.log('Card data:', card);
    const isSingleDigit = 'digit' in card;
    if (cardDigit) cardDigit.textContent = isSingleDigit ? card.digit : card.number;
    if (cardText) cardText.textContent = isMemorizationMode ? (isSingleDigit ? card.letter : card.word) : '';
    const imagePath = isMemorizationMode ? `../images/${encodeURIComponent(card.image)}` : '';
    console.log('Loading image:', imagePath);
    if (cardImage) {
        cardImage.src = imagePath;
        cardImage.style.display = isMemorizationMode ? 'block' : 'none';
    }
    if (nextButton) nextButton.style.display = isAutoPlay ? 'none' : 'block';
    if (autoButton) autoButton.style.display = 'block';
    if (feedback) feedback.textContent = '';
    selectedLetter = null;
    selectedWord = null;

    if (!isMemorizationMode && optionsContainer) {
        if (isSingleDigit) {
            const letters = getRandomOptions(cards.single_digits, 'letter', card.letter, 5);
            const words = getRandomOptions(cards.single_digits, 'word', card.word, 5);
            const letterDiv = document.createElement('div');
            letterDiv.className = 'options-row';
            letterDiv.style.display = 'flex';
            letterDiv.style.gap = '10px';
            letterDiv.style.flexWrap = 'wrap';
            letterDiv.style.justifyContent = 'center';
            letters.forEach(letter => {
                const option = document.createElement('div');
                option.className = 'option';
                option.textContent = letter;
                option.onclick = () => selectOption(option, 'letter', letter);
                letterDiv.appendChild(option);
            });
            const wordDiv = document.createElement('div');
            wordDiv.className = 'options-row';
            wordDiv.style.display = 'flex';
            wordDiv.style.gap = '10px';
            wordDiv.style.flexWrap = 'wrap';
            wordDiv.style.justifyContent = 'center';
            words.forEach(word => {
                const option = document.createElement('div');
                option.className = 'option';
                option.textContent = word;
                option.onclick = () => selectOption(option, 'word', word);
                wordDiv.appendChild(option);
            });
            optionsContainer.appendChild(letterDiv);
            optionsContainer.appendChild(wordDiv);
            startAnswerTimer();
        } else {
            const words = getRandomOptions(cards.double_digits, 'word', card.word, 5);
            const wordDiv = document.createElement('div');
            wordDiv.className = 'options-row';
            wordDiv.style.display = 'flex';
            wordDiv.style.gap = '10px';
            wordDiv.style.flexWrap = 'wrap';
            wordDiv.style.justifyContent = 'center';
            words.forEach(word => {
                const option = document.createElement('div');
                option.className = 'option';
                option.textContent = word;
                option.onclick = () => selectOption(option, 'word', word);
                wordDiv.appendChild(option);
            });
            optionsContainer.appendChild(wordDiv);
            startAnswerTimer();
        }
    }

    if (isAutoPlay && isMemorizationMode) {
        const settings = JSON.parse(localStorage.getItem('settings')) || { displayTime: 2000 };
        autoPlayTimeout = setTimeout(nextCard, settings.displayTime);
    }
}

function toggleTheme() {
    document.body.classList.toggle('dark-theme');
    localStorage.setItem('theme', document.body.classList.contains('dark-theme') ? 'dark' : 'light');
    const themeIcon = document.getElementById('theme-icon');
    if (themeIcon) {
        themeIcon.src = document.body.classList.contains('dark-theme') ? '../icons/sun.svg' : '../icons/moon.svg';
        themeIcon.alt = document.body.classList.contains('dark-theme') ? 'Sun Icon' : 'Moon Icon';
    }
}

function loadTheme() {
    const savedTheme = localStorage.getItem('theme');
    const themeIcon = document.getElementById('theme-icon');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
        if (themeIcon) {
            themeIcon.src = '../icons/sun.svg';
            themeIcon.alt = 'Sun Icon';
        }
    } else {
        if (themeIcon) {
            themeIcon.src = '../icons/moon.svg';
            themeIcon.alt = 'Moon Icon';
        }
    }
}

function showModal(templateId) {
    const modal = document.getElementById('modal');
    const modalContent = document.getElementById('modal-content');
    if (modal && modalContent) {
        modalContent.innerHTML = '';
        const template = document.getElementById(templateId);
        if (template) {
            modalContent.appendChild(template.content.cloneNode(true));
            modal.style.display = 'flex';
            document.querySelector('.sidebar.active')?.classList.remove('active'); // Закрываем боковое меню
            fetch(`../i18n/${currentLanguage}.json`)
                .then(response => {
                    if (!response.ok) throw new Error(`Failed to load translations for modal: ../i18n/${currentLanguage}.json`);
                    return response.json();
                })
                .then(translations => {
                    modalContent.querySelectorAll('[data-i18n]').forEach(element => {
                        const key = element.getAttribute('data-i18n');
                        element.textContent = translations[key] || element.textContent;
                    });
                })
                .catch(error => console.error('Error loading modal translations:', error));
        }
    }
}

function showSettingsModal() {
    showModal('settings-modal-template');
    const savedSettings = JSON.parse(localStorage.getItem('settings')) || {
        rangeStart: 0,
        rangeEnd: 9,
        order: 'sequential',
        displayTime: 2000,
        answerTime: 5000
    };
    const rangeStart = document.getElementById('range-start');
    const rangeEnd = document.getElementById('range-end');
    const orderInput = document.querySelector(`input[name="order"][value="${savedSettings.order}"]`);
    const delaySelect = document.getElementById('delay-select');
    const answerTimeSelect = document.getElementById('answer-time-select');
    if (rangeStart) rangeStart.value = savedSettings.rangeStart;
    if (rangeEnd) rangeEnd.value = savedSettings.rangeEnd;
    if (orderInput) orderInput.checked = true;
    if (delaySelect) delaySelect.value = savedSettings.displayTime;
    if (answerTimeSelect) answerTimeSelect.value = savedSettings.answerTime;
}

function closeModal() {
    const modal = document.getElementById('modal');
    const modalContent = document.getElementById('modal-content');
    if (modal) modal.style.display = 'none';
    if (modalContent) modalContent.innerHTML = '';
}

function resetSettings() {
    localStorage.setItem('settings', JSON.stringify({
        rangeStart: 0,
        rangeEnd: 9,
        order: 'sequential',
        displayTime: 2000,
        answerTime: 5000
    }));
    updateRange();
    closeModal();
}

function exportSettings() {
    const settings = JSON.parse(localStorage.getItem('settings')) || {
        rangeStart: 0,
        rangeEnd: 9,
        order: 'sequential',
        displayTime: 2000,
        answerTime: 5000
    };
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'settings.json';
    a.click();
    URL.revokeObjectURL(url);
}

function importSettings() {
    const input = document.getElementById('import-settings');
    if (input && input.files.length > 0) {
        const file = input.files[0];
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const settings = JSON.parse(e.target.result);
                localStorage.setItem('settings', JSON.stringify(settings));
                updateRange();
                closeModal();
            } catch (error) {
                alert('Invalid settings file');
            }
        };
        reader.readAsText(file);
    }
}


function showExportImportModal() {
    showModal('export-import-modal-template');
}

function showInstructionsModal() {
    showModal('instructions-modal-template');
}

function showAboutModal() {
    showModal('about-modal-template');
}

function changeLanguage() {
    currentLanguage = currentLanguage === 'ru' ? 'en' : 'ru';
    localStorage.setItem('language', currentLanguage);
    console.log('Changing language to:', currentLanguage);
    loadLanguage();
}

function toggleMenu() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.toggle('active');
}

function getRandomOptions(sourceArray, key, correctValue, count) {
    const options = [correctValue];
    const available = sourceArray.filter(item => item[key] !== correctValue).map(item => item[key]);
    for (let i = 0; i < count - 1; i++) {
        if (available.length === 0) break;
        const randomIndex = Math.floor(Math.random() * available.length);
        options.push(available.splice(randomIndex, 1)[0]);
    }
    return options.sort(() => Math.random() - 0.5);
}

function selectOption(element, type, value) {
    if (type === 'letter') {
        if (selectedLetter) {
            selectedLetter.classList.remove('selected');
        }
        selectedLetter = element;
        selectedLetter.classList.add('selected');
    } else {
        if (selectedWord) {
            selectedWord.classList.remove('selected');
        }
        selectedWord = element;
        selectedWord.classList.add('selected');
    }

    const card = currentCards[currentCardIndex];
    const isSingleDigit = 'digit' in card;
    if (isSingleDigit && selectedLetter && selectedWord) {
        checkAnswer();
    } else if (!isSingleDigit && selectedWord) {
        checkAnswer();
    }
}

function toggleMode() {
    isMemorizationMode = !isMemorizationMode;
    fetch(`../i18n/${currentLanguage}.json`)
        .then(response => response.json())
        .then(translations => {
            const modeTitle = document.getElementById('mode-title');
            const modeButton = document.getElementById('mode-button');
            if (modeTitle) modeTitle.textContent = translations[isMemorizationMode ? 'training' : 'testing'] || 'Training';
            if (modeButton) modeButton.title = translations[isMemorizationMode ? 'switch_to_testing' : 'switch_to_training'] || 'Switch Mode';
        });
    stopAutoPlay();
    stopAnswerTimer();
    saveSessionStats();
    stats.correct = 0;
    stats.incorrect = 0;
    stats.timeout = 0;
    stats.attempts = [];
    streak = 0;
    updateStatsDisplay();
    const optionsContainer = document.getElementById('options-container');
    if (optionsContainer) optionsContainer.innerHTML = '';
    showCard();
}

function nextCard() {
    const settings = JSON.parse(localStorage.getItem('settings')) || { order: 'sequential' };
    if (settings.order === 'random') {
        currentCardIndex = Math.floor(Math.random() * currentCards.length);
    } else {
        currentCardIndex = (currentCardIndex + 1) % currentCards.length;
    }
    stopAnswerTimer();
    showCard();
}

function checkAnswer() {
    stopAnswerTimer();
    const card = currentCards[currentCardIndex];
    const isSingleDigit = 'digit' in card;
    const correctLetter = isSingleDigit ? card.letter : null;
    const correctWord = card.word;
    const feedback = document.getElementById('feedback');
    const startTime = Date.now();
    let isCorrect = false;

    fetch(`../i18n/${currentLanguage}.json`)
        .then(response => response.json())
        .then(translations => {
            if (isSingleDigit) {
                isCorrect = selectedLetter?.textContent === correctLetter && selectedWord?.textContent === correctWord;
                if (feedback) {
                    feedback.textContent = isCorrect
                        ? translations.correct
                        : `${translations.incorrect} ${translations.correct_answer}: ${correctLetter}, ${correctWord}`;
                }
            } else {
                isCorrect = selectedWord?.textContent === correctWord;
                if (feedback) {
                    feedback.textContent = isCorrect
                        ? translations.correct
                        : `${translations.incorrect} ${translations.correct_answer}: ${correctWord}`;
                }
            }
            if (feedback) feedback.style.color = isCorrect ? 'green' : 'red';
            stats.attempts.push({
                digit: isSingleDigit ? card.digit : card.number,
                isCorrect,
                selectedLetter: selectedLetter?.textContent,
                selectedWord: selectedWord?.textContent,
                time: Date.now() - startTime
            });
            stats[isCorrect ? 'correct' : 'incorrect']++;
            streak = isCorrect ? streak + 1 : 0;
            if (streak === 10 && feedback) {
                feedback.textContent += ` ${translations.streak}`;
                setTimeout(() => {
                    if (feedback && feedback.textContent.includes(translations.streak)) {
                        feedback.textContent = isCorrect ? translations.correct : `${translations.incorrect} ${translations.correct_answer}: ${correctWord}`;
                    }
                }, 2000);
            }
            updateStatsDisplay();
            const optionsContainer = document.getElementById('options-container');
            if (optionsContainer) optionsContainer.innerHTML = '';
            if (isAutoPlay && !isMemorizationMode) {
                const settings = JSON.parse(localStorage.getItem('settings')) || { displayTime: 2000 };
                autoPlayTimeout = setTimeout(nextCard, settings.displayTime);
            }
        });
}

function startAnswerTimer() {
    stopAnswerTimer();
    if (!isMemorizationMode) {
        const settings = JSON.parse(localStorage.getItem('settings')) || { answerTime: 5000 };
        startTimer(settings.answerTime);
        answerTimeout = setTimeout(() => {
            const card = currentCards[currentCardIndex];
            const isSingleDigit = 'digit' in card;
            const correctLetter = isSingleDigit ? card.letter : null;
            const correctWord = card.word;
            fetch(`../i18n/${currentLanguage}.json`)
                .then(response => response.json())
                .then(translations => {
                    const feedback = document.getElementById('feedback');
                    if (feedback) {
                        feedback.textContent = isSingleDigit
                            ? `${translations.timeout} ${translations.correct_answer}: ${correctLetter}, ${correctWord}`
                            : `${translations.timeout} ${translations.correct_answer}: ${correctWord}`;
                        feedback.style.color = 'red';
                    }
                    stats.timeout++;
                    stats.attempts.push({
                        digit: isSingleDigit ? card.digit : card.number,
                        isCorrect: false,
                        selectedLetter: null,
                        selectedWord: null,
                        time: settings.answerTime
                    });
                    streak = 0;
                    updateStatsDisplay();
                    const optionsContainer = document.getElementById('options-container');
                    if (optionsContainer) optionsContainer.innerHTML = '';
                    if (isAutoPlay) {
                        const delay = settings.displayTime || 2000;
                        autoPlayTimeout = setTimeout(nextCard, delay);
                    }
                });
        }, settings.answerTime);
    }
}

function startTimer(duration) {
    let timeLeft = duration / 1000;
    fetch(`../i18n/${currentLanguage}.json`)
        .then(response => response.json())
        .then(translations => {
            const timer = document.getElementById('timer');
            if (timer) {
                timer.textContent = `${translations.time_left}: ${timeLeft.toFixed(1)} ${translations.seconds}`;
                timerInterval = setInterval(() => {
                    timeLeft -= 0.1;
                    if (timeLeft <= 0) {
                        stopTimer();
                        if (timer) timer.textContent = translations.time_out;
                    } else {
                        if (timer) timer.textContent = `${translations.time_left}: ${timeLeft.toFixed(1)} ${translations.seconds}`;
                    }
                }, 100);
            }
        });
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    const timer = document.getElementById('timer');
    if (timer) timer.textContent = '';
}

function stopAnswerTimer() {
    if (answerTimeout) {
        clearTimeout(answerTimeout);
        answerTimeout = null;
    }
    stopTimer();
}

function toggleAutoPlay() {
    isAutoPlay = !isAutoPlay;
    fetch(`../i18n/${currentLanguage}.json`)
        .then(response => response.json())
        .then(translations => {
            const autoButton = document.getElementById('auto-button');
            if (autoButton) {
                autoButton.textContent = isAutoPlay ? '⏸' : '▶';
                autoButton.title = translations[isAutoPlay ? 'stop_autoplay' : 'start_autoplay'] || 'Auto-play';
            }
            const nextButton = document.getElementById('next-button');
            if (nextButton) nextButton.style.display = isAutoPlay ? 'none' : 'block';
            if (isAutoPlay) {
                if (isMemorizationMode) {
                    const settings = JSON.parse(localStorage.getItem('settings')) || { displayTime: 2000 };
                    autoPlayTimeout = setTimeout(nextCard, settings.displayTime);
                } else {
                    checkAnswer();
                }
            } else {
                stopAutoPlay();
                stopAnswerTimer();
            }
        });
}

function stopAutoPlay() {
    isAutoPlay = false;
    fetch(`../i18n/${currentLanguage}.json`)
        .then(response => response.json())
        .then(translations => {
            const autoButton = document.getElementById('auto-button');
            if (autoButton) {
                autoButton.textContent = '▶';
                autoButton.title = translations.start_autoplay || 'Start Auto-play';
            }
            const nextButton = document.getElementById('next-button');
            if (nextButton) nextButton.style.display = 'block';
            if (autoPlayTimeout) {
                clearTimeout(autoPlayTimeout);
                autoPlayTimeout = null;
            }
        });
}

function updateStatsDisplay() {
    const total = stats.correct + stats.incorrect + stats.timeout;
    const accuracy = total > 0 ? ((stats.correct / total) * 100).toFixed(1) : 0;
    fetch(`../i18n/${currentLanguage}.json`)
        .then(response => response.json())
        .then(translations => {
            const feedback = document.getElementById('feedback');
            if (feedback) {
                feedback.textContent = total > 0
                    ? `${translations.correct}: ${stats.correct}, ${translations.incorrect}: ${stats.incorrect}, ${translations.timeout}: ${stats.timeout}, ${translations.accuracy}: ${accuracy}%`
                    : '';
            }
        });
}

function showStats() {
    saveSessionStats();
    showModal('stats-modal-template');
    const total = stats.correct + stats.incorrect + stats.timeout;
    const accuracy = total > 0 ? ((stats.correct / total) * 100).toFixed(1) : 0;
    fetch(`../i18n/${currentLanguage}.json`)
        .then(response => response.json())
        .then(translations => {
            const summary = document.getElementById('stats-summary');
            if (summary) {
                summary.innerHTML = `
                    <p>${translations.correct}: ${stats.correct}</p>
                    <p>${translations.incorrect}: ${stats.incorrect}</p>
                    <p>${translations.timeout}: ${stats.timeout}</p>
                    <p>${translations.accuracy}: ${accuracy}%</p>
                    <p>${translations.average_time}: ${calculateAverageTime().toFixed(1)} ${translations.ms}</p>
                    <h4>${translations.errors}:</h4>
                    <ul>${generateErrorList()}</ul>
                `;
            }
            const ctx = document.getElementById('stats-chart');
            if (ctx) {
                new Chart(ctx.getContext('2d'), {
                    type: 'pie',
                    data: {
                        labels: [translations.correct, translations.incorrect, translations.timeout],
                        datasets: [{
                            data: [stats.correct, stats.incorrect, stats.timeout],
                            backgroundColor: ['#4CAF50', '#EF4444', '#F59E0B']
                        }]
                    },
                    options: {
                        responsive: true,
                        plugins: { legend: { position: 'bottom' } }
                    }
                });
            }
            const historyBody = document.getElementById('history-table-body');
            if (historyBody) {
                historyBody.innerHTML = '';
                stats.history.forEach((session, index) => {
                    const sessionTotal = session.correct + session.incorrect + session.timeout;
                    const sessionAccuracy = sessionTotal > 0 ? ((session.correct / sessionTotal) * 100).toFixed(1) : 0;
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${new Date(session.date).toLocaleString()}</td>
                        <td>${session.correct}</td>
                        <td>${session.incorrect}</td>
                        <td>${session.timeout}</td>
                        <td>${sessionAccuracy}%</td>
                    `;
                    historyBody.appendChild(row);
                });
            }
            const historyCtx = document.getElementById('history-chart');
            if (historyCtx) {
                const historyData = stats.history.map(session => {
                    const sessionTotal = session.correct + session.incorrect + session.timeout;
                    return sessionTotal > 0 ? (session.correct / sessionTotal) * 100 : 0;
                });
                new Chart(historyCtx.getContext('2d'), {
                    type: 'line',
                    data: {
                        labels: stats.history.map((_, i) => `${translations.session} ${i + 1}`),
                        datasets: [{
                            label: translations.accuracy_percent,
                            data: historyData,
                            borderColor: '#3B82F6',
                            fill: false
                        }]
                    },
                    options: {
                        responsive: true,
                        scales: { y: { beginAtZero: true, max: 100 } }
                    }
                });
            }
        });
}

function calculateAverageTime() {
    const times = stats.attempts.map(attempt => attempt.time).filter(time => time !== undefined);
    return times.length > 0 ? times.reduce((sum, time) => sum + time, 0) / times.length : 0;
}

function generateErrorList() {
    const errors = stats.attempts.filter(attempt => !attempt.isCorrect);
    const errorMap = {};
    errors.forEach(attempt => {
        const key = attempt.digit;
        if (!errorMap[key]) {
            errorMap[key] = { count: 0, details: [] };
        }
        errorMap[key].count++;
        errorMap[key].details.push(`Selected: ${attempt.selectedLetter || '-'}, ${attempt.selectedWord || '-'}`);
    });
    return Object.entries(errorMap).map(([digit, data]) => `
        <li>${digit}: ${data.count} error${data.count === 1 ? '' : 's'} (${data.details.join('; ')})</li>
    `).join('');
}

function saveSessionStats() {
    const total = stats.correct + stats.incorrect + stats.timeout;
    if (total > 0) {
        stats.history.push({
            date: new Date().toISOString(),
            correct: stats.correct,
            incorrect: stats.incorrect,
            timeout: stats.timeout,
            attempts: stats.attempts
        });
        if (stats.history.length > 10) {
            stats.history.shift();
        }
        localStorage.setItem('statsHistory', JSON.stringify(stats.history));
    }
}

function exportStats() {
    fetch(`../i18n/${currentLanguage}.json`)
        .then(response => response.json())
        .then(translations => {
            const csv = [
                `${translations.date},${translations.correct},${translations.incorrect},${translations.timeout},${translations.accuracy},${translations.average_time_ms}`,
                ...stats.history.map(session => {
                    const total = session.correct + session.incorrect + session.timeout;
                    const accuracy = total > 0 ? ((session.correct / total) * 100).toFixed(1) : 0;
                    const avgTime = session.attempts.map(a => a.time).filter(t => t !== undefined).reduce((sum, t) => sum + t, 0) / session.attempts.length || 0;
                    return `${new Date(session.date).toLocaleString()},${session.correct},${session.incorrect},${session.timeout},${accuracy},${avgTime.toFixed(1)}`;
                })
            ].join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'stats.csv';
            a.click();
            URL.revokeObjectURL(url);
        });
}

function resetStats() {
    stats.history = [];
    localStorage.removeItem('statsHistory');
    stats.correct = 0;
    stats.incorrect = 0;
    stats.timeout = 0;
    stats.attempts = [];
    streak = 0;
    updateStatsDisplay();
    closeModal();
}

function loadCards() {
    fetch(`Flashcards/cards_${currentLanguage}.json`)
        .then(response => response.json())
        .then(data => {
            cards = data.filter(card => card.digit >= rangeStart && card.digit <= rangeEnd);
            if (order === 'random') {
                cards = shuffle(cards);
            }
            currentCardIndex = 0; // Сбрасываем индекс на начальную карточку
            showCard();
        });
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing application');
    loadLanguage();
});


document.addEventListener('click', function(e) {
    const sidebar = document.getElementById('sidebar');
    const menuButton = document.getElementById('menu-button');
    if (sidebar && sidebar.classList.contains('active') && !sidebar.contains(e.target) && !menuButton.contains(e.target)) {
        sidebar.classList.remove('active');
    }
});

document.getElementById('modal')?.addEventListener('click', function(e) {
    if (e.target === this) {
        closeModal();
    }
});