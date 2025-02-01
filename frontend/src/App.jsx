// src/App.jsx
import { useState, useEffect, createContext, useRef } from 'react';
import { ThemeProvider, createTheme, CssBaseline, IconButton, Fab } from '@mui/material';
import { Brightness4, Brightness7, Add, Send } from '@mui/icons-material';
import { api } from './services/api';
import ChatList from './components/ChatList';
import Message from './components/Message';
import './styles/App.css';

export const ThemeContext = createContext({ toggleTheme: () => {} });

function App() {
  const [chats, setChats] = useState([]);
  const [selectedChatId, setSelectedChatId] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    return savedTheme ? JSON.parse(savedTheme) : true;
  });
  const [isAIResponding, setIsAIResponding] = useState(false);
  const messagesEndRef = useRef(null);

  const theme = createTheme({
    palette: {
      mode: darkMode ? 'dark' : 'light',
      primary: { main: '#3f51b5' },
      secondary: { main: '#f50057' },
    },
  });

  const toggleTheme = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem('theme', JSON.stringify(newMode));
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    fetchChats();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [selectedChatId, isAIResponding]);

  const fetchChats = async () => {
    try {
      const chats = await api.getChats();
      setChats(chats);
      if (!selectedChatId && chats.length > 0) {
        setSelectedChatId(chats[0].id);
      }
    } catch (error) {
      console.error('Error fetching chats:', error);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;

    setLoading(true);
    setIsAIResponding(true);
    try {
      await api.sendMessage(message, selectedChatId);
      setMessage('');
      await fetchChats();
    } catch (error) {
      console.error('Error sending message:', error);
    }
    setLoading(false);
    setIsAIResponding(false);
  };

  const handleDeleteChat = async (chatId) => {
    try {
      await api.deleteChat(chatId);
      if (selectedChatId === chatId) setSelectedChatId(null);
      await fetchChats();
    } catch (error) {
      console.error('Error deleting chat:', error);
    }
  };

  const handleDeleteAllChats = async () => {
    if (!window.confirm('Are you sure you want to delete all chats?')) return;
    try {
      await api.deleteAllChats();
      setSelectedChatId(null);
      await fetchChats();
    } catch (error) {
      console.error('Error deleting all chats:', error);
    }
  };

  const activeChat = chats.find(chat => chat.id === selectedChatId);

  return (
    <ThemeContext.Provider value={{ toggleTheme }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <div className={`app ${darkMode ? 'dark' : 'light'}`}>
          <Fab
            color="primary"
            className="floating-new-chat"
            onClick={() => {
              setSelectedChatId(null);
              setMessage('');
            }}
          >
            <Add />
          </Fab>

          <header className="app-header">
            <h1>DeepSeek Chat</h1>
            <IconButton onClick={toggleTheme} color="inherit">
              {darkMode ? <Brightness7 /> : <Brightness4 />}
            </IconButton>
          </header>

          <div className="main-container">
            <ChatList
              chats={chats}
              onSelectChat={(chat) => setSelectedChatId(chat.id)}
              onDeleteChat={handleDeleteChat}
              onDeleteAllChats={handleDeleteAllChats}
              selectedChatId={selectedChatId}
              darkMode={darkMode}
            />
            
            <div className="chat-container">
              <div className="messages-container">
                {activeChat?.messages?.map((message, index) => (
                  <Message key={index} message={message} darkMode={darkMode} />
                ))}
                
                {isAIResponding && (
                  <div className="typing-indicator">
                    <div className="dot"></div>
                    <div className="dot"></div>
                    <div className="dot"></div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
              
              <form onSubmit={handleSendMessage} className="message-form">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => e.ctrlKey && e.key === 'Enter' && handleSendMessage(e)}
                  placeholder="Type your message..."
                  disabled={loading}
                  className="message-input"
                />
                <button
                  type="submit"
                  disabled={loading || !message.trim()}
                  className="send-button"
                >
                  <Send fontSize="small" /> {loading ? 'Sending...' : 'Send'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </ThemeProvider>
    </ThemeContext.Provider>
  );
}

export default App;