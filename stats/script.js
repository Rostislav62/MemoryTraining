/* Глобальная переменная для хранения карточек (одно- и двузначные) */
let cards = { single_digits: [], double_digits: [] };

/* Индекс текущей карточки в массиве currentCards */
let currentCardIndex = 0;

/* Текущий массив карточек, отфильтрованный по настройкам диапазона */
let currentCards = [];

/* Флаг режима: true — тренировка, false — тестирование */
let isMemorizationMode = true;

/* Флаг автоматического воспроизведения карточек */
let isAutoPlay = false;

/* Таймер для автопроигрывания карточек */
let autoPlayTimeout = null;

/* Таймер для ограничения времени ответа в режиме тестирования */
let answerTimeout = null;

/* Выбранная буква в режиме тестирования (для однозначных чисел) */
let selectedLetter = null;

/* Выбранное слово в режиме тестирования */
let selectedWord = null;

/* Объект для хранения статистики: правильные/неправильные ответы, таймауты, попытки, история */
let stats = {
    correct: 0, /* Количество правильных ответов */
    incorrect: 0, /* Количество неправильных ответов */
    timeout: 0, /* Количество таймаутов */
    attempts: [], /* Массив попыток с деталями ответа */
    history: JSON.parse(localStorage.getItem('statsHistory')) || [] /* История сессий из localStorage */
};

/* Текущая серия правильных ответов подряд */
let streak = 0;

/* Интервал для таймера обратного отсчёта */
let timerInterval = null;

/* Текущий язык интерфейса (ru/en), загружается из localStorage или по умолчанию 'ru' */
let currentLanguage = localStorage.getItem('language') || 'ru';

/* Функция loadLanguage: Загружает переводы и карточки для текущего языка */
function loadLanguage() {
    console.log('Loading language:', currentLanguage); // Логирование текущего языка
    fetch(`../i18n/${currentLanguage}.json`) // Загружаем JSON с переводами
        .then(response => {
            if (!response.ok) throw new Error(`Failed to load translations: ../i18n/${currentLanguage}.json`); // Проверка успешности загрузки
            return response.json(); // Парсим JSON
        })
        .then(translations => {
            const elements = document.querySelectorAll('[data-i18n]'); // Находим все элементы с атрибутом data-i18n
            elements.forEach(element => {
                const key = element.getAttribute('data-i18n'); // Получаем ключ перевода
                // Пропускаем элементы theme-button, language-text и те, у кого нет перевода
                if (element.id !== 'theme-button' && element.id !== 'language-text' && translations[key]) {
                    element.textContent = translations[key]; // Устанавливаем текст перевода
                }
            });
            const modeTitle = document.getElementById('mode-title'); // Элемент заголовка режима
            const modeButton = document.getElementById('mode-button'); // Кнопка переключения режима
            const autoButton = document.getElementById('auto-button'); // Кнопка автопроигрывания
            if (modeTitle) modeTitle.textContent = translations[isMemorizationMode ? 'training' : 'testing'] || 'Training'; // Устанавливаем заголовок режима
            if (modeButton) modeButton.title = translations[isMemorizationMode ? 'switch_to_testing' : 'switch_to_training'] || 'Switch Mode'; // Устанавливаем подсказку кнопки режима
            if (autoButton) autoButton.title = translations[isAutoPlay ? 'stop_autoplay' : 'start_autoplay'] || 'Auto-play'; // Устанавливаем подсказку кнопки автопроигрывания
        })
        .catch(error => {
            console.error('Error loading translations:', error); // Логируем ошибку загрузки переводов
            const cardDigit = document.getElementById('card-digit'); // Элемент для отображения цифры
            if (cardDigit) cardDigit.textContent = 'Error loading translations'; // Показываем ошибку на карточке
        });
    fetch(`../Flashcards/cards_${currentLanguage}.json`) // Загружаем JSON с карточками для текущего языка
        .then(response => {
            if (!response.ok) throw new Error(`Failed to load cards: ../Flashcards/cards_${currentLanguage}.json`); // Проверка успешности загрузки
            return response.json(); // Парсим JSON
        })
        .then(data => {
            cards = data; // Сохраняем загруженные карточки
            const savedSettings = JSON.parse(localStorage.getItem('settings')) || { // Загружаем настройки из localStorage
                rangeStart: 0, // Начало диапазона
                rangeEnd: 9, // Конец диапазона
                order: 'sequential', // Порядок карточек
                displayTime: 2000, // Время отображения карточки
                answerTime: 5000 // Время на ответ
            };
            currentCards = cards.single_digits.slice(savedSettings.rangeStart, savedSettings.rangeEnd + 1); // Фильтруем однозначные карточки по диапазону
            if (savedSettings.order === 'random') { // Если порядок случайный
                currentCards = currentCards.sort(() => Math.random() - 0.5); // Перемешиваем карточки
            }
            currentCardIndex = 0; // Сбрасываем индекс карточки
            updateStatsDisplay(); // Обновляем отображение статистики
            loadTheme(); // Загружаем тему оформления
            showCard(); // Показываем первую карточку
        })
        .catch(error => {
            console.error('Error loading cards:', error); // Логируем ошибку загрузки карточек
            const cardDigit = document.getElementById('card-digit'); // Элемент для цифры
            if (cardDigit) cardDigit.textContent = 'Error loading data'; // Показываем ошибку на карточке
        });
}

/* Функция updateRange: Обновляет диапазон карточек и настройки */
function updateRange() {
    const start = parseInt(document.getElementById('range-start')?.value || 0); // Получаем начальный диапазон
    const end = parseInt(document.getElementById('range-end')?.value || 9); // Получаем конечный диапазон
    const order = document.querySelector('input[name="order"]:checked')?.value || 'sequential'; // Получаем порядок (sequential/random)
    const displayTime = parseInt(document.getElementById('delay-select')?.value || 2000); // Получаем время отображения
    const answerTime = parseInt(document.getElementById('answer-time-select')?.value || 5000); // Получаем время на ответ

    localStorage.setItem('settings', JSON.stringify({ // Сохраняем настройки в localStorage
        rangeStart: start,
        rangeEnd: end,
        order: order,
        displayTime: displayTime,
        answerTime: answerTime
    }));

    currentCards = []; // Очищаем текущий массив карточек
    if (start <= 9 && end <= 9) { // Если диапазон в пределах однозначных чисел
        currentCards = cards.single_digits.slice(start, end + 1); // Выбираем однозначные карточки
    } else { // Если диапазон включает двузначные числа
        const singleDigits = start <= 9 ? cards.single_digits.slice(start, Math.min(end + 1, 10)) : []; // Однозначные карточки
        const doubleDigits = cards.double_digits.filter(card => { // Фильтруем двузначные карточки
            const num = parseInt(card.number);
            return num >= Math.max(start, 0) && num <= end;
        });
        currentCards = [...singleDigits, ...doubleDigits]; // Объединяем однозначные и двузначные карточки
    }

    if (order === 'random') { // Если порядок случайный
        currentCards = currentCards.sort(() => Math.random() - 0.5); // Перемешиваем карточки
    }

    currentCardIndex = 0; // Сбрасываем индекс
    stats.correct = 0; // Сбрасываем статистику правильных ответов
    stats.incorrect = 0; // Сбрасываем статистику неправильных ответов
    stats.timeout = 0; // Сбрасываем статистику таймаутов
    stats.attempts = []; // Очищаем массив попыток
    streak = 0; // Сбрасываем серию правильных ответов
    updateStatsDisplay(); // Обновляем отображение статистики
    stopAutoPlay(); // Останавливаем автопроигрывание
    stopAnswerTimer(); // Останавливаем таймер ответа
    stopTimer(); // Останавливаем таймер
    showCard(); // Показываем первую карточку
    closeModal(); // Закрываем модальное окно
}

/* Функция showCard: Отображает текущую карточку на экране */
function showCard() {
    const optionsContainer = document.getElementById('options-container'); // Контейнер для вариантов ответа
    if (optionsContainer) optionsContainer.innerHTML = ''; // Очищаем варианты ответа
    stopAnswerTimer(); // Останавливаем таймер ответа
    const cardDigit = document.getElementById('card-digit'); // Элемент для отображения цифры
    const cardText = document.getElementById('card-text'); // Элемент для текста карточки
    const cardImage = document.getElementById('card-image'); // Элемент для изображения
    const nextButton = document.getElementById('next-button'); // Кнопка "Далее"
    const autoButton = document.getElementById('auto-button'); // Кнопка автопроигрывания
    const feedback = document.getElementById('feedback'); // Элемент для обратной связи

    if (currentCards.length === 0) { // Если нет карточек в диапазоне
        if (cardDigit) cardDigit.textContent = 'No cards in range'; // Показываем сообщение
        if (cardText) cardText.textContent = ''; // Очищаем текст
        if (cardImage) {
            cardImage.src = ''; // Очищаем изображение
            cardImage.style.display = 'none'; // Скрываем изображение
        }
        if (optionsContainer) optionsContainer.innerHTML = ''; // Очищаем варианты ответа
        if (nextButton) nextButton.style.display = 'none'; // Скрываем кнопку "Далее"
        if (autoButton) autoButton.style.display = 'block'; // Показываем кнопку автопроигрывания
        if (feedback) feedback.textContent = ''; // Очищаем обратную связь
        const timer = document.getElementById('timer'); // Элемент таймера
        if (timer) timer.textContent = ''; // Очищаем таймер
        return;
    }

    const card = currentCards[currentCardIndex]; // Текущая карточка
    console.log('Card data:', card); // Логируем данные карточки
    const isSingleDigit = 'digit' in card; // Проверяем, однозначная ли карточка
    if (cardDigit) cardDigit.textContent = isSingleDigit ? card.digit : card.number; // Устанавливаем цифру или число
    if (cardText) cardText.textContent = isMemorizationMode ? (isSingleDigit ? card.letter : card.word) : ''; // Показываем букву/слово в режиме тренировки
    const imagePath = isMemorizationMode ? `../images/${encodeURIComponent(card.image)}` : ''; // Путь к изображению в режиме тренировки
    console.log('Loading image:', imagePath); // Логируем путь к изображению
    if (cardImage) {
        cardImage.src = imagePath; // Устанавливаем путь к изображению
        cardImage.style.display = isMemorizationMode ? 'block' : 'none'; // Показываем/скрываем изображение
    }
    if (nextButton) nextButton.style.display = isAutoPlay ? 'none' : 'block'; // Управляем видимостью кнопки "Далее"
    if (autoButton) autoButton.style.display = 'block'; // Показываем кнопку автопроигрывания
    if (feedback) feedback.textContent = ''; // Очищаем обратную связь
    selectedLetter = null; // Сбрасываем выбранную букву
    selectedWord = null; // Сбрасываем выбранное слово

    if (!isMemorizationMode && optionsContainer) { // В режиме тестирования
        if (isSingleDigit) { // Для однозначных чисел
            const letters = getRandomOptions(cards.single_digits, 'letter', card.letter, 5); // Получаем случайные буквы
            const words = getRandomOptions(cards.single_digits, 'word', card.word, 5); // Получаем случайные слова
            const letterDiv = document.createElement('div'); // Контейнер для букв
            letterDiv.className = 'options-row'; // Класс для стилизации
            letterDiv.style.display = 'flex'; // Flex-расположение
            letterDiv.style.gap = '10px'; // Отступ между элементами
            letterDiv.style.flexWrap = 'wrap'; // Перенос элементов
            letterDiv.style.justifyContent = 'center'; // Центрирование
            letters.forEach(letter => { // Для каждой буквы
                const option = document.createElement('div'); // Создаём элемент варианта
                option.className = 'option'; // Класс для стилизации
                option.textContent = letter; // Устанавливаем текст
                option.onclick = () => selectOption(option, 'letter', letter); // Обработчик клика
                letterDiv.appendChild(option); // Добавляем в контейнер
            });
            const wordDiv = document.createElement('div'); // Контейнер для слов
            wordDiv.className = 'options-row'; // Класс для стилизации
            wordDiv.style.display = 'flex'; // Flex-расположение
            wordDiv.style.gap = '10px'; // Отступ между элементами
            wordDiv.style.flexWrap = 'wrap'; // Перенос элементов
            wordDiv.style.justifyContent = 'center'; // Центрирование
            words.forEach(word => { // Для каждого слова
                const option = document.createElement('div'); // Создаём элемент варианта
                option.className = 'option'; // Класс для стилизации
                option.textContent = word; // Устанавливаем текст
                option.onclick = () => selectOption(option, 'word', word); // Обработчик клика
                wordDiv.appendChild(option); // Добавляем в контейнер
            });
            optionsContainer.appendChild(letterDiv); // Добавляем контейнер букв
            optionsContainer.appendChild(wordDiv); // Добавляем контейнер слов
            startAnswerTimer(); // Запускаем таймер ответа
        } else { // Для двузначных чисел
            const words = getRandomOptions(cards.double_digits, 'word', card.word, 5); // Получаем случайные слова
            const wordDiv = document.createElement('div'); // Контейнер для слов
            wordDiv.className = 'options-row'; // Класс для стилизации
            wordDiv.style.display = 'flex'; // Flex-расположение
            wordDiv.style.gap = '10px'; // Отступ между элементами
            wordDiv.style.flexWrap = 'wrap'; // Перенос элементов
            wordDiv.style.justifyContent = 'center'; // Центрирование
            words.forEach(word => { // Для каждого слова
                const option = document.createElement('div'); // Создаём элемент варианта
                option.className = 'option'; // Класс для стилизации
                option.textContent = word; // Устанавливаем текст
                option.onclick = () => selectOption(option, 'word', word); // Обработчик клика
                wordDiv.appendChild(option); // Добавляем в контейнер
            });
            optionsContainer.appendChild(wordDiv); // Добавляем контейнер слов
            startAnswerTimer(); // Запускаем таймер ответа
        }
    }

    if (isAutoPlay && isMemorizationMode) { // Если включено автопроигрывание в режиме тренировки
        const settings = JSON.parse(localStorage.getItem('settings')) || { displayTime: 2000 }; // Получаем настройки
        autoPlayTimeout = setTimeout(nextCard, settings.displayTime); // Устанавливаем таймер для следующей карточки
    }
}

/* Функция toggleTheme: Переключает тему оформления (светлая/тёмная) */
function toggleTheme() {
    document.body.classList.toggle('dark-theme'); // Переключаем класс dark-theme
    localStorage.setItem('theme', document.body.classList.contains('dark-theme') ? 'dark' : 'light'); // Сохраняем тему
    const themeIcon = document.getElementById('theme-icon'); // Иконка темы
    if (themeIcon) {
        themeIcon.src = document.body.classList.contains('dark-theme') ? '../icons/sun.svg' : '../icons/moon.svg'; // Меняем иконку
        themeIcon.alt = document.body.classList.contains('dark-theme') ? 'Sun Icon' : 'Moon Icon'; // Меняем alt-текст
    }
}

/* Функция loadTheme: Загружает сохранённую тему оформления */
function loadTheme() {
    const savedTheme = localStorage.getItem('theme'); // Получаем сохранённую тему
    const themeIcon = document.getElementById('theme-icon'); // Иконка темы
    if (savedTheme === 'dark') { // Если тёмная тема
        document.body.classList.add('dark-theme'); // Добавляем класс
        if (themeIcon) {
            themeIcon.src = '../icons/sun.svg'; // Устанавливаем иконку солнца
            themeIcon.alt = 'Sun Icon'; // Устанавливаем alt-текст
        }
    } else { // Если светлая тема
        if (themeIcon) {
            themeIcon.src = '../icons/moon.svg'; // Устанавливаем иконку луны
            themeIcon.alt = 'Moon Icon'; // Устанавливаем alt-текст
        }
    }
}

/* Функция showModal: Отображает модальное окно с указанным шаблоном */
function showModal(templateId) {
    const modal = document.getElementById('modal'); // Модальное окно
    const modalContent = document.getElementById('modal-content'); // Контент модального окна
    if (modal && modalContent) { // Проверяем наличие элементов
        modalContent.innerHTML = ''; // Очищаем контент
        const template = document.getElementById(templateId); // Находим шаблон
        if (template) {
            modalContent.appendChild(template.content.cloneNode(true)); // Клонируем шаблон
            modal.style.display = 'flex'; // Показываем модальное окно
            document.querySelector('.sidebar.active')?.classList.remove('active'); // Закрываем боковое меню
            fetch(`../i18n/${currentLanguage}.json`) // Загружаем переводы
                .then(response => {
                    if (!response.ok) throw new Error(`Failed to load translations for modal: ../i18n/${currentLanguage}.json`); // Проверка загрузки
                    return response.json(); // Парсим JSON
                })
                .then(translations => {
                    modalContent.querySelectorAll('[data-i18n]').forEach(element => { // Применяем переводы
                        const key = element.getAttribute('data-i18n');
                        element.textContent = translations[key] || element.textContent; // Устанавливаем перевод
                    });
                })
                .catch(error => console.error('Error loading modal translations:', error)); // Логируем ошибку
        }
    }
}

/* Функция showSettingsModal: Открывает модальное окно настроек */
function showSettingsModal() {
    showModal('settings-modal-template'); // Показываем шаблон настроек
    const savedSettings = JSON.parse(localStorage.getItem('settings')) || { // Загружаем настройки
        rangeStart: 0,
        rangeEnd: 9,
        order: 'sequential',
        displayTime: 2000,
        answerTime: 5000
    };
    const rangeStart = document.getElementById('range-start'); // Поле начального диапазона
    const rangeEnd = document.getElementById('range-end'); // Поле конечного диапазона
    const orderInput = document.querySelector(`input[name="order"][value="${savedSettings.order}"]`); // Радиокнопка порядка
    const delaySelect = document.getElementById('delay-select'); // Выбор времени отображения
    const answerTimeSelect = document.getElementById('answer-time-select'); // Выбор времени ответа
    if (rangeStart) rangeStart.value = savedSettings.rangeStart; // Устанавливаем начальный диапазон
    if (rangeEnd) rangeEnd.value = savedSettings.rangeEnd; // Устанавливаем конечный диапазон
    if (orderInput) orderInput.checked = true; // Устанавливаем порядок
    if (delaySelect) delaySelect.value = savedSettings.displayTime; // Устанавливаем время отображения
    if (answerTimeSelect) answerTimeSelect.value = savedSettings.answerTime; // Устанавливаем время ответа
}

/* Функция closeModal: Закрывает модальное окно */
function closeModal() {
    const modal = document.getElementById('modal'); // Модальное окно
    const modalContent = document.getElementById('modal-content'); // Контент модального окна
    if (modal) modal.style.display = 'none'; // Скрываем модальное окно
    if (modalContent) modalContent.innerHTML = ''; // Очищаем контент
}

/* Функция resetSettings: Сбрасывает настройки до значений по умолчанию */
function resetSettings() {
    localStorage.setItem('settings', JSON.stringify({ // Сохраняем настройки по умолчанию
        rangeStart: 0,
        rangeEnd: 9,
        order: 'sequential',
        displayTime: 2000,
        answerTime: 5000
    }));
    updateRange(); // Обновляем диапазон карточек
    closeModal(); // Закрываем модальное окно
}

/* Функция exportSettings: Экспортирует настройки в JSON-файл */
function exportSettings() {
    const settings = JSON.parse(localStorage.getItem('settings')) || { // Загружаем настройки
        rangeStart: 0,
        rangeEnd: 9,
        order: 'sequential',
        displayTime: 2000,
        answerTime: 5000
    };
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' }); // Создаём JSON-файл
    const url = URL.createObjectURL(blob); // Создаём URL для файла
    const a = document.createElement('a'); // Создаём ссылку
    a.href = url; // Устанавливаем URL
    a.download = 'settings.json'; // Имя файла
    a.click(); // Запускаем скачивание
    URL.revokeObjectURL(url); // Освобождаем URL
}

/* Функция importSettings: Импортирует настройки из JSON-файла */
function importSettings() {
    const input = document.getElementById('import-settings'); // Поле ввода файла
    if (input && input.files.length > 0) { // Проверяем наличие файла
        const file = input.files[0]; // Получаем файл
        const reader = new FileReader(); // Создаём FileReader
        reader.onload = function(e) { // При загрузке файла
            try {
                const settings = JSON.parse(e.target.result); // Парсим JSON
                localStorage.setItem('settings', JSON.stringify(settings)); // Сохраняем настройки
                updateRange(); // Обновляем диапазон
                closeModal(); // Закрываем модальное окно
            } catch (error) {
                alert('Invalid settings file'); // Показываем ошибку
            }
        };
        reader.readAsText(file); // Читаем файл как текст
    }
}

/* Функция showExportImportModal: Открывает модальное окно для экспорта/импорта настроек */
function showExportImportModal() {
    showModal('export-import-modal-template'); // Показываем шаблон экспорта/импорта
}

/* Функция showInstructionsModal: Открывает модальное окно с инструкциями */
function showInstructionsModal() {
    showModal('instructions-modal-template'); // Показываем шаблон инструкций
}

/* Функция showAboutModal: Открывает модальное окно с информацией о приложении */
function showAboutModal() {
    showModal('about-modal-template'); // Показываем шаблон "О программе"
}

/* Функция changeLanguage: Переключает язык интерфейса и закрывает боковое меню */
function changeLanguage() {
    currentLanguage = currentLanguage === 'ru' ? 'en' : 'ru'; // Переключаем язык (ru/en)
    localStorage.setItem('language', currentLanguage); // Сохраняем язык в localStorage
    console.log('Changing language to:', currentLanguage); // Логируем смену языка
    const sidebar = document.getElementById('sidebar'); // Находим боковое меню
    if (sidebar && sidebar.classList.contains('active')) { // Если меню открыто
        sidebar.classList.remove('active'); // Закрываем меню
    }
    loadLanguage(); // Загружаем переводы и карточки для нового языка
}

/* Функция toggleMenu: Переключает видимость бокового меню */
function toggleMenu() {
    const sidebar = document.getElementById('sidebar'); // Находим боковое меню
    if (sidebar) sidebar.classList.toggle('active'); // Переключаем класс active
}

/* Функция getRandomOptions: Возвращает массив случайных вариантов ответа */
function getRandomOptions(sourceArray, key, correctValue, count) {
    const options = [correctValue]; // Добавляем правильный ответ
    const available = sourceArray.filter(item => item[key] !== correctValue).map(item => item[key]); // Фильтруем остальные варианты
    for (let i = 0; i < count - 1; i++) { // Добавляем count-1 случайных вариантов
        if (available.length === 0) break; // Прерываем, если вариантов больше нет
        const randomIndex = Math.floor(Math.random() * available.length); // Случайный индекс
        options.push(available.splice(randomIndex, 1)[0]); // Добавляем вариант и удаляем его из доступных
    }
    return options.sort(() => Math.random() - 0.5); // Перемешиваем варианты
}

/* Функция selectOption: Обрабатывает выбор варианта ответа в режиме тестирования */
function selectOption(element, type, value) {
    if (type === 'letter') { // Если выбрана буква
        if (selectedLetter) { // Если уже выбрана буква
            selectedLetter.classList.remove('selected'); // Снимаем выделение
        }
        selectedLetter = element; // Сохраняем выбранный элемент
        selectedLetter.classList.add('selected'); // Добавляем класс selected
    } else { // Если выбрано слово
        if (selectedWord) { // Если уже выбрано слово
            selectedWord.classList.remove('selected'); // Снимаем выделение
        }
        selectedWord = element; // Сохраняем выбранный элемент
        selectedWord.classList.add('selected'); // Добавляем класс selected
    }

    const card = currentCards[currentCardIndex]; // Текущая карточка
    const isSingleDigit = 'digit' in card; // Проверяем, однозначная ли карточка
    if (isSingleDigit && selectedLetter && selectedWord) { // Если выбраны буква и слово для однозначной карточки
        checkAnswer(); // Проверяем ответ
    } else if (!isSingleDigit && selectedWord) { // Если выбрано слово для двузначной карточки
        checkAnswer(); // Проверяем ответ
    }
}

/* Функция toggleMode: Переключает режим тренировки/тестирования */
function toggleMode() {
    isMemorizationMode = !isMemorizationMode; // Переключаем режим
    fetch(`../i18n/${currentLanguage}.json`) // Загружаем переводы
        .then(response => response.json())
        .then(translations => {
            const modeTitle = document.getElementById('mode-title'); // Заголовок режима
            const modeButton = document.getElementById('mode-button'); // Кнопка переключения режима
            if (modeTitle) modeTitle.textContent = translations[isMemorizationMode ? 'training' : 'testing'] || 'Training'; // Обновляем заголовок
            if (modeButton) modeButton.title = translations[isMemorizationMode ? 'switch_to_testing' : 'switch_to_training'] || 'Switch Mode'; // Обновляем подсказку
        });
    stopAutoPlay(); // Останавливаем автопроигрывание
    stopAnswerTimer(); // Останавливаем таймер ответа
    saveSessionStats(); // Сохраняем статистику сессии
    stats.correct = 0; // Сбрасываем правильные ответы
    stats.incorrect = 0; // Сбрасываем неправильные ответы
    stats.timeout = 0; // Сбрасываем таймауты
    stats.attempts = []; // Очищаем попытки
    streak = 0; // Сбрасываем серию
    updateStatsDisplay(); // Обновляем статистику
    const optionsContainer = document.getElementById('options-container'); // Контейнер вариантов ответа
    if (optionsContainer) optionsContainer.innerHTML = ''; // Очищаем варианты
    showCard(); // Показываем карточку
}

/* Функция nextCard: Переходит к следующей карточке */
function nextCard() {
    const settings = JSON.parse(localStorage.getItem('settings')) || { order: 'sequential' }; // Получаем настройки
    if (settings.order === 'random') { // Если случайный порядок
        currentCardIndex = Math.floor(Math.random() * currentCards.length); // Случайный индекс
    } else { // Если последовательный порядок
        currentCardIndex = (currentCardIndex + 1) % currentCards.length; // Следующий индекс
    }
    stopAnswerTimer(); // Останавливаем таймер ответа
    showCard(); // Показываем карточку
}

/* Функция checkAnswer: Проверяет правильность ответа в режиме тестирования */
function checkAnswer() {
    stopAnswerTimer(); // Останавливаем таймер ответа
    const card = currentCards[currentCardIndex]; // Текущая карточка
    const isSingleDigit = 'digit' in card; // Проверяем, однозначная ли карточка
    const correctLetter = isSingleDigit ? card.letter : null; // Правильная буква
    const correctWord = card.word; // Правильное слово
    const feedback = document.getElementById('feedback'); // Элемент обратной связи
    const cardText = document.getElementById('card-text'); // Текст карточки
    const cardImage = document.getElementById('card-image'); // Изображение карточки
    const optionsContainer = document.getElementById('options-container'); // Контейнер вариантов
    const nextButton = document.getElementById('next-button'); // Кнопка "Далее"
    const startTime = Date.now(); // Время начала ответа
    let isCorrect = false; // Флаг правильности ответа

    fetch(`../i18n/${currentLanguage}.json`) // Загружаем переводы
        .then(response => response.json())
        .then(translations => {
            if (isSingleDigit) { // Для однозначных карточек
                isCorrect = selectedLetter?.textContent === correctLetter && selectedWord?.textContent === correctWord; // Проверяем букву и слово
            } else { // Для двузначных карточек
                isCorrect = selectedWord?.textContent === correctWord; // Проверяем слово
            }

            stats.attempts.push({ // Сохраняем попытку
                digit: isSingleDigit ? card.digit : card.number, // Цифра или число
                isCorrect, // Правильность
                selectedLetter: selectedLetter?.textContent, // Выбранная буква
                selectedWord: selectedWord?.textContent, // Выбранное слово
                time: Date.now() - startTime // Время ответа
            });
            stats[isCorrect ? 'correct' : 'incorrect']++; // Увеличиваем счётчик
            streak = isCorrect ? streak + 1 : 0; // Обновляем серию

            if (feedback) feedback.textContent = ''; // Очищаем обратную связь

            if (!isCorrect) { // Если ответ неправильный
                // Показываем правильный ответ как в режиме тренировки
                if (cardText) cardText.textContent = isSingleDigit ? card.letter : card.word; // Показываем букву/слово
                if (cardImage) {
                    cardImage.src = `../images/${encodeURIComponent(card.image)}`; // Показываем изображение
                    cardImage.style.display = 'block'; // Делаем изображение видимым
                }
                if (optionsContainer) optionsContainer.innerHTML = ''; // Очищаем варианты
                if (nextButton) nextButton.style.display = 'block'; // Показываем кнопку "Далее"

                // Настройка автоматического перехода
                const settings = JSON.parse(localStorage.getItem('settings')) || { answerTime: 5000 }; // Получаем настройки
                if (isAutoPlay) { // Если автопроигрывание
                    autoPlayTimeout = setTimeout(nextCard, settings.answerTime); // Переходим к следующей карточке
                }
            } else { // Если ответ правильный
                if (optionsContainer) optionsContainer.innerHTML = ''; // Очищаем варианты
                if (isAutoPlay) { // Если автопроигрывание
                    const settings = JSON.parse(localStorage.getItem('settings')) || { displayTime: 2000 }; // Получаем настройки
                    autoPlayTimeout = setTimeout(nextCard, settings.displayTime); // Переходим к следующей карточке
                } else {
                    nextCard(); // Переходим к следующей карточке
                }
            }

            if (streak === 10 && feedback) { // Если серия 10 правильных ответов
                feedback.textContent = translations.streak; // Показываем сообщение о серии
                feedback.style.color = 'green'; // Цвет сообщения
                setTimeout(() => {
                    if (feedback) feedback.textContent = ''; // Очищаем через 2 секунды
                }, 2000);
            }
        });
}

/* Функция startAnswerTimer: Запускает таймер ответа в режиме тестирования */
function startAnswerTimer() {
    stopAnswerTimer(); // Останавливаем предыдущий таймер
    if (!isMemorizationMode) { // Если режим тестирования
        const settings = JSON.parse(localStorage.getItem('settings')) || { answerTime: 5000 }; // Получаем настройки
        startTimer(settings.answerTime); // Запускаем таймер
        answerTimeout = setTimeout(() => { // Устанавливаем таймаут ответа
            const card = currentCards[currentCardIndex]; // Текущая карточка
            const isSingleDigit = 'digit' in card; // Проверяем, однозначная ли
            const feedback = document.getElementById('feedback'); // Элемент обратной связи
            const cardText = document.getElementById('card-text'); // Текст карточки
            const cardImage = document.getElementById('card-image'); // Изображение карточки
            const optionsContainer = document.getElementById('options-container'); // Контейнер вариантов
            const nextButton = document.getElementById('next-button'); // Кнопка "Далее"

            stats.timeout++; // Увеличиваем счётчик таймаутов
            stats.attempts.push({ // Сохраняем попытку
                digit: isSingleDigit ? card.digit : card.number, // Цифра или число
                isCorrect: false, // Ответ неправильный
                selectedLetter: null, // Нет выбранной буквы
                selectedWord: null, // Нет выбранного слова
                time: settings.answerTime // Время ответа
            });
            streak = 0; // Сбрасываем серию

            if (feedback) feedback.textContent = ''; // Очищаем обратную связь

            // Показываем правильный ответ
            if (cardText) cardText.textContent = isSingleDigit ? card.letter : card.word; // Показываем букву/слово
            if (cardImage) {
                cardImage.src = `../images/${encodeURIComponent(card.image)}`; // Показываем изображение
                cardImage.style.display = 'block'; // Делаем изображение видимым
            }
            if (optionsContainer) optionsContainer.innerHTML = ''; // Очищаем варианты
            if (nextButton) nextButton.style.display = 'block'; // Показываем кнопку "Далее"

            // Настройка автоматического перехода
            if (isAutoPlay) { // Если автопроигрывание
                autoPlayTimeout = setTimeout(nextCard, settings.answerTime); // Переходим к следующей карточке
            }
        }, settings.answerTime);
    }
}

/* Функция startTimer: Запускает обратный отсчёт времени */
function startTimer(duration) {
    let timeLeft = duration / 1000; // Оставшееся время в секундах
    fetch(`../i18n/${currentLanguage}.json`) // Загружаем переводы
        .then(response => response.json())
        .then(translations => {
            const timer = document.getElementById('timer'); // Элемент таймера
            if (timer) {
                timer.textContent = `${translations.time_left}: ${timeLeft.toFixed(1)} ${translations.seconds}`; // Показываем время
                timerInterval = setInterval(() => { // Запускаем интервал
                    timeLeft -= 0.1; // Уменьшаем время
                    if (timeLeft <= 0) { // Если время истекло
                        stopTimer(); // Останавливаем таймер
                        if (timer) timer.textContent = translations.time_out; // Показываем "Время вышло"
                    } else {
                        if (timer) timer.textContent = `${translations.time_left}: ${timeLeft.toFixed(1)} ${translations.seconds}`; // Обновляем время
                    }
                }, 100);
            }
        });
}

/* Функция stopTimer: Останавливает таймер обратного отсчёта */
function stopTimer() {
    if (timerInterval) { // Если таймер активен
        clearInterval(timerInterval); // Останавливаем интервал
        timerInterval = null; // Сбрасываем интервал
    }
    const timer = document.getElementById('timer'); // Элемент таймера
    if (timer) timer.textContent = ''; // Очищаем текст
}

/* Функция stopAnswerTimer: Останавливает таймер ответа */
function stopAnswerTimer() {
    if (answerTimeout) { // Если таймаут ответа активен
        clearTimeout(answerTimeout); // Останавливаем таймаут
        answerTimeout = null; // Сбрасываем таймаут
    }
    stopTimer(); // Останавливаем таймер
}

/* Функция toggleAutoPlay: Переключает режим автопроигрывания */
function toggleAutoPlay() {
    isAutoPlay = !isAutoPlay; // Переключаем флаг автопроигрывания
    fetch(`../i18n/${currentLanguage}.json`) // Загружаем переводы
        .then(response => response.json())
        .then(translations => {
            const autoButton = document.getElementById('auto-button'); // Кнопка автопроигрывания
            if (autoButton) {
                autoButton.textContent = isAutoPlay ? '⏸' : '▶'; // Меняем иконку кнопки
                autoButton.title = translations[isAutoPlay ? 'stop_autoplay' : 'start_autoplay'] || 'Auto-play'; // Обновляем подсказку
            }
            const nextButton = document.getElementById('next-button'); // Кнопка "Далее"
            if (nextButton) nextButton.style.display = isAutoPlay ? 'none' : 'block'; // Управляем видимостью
            if (isAutoPlay) { // Если автопроигрывание включено
                if (isMemorizationMode) { // В режиме тренировки
                    const settings = JSON.parse(localStorage.getItem('settings')) || { displayTime: 2000 }; // Получаем настройки
                    autoPlayTimeout = setTimeout(nextCard, settings.displayTime); // Запускаем автопроигрывание
                } else { // В режиме тестирования
                    checkAnswer(); // Проверяем ответ
                }
            } else { // Если автопроигрывание выключено
                stopAutoPlay(); // Останавливаем автопроигрывание
                stopAnswerTimer(); // Останавливаем таймер ответа
            }
        });
}

/* Функция stopAutoPlay: Останавливает автопроигрывание */
function stopAutoPlay() {
    isAutoPlay = false; // Отключаем автопроигрывание
    fetch(`../i18n/${currentLanguage}.json`) // Загружаем переводы
        .then(response => response.json())
        .then(translations => {
            const autoButton = document.getElementById('auto-button'); // Кнопка автопроигрывания
            if (autoButton) {
                autoButton.textContent = '▶'; // Устанавливаем иконку "Play"
                autoButton.title = translations.start_autoplay || 'Start Auto-play'; // Обновляем подсказку
            }
            const nextButton = document.getElementById('next-button'); // Кнопка "Далее"
            if (nextButton) nextButton.style.display = 'block'; // Показываем кнопку
            if (autoPlayTimeout) { // Если таймер автопроигрывания активен
                clearTimeout(autoPlayTimeout); // Останавливаем таймер
                autoPlayTimeout = null; // Сбрасываем таймер
            }
        });
}

/* Функция updateStatsDisplay: Пустая функция для обновления статистики (не реализована) */
function updateStatsDisplay() {
}

/* Функция showStats: Отображает статистику в модальном окне */
function showStats() {
    saveSessionStats(); // Сохраняем статистику сессии
    showModal('stats-modal-template'); // Показываем шаблон статистики
    const total = stats.correct + stats.incorrect + stats.timeout; // Общее количество попыток
    const accuracy = total > 0 ? ((stats.correct / total) * 100).toFixed(1) : 0; // Точность в процентах
    fetch(`../i18n/${currentLanguage}.json`) // Загружаем переводы
        .then(response => response.json())
        .then(translations => {
            const summary = document.getElementById('stats-summary'); // Элемент для сводки
            if (summary) {
                summary.innerHTML = ` // Формируем HTML для сводки
                    <p>${translations.correct}: ${stats.correct}</p>
                    <p>${translations.incorrect}: ${stats.incorrect}</p>
                    <p>${translations.timeout}: ${stats.timeout}</p>
                    <p>${translations.accuracy}: ${accuracy}%</p>
                    <p>${translations.average_time}: ${calculateAverageTime().toFixed(1)} ${translations.ms}</p>
                    <h4>${translations.errors}:</h4>
                    <ul>${generateErrorList()}</ul>
                `;
            }
            const ctx = document.getElementById('stats-chart'); // Элемент для графика
            if (ctx) {
                new Chart(ctx.getContext('2d'), { // Создаём круговую диаграмму
                    type: 'pie',
                    data: {
                        labels: [translations.correct, translations.incorrect, translations.timeout], // Метки
                        datasets: [{
                            data: [stats.correct, stats.incorrect, stats.timeout], // Данные
                            backgroundColor: ['#4CAF50', '#EF4444', '#F59E0B'] // Цвета
                        }]
                    },
                    options: {
                        responsive: true, // Адаптивность
                        plugins: { legend: { position: 'bottom' } } // Позиция легенды
                    }
                });
            }
            const historyBody = document.getElementById('history-table-body'); // Тело таблицы истории
            if (historyBody) {
                historyBody.innerHTML = ''; // Очищаем таблицу
                stats.history.forEach((session, index) => { // Для каждой сессии
                    const sessionTotal = session.correct + session.incorrect + session.timeout; // Общее количество
                    const sessionAccuracy = sessionTotal > 0 ? ((session.correct / sessionTotal) * 100).toFixed(1) : 0; // Точность
                    const row = document.createElement('tr'); // Создаём строку
                    row.innerHTML = `
                        <td>${new Date(session.date).toLocaleString()}</td>
                        <td>${session.correct}</td>
                        <td>${session.incorrect}</td>
                        <td>${session.timeout}</td>
                        <td>${sessionAccuracy}%</td>
                    `;
                    historyBody.appendChild(row); // Добавляем строку
                });
            }
            const historyCtx = document.getElementById('history-chart'); // Элемент для графика истории
            if (historyCtx) {
                const historyData = stats.history.map(session => { // Данные точности по сессиям
                    const sessionTotal = session.correct + session.incorrect + session.timeout;
                    return sessionTotal > 0 ? (session.correct / sessionTotal) * 100 : 0;
                });
                new Chart(historyCtx.getContext('2d'), { // Создаём линейный график
                    type: 'line',
                    data: {
                        labels: stats.history.map((_, i) => `${translations.session} ${i + 1}`), // Метки
                        datasets: [{
                            label: translations.accuracy_percent, // Название
                            data: historyData, // Данные
                            borderColor: '#3B82F6', // Цвет линии
                            fill: false // Без заливки
                        }]
                    },
                    options: {
                        responsive: true, // Адаптивность
                        scales: { y: { beginAtZero: true, max: 100 } } // Настройка оси Y
                    }
                });
            }
        });
}

/* Функция calculateAverageTime: Вычисляет среднее время ответа */
function calculateAverageTime() {
    const times = stats.attempts.map(attempt => attempt.time).filter(time => time !== undefined); // Фильтруем времена
    return times.length > 0 ? times.reduce((sum, time) => sum + time, 0) / times.length : 0; // Вычисляем среднее
}

/* Функция generateErrorList: Генерирует список ошибок для статистики */
function generateErrorList() {
    const errors = stats.attempts.filter(attempt => !attempt.isCorrect); // Фильтруем ошибки
    const errorMap = {}; // Объект для группировки ошибок
    errors.forEach(attempt => {
        const key = attempt.digit; // Ключ — цифра или число
        if (!errorMap[key]) {
            errorMap[key] = { count: 0, details: [] }; // Инициализируем
        }
        errorMap[key].count++; // Увеличиваем счётчик
        errorMap[key].details.push(`Selected: ${attempt.selectedLetter || '-'}, ${attempt.selectedWord || '-'}`); // Добавляем детали
    });
    return Object.entries(errorMap).map(([digit, data]) => ` // Формируем HTML-список
        <li>${digit}: ${data.count} error${data.count === 1 ? '' : 's'} (${data.details.join('; ')})</li>
    `).join('');
}

/* Функция saveSessionStats: Сохраняет статистику текущей сессии */
function saveSessionStats() {
    const total = stats.correct + stats.incorrect + stats.timeout; // Общее количество попыток
    if (total > 0) { // Если были попытки
        stats.history.push({ // Добавляем сессию
            date: new Date().toISOString(), // Дата сессии
            correct: stats.correct, // Правильные ответы
            incorrect: stats.incorrect, // Неправильные ответы
            timeout: stats.timeout, // Таймауты
            attempts: stats.attempts // Попытки
        });
        if (stats.history.length > 10) { // Ограничиваем историю 10 сессиями
            stats.history.shift(); // Удаляем старую
        }
        localStorage.setItem('statsHistory', JSON.stringify(stats.history)); // Сохраняем историю
    }
}

/* Функция exportStats: Экспортирует статистику в CSV-файл */
function exportStats() {
    fetch(`../i18n/${currentLanguage}.json`) // Загружаем переводы
        .then(response => response.json())
        .then(translations => {
            const csv = [ // Формируем CSV
                `${translations.date},${translations.correct},${translations.incorrect},${translations.timeout},${translations.accuracy},${translations.average_time_ms}`,
                ...stats.history.map(session => { // Для каждой сессии
                    const total = session.correct + session.incorrect + session.timeout; // Общее количество
                    const accuracy = total > 0 ? ((session.correct / total) * 100).toFixed(1) : 0; // Точность
                    const avgTime = session.attempts.map(a => a.time).filter(t => t !== undefined).reduce((sum, t) => sum + t, 0) / session.attempts.length || 0; // Среднее время
                    return `${new Date(session.date).toLocaleString()},${session.correct},${session.incorrect},${session.timeout},${accuracy},${avgTime.toFixed(1)}`; // Строка CSV
                })
            ].join('\n');
            const blob = new Blob([csv], { type: 'text/csv' }); // Создаём CSV-файл
            const url = URL.createObjectURL(blob); // Создаём URL
            const a = document.createElement('a'); // Создаём ссылку
            a.href = url; // Устанавливаем URL
            a.download = 'stats.csv'; // Имя файла
            a.click(); // Запускаем скачивание
            URL.revokeObjectURL(url); // Освобождаем URL
        });
}

/* Функция resetStats: Сбрасывает статистику */
function resetStats() {
    stats.history = []; // Очищаем историю
    localStorage.removeItem('statsHistory'); // Удаляем историю из localStorage
    stats.correct = 0; // Сбрасываем правильные ответы
    stats.incorrect = 0; // Сбрасываем неправильные ответы
    stats.timeout = 0; // Сбрасываем таймауты
    stats.attempts = []; // Очищаем попытки
    streak = 0; // Сбрасываем серию
    updateStatsDisplay(); // Обновляем статистику
    closeModal(); // Закрываем модальное окно
}


/* Событие DOMContentLoaded: Инициализирует приложение */
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing application'); // Логируем инициализацию
    loadLanguage(); // Загружаем язык и карточки
});

/* Событие click: Закрывает боковое меню при клике вне его */
document.addEventListener('click', function(e) {
    const sidebar = document.getElementById('sidebar'); // Боковое меню
    const menuButton = document.getElementById('menu-button'); // Кнопка меню
    if (sidebar && sidebar.classList.contains('active') && !sidebar.contains(e.target) && !menuButton.contains(e.target)) { // Если меню открыто и клик вне его
        sidebar.classList.remove('active'); // Закрываем меню
    }
});

/* Событие click на модальном окне: Закрывает модальное окно при клике на фон */
document.getElementById('modal')?.addEventListener('click', function(e) {
    if (e.target === this) { // Если клик на фоне модального окна
        closeModal(); // Закрываем модальное окно
    }
});