# MemoryTraining

## Description
MemoryTraining is a web application designed to improve memory skills by training users to memorize associations between numbers, letters, words, and images. The application features two modes—Training and Testing—along with customizable settings, statistics tracking, and bilingual support (English and Russian). It is optimized for both desktop and mobile devices, hosted on GitHub Pages.

## Problem
Memorizing complex associations, such as linking numbers to specific words or images, can be challenging and time-consuming without structured practice. Existing tools often lack user-friendly interfaces, bilingual support, or the ability to track progress effectively.

## Solution
MemoryTraining provides an intuitive web-based platform with:
- **Training Mode**: Displays cards with numbers, letters, words, and images for memorization.
- **Testing Mode**: Challenges users to recall associations within a time limit.
- **Customizable Settings**: Allows users to adjust card ranges and timing.
- **Statistics Tracking**: Records performance metrics and supports CSV export.
- **Bilingual Interface**: Supports English and Russian with JSON-based internationalization.
- **Responsive Design**: Works seamlessly on desktop and mobile devices.

The application is hosted on GitHub Pages for easy access and includes downloadable PDF instructions in both languages.

## Technologies
- **Programming Languages**: Python 3.12, HTML, CSS, JavaScript
- **Development Environment**: PyCharm on Linux
- **Version Control**: Git, hosted on GitHub
- **Hosting**: GitHub Pages
- **Other Tools**: JSON for internationalization, Python HTTP server for local testing

## Result
MemoryTraining simplifies memory training, enabling users to practice associations efficiently. It saves time by providing instant feedback, progress tracking, and customizable settings, making it suitable for both beginners and advanced learners.

---

## How to Use

### Run the Application Locally
1️⃣ Clone the repository:
```bash
git clone https://github.com/Rostislav62/Rostislav62.github.io.git
cd Rostislav62.github.io
```

2️⃣ Navigate to the project directory:
```bash
cd stats
```

3️⃣ Start a local server:
```bash
python3.12 -m http.server 8000
```

4️⃣ Open the application in your browser:
```
http://localhost:8000
```

Access the application:
- Main interface: `http://localhost:8000/`
- Instructions and About pages are available via the sidebar menu.

---

## Features
- **Training Mode**: View cards with numbers, letters, words, and images to memorize associations.
- **Testing Mode**: Select correct letters and words for given numbers within a time limit.
- **Settings**: Customize card range, order (sequential or random), and timing for both modes.
- **Statistics**: Track performance with detailed metrics and export results to CSV.
- **Bilingual Support**: Switch between English and Russian interfaces using JSON-based localization.
- **PDF Instructions**: Download detailed user guides in English or Russian from the Instructions modal.
- **Responsive Design**: Optimized for desktop and mobile devices with light and dark theme support.

## Project Structure
- `stats/index.html`: Main application file with HTML structure and modals.
- `stats/script.js`: JavaScript logic for card display, mode switching, and modal handling.
- `stats/styles.css`: CSS styles for responsive design and theme support.
- `i18n/en.json`, `i18n/ru.json`: Translation files for English and Russian interfaces.
- `stats/docs/MemoryTraining_Instructions_en.pdf`, `stats/docs/MemoryTraining_Instructions_ru.pdf`: Bilingual user guides.

## License
MIT License  
© 2025 Rostislav  
Learn more about the author at [SkillFlux Portfolio](https://skillflux.dev/).