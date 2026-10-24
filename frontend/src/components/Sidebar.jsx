// src/components/Sidebar.jsx
import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import { Button, IconButton, Menu, MenuItem, TextField, InputAdornment, ListItemIcon, ListItemText, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Divider } from '@mui/material';
import { Plus, Trash2, Search, Pin, PinOff, Pencil, Download, FileJson, MoreHorizontal, MessageSquare, X } from 'lucide-react';
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
      <MessageSquare size={16} className="chat-icon" />
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
          <div className="chat-title">{chat.title || 'New chat'}</div>
        )}
        <div className="chat-meta">
          <span>{formatRelative(chat.updatedAt)}</span>
          <span>·</span>
          <span>{chat.messageCount ?? 0} msgs</span>
          {chat.lastMessagePreview && (
            <>
              <span>·</span>
              <span>{chat.lastMessagePreview}</span>
            </>
          )}
        </div>
      </div>
      <IconButton
        size="small"
        className="chat-menu-btn"
        onClick={(e) => {
          e.stopPropagation();
          setMenuAnchor(e.currentTarget);
        }}
        aria-label="Chat options"
      >
        <MoreHorizontal size={16} />
      </IconButton>
      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={closeMenu} onClick={(e) => e.stopPropagation()}>
        <MenuItem
          onClick={() => {
            closeMenu();
            setRenaming(true);
          }}
        >
          <ListItemIcon>
            <Pencil size={16} />
          </ListItemIcon>
          <ListItemText>Rename</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            closeMenu();
            onTogglePin(chat);
          }}
        >
          <ListItemIcon>{chat.pinned ? <PinOff size={16} /> : <Pin size={16} />}</ListItemIcon>
          <ListItemText>{chat.pinned ? 'Unpin' : 'Pin'}</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            closeMenu();
            onExport(chat, 'markdown');
          }}
        >
          <ListItemIcon>
            <Download size={16} />
          </ListItemIcon>
          <ListItemText>Export Markdown</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            closeMenu();
            onExport(chat, 'json');
          }}
        >
          <ListItemIcon>
            <FileJson size={16} />
          </ListItemIcon>
          <ListItemText>Export JSON</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() => {
            closeMenu();
            onDelete(chat);
          }}
          sx={{ color: 'error.main' }}
        >
          <ListItemIcon sx={{ color: 'error.main' }}>
            <Trash2 size={16} />
          </ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
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

  const { pinned, others } = useMemo(() => {
    const pinned = chats.filter((c) => c.pinned);
    const others = chats.filter((c) => !c.pinned);
    return { pinned, others };
  }, [chats]);

  const rowProps = {
    onSelect: onSelectChat,
    onRename: onRenameChat,
    onTogglePin,
    onExport: onExportChat,
    onDelete: (chat) => setConfirmChat(chat),
  };

  return (
    <aside className={`sidebar ${isDrawer ? 'drawer' : ''}`} aria-label="Chat history">
      <div className="sidebar-actions">
        <Button variant="contained" startIcon={<Plus size={16} />} onClick={onNewChat} disableElevation>
          New chat
        </Button>
        {isDrawer && (
          <IconButton onClick={onClose} aria-label="Close chat list">
            <X size={18} />
          </IconButton>
        )}
      </div>
      <TextField
        className="sidebar-search"
        size="small"
        placeholder="Search chats…"
        value={query}
        inputRef={searchRef}
        onChange={(e) => onQueryChange(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Search size={16} />
            </InputAdornment>
          ),
          endAdornment: query ? (
            <InputAdornment position="end">
              <IconButton size="small" onClick={() => onQueryChange('')} aria-label="Clear search">
                <X size={14} />
              </IconButton>
            </InputAdornment>
          ) : null,
        }}
      />
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
        {chats.length === 0 && <div className="chat-list-empty">{query ? 'No chats match your search.' : 'No chats yet. Start a new one!'}</div>}
      </div>
      <div className="sidebar-footer">
        <span>{footer}</span>
        <Button size="small" color="error" startIcon={<Trash2 size={14} />} onClick={() => setConfirmAll(true)} disabled={chats.length === 0} sx={{ textTransform: 'none' }}>
          Clear history
        </Button>
      </div>

      <Dialog open={confirmAll} onClose={() => setConfirmAll(false)}>
        <DialogTitle>Delete all chats?</DialogTitle>
        <DialogContent>
          <DialogContentText>This permanently removes every conversation stored in LocalMind. Export first if you want a copy.</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmAll(false)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
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
