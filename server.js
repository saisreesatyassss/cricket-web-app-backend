// server.js
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 8000;


app.use(cors());

app.options('*', cors());  
 
app.use(bodyParser.json({ limit: '50mb' }));  
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
 
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log('MongoDB connection error:', err));

// Routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const teamRoutes = require('./routes/teamRoutes');
const earlyaccessRoutes = require('./routes/earlyaccessRoutes');

 
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/earlyaccess', earlyaccessRoutes);


app.get('/', (req, res) => {
  res.send('Server Working');
});

// Health Check Endpoint
app.get('/health', async (req, res) => {
  try {
    // Check database connection
    const dbStatus = mongoose.connection.readyState;
    const dbState = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting',
    };

    const healthStatus = {
      service: 'Cricket API',
      uptime: process.uptime(), // API uptime in seconds
      timestamp: new Date(),
      database: dbState[dbStatus],
      status: dbStatus === 1 ? 'healthy' : 'unhealthy',
    };

    // Return health status
    const statusCode = dbStatus === 1 ? 200 : 500;
    res.status(statusCode).json(healthStatus);
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      message: 'Health check failed',
      error: error.message,
    });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
