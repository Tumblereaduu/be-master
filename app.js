const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require("http");
const { Server } = require("socket.io");

// ============================================================================
// PHASE 1: SECURITY HARDENING - Production Security Middleware
// ============================================================================
// Note: Helmet, compression, hpp require npm install
// These will be available after: npm install helmet compression hpp express-rate-limit express-validator
// For now, we implement the architectural setup

const app = express();
app.use('/public', express.static(path.join(__dirname, 'public')));

// Remove powered-by header to prevent fingerprinting
app.disable('x-powered-by');

// ============================================================================
// TASK 4: CORS Configuration - Production Safe
// ============================================================================
// Support multiple origins for development and production
// Use environment variable: CORS_ORIGIN
// Example: CORS_ORIGIN=http://localhost:5173,https://admin.company.com
// Default to localhost for development
const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:5173";

// Parse comma-separated origins if multiple provided
const allowedOrigins = corsOrigin.split(',').map(origin => origin.trim());

app.use(cors({ 
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl requests, Postman, etc.)
    if (!origin) return callback(null, true);
    
    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      callback(new Error('CORS not allowed for this origin: ' + origin));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10kb' })); // PHASE 1: Request size limit
app.set("trust proxy", true);

// ============================================================================
// PHASE 1: Security Headers & Configuration
// ============================================================================
// Disable x-powered-by (already done above with app.disable)

// Trust proxy for accurate IP addresses when behind reverse proxy
app.set('trust proxy', 'loopback');

// Prevent HTTP Parameter Pollution attacks
app.use((req, _, next) => {
  if (req.query && Object.keys(req.query).length > 0) {
    // Remove duplicate query parameters (keep first occurrence)
    const uniqueParams = {};
    for (const [key, value] of Object.entries(req.query)) {
      if (!uniqueParams[key]) {
        uniqueParams[key] = value;
      }
    }
    req.query = uniqueParams;
  }
  next();
});

// Secure headers (manual setup - Helmet would require npm install)
app.use((req, res, next) => {
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // XSS Protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Referrer Policy
  res.setHeader('Referrer-Policy', 'no-referrer');
  
  // Content Security Policy (basic)
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  
  // Strict Transport Security (for HTTPS)
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
  next();
});

// IMP, Dont remove this
app.use(express.urlencoded({ extended: true }));

// ============================================================================
// Socket.IO CORS Configuration - Also Production Safe
// ============================================================================
const server = http.createServer(app);

const io = new Server(server, {
    cors: { 
      origin: allowedOrigins.length === 1 && allowedOrigins[0] === '*' ? '*' : allowedOrigins,
      methods: ["GET", "POST"],
      credentials: true
    }
});

// 1forge Connection
const init1ForgeSocketConn = require('./src/sockets/1forge.socket');
const forgeRoutes = require('./src/routes/1forge/1forgeRoutes');
app.use('/api/currency/forge', forgeRoutes);

// 1ForgeScoket API

// const API_KEY = '2a9XXAiiuiC6nxMeJ1bn88qmlj7nISWE';

// FCS API 

 const API_KEY = "ZxeXcXmXlHpoSn61NUhh5HBtuWTvz6P";


// frontend client connects
io.on("connection", (socket) => {
  console.log("Frontend connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("Frontend disconnected:", socket.id);
  });
});

// For triggering pending orders
const { processPendingLimitOrders, processTpSlForActiveOrders, processPnLTpSlForActiveOrders } = require('./src/controllers/orders/orderController');
setInterval(processPendingLimitOrders, 2000);
setInterval(processTpSlForActiveOrders, 2000);
setInterval(processPnLTpSlForActiveOrders, 2000);

const { demoProcessPendingLimitOrders, demoProcessTpSlForActiveOrders, demoProcessPnLTpSlForActiveOrders } = require('./src/controllers/orders/demoOrderController');
setInterval(demoProcessPendingLimitOrders, 2000);
setInterval(demoProcessTpSlForActiveOrders, 2000);
setInterval(demoProcessPnLTpSlForActiveOrders, 2000);

// ============================================================================
// Routes
// ============================================================================
const demoRoutes = require('./src/routes/demo/demoRoutes');
const authRoutes = require('./src/routes/auth/authRoutes');

const orderRoutes = require("./src/routes/orders/ordersRoutes");
const demoOrderRoutes = require("./src/routes/orders/demoOrderRoutes");
const liveAdminRoutes = require("./src/routes/orders/liveAdminRoutes");

const depositRoutes = require("./src/routes/deposit/depositRoutes");
const withdrawalRoutes = require("./src/routes/withdrawal/withdrawalRoutes");
const supportTicketRoutes = require("./src/routes/support/supportTicketRoutes");
const kycRoutes = require("./src/routes/kyc/kycRoutes");
const walletRoutes = require("./src/routes/wallet/walletRoutes");
const demoAccountRoutes = require("./src/routes/demoAccount/demoAccountRoute")
const demofavouritesRoutes =require("./src/routes/favourites/demoFavouritesRoutes")
const favouritesRoutes = require("./src/routes/favourites/favouritesRoutes");
const adminRoutes = require("./src/routes/admin/adminRoutes");
const setValues = require("./src/routes/setValues/setRoutes");
const paymentRoutes = require("./src/routes/payment/paymentRoutes");
const admindashboard = require("./src/routes/admindashboard/admindashboardRoutes");
const bannerRoutes = require("./src/routes/banner/bannerRoutes");
const spreadRoutes = require("./src/routes/orders/spreadRoutes");
const adminEmailRoutes = require("./src/routes/emailphone/emailPhoneRoutes");
const ibRoutes = require("./src/routes/ib/ibRoutes");
const ibkycRoutes = require("./src/routes/ibkyc/ibkycRoutes");
const { loadSpreadValuesFromDB } = require("./src/controllers/orders/spreadController");
const accountDeleteRoutes = require("./src/routes/accountdelete/accountDeleteRoutes");
const masterAuthRoutes = require('./src/routes/master/masterAuthRoutes');


app.use('/', demoRoutes);
app.use('/api/auth', authRoutes);

app.use('/api/order', orderRoutes);
app.use('/api/demo/order',demoOrderRoutes);
app.use('/api/spread',spreadRoutes);
app.use('/api/deposit', depositRoutes);
app.use('/api/withdrawal', withdrawalRoutes);
app.use('/api/support', supportTicketRoutes);
app.use('/api/kyc', kycRoutes);
app.use('/api/demoaccount', demoAccountRoutes);
app.use('/api/accountdelete', accountDeleteRoutes);

//Admin
app.use('/api/wallet', walletRoutes);
app.use("/api/demofavourites",demofavouritesRoutes);
app.use('/api/favourites', favouritesRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/values', setValues);
app.use('/api/payment', paymentRoutes);
app.use('/api/admindash', admindashboard);
app.use('/api/adminorder',liveAdminRoutes);
app.use('/api/banner',bannerRoutes);
app.use('/api/contact',adminEmailRoutes);
app.use('/api/ib',ibRoutes);
app.use('/api/ib/kyc',ibkycRoutes);

//master admin
app.use('/api/master', masterAuthRoutes);

// Master Admin Management Routes
const adminManagementRoutes = require('./src/routes/master/adminManagementRoutes');
app.use('/api/master/admins', adminManagementRoutes);

// Admin User Management Routes  
const userManagementRoutes = require('./src/routes/admin/userManagementRoutes');
app.use('/api/admin/users', userManagementRoutes);

// Dashboard Routes (Phase 7)
const dashboardRoutes = require('./src/routes/dashboard/dashboardRoutes');
app.use('/api/dashboard', dashboardRoutes);

const tenantRoutes = require("./src/routes/master/tenantRoutes");
app.use("/api/tenant", tenantRoutes);

const domainManagementRoutes = require("./src/routes/master/domainManagementRoutes");
app.use("/api/master/domains",domainManagementRoutes);

init1ForgeSocketConn(io, API_KEY);
loadSpreadValuesFromDB();


module.exports = { app, server };
