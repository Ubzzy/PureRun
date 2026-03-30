import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { Resend } from 'resend';
import dotenv from 'dotenv';

dotenv.config();

let resendClient: Resend | null = null;

function getResendClient() {
  if (!resendClient) {
    const key = process.env.RESEND_API_KEY;
    if (!key) {
      console.error("RESEND_API_KEY is missing from environment variables.");
      return null;
    }
    resendClient = new Resend(key);
  }
  return resendClient;
}

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@wiliodaeze.resend.app";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/status", (req, res) => {
    console.log("Status check - API Key present:", !!process.env.RESEND_API_KEY);
    res.json({
      emailConfigured: !!process.env.RESEND_API_KEY,
      adminEmailSet: !!process.env.ADMIN_EMAIL,
      adminEmail: process.env.ADMIN_EMAIL || "admin@wiliodaeze.resend.app",
      isDevelopment: process.env.NODE_ENV !== "production"
    });
  });

  app.post("/api/test-email", async (req, res) => {
    const client = getResendClient();
    if (!client) return res.status(400).json({ error: "Email service not configured" });

    try {
      const { data, error } = await client.emails.send({
        from: 'PureRun Detailing <notifications@wiliodaeze.resend.app>',
        to: ADMIN_EMAIL,
        subject: 'Test Email - PureRun Detailing',
        html: '<p>This is a test email to verify your Resend configuration is working correctly!</p>'
      });

      if (error) {
        console.error("Resend returned an error:", error);
        return res.status(500).json({ error: "Test email failed", details: error.message });
      }

      res.json({ status: "ok", data });
    } catch (error) {
      console.error("Test email failed:", error);
      res.status(500).json({ error: "Test email failed", details: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post("/api/notify-admin", async (req, res) => {
    const { booking, adminEmail } = req.body;
    const client = getResendClient();
    
    if (!client) {
      console.warn("Resend client not initialized. Skipping email.");
      return res.status(200).json({ status: "skipped", reason: "no_api_key" });
    }

    const targetEmail = (adminEmail && adminEmail.trim() !== "") ? adminEmail : ADMIN_EMAIL;

    // Basic email validation regex
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(targetEmail)) {
      console.error(`Invalid target email for admin notification: ${targetEmail}`);
      return res.status(400).json({ error: "Invalid admin email address", details: `The email address "${targetEmail}" is not valid.` });
    }

    try {
      console.log(`Attempting to send admin email to: ${targetEmail}`);
      const { data, error } = await client.emails.send({
        from: 'PureRun Detailing <notifications@wiliodaeze.resend.app>',
        to: targetEmail,
        subject: 'New Booking Request - PureRun Detailing',
        html: `
          <h2>New Booking Request</h2>
          <p><strong>Customer:</strong> ${booking.name}</p>
          <p><strong>Email:</strong> ${booking.email}</p>
          <p><strong>Service:</strong> ${booking.serviceName}</p>
          <p><strong>Car:</strong> ${booking.carInfo}</p>
          <p><strong>Date:</strong> ${booking.date}</p>
          <p><strong>Location:</strong> ${booking.location}</p>
          <p><strong>Total:</strong> $${booking.total.toFixed(2)}</p>
        `
      });

      if (error) {
        console.error("Resend returned an error:", error);
        if (error.name === 'validation_error') {
          return res.status(400).json({ error: "Resend Validation Error", details: "Resend rejected the email. This often happens if the 'To' address is not verified in your Resend dashboard while in testing mode." });
        }
        return res.status(500).json({ error: "Failed to send email", details: error.message });
      }

      console.log("Admin email sent successfully:", data);
      res.json({ status: "ok", data });
    } catch (error) {
      console.error("Failed to send admin email:", error);
      // Check for specific Resend validation errors
      if (typeof error === 'object' && error !== null && 'name' in error && error.name === 'validation_error') {
        return res.status(400).json({ error: "Resend Validation Error", details: "Resend rejected the email. This often happens if the 'To' address is not verified in your Resend dashboard while in testing mode." });
      }
      res.status(500).json({ error: "Failed to send email", details: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post("/api/notify-customer", async (req, res) => {
    const { booking } = req.body;
    const client = getResendClient();

    if (!client) {
      console.warn("Resend client not initialized. Skipping email.");
      return res.status(200).json({ status: "skipped", reason: "no_api_key" });
    }

    // Basic email validation regex
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(booking.email)) {
      console.error(`Invalid customer email for notification: ${booking.email}`);
      return res.status(400).json({ error: "Invalid customer email address", details: `The email address "${booking.email}" is not valid.` });
    }

    try {
      console.log(`Attempting to send customer email to: ${booking.email}`);
      const { data, error } = await client.emails.send({
        from: 'PureRun Detailing <notifications@wiliodaeze.resend.app>',
        to: booking.email,
        subject: 'Booking Confirmed - PureRun Detailing',
        html: `
          <h2>Your Booking is Confirmed!</h2>
          <p>Hi ${booking.name},</p>
          <p>Your detailing appointment for <strong>${booking.date}</strong> has been confirmed.</p>
          <p><strong>Service:</strong> ${booking.serviceName}</p>
          <p><strong>Car:</strong> ${booking.carInfo}</p>
          <p><strong>Location:</strong> ${booking.location}</p>
          <p>We'll see you then!</p>
        `
      });

      if (error) {
        console.error("Resend returned an error:", error);
        if (error.name === 'validation_error') {
          return res.status(400).json({ error: "Resend Validation Error", details: "Resend rejected the email. This often happens if the 'To' address is not verified in your Resend dashboard while in testing mode." });
        }
        return res.status(500).json({ error: "Failed to send email", details: error.message });
      }

      console.log("Customer email sent successfully:", data);
      res.json({ status: "ok", data });
    } catch (error) {
      console.error("Failed to send customer email:", error);
      // Check for specific Resend validation errors
      if (typeof error === 'object' && error !== null && 'name' in error && error.name === 'validation_error') {
        return res.status(400).json({ error: "Resend Validation Error", details: "Resend rejected the email. This often happens if the 'To' address is not verified in your Resend dashboard while in testing mode." });
      }
      res.status(500).json({ error: "Failed to send email", details: error instanceof Error ? error.message : String(error) });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
