// src/App.jsx
import { useState, useEffect } from 'react';
import { api } from './services/api';
import ChatList from './components/ChatList';
import Message from './components/Message';
import './styles/App.css';

function App() {
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchChats();
  }, []);

  const fetchChats = async () => {
    try {
      const chats = await api.getChats();
      setChats(chats);
    } catch (error) {
      console.error('Error fetching chats:', error);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;

    setLoading(true);
    try {
      await api.sendMessage(message, selectedChat?._id);
      setMessage('');
      await fetchChats();
    } catch (error) {
      console.error('Error sending message:', error);
    }
    setLoading(false);
  };

  const handleDeleteChat = async (chatId) => {
    try {
      await api.deleteChat(chatId);
      if (selectedChat?._id === chatId) {
        setSelectedChat(null);
      }
      await fetchChats();
    } catch (error) {
      console.error('Error deleting chat:', error);
    }
  };

  const handleDeleteAllChats = async () => {
    if (!window.confirm('Are you sure you want to delete all chats?')) return;
    
    try {
      await api.deleteAllChats();
      setSelectedChat(null);
      await fetchChats();
    } catch (error) {
      console.error('Error deleting all chats:', error);
    }
  };

  return (
    <div className="app">
      <ChatList
        chats={chats}
        onSelectChat={setSelectedChat}
        onDeleteChat={handleDeleteChat}
        onDeleteAllChats={handleDeleteAllChats}
        selectedChatId={selectedChat?._id}
      />
      
      <div className="chat-container">
        <div className="messages-container">
          {selectedChat?.messages.map((message, index) => (
            <Message key={index} message={message} />
          ))}
        </div>
        
        <form onSubmit={handleSendMessage} className="message-form">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your message..."
            disabled={loading}
            className="message-input"
          />
          <button
            type="submit"
            disabled={loading || !message.trim()}
            className="send-button"
          >
            {loading ? 'Sending...' : 'Send'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default App;