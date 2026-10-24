// src/components/Markdown.jsx
import { memo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import {
  materialDark,
  materialLight,
  oneDark,
  oneLight,
  vscDarkPlus,
  vs,
  dracula,
  ghcolors,
} from 'react-syntax-highlighter/dist/esm/styles/prism';
import { IconButton, Tooltip } from '@mui/material';
import { Copy, Check } from 'lucide-react';
import { copyText } from '../utils/clipboard';

function pickStyle(codeTheme, isDark) {
  switch (codeTheme) {
    case 'one':
      return isDark ? oneDark : oneLight;
    case 'vscode':
      return isDark ? vscDarkPlus : vs;
    case 'dracula':
      return isDark ? dracula : ghcolors;
    default:
      return isDark ? materialDark : materialLight;
  }
}

function CodeBlock({ children, isDark, codeTheme }) {
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
          <IconButton size="small" onClick={onCopy} aria-label="Copy code">
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </IconButton>
        </Tooltip>
      </div>
      <SyntaxHighlighter style={pickStyle(codeTheme, isDark)} language={language || 'text'} PreTag="pre" wrapLongLines>
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

function Markdown({ content, isDark, codeTheme }) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre: ({ children }) => <CodeBlock isDark={isDark} codeTheme={codeTheme}>{children}</CodeBlock>,
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
