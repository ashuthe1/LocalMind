// src/services/api.js
import axios from 'axios';

const API_BASE_URL = '/api';

export const api = {
  async sendMessage(message, chatId) {
    const response = await axios.post(`${API_BASE_URL}/chat`, {
      message,
      chatId,
      model: "deepseek"
    });
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
  }
};