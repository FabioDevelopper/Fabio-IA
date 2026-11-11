"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  ArrowUp, Check, ChevronDown, Copy, FileText, Menu, MessageSquare,
  Mic, MoreHorizontal, Paperclip, PanelLeftClose, Plus, Search,
  Settings, Sparkles, Trash2, X,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
const STORAGE_KEY = "fabio-ia-conversations";
const USER_ID = "fabrice";
const MAX_FILE_SIZE = 10 * 1024 * 1024;

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};
type Conversation = {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: string;
};
type Attachment = { id: string; file: File };

function createId(): string {
  return crypto.randomUUID();
}

function formatDate(date: string): string {
  const messageDate = new Date(date);
  if (Number.isNaN(messageDate.getTime())) return "Date inconnue";
  const today = new Date();
  if (today.toDateString() === messageDate.toDateString()) return "Aujourd'hui";
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (yesterday.toDateString() === messageDate.toDateString()) return "Hier";
  return messageDate.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
  });
}

function groupConversations(conversations: Conversation[]) {
  const groups: Record<string, Conversation[]> = {};
  conversations.forEach((conversation) => {
    const group = formatDate(conversation.updatedAt);
    if (!groups[group]) groups[group] = [];
    groups[group].push(conversation);
  });
  return groups;
}

function CodeBlock({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const language = className?.replace("language-", "") || "code";

  const copyCode = async () => {
    const text = String(children ?? "").replace(/\n$/, "");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="my-5 overflow-hidden rounded-xl border border-[#303030] bg-[#151515]">
      <div className="flex items-center justify-between border-b border-[#333] px-4 py-2.5">
        <span className="text-xs text-gray-400">{language}</span>
        <button
          type="button"
          onClick={copyCode}
          className="flex items-center gap-2 text-xs text-gray-400 transition hover:text-white"
          aria-label="Copier le code"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "Copié" : "Copier"}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-sm leading-7 text-gray-100">
        <code>{children}</code>
      </pre>
    </div>
  );
}

function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="markdown-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children }) {
            if (className) {
              return <CodeBlock className={className}>{children}</CodeBlock>;
            }
            return (
              <code className="rounded bg-[#292929] px-1.5 py-0.5 text-sm text-gray-200">
                {children}
              </code>
            );
          },
          a({ href, children }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-white underline underline-offset-4 hover:text-gray-300"
              >
                {children}
              </a>
            );
          },
          table({ children }) {
            return (
              <div className="my-5 overflow-x-auto rounded-xl border border-[#333]">
                <table className="w-full border-collapse text-sm">{children}</table>
              </div>
            );
          },
          th({ children }) {
            return (
              <th className="border-b border-[#444] bg-[#202020] px-4 py-3 text-left font-semibold">
                {children}
              </th>
            );
          },
          td({ children }) {
            return <td className="border-b border-[#333] px-4 py-3">{children}</td>;
          },
          ul({ children }) {
            return <ul className="my-3 ml-6 list-disc space-y-2">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="my-3 ml-6 list-decimal space-y-2">{children}</ol>;
          },
          p({ children }) {
            return <p className="my-3 leading-7">{children}</p>;
          },
          h1({ children }) {
            return <h1 className="mb-4 mt-7 text-2xl font-semibold text-white">{children}</h1>;
          },
          h2({ children }) {
            return <h2 className="mb-3 mt-6 text-xl font-semibold text-white">{children}</h2>;
          },
          h3({ children }) {
            return <h3 className="mb-2 mt-5 text-lg font-semibold text-white">{children}</h3>;
          },
          blockquote({ children }) {
            return (
              <blockquote className="my-4 border-l-2 border-gray-500 pl-4 text-gray-400">
                {children}
              </blockquote>
            );
          },
          hr() {
            return <hr className="my-6 border-[#333]" />;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export default function Home() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [hydrated, setHydrated] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeConversation =
    conversations.find((conversation) => conversation.id === activeId) ?? null;
  const messages = activeConversation?.messages ?? [];
  const filteredConversations = conversations.filter((conversation) =>
    conversation.title.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const groupedConversations = groupConversations(filteredConversations);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setConversations(parsed);
      }
    } catch (error) {
      console.error("Impossible de charger les conversations :", error);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
    } catch (error) {
      console.error("Impossible de sauvegarder les conversations :", error);
    }
  }, [conversations, hydrated]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  }, [input]);

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    };
  }, []);

  const updateConversation = useCallback(
    (
      conversationId: string,
      updater: (conversation: Conversation) => Conversation
    ) => {
      setConversations((previous) =>
        previous.map((conversation) =>
          conversation.id === conversationId ? updater(conversation) : conversation
        )
      );
    },
    []
  );

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => setNotice(""), 3000);
  }, []);

  const createConversation = () => {
    if (loading) return;
    const conversation: Conversation = {
      id: createId(),
      title: "Nouvelle conversation",
      messages: [],
      updatedAt: new Date().toISOString(),
    };
    setConversations((previous) => [conversation, ...previous]);
    setActiveId(conversation.id);
    setInput("");
    setAttachments([]);
    setSidebarOpen(false);
    textareaRef.current?.focus();
  };

  const selectConversation = (conversationId: string) => {
    if (loading) return;
    setActiveId(conversationId);
    setSidebarOpen(false);
  };

  const deleteConversation = (conversationId: string) => {
    if (loading) return;
    const confirmed = window.confirm("Voulez-vous vraiment supprimer cette conversation ?");
    if (!confirmed) return;
    setConversations((previous) =>
      previous.filter((conversation) => conversation.id !== conversationId)
    );
    if (activeId === conversationId) setActiveId(null);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    const allowedExtensions = ["pdf", "txt", "docx", "png", "jpg", "jpeg", "webp"];
    const validFiles: Attachment[] = [];

    for (const file of files) {
      const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
      if (!allowedExtensions.includes(extension)) {
        showNotice(`Format non accepté : ${file.name}`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        showNotice(`${file.name} dépasse la limite de 10 Mo.`);
        continue;
      }
      validFiles.push({ id: createId(), file });
    }

    setAttachments((previous) => [...previous, ...validFiles]);
    event.target.value = "";
  };

  const removeAttachment = (attachmentId: string) => {
    setAttachments((previous) =>
      previous.filter((attachment) => attachment.id !== attachmentId)
    );
  };

  const sendMessage = async () => {
    const content = input.trim();
    if (loading || (!content && attachments.length === 0)) return;
    if (attachments.length > 0) {
      showNotice(
        "L'envoi de fichiers n'est pas encore disponible. Retire les pièces jointes pour continuer."
      );
      return;
    }
    if (!content) return;

    let conversationId = activeId;
    if (!conversationId) {
      conversationId = createId();
      setActiveId(conversationId);
    }
    const currentId = conversationId;

    const userMessage: Message = {
      id: createId(),
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    };

    const conversationExists = conversations.some(
      (conversation) => conversation.id === currentId
    );

    if (conversationExists) {
      updateConversation(currentId, (conversation) => ({
        ...conversation,
        title:
          conversation.messages.length === 0
            ? content.slice(0, 45) || "Nouvelle conversation"
            : conversation.title,
        messages: [...conversation.messages, userMessage],
        updatedAt: new Date().toISOString(),
      }));
    } else {
      const newConversation: Conversation = {
        id: currentId,
        title: content.slice(0, 45) || "Nouvelle conversation",
        messages: [userMessage],
        updatedAt: new Date().toISOString(),
      };
      setConversations((previous) => [newConversation, ...previous]);
    }

    setInput("");
    setAttachments([]);
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content, user_id: USER_ID }),
      });

      if (!response.ok) throw new Error(`Erreur serveur : ${response.status}`);
      const data = await response.json();
      const assistantContent =
        typeof data.response === "string"
          ? data.response
          : typeof data.answer === "string"
            ? data.answer
            : typeof data.message === "string"
              ? data.message
              : "Je n'ai pas reçu de réponse exploitable du serveur.";

      const assistantMessage: Message = {
        id: createId(),
        role: "assistant",
        content: assistantContent,
        createdAt: new Date().toISOString(),
      };

      updateConversation(currentId, (conversation) => ({
        ...conversation,
        messages: [...conversation.messages, assistantMessage],
        updatedAt: new Date().toISOString(),
      }));
    } catch (error) {
      console.error("Erreur lors de l'envoi :", error);
      const errorMessage: Message = {
        id: createId(),
        role: "assistant",
        content:
          "Une erreur est survenue lors de la connexion au serveur. Vérifie que le backend Fabio IA est démarré et réessaie.",
        createdAt: new Date().toISOString(),
      };
      updateConversation(currentId, (conversation) => ({
        ...conversation,
        messages: [...conversation.messages, errorMessage],
        updatedAt: new Date().toISOString(),
      }));
    } finally {
      setLoading(false);
      textareaRef.current?.focus();
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendMessage();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  };

  const copyMessage = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      showNotice("Réponse copiée.");
    } catch {
      showNotice("Impossible de copier le texte.");
    }
  };

  const welcomePrompts = [
    {
      title: "Apprendre quelque chose",
      description: "Explique-moi un concept étape par étape.",
      icon: <Sparkles size={18} />,
    },
    {
      title: "Écrire du code",
      description: "Aide-moi à développer une application.",
      icon: <FileText size={18} />,
    },
    {
      title: "Résoudre un problème",
      description: "Analysons une difficulté ensemble.",
      icon: <MessageSquare size={18} />,
    },
    {
      title: "Organiser mes idées",
      description: "Structure un projet ou un plan de travail.",
      icon: <Settings size={18} />,
    },
  ];

  return (
    <main className="flex h-screen overflow-hidden bg-[#0b0b0b] text-white">
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Fermer le menu"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/70 md:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col border-r border-[#252525] bg-[#111111] transition-transform duration-300 md:relative md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-[68px] items-center justify-between border-b border-[#252525] px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-black">
              <Sparkles size={19} />
            </div>
            <div>
              <h1 className="text-base font-semibold tracking-tight">Fabio IA</h1>
              <p className="text-[10px] uppercase tracking-[2px] text-gray-500">
                Assistant intelligent
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="rounded-lg p-2 text-gray-400 transition hover:bg-[#252525] hover:text-white md:hidden"
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="hidden rounded-lg p-2 text-gray-500 transition hover:bg-[#252525] hover:text-white md:block"
            aria-label="Réduire le menu"
          >
            <PanelLeftClose size={18} />
          </button>
        </div>

        <div className="space-y-2 p-4">
          <button
            type="button"
            onClick={createConversation}
            disabled={loading}
            className="flex w-full items-center gap-3 rounded-xl border border-[#353535] bg-[#202020] px-4 py-3 text-sm font-medium transition hover:border-[#555] hover:bg-[#292929] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus size={17} />
            Nouvelle conversation
          </button>

          <button
            type="button"
            onClick={() => {
              setSearchOpen((previous) => !previous);
              setSearchQuery("");
            }}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm text-gray-400 transition hover:bg-[#202020] hover:text-white"
          >
            <Search size={17} />
            Rechercher
            <span className="ml-auto text-xs text-gray-600">Ctrl K</span>
          </button>

          {searchOpen && (
            <div className="relative">
              <input
                autoFocus
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Rechercher une conversation..."
                className="w-full rounded-lg border border-[#353535] bg-[#191919] px-3 py-2.5 pr-9 text-xs text-white outline-none placeholder:text-gray-600 focus:border-gray-500"
              />
              <button
                type="button"
                onClick={() => {
                  setSearchOpen(false);
                  setSearchQuery("");
                }}
                className="absolute right-2 top-2.5 text-gray-500 hover:text-white"
                aria-label="Fermer la recherche"
              >
                <X size={15} />
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-4">
          <div className="mb-3 px-3 pt-3 text-[10px] font-semibold uppercase tracking-[2px] text-gray-600">
            Historique
          </div>

          {Object.entries(groupedConversations).map(([group, items]) => (
            <div key={group} className="mb-5">
              <p className="mb-2 px-3 text-[11px] text-gray-600">{group}</p>
              <div className="space-y-1">
                {items.map((conversation) => (
                  <div
                    key={conversation.id}
                    className={`group flex items-center gap-2 rounded-lg px-3 py-2.5 transition ${
                      activeId === conversation.id
                        ? "bg-[#292929] text-white"
                        : "text-gray-400 hover:bg-[#202020] hover:text-white"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => selectConversation(conversation.id)}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <MessageSquare size={15} className="shrink-0" />
                      <span className="truncate text-xs">{conversation.title}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteConversation(conversation.id)}
                      className="rounded p-1 text-gray-600 opacity-0 transition hover:bg-[#383838] hover:text-white group-hover:opacity-100 focus:opacity-100"
                      aria-label="Supprimer la conversation"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {filteredConversations.length === 0 && (
            <p className="px-3 py-4 text-xs text-gray-600">
              {searchQuery ? "Aucun résultat." : "Tes conversations apparaîtront ici."}
            </p>
          )}
        </div>

        <div className="border-t border-[#252525] p-4">
          <button
            type="button"
            onClick={() => showNotice("Les paramètres seront bientôt disponibles.")}
            className="mb-3 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-gray-400 transition hover:bg-[#202020] hover:text-white"
          >
            <Settings size={17} />
            Paramètres
          </button>
          <div className="flex items-center gap-3 rounded-xl bg-[#1c1c1c] p-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#343434] text-sm font-semibold">
              F
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">Fabrice</p>
              <p className="text-[11px] text-gray-500">Compte personnel</p>
            </div>
            <MoreHorizontal size={18} className="text-gray-500" />
          </div>
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[68px] shrink-0 items-center justify-between border-b border-[#252525] px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg p-2 text-gray-400 transition hover:bg-[#202020] hover:text-white md:hidden"
              aria-label="Ouvrir le menu"
            >
              <Menu size={20} />
            </button>
            <div>
              <p className="text-sm font-medium">
                {activeConversation?.title || "Nouvelle conversation"}
              </p>
              <p className="text-[11px] text-gray-500">Fabio IA · Votre assistant</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => showNotice("Plus d'options seront bientôt disponibles.")}
            className="rounded-lg p-2 text-gray-500 transition hover:bg-[#202020] hover:text-white"
            aria-label="Plus d'options"
          >
            <MoreHorizontal size={20} />
          </button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {messages.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center px-5 py-12">
              <div className="mb-7 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#333] bg-[#181818]">
                <Sparkles size={28} strokeWidth={1.5} />
              </div>
              <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
                Comment puis-je t'aider ?
              </h2>
              <p className="mt-3 max-w-md text-center text-sm leading-6 text-gray-500">
                Pose une question, partage une idée ou démarre un projet.
                Fabio IA est prêt à t'accompagner.
              </p>
              <div className="mt-10 grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
                {welcomePrompts.map((prompt) => (
                  <button
                    type="button"
                    key={prompt.title}
                    onClick={() => setInput(prompt.description)}
                    className="group rounded-xl border border-[#292929] bg-[#121212] p-4 text-left transition hover:border-[#555] hover:bg-[#191919]"
                  >
                    <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-[#252525] text-gray-300 transition group-hover:bg-[#333] group-hover:text-white">
                      {prompt.icon}
                    </div>
                    <p className="text-sm font-medium">{prompt.title}</p>
                    <p className="mt-1 text-xs leading-5 text-gray-500">
                      {prompt.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
              <div className="space-y-8">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex gap-4 ${
                      message.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    {message.role === "assistant" && (
                      <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#333] bg-[#1b1b1b]">
                        <Sparkles size={16} />
                      </div>
                    )}
                    <div
                      className={`min-w-0 max-w-[90%] ${
                        message.role === "user"
                          ? "rounded-2xl rounded-br-md bg-[#292929] px-4 py-3 sm:max-w-[80%]"
                          : "flex-1 pt-1"
                      }`}
                    >
                      {message.role === "user" ? (
                        <p className="whitespace-pre-wrap text-sm leading-7">
                          {message.content}
                        </p>
                      ) : (
                        <>
                          <MarkdownContent content={message.content} />
                          <div className="mt-4 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => void copyMessage(message.content)}
                              className="rounded-lg p-2 text-gray-600 transition hover:bg-[#202020] hover:text-white"
                              aria-label="Copier la réponse"
                            >
                              <Copy size={14} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="flex gap-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#333] bg-[#1b1b1b]">
                      <Sparkles size={16} />
                    </div>
                    <div className="flex items-center gap-2 pt-2">
                      <span className="typing-dot h-2 w-2 rounded-full bg-gray-400" />
                      <span className="typing-dot h-2 w-2 rounded-full bg-gray-400" />
                      <span className="typing-dot h-2 w-2 rounded-full bg-gray-400" />
                    </div>
                  </div>
                )}
              </div>
              <div ref={bottomRef} />
            </div>
          )}
          {messages.length === 0 && <div ref={bottomRef} />}
        </div>

        <div className="shrink-0 px-4 pb-5 pt-3 sm:px-6">
          <div className="mx-auto max-w-3xl">
            {attachments.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="flex items-center gap-2 rounded-lg border border-[#353535] bg-[#1b1b1b] px-3 py-2"
                  >
                    <FileText size={15} className="text-gray-400" />
                    <span className="max-w-[180px] truncate text-xs text-gray-300">
                      {attachment.file.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(attachment.id)}
                      className="text-gray-500 hover:text-white"
                      aria-label="Retirer le fichier"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <form
              onSubmit={handleSubmit}
              className="rounded-2xl border border-[#393939] bg-[#171717] shadow-[0_10px_40px_rgba(0,0,0,0.2)] transition focus-within:border-[#555]"
            >
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Écris ton message à Fabio IA..."
                rows={1}
                disabled={loading}
                className="max-h-[200px] min-h-[58px] w-full resize-none bg-transparent px-5 pb-2 pt-5 text-sm leading-6 text-white outline-none placeholder:text-gray-600 disabled:opacity-60"
              />
              <div className="flex items-center justify-between px-3 pb-3">
                <div className="flex items-center gap-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.txt,.docx,.png,.jpg,.jpeg,.webp"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={loading}
                    className="rounded-lg p-2.5 text-gray-500 transition hover:bg-[#292929] hover:text-white disabled:opacity-40"
                    aria-label="Joindre un fichier"
                  >
                    <Paperclip size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      showNotice("La saisie vocale sera disponible prochainement.")
                    }
                    className="rounded-lg p-2.5 text-gray-500 transition hover:bg-[#292929] hover:text-white"
                    aria-label="Saisie vocale"
                  >
                    <Mic size={18} />
                  </button>
                  <div className="relative hidden sm:block">
                    <span className="flex items-center gap-1 rounded-lg px-2 py-2 text-[11px] text-gray-600">
                      Fabio IA
                      <ChevronDown size={13} />
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="hidden text-[10px] text-gray-600 sm:block">
                    Entrée pour envoyer
                  </span>
                  <button
                    type="submit"
                    disabled={loading || (!input.trim() && attachments.length === 0)}
                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-black transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:bg-[#333] disabled:text-gray-600"
                    aria-label="Envoyer le message"
                  >
                    {loading ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-500 border-t-white" />
                    ) : (
                      <ArrowUp size={19} strokeWidth={2.5} />
                    )}
                  </button>
                </div>
              </div>
            </form>
            <p className="mt-3 text-center text-[10px] text-gray-600">
              Fabio IA peut faire des erreurs. Vérifie les informations importantes.
            </p>
          </div>
        </div>
      </section>

      {notice && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 rounded-xl border border-[#444] bg-[#222] px-5 py-3 text-sm text-white shadow-2xl"
        >
          {notice}
        </div>
      )}
    </main>
  );
}
