"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface DocumentContext {
  summary?: string;
  riskLevel?: string;
  risks?: string[];
  recommendations?: string[];
  keyFindings?: string[];
  metadata?: {
    type?: string;
    company?: string;
    date?: string;
    parties?: string;
  };
}

interface ChatBotProps {
  documentContext?: DocumentContext;
  documentName?: string;
}

export default function ChatBot({ documentContext, documentName }: ChatBotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Reset + greet when opened with a document
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const greeting = documentContext
        ? `Hello! 👋 I'm here to help you understand **${documentName || "this document"}**.\n\nYou can ask me:\n• What is covered in this policy?\n• How do I file a claim?\n• Explain a specific clause\n• What are the key risks?`
        : `Hello! 👋 I'm DeepInshAura AI.\n\nAsk me anything about your insurance policies — claims, coverage, risks, or anything else!`;

      setMessages([{ role: "assistant", content: greeting }]);
    }
  }, [isOpen]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input.trim() };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages.filter((m) => m.role !== "assistant" || m.content !== messages[0]?.content).map(m => ({
            role: m.role,
            content: m.content,
          })),
          documentContext: documentContext || null,
        }),
      });

      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply || "Something went wrong, please try again." },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "⚠️ Network error. Please try again." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatMessage = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\n/g, "<br/>");
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
          width: "56px",
          height: "56px",
          borderRadius: "50%",
          background: isOpen ? "#1e293b" : "#2563eb",
          color: "white",
          border: "none",
          cursor: "pointer",
          boxShadow: "0 4px 20px rgba(37,99,235,0.4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "22px",
          zIndex: 1000,
          transition: "all 0.2s ease",
        }}
        title="Ask AI"
      >
        {isOpen ? "✕" : "💬"}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div
          style={{
            position: "fixed",
            bottom: "90px",
            right: "24px",
            width: "360px",
            height: "500px",
            background: "#ffffff",
            borderRadius: "16px",
            boxShadow: "0 8px 40px rgba(0,0,0,0.15)",
            display: "flex",
            flexDirection: "column",
            zIndex: 1000,
            overflow: "hidden",
            border: "1px solid #e2e8f0",
          }}
        >
          {/* Header */}
          <div
            style={{
              background: "#1e293b",
              color: "white",
              padding: "14px 16px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <div
              style={{
                width: "34px",
                height: "34px",
                borderRadius: "50%",
                background: "#2563eb",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "16px",
                flexShrink: 0,
              }}
            >
              🤖
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: "14px" }}>DeepInshAura AI</div>
              <div style={{ fontSize: "11px", color: "#94a3b8" }}>
                {documentName ? `📄 ${documentName.slice(0, 28)}...` : "Insurance Assistant"}
              </div>
            </div>
            <div
              style={{
                marginLeft: "auto",
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: "#22c55e",
              }}
            />
          </div>

          {/* Messages */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "12px",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              background: "#f8fafc",
            }}
          >
            {messages.map((msg, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                }}
              >
                <div
                  style={{
                    maxWidth: "82%",
                    padding: "10px 13px",
                    borderRadius: msg.role === "user" ? "14px 14px 2px 14px" : "14px 14px 14px 2px",
                    background: msg.role === "user" ? "#2563eb" : "#ffffff",
                    color: msg.role === "user" ? "white" : "#1e293b",
                    fontSize: "13px",
                    lineHeight: "1.5",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                    border: msg.role === "assistant" ? "1px solid #e2e8f0" : "none",
                  }}
                  dangerouslySetInnerHTML={{ __html: formatMessage(msg.content) }}
                />
              </div>
            ))}

            {isLoading && (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: "14px 14px 14px 2px",
                    background: "#ffffff",
                    border: "1px solid #e2e8f0",
                    display: "flex",
                    gap: "5px",
                    alignItems: "center",
                  }}
                >
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      style={{
                        width: "7px",
                        height: "7px",
                        borderRadius: "50%",
                        background: "#94a3b8",
                        animation: `bounce 1s ${i * 0.15}s infinite`,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div
            style={{
              padding: "10px 12px",
              borderTop: "1px solid #e2e8f0",
              background: "#ffffff",
              display: "flex",
              gap: "8px",
              alignItems: "flex-end",
            }}
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about this policy..."
              rows={1}
              style={{
                flex: 1,
                padding: "9px 12px",
                borderRadius: "10px",
                border: "1px solid #cbd5e1",
                fontSize: "13px",
                resize: "none",
                outline: "none",
                fontFamily: "inherit",
                color: "#1e293b",
                lineHeight: "1.4",
                maxHeight: "80px",
                overflowY: "auto",
              }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              style={{
                width: "38px",
                height: "38px",
                borderRadius: "10px",
                background: input.trim() && !isLoading ? "#2563eb" : "#e2e8f0",
                color: input.trim() && !isLoading ? "white" : "#94a3b8",
                border: "none",
                cursor: input.trim() && !isLoading ? "pointer" : "not-allowed",
                fontSize: "16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                transition: "all 0.15s ease",
              }}
            >
              ➤
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }
      `}</style>
    </>
  );
}