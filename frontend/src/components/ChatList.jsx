// src/components/ChatList.jsx
import React from 'react';
import '../styles/ChatList.css';

const ChatList = ({ chats, onSelectChat, onDeleteChat, onDeleteAllChats, selectedChatId }) => {
  return (
    <div className="chat-list">
      <button 
        onClick={onDeleteAllChats}
        className="delete-all-button"
      >
        Delete All Chats
      </button>
      
      {chats.map((chat) => (
        <div
          key={chat._id}
          className={`chat-item ${selectedChatId === chat._id ? 'selected' : ''}`}
        >
          <span 
            className="chat-title"
            onClick={() => onSelectChat(chat)}
          >
            {chat.title}
          </span>
          <button
            className="delete-button"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteChat(chat._id);
            }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
};

export default ChatList;