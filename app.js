const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Setup Express app
const app = express();
const server = http.createServer(app);

// Setup gemini AI
require("dotenv").config();
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Setup WebSocket server
const wss = new WebSocket.Server({ server });

// Store active connections
const connections = new Map();
let userCount = 0;

// Function to broadcast messages to all connected clients
function broadcastMessage(message) {
  connections.forEach((_, client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}

// Handle WebSocket connections
wss.on("connection", (ws) => {
  console.log("New client connected");

  ws.on("message", async (message) => {
    try {
      const data = JSON.parse(message);
      const { username, message: messageContent } = data;

      // Handle user activation
      if (
        messageContent.type === "system" &&
        messageContent.text === "Active"
      ) {
        connections.set(ws, username);
        userCount += 1;
        const systemMessage = {
          username: "System",
          userCount: userCount,
          message: {
            text: `${username} bergabung dalam chat`,
            type: "text",
          },
        };
        broadcastMessage(systemMessage);
        console.log(`${username} joined the chat`);
        return;
      }

      // Handle AI messages
      if (
        messageContent.type === "text" &&
        messageContent.text.toUpperCase().includes("AI")
      ) {
        try {
          const result = await model.generateContent(messageContent.text);
          const aiResponse = result.response.text();

          // Broadcast original message
          broadcastMessage(data);

          // Broadcast AI response
          const aiMessage = {
            username: "AI",
            message: {
              text: aiResponse,
              type: "text",
            },
          };
          broadcastMessage(aiMessage);
        } catch (error) {
          console.error("Error generating AI response:", error);
          const errorMessage = {
            username: "System",
            message: {
              text: "Maaf, terjadi kesalahan saat memproses permintaan AI",
              type: "text",
            },
          };
          ws.send(JSON.stringify(errorMessage));
        }
      } else {
        // Broadcast regular message
        broadcastMessage(data);
      }
    } catch (error) {
      console.error("Error processing message:", error);
    }
  });

  // Handle client disconnect
  ws.on("close", () => {
    const username = connections.get(ws);
    if (username) {
      userCount -= 1;
      const systemMessage = {
        username: "System",
        userCount: userCount,
        message: {
          text: `${username} meninggalkan chat`,
          type: "text",
        },
      };
      broadcastMessage(systemMessage);
      console.log(`${username} disconnected`);
    }
    connections.delete(ws);
  });
});

app.get("/", (req, res) => {
  res.send("Halo Dunia");
});

// Start the server
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
