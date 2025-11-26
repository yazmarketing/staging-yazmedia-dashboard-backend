import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { PrismaClient } from '@prisma/client';
import * as path from 'path';
import authRoutes from './routes/auth';
import employeeRoutes from './routes/employees';
import leaveManagementRoutes from './routes/leaveManagement';
import holidayManagementRoutes from './routes/holidayManagement';
import calendarViewRoutes from './routes/calendarView';
import announcementRoutes from './routes/announcements';
import assetRoutes from './routes/assets';
import manufacturerRoutes from './routes/manufacturers';
import supplierRoutes from './routes/suppliers';
import attendanceRoutes from './routes/attendance';
import payrollRoutes from './routes/payroll';
import bankDetailChangeRequestRoutes from './routes/bankDetailChangeRequests';
import reimbursementRoutes from './routes/reimbursements';
import overtimeRequestRoutes from './routes/overtimeRequests';
import clientProjectRoutes from './routes/clientProjects';
import bonusRoutes from './routes/bonuses';
import bonusTypeRoutes from './routes/bonusTypes';
import deductionRoutes from './routes/deductions';
import deductionTypeRoutes from './routes/deductionTypes';
import uploadRoutes from './routes/uploads';
import { setupAttendanceSocket } from './websocket/attendanceSocket';
import { startCarryOverAnnualLeaveJob } from './jobs/carryOverAnnualLeaveJob';
import { initializeEmailTransporter, verifyEmailConnection } from './services/emailService';

// Load environment variables
// Try .env first, fallback to .env.local if .env doesn't exist
// Note: When using dotenv-cli (npm run dev), env vars are already loaded
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: '.env' });
  // If still not found, try .env.local
  if (!process.env.DATABASE_URL) {
    dotenv.config({ path: '.env.local' });
  }
}

const app = express();

// Configure connection pool limits
// DigitalOcean managed databases typically allow 25-100 connections
// Reserve connections for superuser/admin, use conservative limit for application
const DATABASE_URL = process.env.DATABASE_URL || '';
const connectionLimit = parseInt(process.env.DATABASE_CONNECTION_LIMIT || '10', 10);

// Add connection pool parameters to DATABASE_URL if using PgBouncer or direct connection
// Note: Prisma uses connection pooling internally, but we can limit via connection string
const getDatabaseUrlWithPool = (url: string): string => {
  // If URL already has query parameters, preserve them
  if (url.includes('?')) {
    const urlObj = new URL(url);
    // Only add if not already present
    if (!urlObj.searchParams.has('pgbouncer')) {
      // For DigitalOcean, connection pooling is handled by the database
      // We just need to ensure we don't exceed limits
      urlObj.searchParams.set('connection_limit', connectionLimit.toString());
    }
    urlObj.searchParams.set('connect_timeout', '10'); // 10 second connection timeout
    return urlObj.toString();
  } else {
    // Add query parameters
    return `${url}?connection_limit=${connectionLimit}&connect_timeout=10`;
  }
};

// Initialize Prisma Client with optimized configuration
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  datasources: {
    db: {
      url: getDatabaseUrlWithPool(DATABASE_URL),
    },
  },
});

// Connection monitoring - log connection pool status periodically
if (process.env.NODE_ENV === 'development') {
  setInterval(async () => {
    try {
      // Check database connection health
      await prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      console.error(`❌ Database connection check failed:`, error);
    }
  }, 60000); // Check every minute
}

const PORT = process.env.PORT || 3000;

// Middleware - CORS Configuration
const corsOptions = {
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // Allow localhost with any port for development
    if (origin.match(/^http:\/\/localhost:\d+$/)) {
      return callback(null, true);
    }

    // Allow configured CORS origin from environment
    const allowedOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
    if (origin === allowedOrigin) {
      return callback(null, true);
    }

    // Reject other origins
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files statically (for local storage fallback)
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// API Routes
app.get('/api', (_req, res) => {
  res.json({ message: 'YAZ Media Dashboard API v1.0' });
});

// Auth routes
app.use('/auth', authRoutes);

// Employee routes (includes employee management for role/status)
app.use('/employees', employeeRoutes);

// Leave Management routes
app.use('/leave-requests', leaveManagementRoutes);

// Holiday Management routes
app.use('/holidays', holidayManagementRoutes);

// Calendar View routes
app.use('/calendar', calendarViewRoutes);

// Announcements routes
app.use('/announcements', announcementRoutes);

// Assets routes
app.use('/assets', assetRoutes);
app.use('/manufacturers', manufacturerRoutes);
app.use('/suppliers', supplierRoutes);

// Contract routes (view-only, based on Employee data)
import contractRoutes from './routes/contracts';
app.use('/contracts', contractRoutes);

// Attendance routes
app.use('/attendance', attendanceRoutes);

// Payroll routes
app.use('/payroll', payrollRoutes);

// Bank detail change request routes
app.use('/bank-detail-change-requests', bankDetailChangeRequestRoutes);

// Reimbursement routes
app.use('/reimbursements', reimbursementRoutes);

// Bonus routes
app.use('/bonuses', bonusRoutes);
app.use('/bonus-types', bonusTypeRoutes);

// Deduction routes
app.use('/deductions', deductionRoutes);
app.use('/deduction-types', deductionTypeRoutes);

// Overtime Request routes
app.use('/overtime-requests', overtimeRequestRoutes);

// Client and Project routes
app.use('/clients-projects', clientProjectRoutes);

// Upload routes
app.use('/uploads', uploadRoutes);

// Contract Management routes

// Error handling middleware
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    status: err.status || 500,
  });
});

// Start server
const startServer = async () => {
  try {
    // Test database connection
    await prisma.$connect();

    // Initialize email service
    initializeEmailTransporter();
    // Verify email connection asynchronously (don't block server startup)
    verifyEmailConnection().catch((error) => {
      console.warn('⚠️  Email service verification failed:', error);
    });

    // Create HTTP server for WebSocket support
    const httpServer = createServer(app);

    // Setup WebSocket for real-time attendance updates
    setupAttendanceSocket(httpServer);

    // Start scheduled jobs
    startCarryOverAnnualLeaveJob(prisma); // Pass prisma instance to avoid circular dependency

    httpServer.listen(PORT, () => {
      console.log(`✅ Server is running on http://localhost:${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`🔌 API endpoint: http://localhost:${PORT}/api`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown - ensure all connections are closed
const gracefulShutdown = async (_signal: string) => {
  try {
    // Disconnect Prisma client (closes all database connections)
    await prisma.$disconnect();
    // Give time for any pending operations to complete
    setTimeout(() => {
      process.exit(0);
    }, 1000);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

startServer();

export { app };

