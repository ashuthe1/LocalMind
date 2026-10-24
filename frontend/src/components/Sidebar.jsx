// src/components/Sidebar.jsx — plain chat list
import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import { Menu, MenuItem, ListItemIcon, ListItemText, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Divider, Button } from '@mui/material';
import { Plus, Trash2, Search, Pin, PinOff, Pencil, Download, FileJson, MoreHorizontal, X } from 'lucide-react';
import { formatRelative } from '../utils/dateUtils';
import '../styles/sidebar.css';

function ChatRow({ chat, selected, onSelect, onRename, onTogglePin, onExport, onDelete }) {
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(chat.title);
  const inputRef = useRef(null);

  useEffect(() => {
    if (renaming) {
      setTitle(chat.title);
      setTimeout(() => inputRef.current?.select(), 0);
    }
  }, [renaming, chat.title]);

  const commitRename = () => {
    const t = title.trim();
    setRenaming(false);
    if (t && t !== chat.title) onRename(chat, t);
  };
  const closeMenu = () => setMenuAnchor(null);
  const item = (label, icon, action, extra = {}) => (
    <MenuItem
      onClick={() => {
        closeMenu();
        action();
      }}
      {...extra}
    >
      <ListItemIcon sx={extra.sx}>{icon}</ListItemIcon>
      <ListItemText>{label}</ListItemText>
    </MenuItem>
  );

  return (
    <div
      className={`chat-item ${selected ? 'selected' : ''} ${menuAnchor ? 'menu-open' : ''}`}
      role="button"
      tabIndex={0}
      onClick={() => !renaming && onSelect(chat)}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !renaming) {
          e.preventDefault();
          onSelect(chat);
        }
      }}
      onDoubleClick={() => setRenaming(true)}
    >
      <div className="chat-body">
        {renaming ? (
          <input
            ref={inputRef}
            className="rename-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={commitRename}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') setRenaming(false);
            }}
            aria-label="Chat title"
          />
        ) : (
          <>
            <span className="chat-title">{chat.title || 'New chat'}</span>
            <span className="chat-time">{formatRelative(chat.updatedAt)}</span>
          </>
        )}
      </div>
      <button
        className="icon-btn chat-menu-btn"
        onClick={(e) => {
          e.stopPropagation();
          setMenuAnchor(e.currentTarget);
        }}
        aria-label="Chat options"
      >
        <MoreHorizontal size={16} />
      </button>
      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={closeMenu} onClick={(e) => e.stopPropagation()}>
        {item('Rename', <Pencil size={16} />, () => setRenaming(true))}
        {item(chat.pinned ? 'Unpin' : 'Pin', chat.pinned ? <PinOff size={16} /> : <Pin size={16} />, () => onTogglePin(chat))}
        {item('Export Markdown', <Download size={16} />, () => onExport(chat, 'markdown'))}
        {item('Export JSON', <FileJson size={16} />, () => onExport(chat, 'json'))}
        <Divider />
        {item('Delete', <Trash2 size={16} />, () => onDelete(chat), { sx: { color: 'error.main' } })}
      </Menu>
    </div>
  );
}

const Sidebar = forwardRef(function Sidebar(
  { chats, selectedChatId, query, onQueryChange, onSelectChat, onNewChat, onRenameChat, onTogglePin, onExportChat, onDeleteChat, onDeleteAll, isDrawer, onClose, footer },
  searchRef
) {
  const [confirmAll, setConfirmAll] = useState(false);
  const [confirmChat, setConfirmChat] = useState(null);

  const { pinned, others } = useMemo(() => ({ pinned: chats.filter((c) => c.pinned), others: chats.filter((c) => !c.pinned) }), [chats]);

  const rowProps = { onSelect: onSelectChat, onRename: onRenameChat, onTogglePin, onExport: onExportChat, onDelete: (chat) => setConfirmChat(chat) };

  return (
    <aside className={`sidebar ${isDrawer ? 'drawer' : ''}`} aria-label="Chat history">
      <div className="sidebar-actions">
        <button className="btn new-chat" onClick={onNewChat}>
          <Plus size={16} /> New chat
        </button>
        {isDrawer && (
          <button className="icon-btn" onClick={onClose} aria-label="Close chat list">
            <X size={18} />
          </button>
        )}
      </div>
      <label className="sidebar-search">
        <Search size={15} />
        <input ref={searchRef} placeholder="Search" value={query} onChange={(e) => onQueryChange(e.target.value)} aria-label="Search chats" />
        {query && (
          <button className="icon-btn" onClick={() => onQueryChange('')} aria-label="Clear search">
            <X size={13} />
          </button>
        )}
      </label>
      <div className="chat-list">
        {pinned.length > 0 && (
          <>
            <div className="chat-section">Pinned</div>
            {pinned.map((chat) => (
              <ChatRow key={chat.id} chat={chat} selected={chat.id === selectedChatId} {...rowProps} />
            ))}
            {others.length > 0 && <div className="chat-section">Recent</div>}
          </>
        )}
        {others.map((chat) => (
          <ChatRow key={chat.id} chat={chat} selected={chat.id === selectedChatId} {...rowProps} />
        ))}
        {chats.length === 0 && <div className="chat-list-empty">{query ? 'No chats match.' : 'No chats yet.'}</div>}
      </div>
      <div className="sidebar-footer">
        <span>{footer}</span>
        <button className="link" onClick={() => setConfirmAll(true)} disabled={chats.length === 0}>
          Clear history
        </button>
      </div>

      <Dialog open={confirmAll} onClose={() => setConfirmAll(false)}>
        <DialogTitle>Delete all chats?</DialogTitle>
        <DialogContent>
          <DialogContentText>This permanently removes every conversation. Export first if you want a copy.</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmAll(false)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            disableElevation
            onClick={() => {
              setConfirmAll(false);
              onDeleteAll();
            }}
          >
            Delete everything
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={Boolean(confirmChat)} onClose={() => setConfirmChat(null)}>
        <DialogTitle>Delete this chat?</DialogTitle>
        <DialogContent>
          <DialogContentText>&ldquo;{confirmChat?.title || 'New chat'}&rdquo; will be permanently deleted.</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmChat(null)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            disableElevation
            onClick={() => {
              const c = confirmChat;
              setConfirmChat(null);
              onDeleteChat(c);
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </aside>
  );
});

export default Sidebar;
