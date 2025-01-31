// src/App.jsx
import { useState, useEffect, createContext } from 'react';
import { ThemeProvider, createTheme, CssBaseline, IconButton } from '@mui/material';
import { Brightness4, Brightness7 } from '@mui/icons-material';
import { api } from './services/api';
import ChatList from './components/ChatList';
import Message from './components/Message';
import './styles/App.css';

export const ThemeContext = createContext({ toggleTheme: () => {} });

function App() {
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  const theme = createTheme({
    palette: {
      mode: darkMode ? 'dark' : 'light',
      primary: {
        main: '#3f51b5',
      },
      secondary: {
        main: '#f50057',
      },
    },
  });

  // Add all handler functions properly
  const toggleTheme = () => {
    setDarkMode(!darkMode);
  };

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
    <ThemeContext.Provider value={{ toggleTheme }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <div className={`app ${darkMode ? 'dark' : 'light'}`}>
          <header className="app-header">
            <h1>DeepSeek Chat</h1>
            <IconButton onClick={toggleTheme} color="inherit">
              {darkMode ? <Brightness7 /> : <Brightness4 />}
            </IconButton>
          </header>

          <div className="main-container">
            <ChatList
              chats={chats}
              onSelectChat={setSelectedChat}
              onDeleteChat={handleDeleteChat} // Now properly bound
              onDeleteAllChats={handleDeleteAllChats}
              selectedChatId={selectedChat?._id}
              darkMode={darkMode}
            />
            
            <div className="chat-container">
              <div className="messages-container">
                {selectedChat?.messages.map((message, index) => (
                  <Message key={index} message={message} darkMode={darkMode} />
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
                  {loading ? '✈️ Sending...' : '🚀 Send'}
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