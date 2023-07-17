const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');

// Set up MongoDB connection
mongoose.connect('mongodb://localhost:27017/projectDB', { useNewUrlParser: true, useUnifiedTopology: true });
const Project = mongoose.model('Project', {
  title: String,
  description: String,
  skills: String,
//   collaborationRequests: [
//     {
//       userId: String,
//       username: String,
//     },
//   ],
});

// Create Express app and HTTP server
const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Middleware to parse request bodies
app.use(express.json());

// Set the view engine to EJS
app.set('view engine', 'ejs');

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));


// API endpoint to get all projects
app.get('/api/projects', async (req, res) => {
    try {
      const projects = await Project.find();
      res.json({ projects });
    } catch (error) {
      res.status(500).json({ error: 'Something went wrong.' });
    }
  });
  
// API endpoint to publish a project

app.post('/api/projects', async (req, res) => {
    try {
      const { title, description, skills } = req.body;
  
      // Save project to the database
      const project = new Project({ title, description, skills });
      await project.save();
  
      // Redirect the user to a different page (e.g., index page)
      res.redirect('/');
  
    } catch (error) {
      res.status(500).json({ error: 'Something went wrong.' });
    }
  });
  

// API endpoint to send a collaboration request
app.post('/api/projects/:projectId/collaborate', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { userId, username } = req.body;

    // Find the project by ID
    const project = await Project.findById(projectId);

    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    // Add collaboration request to the project
    project.collaborationRequests.push({ userId, username });
    await project.save();

    // Emit a real-time event to the project owner
    io.to(projectId).emit('collaborationRequest', project.collaborationRequests);

    res.status(201).json({ message: 'Collaboration request sent.' });
  } catch (error) {
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// API endpoint to accept or reject a collaboration request
app.patch('/api/projects/:projectId/collaborate/:requestId', async (req, res) => {
  try {
    const { projectId, requestId } = req.params;
    const { accepted } = req.body;

    // Find the project by ID
    const project = await Project.findById(projectId);

    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    // Find the collaboration request by ID
    const collaborationRequest = project.collaborationRequests.id(requestId);

    if (!collaborationRequest) {
      return res.status(404).json({ error: 'Collaboration request not found.' });
    }

    // Remove the collaboration request from the project
    collaborationRequest.remove();

    // Emit a real-time event to the user who sent the collaboration request
    io.to(collaborationRequest.userId).emit('collaborationResponse', { projectId, accepted });

    await project.save();

    res.json({ message: 'Collaboration request updated.' });
  } catch (error) {
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// Serve the login page
app.get('/login', (req, res) => {
    res.render('login');
  });
  
  // Serve the index page
  app.get('/', (req, res) => {
    res.render('index');
  });
  
  // Serve the publish page
  app.get('/publish', (req, res) => {
    res.render('publish');
  });
  
  // Serve the join page
  app.get('/join', (req, res) => {
    res.render('join');
  });
  

// Start the server
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Socket.io event listener for new connections
io.on('connection', (socket) => {
  console.log('A client connected.');

  // Socket.io event listener for disconnections
  socket.on('disconnect', () => {
    console.log('A client disconnected.');
  });

  // Socket.io event listener for joining a project room
  socket.on('joinProjectRoom', (projectId) => {
    socket.join(projectId);
  });
});
