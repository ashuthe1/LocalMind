// src/services/api.js
import axios from 'axios';

const API_BASE_URL = '/api';

export const api = {
  async sendMessage(message, chatId) {
    const requestBody = { message, model: "deepseek" };
    if (chatId) requestBody.chatId = chatId;
    
    const response = await axios.post(`${API_BASE_URL}/chat`, requestBody);
    return response.data;
  },

  async getChats() {
    const response = await axios.get(`${API_BASE_URL}/chats`);
    return response.data;
  },

  async deleteChat(chatId) {
    const response = await axios.delete(`${API_BASE_URL}/chat/${chatId}`);
    return response.data;
  },

  async deleteAllChats() {
    const response = await axios.delete(`${API_BASE_URL}/chats`);
    return response.data;
  },

  async sendMessageSSE(message, chatId, onChunk) {
    const requestBody = { message, model: "deepseek" };
    if (chatId) {
      requestBody.chatId = chatId;
    }
    // Use fetch so that we can access the response stream.
    const response = await fetch(`${API_BASE_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody)
    });
    if (!response.ok) {
      throw new Error("Network response error");
    }

    // Get a reader from the response body
   // Inside your fetch-based SSE method:
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunkText = decoder.decode(value, { stream: true });
      console.log("Received raw chunk:", chunkText); // Debug log
      buffer += chunkText;
      buffer = buffer.replace(/\r\n/g, "\n");
      const parts = buffer.split("\n\n");
      buffer = parts.pop(); // Save the partial event for later.
      parts.forEach(part => {
        if (part.startsWith("data: ")) {
          const data = part.slice("data: ".length).trim();
          console.log("Parsed SSE data:", data); // Debug log
          if (data) {
            onChunk(data);
          }
        }
      });
    }
    if (buffer.startsWith("data: ")) {
      const data = buffer.slice("data: ".length).trim();
      if (data) onChunk(data);
    }
  }
};