// src/components/Message.jsx
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import '../styles/Message.css';

const Message = ({ message }) => {
  const renderContent = () => {
    if (message.role === 'assistant') {
      const thinkMatch = message.content.match(/<think>(.*?)<\/think>/s);
      const thinking = thinkMatch ? thinkMatch[1] : '';
      const finalResponse = message.content.replace(/<think>.*?<\/think>/s, '').trim();

      return (
        <div className="message-content">
          {thinking && (
            <div className="thinking-content">
              Thinking: {thinking}
            </div>
          )}
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw]}
          >
            {finalResponse}
          </ReactMarkdown>
        </div>
      );
    }
    return message.content;
  };

  return (
    <div className={`message ${message.role}`}>
      {renderContent()}
    </div>
  );
};

export default Message;