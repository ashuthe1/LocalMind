import React from 'react';
import { List, ListItem, ListItemText, IconButton, Button } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import '../styles/ChatList.css';

const isValidDate = (dateString) => {
  const date = new Date(dateString);
  return !isNaN(date) && date.getFullYear() > 1;
};

const formatChatDate = (dateString) => {
  if (!isValidDate(dateString)) return 'New Chat';
  
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const ChatList = ({ chats, onSelectChat, onDeleteChat, onDeleteAllChats, selectedChatId, darkMode }) => {
  return (
    <div className={`chat-list ${darkMode ? 'dark' : 'light'}`}>
      <Button
        variant="contained"
        color="secondary"
        onClick={onDeleteAllChats}
        className="delete-all-button"
        startIcon={<DeleteIcon />}
      >
        Clear History
      </Button>

      <List dense={false}>
        {chats.map((chat) => (
          <ListItem
            key={chat.id}
            className={`chat-item ${selectedChatId === chat.id ? 'selected' : ''}`}
            secondaryAction={
              <IconButton
                edge="end"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteChat(chat.id);
                }}
                color="inherit"
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            }
            onClick={() => onSelectChat(chat)}
          >
            <ListItemText
              primary={formatChatDate(chat.createdAt)}
              primaryTypographyProps={{
                style: {
                  fontWeight: selectedChatId === chat.id ? '600' : '400',
                  color: darkMode ? '#fff' : '#333',
                  fontSize: '0.9rem'
                }
              }}
              secondary={chat.title !== 'New Chat' ? chat.title : ''}
              secondaryTypographyProps={{
                style: {
                  color: darkMode ? '#aaa' : '#666',
                  fontSize: '0.8rem'
                }
              }}
            />
          </ListItem>
        ))}
      </List>
    </div>
  );
};

export default ChatList;