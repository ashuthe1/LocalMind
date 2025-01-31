// src/utils/dateUtils.js
export const isValidDate = (dateString) => {
    return !isNaN(Date.parse(dateString));
  };
  
  export const formatChatDate = (dateString) => {
    if (!isValidDate(dateString)) return 'New Chat';
    
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };