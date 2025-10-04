Cloudflare DNS Manager

A lightweight web-based DNS manager for Cloudflare, packaged in a single Docker container.
This tool provides a simple and secure interface for managing DNS records (A, AAAA, CNAME, TXT, MX, NS, PTR) with proxy toggles, comments, record restrictions, and dark mode support.

✨ Features

Single Container App: Backend (Node.js + Express) + Frontend (React + Vite) in one container

Authentication: All API routes protected by APP_PASSWORD

Cloudflare API Integration: Manage zones and DNS records via CF_API_TOKEN

Record Support: A, AAAA, CNAME, TXT, MX, NS, PTR

Proxy Toggle: Enable/disable Cloudflare proxy for A/AAAA/CNAME

Read-Only Protection: Records flagged read_only by Cloudflare cannot be modified

Search & Filter: Filter by type and search by name/content/comment

Bulk Actions: Multi-select DNS entries for deletion

Dark Mode: Toggle with persistence

UI: 3D-style buttons, centered modals, tooltips for comments, responsive design

Debug Logs: All requests and Cloudflare API calls logged

🛠 Tech Stack

Backend

Node.js 20 (Alpine base)

Express, node-fetch, dotenv, cors, morgan

Frontend

React + Vite

Custom CSS

Containerization

Multi-stage Dockerfile

docker-compose.yml

⚙ Environment Variables
Variable	Description
APP_PASSWORD	Password to access the UI/API
CF_API_TOKEN	Cloudflare API token (Zone:Read, DNS:Edit)
🚀 Quick Start
Clone & Configure
git clone https://github.com/your-username/cloudflare-dns-manager.git
cd cloudflare-dns-manager
cp .env.example .env
# Edit .env with your APP_PASSWORD and CF_API_TOKEN

Run with Docker Compose
docker compose up --build -d

Access

Open http://localhost:8080
 in your browser and login with your APP_PASSWORD.

📡 API Endpoints

All requests require x-app-password header or app_password cookie.

Method	Endpoint	Description
GET	/api/health	Health check
GET	/api/zones	List zones
GET	/api/zone/:zoneId/dns_records	List DNS records
POST	/api/zone/:zoneId/dns_records	Create record
PUT	/api/zone/:zoneId/dns_records/:id	Update record
DELETE	/api/zone/:zoneId/dns_records/:id	Delete record
🖥 Frontend
Login Page

Centered login card with password input

Buttons: Login, Clear, Reload

Zone Selection

Compact cards showing zone name and type badge

“Open” button to manage DNS

Sign Out button in header

DNS Management

Header: DNS Manager for Zone ZONENAME (highlighted)

Search & filter bar (type + text search + clear)

Add Record (green), Delete Selected (red, disabled until checked)

Table:

Select (🔒 for read-only)

Type

Name (📜 tooltip if comment exists)

Content (truncated + tooltip if long)

TTL

Proxy (toggle for A/AAAA/CNAME, DNS only for others)

Priority (MX pill style beside content)

Actions (Edit/Delete; disabled for read-only)

Modals

Add/Edit Record: aligned form, proxy toggle slider, priority only for MX

Delete Record: single or bulk confirm, compact popup

All popups have single shadow and proper spacing

Dark Mode

Footer toggle after “Powered by Cloudflare DNS API • © iAmSaugata”

Persists in localStorage

📝 Development
Run Frontend Only
cd frontend
npm install
npm run dev

Run Backend Only
cd backend
npm install
node server.js

📜 License

MIT License
Powered by Cloudflare DNS API • © iAmSaugata
