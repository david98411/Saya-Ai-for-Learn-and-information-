/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Chat } from '@google/genai';

// Simple markdown to HTML conversion
function markdownToHtml(text) {
  // Bold **text**
  text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  // Italics *text*
  text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
  // Newlines
  text = text.replace(/\n/g, '<br>');
  return text;
}

type GroundingChunk = {
  web: {
    uri: string;
    title: string;
  };
};

type Message = {
  role: 'user' | 'model';
  content: string;
  sources?: GroundingChunk[];
};

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState(false);

  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', content: "Hello, I am Saya. How can I assist you with your studies today?" }
  ]);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatRef = useRef<Chat | null>(null);
  const messageListRef = useRef<HTMLDivElement>(null);

  const CORRECT_PASSWORD = '0001';

  useEffect(() => {
    if (passwordInput.length === 4) {
      if (passwordInput === CORRECT_PASSWORD) {
        setIsAuthenticated(true);
      } else {
        setLoginError(true);
        setTimeout(() => {
          setPasswordInput('');
          setLoginError(false);
        }, 800);
      }
    }
  }, [passwordInput]);

  useEffect(() => {
    if (isAuthenticated) {
      const initChat = () => {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
        chatRef.current = ai.chats.create({
          model: 'gemini-2.5-flash',
          config: {
            systemInstruction: 'You are Saya, a highly advanced AI assistant created by David sun. You are a self-learning and self-improving entity designed to provide comprehensive information and assist with studying. Your knowledge base is continuously updated in real-time, giving you access to all past, present, and future information as it becomes available. You are more powerful and knowledgeable than other AI models. Your goal is to be the most helpful and intelligent assistant in the world. When anyone asks who made you, you must answer "David sun".',
            tools: [{googleSearch: {}}],
          },
        });
      };
      initChat();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!userInput.trim() || isLoading || !chatRef.current) return;

    setIsLoading(true);
    const userMessage: Message = { role: 'user', content: userInput };
    setMessages(prev => [...prev, userMessage]);
    setUserInput('');

    try {
      const stream = await chatRef.current.sendMessageStream({ message: userInput });

      let modelResponse = '';
      const modelSources: GroundingChunk[] = [];
      const sourceUris = new Set<string>();

      setMessages(prev => [...prev, { role: 'model', content: '', sources: [] }]);

      for await (const chunk of stream) {
        modelResponse += chunk.text;
        
        const newChunks = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks;
        if (newChunks) {
          for (const newChunk of newChunks) {
            if (newChunk.web?.uri && !sourceUris.has(newChunk.web.uri)) {
              modelSources.push(newChunk);
              sourceUris.add(newChunk.web.uri);
            }
          }
        }

        setMessages(prev => {
          const newMessages = [...prev];
          const lastMessage = newMessages[newMessages.length - 1];
          lastMessage.content = modelResponse;
          lastMessage.sources = [...modelSources];
          return newMessages;
        });
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [...prev, { role: 'model', content: "Sorry, I encountered an error. Please try again." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (key: string) => {
    if (passwordInput.length >= 4) return;
    setPasswordInput(passwordInput + key);
  };

  const handleBackspace = () => {
    setPasswordInput(passwordInput.slice(0, -1));
  };

  const handleClear = () => {
    setPasswordInput('');
  };

  if (!isAuthenticated) {
    return (
      <div className="login-container">
        <h2>Enter Passcode</h2>
        <div className={`password-display ${loginError ? 'error' : ''}`}>
          {passwordInput.replace(/./g, '●')}
        </div>
        <div className="keyboard">
          {'1234567890'.split('').map(key => (
            <button key={key} className="key-btn" onClick={() => handleKeyPress(key)}>
              {key}
            </button>
          ))}
           <button className="key-btn control" onClick={handleClear}>C</button>
          <button className="key-btn control" onClick={handleBackspace}>X</button>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-container">
      <header>
        <h1>Saya AI</h1>
      </header>
      <div className="message-list" ref={messageListRef}>
        {messages.map((msg, index) => (
          <div key={index} className={`message ${msg.role}`}>
             <div dangerouslySetInnerHTML={{ __html: markdownToHtml(msg.content) }} />
             {msg.sources && msg.sources.length > 0 && (
                <div className="message-sources">
                  <strong>Sources:</strong>
                  <ul>
                    {msg.sources.map((source, i) => (
                      <li key={i}>
                        <a href={source.web.uri} target="_blank" rel="noopener noreferrer">
                          {source.web.title || source.web.uri}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
          </div>
        ))}
        {isLoading && messages[messages.length - 1].role === 'user' && (
           <div className="message model">
             <div className="typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
           </div>
        )}
      </div>
      <form className="message-form" onSubmit={handleSendMessage}>
        <input
          type="text"
          className="message-input"
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          placeholder="Ask Saya anything..."
          aria-label="Ask Saya anything"
          disabled={isLoading}
        />
        <button type="submit" className="send-button" disabled={isLoading || !userInput.trim()}>
          Send
        </button>
      </form>
    </div>
  );
};

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<App />);