// src/components/ChatList.jsx
import React from 'react';
import { List, ListItem, ListItemText, IconButton, Button } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import '../styles/ChatList.css';

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
            key={chat._id}
            className={`chat-item ${selectedChatId === chat._id ? 'selected' : ''}`}
            secondaryAction={
              <IconButton
                edge="end"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteChat(chat._id);
                }}
                color="inherit"
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            }
            onClick={() => onSelectChat(chat)}
          >
            <ListItemText
              primary={chat.title}
              primaryTypographyProps={{
                style: {
                  fontWeight: selectedChatId === chat._id ? '600' : '400',
                  color: darkMode ? '#fff' : '#333',
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