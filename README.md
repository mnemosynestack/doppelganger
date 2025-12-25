# Doppelgänger 🕵️‍♂️

**The high-performance, stealth-focused browser automation microservice.**

Based on Microsoft's Playwright, Doppelgänger is designed for seamless data extraction and web infiltration. It features advanced behavioral simulation to bypass detection and captures mission telemetry through human behavior simulation.

---

## 🐳 Quick Start with Docker

Doppelgänger is optimized for standard Docker environments, ensuring all browser dependencies are pre-configured.

### 1. Build the Image
```bash
docker build -t doppelganger-scraper .
```

### 2. Run the Container
```bash
docker run -d \
  -p 3000:3000 \
  -v $(pwd)/storage_state.json:/app/storage_state.json \
  -v $(pwd)/public/screenshots:/app/public/screenshots \
  --name doppelganger \
  doppelganger-scraper
```

*   **Access the UI**: Open `http://localhost:3000/test` in your browser.
*   **API Endpoints**: `POST /agent` or `POST /scrape`

---

## 🎭 Mission Modes

### 1. Scraper Mode (`/scrape`)
**Best for: Public data and rapid monitoring.**
A stateless engine optimized for speed. It navigates, waits, and extracts content instantly. Ideal for SEO tracking, price monitoring, and public indexing.

### 2. Agent Mode (`/agent`)
**Best for: Authenticated portals and anti-bot bypass.**
A stateful engine that simulates human behavior (clicks, typing, physics-based scrolling) to remain undetected. Perfect for social media automation and deep-site scraping.

### 3. Headful Mode (`/headful`)
**Best for: Manual Auth (2FA, Captchas).**
A bootstrap mode that launches a visible browser window. Use this for initial login rituals. Once closed, your session is saved to `storage_state.json` and inherited by all headless automation.

---

## 🦾 Advanced Stealth Features

| Feature | User Value |
| :--- | :--- |
| **Rotate UA** | Randomized browser fingerprints to prevent detection. |
| **Natural Typing** | Rhythmic, variable delays mimicking human input speed. |
| **Human Typos** | Occasional mistakes and corrections to bypass behavioral analysis. |
| **Restless Idle** | Keeps the session "alive" with natural cursor jitters and drifts. |
| **Overscroll** | Physics-based scrolling with realistic human overshoot. |
| **Dead Clicks** | Random non-functional clicks to mimic exploration. |
| **Fatigue Emulation** | Increasing response variability over long sessions. |

---

## 🔒 Session & Asset Persistence

To ensure your sessions and captured data survive container updates, always mount these volumes:
*   **`storage_state.json`**: Keeps your logged-in cookies and localStorage persistent.
*   **`public/screenshots`**: Stores all captured visual telemetry files.

---

## 🎮 Visual Action Builder (BETA)

Doppelgänger includes a built-in dashboard for rapid action planning.
*   **Visual Interface**: Build complex "Agent" sequences without writing code.
*   **Real-time Sync**: Watch your visual steps turn into technical JSON scripts instantly.
*   **Live Metrics**: View browser screenshots and execution logs in a premium dark-mode interface.

---

## 🧪 cURL API Example

```bash
curl -X POST http://localhost:3000/agent \
     -H "Content-Type: application/json" \
     -d '{
       "url": "https://www.example.com",
       "actions": [
         { "type": "fill", "selector": "#search", "value": "Agent Zero" },
         { "type": "press", "key": "Enter" }
       ]
     }'
```

---

## 📄 License
This project is licensed under the **Apache License 2.0**. See the [LICENSE](LICENSE) file for the full text.

