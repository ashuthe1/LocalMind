import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { materialDark, materialLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import '../styles/Message.css';

const Message = ({ message, darkMode }) => {
  const renderContent = () => {
    if (message.role === 'assistant') {
      const thinkMatch = message.content.match(/<think>(.*?)<\/think>/s);
      const thinking = thinkMatch ? thinkMatch[1] : '';
      const finalResponse = message.content.replace(/<think>.*?<\/think>/s, '').trim();

      return (
        <div className="message-content">
          {thinking && (
            <div className={`thinking-bubble ${darkMode ? 'dark' : 'light'}`}>
              <span className="thinking-label">🤔 Internal Monologue:</span>
              {thinking}
            </div>
          )}
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

  return (
    <div className={`message ${message.role} ${darkMode ? 'dark' : 'light'}`}>
      {renderContent()}
      <div className="timestamp">
        {new Date(message.createdAt).toLocaleTimeString()}
      </div>
    </div>
  );
};

export default Message;