// src/components/Markdown.jsx
import { memo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Tooltip } from '@mui/material';
import { Copy, Check } from 'lucide-react';
import { copyText } from '../utils/clipboard';

function CodeBlock({ children, isDark }) {
  const [copied, setCopied] = useState(false);
  const child = Array.isArray(children) ? children[0] : children;
  const className = child?.props?.className || '';
  const match = /language-([\w+-]+)/.exec(className);
  const language = match ? match[1] : '';
  const code = String(child?.props?.children ?? '').replace(/\n$/, '');

  const onCopy = async () => {
    if (await copyText(code)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <div className="code-block">
      <div className="code-block-header">
        <span>{language || 'code'}</span>
        <Tooltip title={copied ? 'Copied' : 'Copy code'}>
          <button className="icon-btn" onClick={onCopy} aria-label="Copy code" style={{ width: 26, height: 26 }}>
            {copied ? <Check size={13} /> : <Copy size={13} />}
          </button>
        </Tooltip>
      </div>
      <SyntaxHighlighter style={isDark ? oneDark : oneLight} language={language || 'text'} PreTag="pre" wrapLongLines customStyle={{ background: 'transparent', padding: '12px 14px' }}>
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

function Markdown({ content, isDark }) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre: ({ children }) => <CodeBlock isDark={isDark}>{children}</CodeBlock>,
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noreferrer noopener">
              {children}
            </a>
          ),
        }}
      >
        {content || ''}
      </ReactMarkdown>
    </div>
  );
}

export default memo(Markdown);
