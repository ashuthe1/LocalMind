import { useState, useEffect, createContext, useRef } from 'react';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { Brightness4, Brightness7, Send } from '@mui/icons-material';
import { api } from './services/api';
import ChatList from './components/ChatList';
import Message from './components/Message';
import Navbar from './components/Navbar';
import SettingForm from './components/SettingForm';
import './styles/App.css';
import { Box } from 'lucide-react';

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
  const [activeView, setActiveView] = useState('chat');

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
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    fetchChats();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [selectedChatId, isAIResponding, chats]);

  const fetchChats = async () => {
    try {
      const chatsData = await api.getChats();
      setChats(chatsData);
      if (!selectedChatId && chatsData.length > 0) {
        setSelectedChatId(chatsData[0].id);
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

    // Append an empty assistant message locally for real-time update.
    setChats((prevChats) =>
      prevChats.map((chat) => {
        if (chat.id === selectedChatId) {
          return {
            ...chat,
            messages: [
              ...chat.messages,
              { id: 'temp-id', role: 'assistant', content: '', timestamp: new Date().toISOString() },
            ],
          };
        }
        return chat;
      })
    );

    try {
      await api.sendMessageSSE(message, selectedChatId, (chunk) => {
        setChats((prevChats) =>
          prevChats.map((chat) => {
            if (chat.id === selectedChatId) {
              const updatedMessages = [...chat.messages];
              const lastIndex = updatedMessages.length - 1;
              if (updatedMessages[lastIndex].role === 'assistant') {
                updatedMessages[lastIndex].content += chunk;
              }
              return { ...chat, messages: updatedMessages };
            }
            return chat;
          })
        );
      });
      await fetchChats();
    } catch (error) {
      console.error('Error sending message:', error);
    }
    setMessage('');
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

  const activeChat = chats.find((chat) => chat.id === selectedChatId);

  return (
    <ThemeContext.Provider value={{ toggleTheme }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <div className={`app ${darkMode ? 'dark' : 'light'}`}>
          <Navbar
            darkMode={darkMode}
            toggleTheme={toggleTheme}
            activeView={activeView}
            setActiveView={setActiveView}
          />
          {activeView === 'settings' ? (
            <div className='SettingBox'>
              <SettingForm />
            </div>
          ) : (
            <div className="main-container">
              <ChatList
                chats={chats}
                onSelectChat={(chat) => setSelectedChatId(chat.id)}
                onDeleteChat={handleDeleteChat}
                onDeleteAllChats={handleDeleteAllChats}
                selectedChatId={selectedChatId}
                darkMode={darkMode}
                setSelectedChatId={setSelectedChatId}
                setMessage={setMessage}
              />
              <div className="chat-container">
                <div className="messages-container">
                  {activeChat?.messages?.map((msg, index) => (
                    <Message key={index} message={msg} darkMode={darkMode} />
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
                  <Send fontSize="small" /> {loading ? 'Generating...' : 'Send'}
                </button>
              </form>

              </div>
            </div>
          )}
        </div>
      </ThemeProvider>
    </ThemeContext.Provider>
  );
}

export default App;
