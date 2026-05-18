<div align="center">

# QueueLess

AI-powered queue management system designed for hospitals, clinics, and public service centers in Pakistan.

Reduce physical waiting time through QR-based queue access, live tracking, and smart wait-time prediction.

</div>

---

## About QueueLess

QueueLess is a lightweight and accessible queue management solution built to solve long waiting lines in hospitals and public offices.

Users can:
- Join queues remotely
- Scan a QR code to enter a queue
- Track their live position
- Receive estimated waiting times

The system is designed specifically for low-end devices and low-internet environments.

---

## Features

- Remote queue joining
- QR-based access
- Live queue tracking
- AI-based wait time prediction
- Minimal admin panel
- Mobile-friendly interface
- English and Urdu support

---

## Tech Stack

### Frontend
- React
- JavaScript
- HTML/CSS

### Backend
- Node.js
- Express.js

### Database
- Firebase Firestore

### Deployment
- Firebase Hosting
- Google Cloud Run

---

## Run Locally

### Prerequisites
- Node.js
- Firebase project
- Gemini API Key (if AI features are enabled)

### Installation

1. Clone the repository

```bash
git clone <repository-link>
```

2. Install dependencies

```bash
npm install
```

3. Create a `.env.local` file and add:

```env
GEMINI_API_KEY=your_api_key
```

4. Run the development server

```bash
npm run dev
```

---

## How It Works

1. Admin creates a service queue
2. A QR code is generated
3. Users scan the QR or join remotely
4. Users receive queue updates in real time
5. Admin advances the queue with a single action

---

## Future Improvements

- SMS notifications
- Multi-service support
- Google Maps integration
- Urdu voice assistance
- Analytics dashboard

---

## Goal

QueueLess aims to make public services more efficient, organized, and accessible for everyone.

---

## Author

Built by **Khadija Bilal** for **AISeekho 2026**.
