'use client';

import { useState, useEffect, useRef } from 'react';
import { Send, MessageSquare } from 'lucide-react';
import { Socket } from 'socket.io-client';

interface Message {
  playerName: string;
  symbol: 'X' | 'O';
  message: string;
  timestamp: number;
}

interface ChatBoxProps {
  socket: Socket | null;
  roomId: string | null;
  playerSymbol: 'X' | 'O' | null;
  onSendMessage: (message: string) => void;
}

export default function ChatBox({ socket, roomId, playerSymbol, onSendMessage }: ChatBoxProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]       = useState('');
  const endRef  = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Subscribe to chat-message events
  useEffect(() => {
    if (!socket) return;
    const handler = (data: Message) => setMessages(prev => [...prev, data]);
    socket.on('chat-message', handler);
    return () => { socket.off('chat-message', handler); };
  }, [socket]);

  // Auto-scroll to latest message [Lecture 6 - Pub-Sub chat]
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !roomId) return;
    onSendMessage(input.trim());
    setInput('');
    inputRef.current?.focus();
  };

  const fmt = (ts: number) =>
    new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const isMe = (symbol: 'X' | 'O') => symbol === playerSymbol;

  return (
    <div className="glass rounded-2xl p-4 flex flex-col h-full min-h-[320px]">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3 pb-3 border-b border-white/8">
        <MessageSquare className="w-4 h-4 text-violet-400" />
        <span className="font-semibold text-slate-200 text-sm">Chat</span>
        <span className="text-xs text-slate-500 ml-auto">{messages.length} msg{messages.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 mb-3 min-h-0">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-24 text-slate-600 text-xs">
            <MessageSquare className="w-6 h-6 mb-1 opacity-40" />
            <span>No messages yet</span>
          </div>
        ) : (
          messages.map((msg, i) => {
            const mine = isMe(msg.symbol);
            return (
              <div key={i} className={`msg-in flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                {/* Sender label */}
                <span className="text-[10px] text-slate-500 mb-0.5 px-1">
                  {mine ? 'You' : msg.playerName} · {fmt(msg.timestamp)}
                </span>
                {/* Bubble */}
                <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm break-words ${
                  mine
                    ? 'bg-violet-700/70 text-slate-100 rounded-br-sm'
                    : msg.symbol === 'X'
                      ? 'bg-rose-900/50 text-slate-200 border border-rose-700/30 rounded-bl-sm'
                      : 'bg-blue-900/50 text-slate-200 border border-blue-700/30 rounded-bl-sm'
                }`}>
                  {msg.message}
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={roomId ? 'Type a message…' : 'Join a game to chat'}
          maxLength={120}
          disabled={!roomId}
          className="dark-input flex-1 px-3 py-2 rounded-xl text-sm disabled:opacity-40"
        />
        <button
          type="submit"
          disabled={!input.trim() || !roomId}
          className="btn-primary p-2.5 rounded-xl text-white disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
