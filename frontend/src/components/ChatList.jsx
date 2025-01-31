import React from 'react';
import { List, ListItem, ListItemText, IconButton, Button } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import '../styles/ChatList.css';

const formatDate = (dateString) => {
  try {
    const date = new Date(dateString);
    if (isNaN(date) || date.getFullYear() <= 1) return 'New Chat';
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return 'New Chat';
  }
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
              primary={formatDate(chat.createdAt)}
              secondary={`${chat.messages?.length || 0} messages`}
              primaryTypographyProps={{
                style: {
                  fontWeight: selectedChatId === chat.id ? '600' : '400',
                  color: darkMode ? '#fff' : '#333',
                  fontSize: '0.9rem'
                }
              }}
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