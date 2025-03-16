import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { setupAuth } from "./auth";
import session from "express-session";
import { storage } from "./storage";

const app = express();

// Add JSON middleware before any routes
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Configure session middleware
const sessionSettings: session.SessionOptions = {
  secret: process.env.SESSION_SECRET || "development-secret",
  resave: false,
  saveUninitialized: false,
  store: storage.sessionStore,
  cookie: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: "lax"
  },
  name: "aguwai.sid" // Custom session ID name
};

// Set up session middleware
app.set("trust proxy", 1);
app.use(session(sessionSettings));

// Add logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  // Log session and authentication state for debugging
  if (path.startsWith("/api")) {
    console.log(`Request ${path}:`, {
      sessionID: req.sessionID,
      isAuthenticated: req.isAuthenticated?.(),
      user: req.user,
    });
  }

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Set up authentication after session middleware
  setupAuth(app);

  // Register API routes before Vite middleware
  const server = await registerRoutes(app);

  // Error handling middleware
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    // Don't throw after sending response
    res.status(status).json({ message });
    console.error(err);
  });

  // Only setup vite/static serving after API routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();