import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { materialDark, materialLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import '../styles/Message.css';
import BotAvatar from './BotAvatar';

const defaultThought = 'This is where my thoughts will appear if I have to deeply think about any problem, otherwise this field will be empty or show the default text. It helps keep things organized and simple when no deep analysis is needed.';
const isValidTimestamp = (timestamp) => {
  const date = new Date(timestamp);
  return !isNaN(date) && date.getFullYear() > 1;
};

const Message = ({ message, darkMode }) => {
  const [showThinking, setShowThinking] = useState(false);

  const renderContent = () => {
    if (message.role === 'assistant') {
      const thinkMatch = message.content.match(/<think>(.*?)<\/think>/s);
      var thinking = thinkMatch ? thinkMatch[1] : defaultThought
      const finalResponse = message.content.replace(/<think>.*?<\/think>/s, '').trim();

      return (
        <div className="message-content">
          <div className="toggle-btn" onClick={() => setShowThinking(!showThinking)}>
            <div className={`thinking-bubble ${darkMode ? 'dark' : 'light'}`}>
              <span className="thinking-label">💡 Thought Process:</span>
              <span>
                {showThinking ? thinking : `${thinking.substring(0, 150)}...`}
                {thinking.length > 150 && (
                  <button>
                    {showThinking ? 'Hide Details' : 'View Details'}
                  </button>
                )}
              </span>
            </div>
          </div>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw]}
            components={{
              code({ node, inline, className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || '');
                return !inline && match ? (
                  <SyntaxHighlighter
                    style={darkMode ? materialDark : materialLight}
                    language={match[1]}
                    PreTag="div"
                    {...props}
                  >
                    {String(children).replace(/\n$/, '')}
                  </SyntaxHighlighter>
                ) : (
                  <code className={className} {...props}>
                    {children}
                  </code>
                );
              }
            }}
          >
            {finalResponse}
          </ReactMarkdown>
        </div>
      );
    }
    return message.content;
  };

  const timestamp = isValidTimestamp(message.timestamp)
    ? new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className={`message ${message.role} ${darkMode ? 'dark' : 'light'}`}>
      <span className="message-icon">
        {message.role === 'user' ? '👨🏻‍💻' : <BotAvatar/>}
      </span>
      {renderContent()}
      {timestamp && <div className="timestamp">{timestamp}</div>}
    </div>
  );
};

export default Message;
