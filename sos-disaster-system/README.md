# Online SOS & Disaster Management System (Pro Edition)

A production-ready full-stack application for emergency response and disaster management.

## 🚀 Key Features

- **Real-Time SOS Alerts**: Instant notifications on the dashboard using Socket.io.
- **Interactive Maps**: Live tracking of SOS requests on OpenStreetMap (Leaflet).
- **Secure Admin Portal**: JWT-based authentication for responders and admins.
- **Disaster Alerts**: Integrated mock API for weather and disaster warnings.
- **Premium UI**: Modern, glassmorphism-inspired design with smooth animations.
- **Mobile-First**: Optimized for citizens to report emergencies quickly.

## 🛠 Tech Stack

- **Backend**: Node.js, Express, MongoDB, Socket.io, JWT
- **Frontend**: React, Vite, Leaflet, Socket.io Client, CSS3 (Glassmorphism)

## 📦 Installation & Setup

### 1. Backend Setup

1. Navigate to the server directory:
   ```bash
   cd server
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure Environment Variables:
   - Create a `.env` file (template provided).
   - Set `MONGO_URI` and `JWT_SECRET`.
4. Start the server:
   ```bash
   npm run dev
   ```
   Server runs on `http://localhost:5000`.

### 2. Frontend Setup

1. Open a new terminal and navigate to the client directory:
   ```bash
   cd client
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
   Frontend runs on `http://localhost:5173`.

## 📱 Usage Guide

### Citizen (Mobile)
1. Open the app on a mobile device.
2. Click **"Send SOS Alert"**.
3. Location is auto-detected. Select type (Fire, Medical, etc.) and upload a photo.
4. Hit **SEND**.

### Admin (Desktop)
1. Go to `/login` and sign in (Register a user via API or use default if configured).
2. Access the **Admin Dashboard**.
3. View live SOS markers on the map.
4. Watch the list update **instantly** as new requests come in.
5. Change status to "Dispatched" or "Resolved".

## 📡 API Endpoints

- `POST /api/auth/login`: Admin login.
- `POST /api/sos`: Create SOS request (emits socket event).
- `GET /api/sos`: Fetch all requests.
- `GET /api/disasters/alerts`: Fetch active disaster warnings.

## ⚠️ Notes

- **Map**: Uses OpenStreetMap (free). No API key required.
- **Images**: Stored locally in `server/uploads`.
- **Real-time**: Ensure port 5000 is not blocked for Socket.io.
