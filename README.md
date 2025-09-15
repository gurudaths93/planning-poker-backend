# Planning Poker Backend

Real-time backend service for the Planning Poker app using Node.js and Socket.IO.

## Features

- Real-time session synchronization
- Cross-browser and cross-device support
- User management and activity tracking
- Story selection and voting
- Automatic session cleanup

## Quick Deploy to Railway

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/eEJ9Wf)

## Quick Deploy to Render

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

## Quick Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/planning-poker-app&project-name=planning-poker-backend&repository-name=planning-poker-backend)

## Local Development

1. **Install dependencies:**
   ```bash
   cd backend
   npm install
   ```

2. **Start development server:**
   ```bash
   npm run dev
   ```

3. **The server will be available at:**
   ```
   http://localhost:3000
   ```

## Environment Variables

No environment variables are required for basic functionality. The server will run on port 3000 by default, or use the PORT environment variable if set.

## Deployment

### Railway Deployment

1. Fork this repository
2. Connect to Railway
3. Deploy the `backend` folder
4. Railway will automatically detect and deploy the Node.js app

### Render Deployment

1. Fork this repository
2. Create a new Web Service on Render
3. Connect your GitHub repository
4. Set the root directory to `backend`
5. Use the following settings:
   - Build Command: `npm install`
   - Start Command: `npm start`

### Vercel Deployment

1. Fork this repository
2. Import project to Vercel
3. Set the root directory to `backend`
4. Deploy

## API Endpoints

- `GET /` - Health check with connection info
- `GET /health` - Detailed health status

## Socket.IO Events

### Client to Server:
- `join-session` - Join a planning session
- `update-session` - Update session data
- `story-selected` - Select a story for voting
- `vote-submitted` - Submit a vote
- `reveal-votes` - Reveal all votes
- `hide-votes` - Hide votes (start new round)
- `story-added` - Add a new story
- `user-activity` - Update user activity

### Server to Client:
- `session-joined` - Confirmation of joining session
- `session-updated` - Session data updated
- `user-joined` - New user joined the session
- `user-left` - User left the session
- `story-selected` - Story was selected
- `vote-submitted` - New vote submitted
- `votes-revealed` - Votes are now visible
- `votes-hidden` - Votes are hidden
- `story-added` - New story added

## CORS Configuration

The server is configured to accept connections from:
- localhost:4200 (development)
- GitHub Pages domains
- Vercel and Netlify domains

Update the CORS configuration in `server.js` if deploying to other domains.