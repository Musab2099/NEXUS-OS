Personal OS (Dark Glass Edition)

Personal OS is a unified, high-performance ecosystem of personal tracking applications. It is designed for users who want to own their data, avoid subscription-based SaaS tools, and enjoy a premium, cohesive aesthetic.

The suite is built as a Local-First system: it runs entirely in your browser, stores data in localStorage for instant access, and optionally mirrors that data to a Supabase cloud database for multi-device synchronization.




🏛 Architecture & Design Philosophy

1. Zero-Dependency Core

Unlike modern web apps that rely on heavy frameworks (React, Vue, etc.), Personal OS is built with Vanilla JavaScript, CSS3, and HTML5.

•
No Build Step: No npm install, no webpack, no vite.

•
Instant Portability: The entire OS can be carried on a thumb drive or hosted on any static provider (Vercel, GitHub Pages, Netlify).

•
Performance: Sub-millisecond UI response times because there is no virtual DOM overhead.

2. "Dark Glass" Aesthetic

The UI is engineered to be visually immersive without being distracting:

•
Glassmorphism: Uses backdrop-filter: blur(24px) to create deep, layered transparency.

•
Organic Motion: Backgrounds feature drifting radial washes and film-grain textures to prevent the "plastic" look of flat digital themes.

•
Precision Typography: Uses a system font stack for speed and tabular mono-fonts for numeric data to ensure perfect alignment in charts and tables.




🧩 The Core Modules

🎯 Goals & Consistency (index.html)

The nerve center of the OS.

•
Day Ring: A circular SVG progress bar that tracks your "awake window" (8 AM – Midnight), changing color from morning gold to twilight purple as the day progresses.

•
Monthly Consistency Chart: A dynamic bar chart that analyzes your localStorage history to show completion rates month-over-month.

•
Smart Rollover: Automatically pulls undone goals from previous days into today’s list at 6 AM.

💊 Supplement Stack (health.html)

A specialized manager for health protocols.

•
Windowed Tracking: Organizes supplements by Morning, Midday, and Evening.

•
Inventory Alerts: Flags items that are running low or have been missed.

•
Quick-Log: Integrated with the shared top bar for one-tap tracking.

💧 Water Coach (po-water.html)

A hydration engine that goes beyond simple "8 glasses a day."

•
Dynamic Targets: Calculates needs based on body weight, age, sex, and exercise.

•
Adjustments: Automatically increases your daily target based on caffeine intake or specific dehydrating substances.

🏋️ Summer Grind Gym (gym.html)

A workout tracker focused on progression.

•
Split Management: Pre-configured for Push, Pull, Legs, and Core.

•
Skill Progression: Dedicated tracking for high-level skills like the Planche, divided into achievable phases.

•
Weight Tracking: Integrated bodyweight logging with goal visualization.

📈 Finance Dashboard (finance.html)

A secure, private view of your net worth.

•
Asset Allocation: Visualizes your portfolio across different classes.

•
Delta Tracking: Shows growth or decline with stock-market style badges.

•
Privacy First: Since it's local-first, your financial data never touches a server unless you explicitly enable Supabase sync.




☁️ Cloud Synchronization (sync.js)

Personal OS uses a unique "Bridge" synchronization method:

1.
Local-First: All writes happen to localStorage first. The UI never waits for a server.

2.
Debounced Sync: sync.js detects changes and sends a debounced update to Supabase.

3.
Real-time Mirroring: Using PostgreSQL Row Level Security and WebSockets, other devices (like your phone) receive the update and patch their local storage instantly.




🚀 Getting Started

1. Deployment

The easiest way to get your own instance is via Vercel:










2. Supabase Configuration (Optional)

To enable sync:

1.
Create a project at Supabase.

2.
Run the SQL provided in the sync.js comments to create the app_state table.

3.
Paste your SUPABASE_URL and SUPABASE_KEY into sync.js and topbar.js.




🛠 Development & Extension

To add a new page to the suite:

1.
Create a new .html file.

2.
Include the shared assets:

HTML


<script src="sync.js" defer></script>
<script src="topbar.js" defer></script>





3.
Use the CSS variables defined in :root (e.g., --text-primary, --success) to maintain the aesthetic.




📜 License

This project is open-source. Feel free to fork, customize, and build your own personal operating system.




