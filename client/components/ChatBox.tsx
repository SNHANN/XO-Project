'use client';

import { useState, useEffect, useRef } from 'react';
import { Send, MessageCircle } from 'lucide-react';
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
  onSendMessage: (message: string) => void;
}

export default function ChatBox({ socket, roomId, onSendMessage }: ChatBoxProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!socket) return;

    const handleMessage = (data: Message) => {
      setMessages(prev => [...prev, data]);
    };

    socket.on('chat-message', handleMessage);

    return () => {
      socket.off('chat-message', handleMessage);
    };
  }, [socket]);

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputMessage.trim() && roomId) {
      onSendMessage(inputMessage.trim());
      setInputMessage('');
      inputRef.current?.focus();
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  if (!roomId) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-4 md:p-6 opacity-50">
        <div className="flex items-center gap-2 text-gray-500 mb-4">
          <MessageCircle className="w-5 h-5" />
          <h3 className="font-semibold">Chat</h3>
        </div>
        <p className="text-sm text-gray-400 text-center py-8">
          Join a game to use chat
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-4 md:p-6">
      <div className="flex items-center gap-2 text-gray-700 mb-4">
        <MessageCircle className="w-5 h-5" />
        <h3 className="font-semibold">Chat</h3>
        <span className="text-xs text-gray-400">({messages.length})</span>
      </div>

      {/* Messages Area */}
      <div className="h-48 md:h-64 overflow-y-auto space-y-2 mb-4 pr-2 scrollbar-thin">
        {messages.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">
            No messages yet. Say hello! 👋
          </p>
        ) : (
          messages.map((msg, index) => (
            <div 
              key={index}
              className="chat-message bg-gray-50 rounded-lg p-2 text-sm"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className={`
                  font-bold text-xs px-2 py-0.5 rounded
                  ${msg.symbol === 'X' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}
                `}>
                  {msg.symbol}
                </span>
                <span className="font-medium text-gray-700 truncate">
                  {msg.playerName}
                </span>
                <span className="text-xs text-gray-400 ml-auto">
                  {formatTime(msg.timestamp)}
                </span>
              </div>
              <p className="text-gray-600 pl-1">{msg.message}</p>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          placeholder="Type a message..."
          maxLength={100}
          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
        />
        <button
          type="submit"
          disabled={!inputMessage.trim()}
          className="p-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
