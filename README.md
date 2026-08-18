# AI Career Copilot

**Your AI career copilot, inside every job listing.**

AI Career Copilot is a powerful Chrome extension that acts as your personal assistant for job hunting. It automatically detects job postings, analyzes your resume against the role, and helps you tailor your application, track your progress, and prepare for interviews.

---

## 🚀 What It Does

Open any job posting on sites like LinkedIn, Greenhouse, or Workday, and the extension will instantly:

- **Analyze Your Fit:** Compare the role against your resume to provide an explainable match score.
- **Identify Gaps:** Highlight missing skills and keywords to improve your ATS (Applicant Tracking System) coverage.
- **Tailor Your Application:** Automatically generate custom-tailored resumes and cover letters for the specific job.
- **Interview Prep:** Generate personalized interview questions and talking points based on your experience and the job description.
- **Track Everything:** Save the job details and your application status in a built-in application tracker that you can export to CSV or Excel.

---

## 🔒 Privacy-First

Your data belongs to you. AI Career Copilot is built with a strict privacy-first architecture:

- **Local Storage:** Your resume, application tracker, and API keys live completely locally in your browser (`chrome.storage.local`).
- **No Telemetry:** We don't track your browsing history or secretly upload your resume to the cloud. 
- **Direct API Calls:** Your resume data is only sent directly to the AI provider you configure (like Google or OpenAI) to generate your analysis. No middleman servers are used.

---

## 🔑 Bring Your Own Key (BYOK)

To keep the extension free and privacy-focused, you provide your own API key. You can choose from **Google Gemini**, **OpenAI**, **Anthropic**, or **OpenRouter**.

- The key is saved securely in your browser's local storage.
- It is never logged, never placed in a URL, and is excluded from every export.
- Usage is billed directly to your own provider account, ensuring you are in full control of your costs.

Adding your key is easy: simply open the extension's **Settings**, choose your preferred provider, and paste your API key!

---

## 🛠️ How to Install (Developer Mode)

To install the extension locally from the source code, follow these steps:

1. **Clone the repository and install dependencies:**
   ```bash
   git clone <repository-url>
   cd job-tracker
   npm install
   ```

2. **Build the extension:**
   ```bash
   npm run build:ext
   ```

3. **Load it into Chrome:**
   - Open Chrome and navigate to `chrome://extensions`
   - Turn on **Developer mode** (toggle in the top right corner)
   - Click **Load unpacked** in the top left
   - Select the `apps/extension/dist` folder from the project directory.

The onboarding screen will open automatically. Upload your resume, plug in your AI API key, and you're ready to go!

---

## 🤝 Contributing

Fellow developers are more than welcome to contribute to the code! Whether you want to suggest improvements, hunt down bugs, or add support for new ATS platforms:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Feel free to open an issue if you find a bug or have a feature request. Let's build the best job search tool together!
