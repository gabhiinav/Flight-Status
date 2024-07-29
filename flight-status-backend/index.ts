import express from "express";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import { Pool } from "pg";
import webpush from "web-push";

dotenv.config();

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

app.use(
  cors({
    origin: "http://localhost:3000",
  })
);
app.use(express.json());

// API Routes

app.get("/api/vapid-public-key", (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

app.get("/api/flights", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM flight_status ORDER BY flight_number"
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/flight-status/:flight_number", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM flight_status WHERE flight_number = $1",
      [req.params.flight_number]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: "Flight not found" });
    } else {
      res.json(result.rows[0]);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/notification-settings", async (req, res) => {
  const { email, phone, pushEnabled } = req.body;
  try {
    await pool.query(
      "UPDATE notification_settings SET email = $1, phone = $2, push_enabled = $3 WHERE id = 1",
      [email, phone, pushEnabled]
    );
    res.json({ message: "Notification settings updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/flight-status", async (req, res) => {
  console.log("Received update request:", req.body);
  const { flight_number, status, gate, delay } = req.body;
  try {
    const result = await pool.query(
      "INSERT INTO flight_status (flight_number, status, gate, delay) VALUES ($1, $2, $3, $4) " +
        "ON CONFLICT (flight_number) DO UPDATE SET status = $2, gate = $3, delay = $4 RETURNING *",
      [flight_number, status, gate, delay]
    );
    const updatedFlightStatus = result.rows[0];

    console.log("Updated/Created flight status:", updatedFlightStatus);

    io.emit("statusUpdate", updatedFlightStatus);

    if (status === "Delayed" || status === "Boarding") {
      await sendNotifications(updatedFlightStatus);
    }

    res.json(updatedFlightStatus);
  } catch (err) {
    console.error("Error updating flight status:", err);
    res
      .status(500)
      .json({ error: "Internal server error", details: err.message });
  }
});

app.delete("/api/flight-status/:flight_number", async (req, res) => {
  try {
    const result = await pool.query(
      "DELETE FROM flight_status WHERE flight_number = $1 RETURNING *",
      [req.params.flight_number]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: "Flight not found" });
    } else {
      res.json({ message: "Flight deleted successfully" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/users", async (req, res) => {
  const { username } = req.body;
  try {
    const result = await pool.query(
      "INSERT INTO users (username) VALUES ($1) RETURNING id, username",
      [username]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get subscribed flights for a user
app.get("/api/user-flights/:userId", async (req, res) => {
  const userId = req.params.userId;
  try {
    const result = await pool.query(
      `SELECT fs.* 
       FROM flight_status fs
       JOIN user_flight_subscriptions ufs ON fs.flight_number = ufs.flight_number
       WHERE ufs.user_id = $1
       ORDER BY fs.flight_number`,
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Subscribe to a flight
app.post("/api/subscribe", async (req, res) => {
  const { userId, flightNumber } = req.body;
  try {
    await pool.query(
      "INSERT INTO user_flight_subscriptions (user_id, flight_number) VALUES ($1, $2)",
      [userId, flightNumber]
    );
    res.json({ message: "Subscribed successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Unsubscribe from a flight
app.post("/api/unsubscribe", async (req, res) => {
  const { userId, flightNumber } = req.body;
  try {
    await pool.query(
      "DELETE FROM user_flight_subscriptions WHERE user_id = $1 AND flight_number = $2",
      [userId, flightNumber]
    );
    res.json({ message: "Unsubscribed successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/save-subscription", async (req, res) => {
  const { userId, subscription } = req.body;
  try {
    await pool.query(
      "INSERT INTO push_subscriptions (user_id, subscription) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET subscription = $2",
      [userId, JSON.stringify(subscription)]
    );
    res.status(201).json({ message: "Subscription saved successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error saving subscription" });
  }
});

async function sendNotifications(status: any) {
  try {
    console.log("Sending notifications:", status);

    // Get all subscriptions for users who are subscribed to this flight
    const subscriptionsResult = await pool.query(
      `SELECT ps.subscription 
       FROM push_subscriptions ps
       JOIN user_flight_subscriptions ufs ON ps.user_id = ufs.user_id
       WHERE ufs.flight_number = $1`,
      [status.flight_number]
    );

    const notifications = subscriptionsResult.rows.map(async (row) => {
      const subscription = JSON.parse(row.subscription);
      const payload = JSON.stringify({
        title: `Flight ${status.flight_number} Update`,
        body: `Status: ${status.status}, Gate: ${status.gate}, Delay: ${status.delay} minutes`,
      });

      try {
        await webpush.sendNotification(subscription, payload);
      } catch (error) {
        console.error("Error sending push notification:", error);
        // If the subscription is no longer valid, you might want to remove it
        if (error.statusCode === 410) {
          await pool.query(
            "DELETE FROM push_subscriptions WHERE subscription = $1",
            [JSON.stringify(subscription)]
          );
        }
      }
    });

    await Promise.all(notifications);
    console.log(`Sent ${notifications.length} push notifications`);
  } catch (err) {
    console.error("Error sending notifications:", err);
  }
}

// Socket.IO connection handling
io.on("connection", (socket) => {
  console.log("New client connected");
  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
