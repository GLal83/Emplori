"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MessageCircle, X, Send, Loader2, ChevronDown, ChevronUp, Trash2 } from "lucide-react"
import { chatAssistant } from "@/app/actions/chat-assistant"
import { useData } from "@/contexts/data-context"

interface ChatMessage {
  role: "user" | "assistant"
  content: string
}

export function ChatAssistant() {
  const { applicants, jobOrders, clients } = useData()
  const [isMinimized, setIsMinimized] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Hello! I'm your AI recruitment assistant. I have access to all your applicants, job orders, and clients. How can I help you today?\n\nFor example, you can ask me:\n- \"Find me the top 5 candidates for a Senior React Developer position\"\n- \"Show me candidates with 5+ years of experience in Toronto\"\n- \"Who would be a good fit for [job title]?\"",
    },
  ])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    if (!isMinimized) {
      scrollToBottom()
    }
  }, [messages, isMinimized])

  useEffect(() => {
    if (!isMinimized && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isMinimized])

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput("")
    setMessages((prev) => [...prev, { role: "user", content: userMessage }])
    setIsLoading(true)
    setIsMinimized(false) // Expand if minimized when sending a message

    try {
      const result = await chatAssistant(userMessage, messages, applicants, jobOrders, clients)

      if (result.success && result.message) {
        setMessages((prev) => [...prev, { role: "assistant", content: result.message }])
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `Sorry, I encountered an error: ${result.error || "Unknown error"}. Please try again.`,
          },
        ])
      }
    } catch (error) {
      console.error("Chat error:", error)
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleClearChat = () => {
    setMessages([
      {
        role: "assistant",
        content:
          "Hello! I'm your AI recruitment assistant. I have access to all your applicants, job orders, and clients. How can I help you today?\n\nFor example, you can ask me:\n- \"Find me the top 5 candidates for a Senior React Developer position\"\n- \"Show me candidates with 5+ years of experience in Toronto\"\n- \"Who would be a good fit for [job title]?\"",
      },
    ])
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center px-6">
      <div
        className={`w-full max-w-[1400px] bg-white border-t-2 border-slate-300 shadow-2xl flex flex-col transition-all duration-300 ${
          isMinimized ? "h-16 rounded-t-2xl" : "h-[500px] rounded-t-2xl"
        }`}
      >
      {/* Header Bar */}
      <div className="bg-blue-600 text-white px-5 py-2.5 flex items-center justify-between border-b border-blue-700/30 rounded-t-2xl">
        <div className="flex items-center gap-2.5">
          <MessageCircle className="h-4 w-4" />
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm">AI Assistant</h3>
            <span className="text-xs text-blue-200">
              {applicants.length} applicants • {jobOrders.length} jobs • {clients.length} clients
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClearChat}
            className="h-7 w-7 text-white hover:bg-blue-700/50 rounded-md transition-colors"
            title="Clear chat"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMinimized(!isMinimized)}
            className="h-7 w-7 text-white hover:bg-blue-700/50 rounded-md transition-colors"
          >
            {isMinimized ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Chat Content */}
      {!isMinimized && (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gradient-to-b from-slate-50 to-white">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-5 py-3 shadow-sm ${
                    message.role === "user"
                      ? "bg-gradient-to-br from-blue-600 to-blue-700 text-white"
                      : "bg-white text-slate-800 border border-slate-200 shadow-md"
                  }`}
                >
                  <div className={`whitespace-pre-wrap leading-tight ${
                    message.role === "user" 
                      ? "text-white font-medium text-[15px]" 
                      : "text-slate-700 font-normal text-[15px]"
                  }`}>
                    {message.role === "assistant" ? (
                      <div className="space-y-0.5">
                        {message.content.split('\n').map((line, idx) => {
                          // Convert markdown-style bold (**text**) to actual bold
                          const formattedLine = line
                            .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold">$1</strong>')
                            .replace(/\*(.*?)\*/g, '<em class="italic">$1</em>')
                          
                          // Handle bullet points
                          if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
                            return (
                              <div key={idx} className="ml-4 flex items-start gap-2">
                                <span className="text-blue-600 mt-1">•</span>
                                <span dangerouslySetInnerHTML={{ __html: formattedLine.replace(/^[-*]\s+/, '') }} />
                              </div>
                            )
                          }
                          
                          // Handle numbered lists
                          if (/^\d+\.\s/.test(line.trim())) {
                            return (
                              <div key={idx} className="ml-4 flex items-start gap-2">
                                <span className="font-semibold text-blue-600">{line.match(/^\d+\./)?.[0]}</span>
                                <span dangerouslySetInnerHTML={{ __html: formattedLine.replace(/^\d+\.\s+/, '') }} />
                              </div>
                            )
                          }
                          
                          // Regular line with potential bold formatting
                          if (formattedLine !== line) {
                            return <div key={idx} dangerouslySetInnerHTML={{ __html: formattedLine }} />
                          }
                          
                          return <div key={idx}>{line || '\u00A0'}</div>
                        })}
                      </div>
                    ) : (
                      <p>{message.content}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 rounded-2xl px-5 py-3 shadow-sm">
                  <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-5 border-t border-slate-200 bg-white shadow-lg">
            <div className="flex gap-3">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask me anything about candidates, jobs, or clients..."
                className="flex-1 border-slate-300 focus:border-blue-500 focus:ring-blue-500 rounded-xl px-4 py-3 text-[15px] font-normal"
                disabled={isLoading}
              />
              <Button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-5 shadow-md hover:shadow-lg transition-all"
                size="icon"
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </Button>
            </div>
          </div>
        </>
      )}
      </div>
    </div>
  )
}

