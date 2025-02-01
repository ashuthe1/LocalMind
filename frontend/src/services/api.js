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
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      // Decode the received chunk and append to buffer.
      buffer += decoder.decode(value, { stream: true });
      
      // SSE events are separated by double newlines.
      const parts = buffer.split("\n\n");
      // Keep the last partial part in the buffer.
      buffer = parts.pop();
      
      parts.forEach(part => {
        // Each SSE event line starts with "data: "
        if (part.startsWith("data: ")) {
          const data = part.replace("data: ", "").trim();
          if (data) {
            onChunk(data);
          }
        }
      });
    }
    // Process any remaining text.
    if (buffer.startsWith("data: ")) {
      const data = buffer.replace("data: ", "").trim();
      if (data) onChunk(data);
    }
  }
};