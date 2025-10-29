# Pano Viewer Project

This project consists of a React frontend application called "pano-viewer" and an Express.js backend server.

## Project Structure

```
360_Viewer/
├── pano-viewer/          # React frontend application
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── ...
└── backend/              # Express.js backend server
    ├── server.js
    ├── package.json
    ├── .env.example
    └── ...
```

## Setup Instructions

### Frontend (React App)

1. Navigate to the frontend directory:
   ```bash
   cd pano-viewer
   ```

2. Install dependencies (if not already installed):
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```

   The React app will run on `http://localhost:3000`

### Backend (Express.js Server)

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies (if not already installed):
   ```bash
   npm install
   ```

3. Copy the environment file:
   ```bash
   copy .env.example .env
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

   The Express server will run on `http://localhost:5000`

## Available Scripts

### Frontend (pano-viewer)
- `npm start` - Runs the app in development mode
- `npm run build` - Builds the app for production
- `npm test` - Launches the test runner
- `npm run eject` - Ejects from Create React App (one-way operation)

### Backend
- `npm start` - Runs the server in production mode
- `npm run dev` - Runs the server in development mode with nodemon
- `npm run build` - Builds the React frontend from the backend directory

## API Endpoints

### Health Check
- `GET /api/health` - Returns server status and timestamp

## Production Deployment

1. Build the React application:
   ```bash
   cd pano-viewer
   npm run build
   ```

2. Start the Express server:
   ```bash
   cd ../backend
   npm start
   ```

The Express server will serve the built React application and handle API requests.

## Development Notes

- The backend is configured to serve the React build files in production
- CORS is enabled for development
- The server includes a catch-all route to serve the React app for client-side routing
- Environment variables can be configured in the `.env` file in the backend directory