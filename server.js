const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);

// Configure CORS for Socket.IO
const io = socketIo(server, {
  cors: {
    origin: "*", // Allow all origins for now
    methods: ["GET", "POST"],
    allowedHeaders: ["*"],
    credentials: false
  },
  allowEIO3: true // Enable compatibility with older clients
});

// Express middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Planning Poker Backend is running!', 
    timestamp: new Date().toISOString(),
    connectedClients: io.engine.clientsCount
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    uptime: process.uptime(),
    connectedClients: io.engine.clientsCount
  });
});

// In-memory storage for sessions (in production, use Redis or database)
const sessions = new Map();
const userSessions = new Map(); // Track which users are in which sessions

// Clean up expired sessions every 5 minutes
setInterval(() => {
  const now = new Date();
  for (const [sessionId, session] of sessions.entries()) {
    if (new Date(session.expiresAt) < now) {
      sessions.delete(sessionId);
      console.log(`Cleaned up expired session: ${sessionId}`);
    }
  }
}, 5 * 60 * 1000);

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Join a session
  socket.on('join-session', (data) => {
    const { sessionId, user } = data;
    
    // Leave any previous session
    if (userSessions.has(socket.id)) {
      const prevSessionId = userSessions.get(socket.id);
      socket.leave(prevSessionId);
      
      // Remove user from previous session
      if (sessions.has(prevSessionId)) {
        const prevSession = sessions.get(prevSessionId);
        prevSession.users = prevSession.users.filter(u => u.id !== user.id);
        sessions.set(prevSessionId, prevSession);
        socket.to(prevSessionId).emit('user-left', { user, session: prevSession });
      }
    }

    // Join new session
    socket.join(sessionId);
    userSessions.set(socket.id, sessionId);

    // Get or create session
    let session = sessions.get(sessionId) || {
      id: sessionId,
      users: [],
      currentStory: null,
      votes: [],
      isVotingRevealed: false,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
    };

    // Add user to session if not already present
    const existingUserIndex = session.users.findIndex(u => u.id === user.id);
    if (existingUserIndex >= 0) {
      session.users[existingUserIndex] = { ...user, lastActivity: new Date().toISOString() };
    } else {
      session.users.push({ ...user, lastActivity: new Date().toISOString() });
    }

    sessions.set(sessionId, session);

    // Send current session state to the joining user
    socket.emit('session-joined', { session, user });
    
    // Notify other users in the session
    socket.to(sessionId).emit('user-joined', { user, session });

    console.log(`User ${user.name} joined session ${sessionId}`);
  });

  // Update session data
  socket.on('update-session', (data) => {
    const { sessionId, session: updatedSession } = data;
    
    if (sessions.has(sessionId)) {
      // Merge the updates with existing session
      const currentSession = sessions.get(sessionId);
      const mergedSession = { ...currentSession, ...updatedSession, id: sessionId };
      sessions.set(sessionId, mergedSession);
      
      // Broadcast to all users in the session
      io.to(sessionId).emit('session-updated', { session: mergedSession });
      
      console.log(`Session ${sessionId} updated`);
    }
  });

  // Story selection
  socket.on('story-selected', (data) => {
    const { sessionId, story } = data;
    
    if (sessions.has(sessionId)) {
      const session = sessions.get(sessionId);
      session.currentStory = story;
      session.votes = []; // Clear votes when new story is selected
      session.isVotingRevealed = false;
      sessions.set(sessionId, session);
      
      // Broadcast to all users in the session
      io.to(sessionId).emit('story-selected', { story, session });
      
      console.log(`Story selected in session ${sessionId}: ${story?.number || 'none'}`);
    }
  });

  // Vote submission
  socket.on('vote-submitted', (data) => {
    const { sessionId, vote } = data;
    
    if (sessions.has(sessionId)) {
      const session = sessions.get(sessionId);
      
      // Remove existing vote from the same user
      session.votes = session.votes.filter(v => v.userId !== vote.userId);
      
      // Add new vote
      session.votes.push({
        ...vote,
        timestamp: new Date().toISOString()
      });
      
      sessions.set(sessionId, session);
      
      // Broadcast to all users in the session
      io.to(sessionId).emit('vote-submitted', { vote, session });
      
      console.log(`Vote submitted in session ${sessionId} by user ${vote.userId}`);
    }
  });

  // Reveal votes
  socket.on('reveal-votes', (data) => {
    const { sessionId } = data;
    
    if (sessions.has(sessionId)) {
      const session = sessions.get(sessionId);
      session.isVotingRevealed = true;
      sessions.set(sessionId, session);
      
      // Broadcast to all users in the session
      io.to(sessionId).emit('votes-revealed', { session });
      
      console.log(`Votes revealed in session ${sessionId}`);
    }
  });

  // Hide votes (start new round)
  socket.on('hide-votes', (data) => {
    const { sessionId } = data;
    
    if (sessions.has(sessionId)) {
      const session = sessions.get(sessionId);
      session.isVotingRevealed = false;
      session.votes = [];
      sessions.set(sessionId, session);
      
      // Broadcast to all users in the session
      io.to(sessionId).emit('votes-hidden', { session });
      
      console.log(`Votes hidden in session ${sessionId}`);
    }
  });

  // Add story to session
  socket.on('story-added', (data) => {
    const { sessionId, story } = data;
    
    if (sessions.has(sessionId)) {
      const session = sessions.get(sessionId);
      if (!session.stories) {
        session.stories = [];
      }
      session.stories.push(story);
      sessions.set(sessionId, session);
      
      // Broadcast to all users in the session
      io.to(sessionId).emit('story-added', { story, session });
      
      console.log(`Story added to session ${sessionId}: ${story.number}`);
    }
  });

  // Update user activity
  socket.on('user-activity', (data) => {
    const { sessionId, userId } = data;
    
    if (sessions.has(sessionId)) {
      const session = sessions.get(sessionId);
      const userIndex = session.users.findIndex(u => u.id === userId);
      if (userIndex >= 0) {
        session.users[userIndex].lastActivity = new Date().toISOString();
        sessions.set(sessionId, session);
      }
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
    
    if (userSessions.has(socket.id)) {
      userSessions.delete(socket.id);
      
      // Note: We don't remove the user from the session immediately
      // to allow for reconnection. Users will be cleaned up by the 
      // periodic cleanup based on lastActivity
    }
  });

  // Error handling
  socket.on('error', (error) => {
    console.error(`Socket error for ${socket.id}:`, error);
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Planning Poker Backend running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});