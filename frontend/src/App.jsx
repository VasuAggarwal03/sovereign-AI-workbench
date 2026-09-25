import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUp,
  Check,
  ChevronDown,
  Circle,
  Clock3,
  Copy,
  FileText,
  Image as ImageIcon,
  Lock,
  Mic,
  Square,
  Volume2,
  Menu,
  Plus,
  RotateCcw,
  Search,
  Shield,
  ShieldCheck,
  Sparkles,
  Terminal,
  X,
  Zap,
} from "lucide-react";

const API_URL = "http://127.0.0.1:8000";

const starterPrompts = [
  {
    title: "Explain machine learning",
    description: "Get a clear technical explanation",
  },
  {
    title: "Analyze a security request",
    description: "See the policy engine in action",
  },
  {
    title: "What is zero trust?",
    description: "Learn about modern security architecture",
  },
];
async function speakResponse(text) {
  if (!text?.trim()) return;

  try {
    const response = await fetch(`${API_URL}/voice/speak`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: text.trim(),
      }),
    });

    if (!response.ok) {
      let detail = `Speech generation failed (${response.status})`;

      try {
        const errorData = await response.json();

        if (errorData?.detail) {
          detail = errorData.detail;
        }
      } catch {
        // Keep default error
      }

      throw new Error(detail);
    }

    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);

    const audio = new Audio(audioUrl);

    audio.onended = () => {
      URL.revokeObjectURL(audioUrl);
    };

    audio.onerror = () => {
      URL.revokeObjectURL(audioUrl);
      console.error("Audio playback failed.");
    };

    await audio.play();
  } catch (error) {
    console.error("Voice playback error:", error);
  }
}

function App() {
  const fileInputRef = useRef(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const [activeView, setActiveView] = useState("workspace");

  const [security, setSecurity] = useState({
    status: "ready",
    allowed: null,
    risk: "—",
    reason: "Waiting for a request",
    requestId: "—",
    model: "qwen3:4b",
    location: "Local",
    gateway: "Protected",
  });

  const [sessions, setSessions] = useState([
    { id: 1, title: "New conversation", time: "Just now" },
  ]);

  const [activeSession, setActiveSession] = useState(1);
  const [mobileSecurityOpen, setMobileSecurityOpen] = useState(false);

  const [auditEvents, setAuditEvents] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState("");
  const [auditSearch, setAuditSearch] = useState("");
  const [auditFilter, setAuditFilter] = useState("all");

  const bottomRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("")
  const [documentId, setDocumentId] = useState(null);

  const imageInputRef = useRef(null);
  const createdUrlsRef = useRef(new Set());
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageError, setImageError] = useState("");
  const [isVisionLoading, setIsVisionLoading] = useState(false);

  // Revoke created object URLs on unmount
  useEffect(() => {
    const urls = createdUrlsRef.current;
    return () => {
      urls.forEach((url) => {
        URL.revokeObjectURL(url);
      });
      urls.clear();
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  /*
   * Load the real audit trail from the backend.
   */
  async function loadAuditTrail() {
    setAuditLoading(true);
    setAuditError("");

    try {
      const response = await fetch(`${API_URL}/audit`);

      if (!response.ok) {
        throw new Error(`Audit endpoint returned ${response.status}`);
      }

      const data = await response.json();

      setAuditEvents(Array.isArray(data.events) ? data.events : []);
    } catch (error) {
      console.error("Audit trail error:", error);
      setAuditError(
        "Unable to load the audit trail. Make sure the backend is running."
      );
    } finally {
      setAuditLoading(false);
    }
  }

  /*
   * Load audit data when the Audit Trail page is opened.
   */
  useEffect(() => {
    if (activeView === "audit" || activeView === "logs") {
      loadAuditTrail();
    }
  }, [activeView]);

  const sessionTitle = useMemo(() => {
    const active = sessions.find((s) => s.id === activeSession);
    return active?.title || "New conversation";
  }, [sessions, activeSession]);

  const riskLabel = security.risk?.toUpperCase() || "—";

  const riskClass =
    security.risk === "high"
      ? "risk-high"
      : security.risk === "medium"
        ? "risk-medium"
        : security.risk === "low"
          ? "risk-low"
          : "risk-neutral";

  function handleImageSelect(file) {
    setImageError("");
    if (!file) return;

    const allowedExtensions = [".png", ".jpg", ".jpeg", ".webp"];
    const allowedMimeTypes = ["image/png", "image/jpeg", "image/webp"];
    const filename = (file.name || "").toLowerCase();
    const hasValidExt = allowedExtensions.some((ext) => filename.endsWith(ext));
    const hasValidMime = allowedMimeTypes.includes(file.type);

    if (!hasValidExt && !hasValidMime) {
      setImageError("Please upload a PNG, JPG, JPEG, or WEBP image.");
      if (imageInputRef.current) {
        imageInputRef.current.value = "";
      }
      return;
    }

    if (file.size === 0) {
      setImageError("Uploaded image is empty.");
      if (imageInputRef.current) {
        imageInputRef.current.value = "";
      }
      return;
    }

    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
      createdUrlsRef.current.delete(imagePreview);
    }

    const previewUrl = URL.createObjectURL(file);
    createdUrlsRef.current.add(previewUrl);
    setSelectedImage(file);
    setImagePreview(previewUrl);
  }

  function clearSelectedImage() {
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
      createdUrlsRef.current.delete(imagePreview);
    }
    setSelectedImage(null);
    setImagePreview(null);
    setImageError("");
    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }
  }
  async function toggleVoiceRecording() {
    if (isTranscribing || loading) return;

    // Stop recording
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      return;
    }



    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      const mimeTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
      ];

      const supportedMimeType = mimeTypes.find((type) =>
        MediaRecorder.isTypeSupported(type)
      );

      const recorder = supportedMimeType
        ? new MediaRecorder(stream, {
          mimeType: supportedMimeType,
        })
        : new MediaRecorder(stream);

      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());

        const audioBlob = new Blob(
          audioChunksRef.current,
          {
            type: recorder.mimeType || "audio/webm",
          }
        );

        setIsRecording(false);
        setIsTranscribing(true);

        try {
          const formData = new FormData();

          const extension = recorder.mimeType.includes("mp4")
            ? "mp4"
            : "webm";

          formData.append(
            "file",
            audioBlob,
            `voice-input.${extension}`
          );

          const response = await fetch(
            `${API_URL}/voice/transcribe`,
            {
              method: "POST",
              body: formData,
            }
          );

          if (!response.ok) {
            let detail = `Voice transcription failed (${response.status})`;

            try {
              const errorData = await response.json();

              if (errorData?.detail) {
                detail = errorData.detail;
              }
            } catch {
              // Keep default error
            }

            throw new Error(detail);
          }

          const data = await response.json();

          const transcript = data.text?.trim();

          if (transcript) {
            setInput((previous) =>
              previous.trim()
                ? `${previous.trim()} ${transcript}`
                : transcript
            );
          }
        } catch (error) {
          console.error("Voice transcription error:", error);

          setSecurity({
            status: "error",
            allowed: null,
            risk: "—",
            reason: "Voice transcription failed",
            requestId: "—",
            model: "faster-whisper-base",
            location: "Local",
            gateway: "Protected",
          });
        } finally {
          setIsTranscribing(false);
        }
      };

      mediaRecorderRef.current = recorder;

      recorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Microphone access error:", error);

      setSecurity({
        status: "error",
        allowed: null,
        risk: "—",
        reason: "Microphone access was unavailable",
        requestId: "—",
        model: "faster-whisper-base",
        location: "Local",
        gateway: "Protected",
      });
    }
  }

  async function sendMessage(message = input) {
    const trimmed = typeof message === "string" ? message.trim() : input.trim();

    if ((!trimmed && !selectedImage) || loading) return;

    if (selectedImage) {
      const currentImage = selectedImage;
      const currentPreview = imagePreview;
      const promptText =
        trimmed || "Analyze this image and describe the important visual information.";

      const userMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: promptText,
        imageUrl: currentPreview,
        imageName: currentImage.name,
      };

      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      setSelectedImage(null);
      setImagePreview(null);
      setImageError("");
      if (imageInputRef.current) {
        imageInputRef.current.value = "";
      }

      setLoading(true);
      setIsVisionLoading(true);

      setSecurity({
        status: "analyzing",
        allowed: null,
        risk: "—",
        reason: "Vision model is analyzing the image locally",
        requestId: "processing…",
        model: "qwen2.5vl:3b",
      });

      const startTime = performance.now();

      try {
        const formData = new FormData();
        formData.append("file", currentImage);

        const response = await fetch(`${API_URL}/vision/analyze`, {
          method: "POST",
          body: formData,
        });

        const elapsedSeconds = ((performance.now() - startTime) / 1000).toFixed(2);

        if (!response.ok) {
          let errDetail = `Vision analysis failed (status ${response.status})`;
          try {
            const errData = await response.json();
            if (errData?.detail) {
              errDetail =
                typeof errData.detail === "string"
                  ? errData.detail
                  : JSON.stringify(errData.detail);
            }
          } catch {
            // Keep default
          }
          throw new Error(errDetail);
        }

        const data = await response.json();

        setSecurity({
          status: "allowed",
          allowed: true,
          risk: "low",
          reason: "Local vision intelligence analysis completed",
          requestId: `vis-${Date.now().toString(36)}`,
          model: data.model || "qwen2.5vl:3b",
          location: data.local ? "Local" : "Remote",
          gateway: "Protected",
        });

        const assistantMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.response || "No analysis provided by vision model.",
          model: data.model || "qwen2.5vl:3b",
          local: data.local ?? true,
          responseTime: elapsedSeconds,
          isVision: true,
        };

        setMessages((prev) => [...prev, assistantMessage]);

        setSessions((prev) =>
          prev.map((session) =>
            session.id === activeSession &&
              session.title === "New conversation"
              ? {
                ...session,
                title:
                  promptText.length > 30
                    ? `${promptText.slice(0, 30)}…`
                    : promptText,
              }
              : session
          )
        );
      } catch (error) {
        console.error("Vision analysis error:", error);

        setSecurity({
          status: "error",
          allowed: null,
          risk: "—",
          reason: "Unable to complete vision analysis",
          requestId: "—",
          model: "qwen2.5vl:3b",
        });

        let displayError = "Vision analysis failed. Make sure the local vision model is available.";
        if (error?.message) {
          const clean = error.message.replace(/^Error:\s*/, "");
          if (!clean.includes("Traceback") && !clean.includes("File \"")) {
            displayError = clean;
          }
        }

        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: displayError,
            error: true,
          },
        ]);
      } finally {
        setLoading(false);
        setIsVisionLoading(false);
      }
      return;
    }

    const userMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    setSecurity({
      status: "analyzing",
      allowed: null,
      risk: "—",
      reason: "Policy engine is evaluating the request",
      requestId: "processing…",
      model: "qwen3:4b",
    });

    try {
      const response = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: trimmed,
          document_id: documentId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Backend returned ${response.status}`);
      }

      const data = await response.json();

      const allowed = data.allowed;
      const risk = data.risk_level || "low";

      setSecurity({
        status: allowed ? "allowed" : "blocked",
        allowed,
        risk,
        reason: data.reason || "Policy decision received",
        requestId: data.request_id || "—",
        model: "qwen3:4b",
        location: data.location || "Local",
        gateway: allowed ? "Protected" : "Blocked",
      });

      const assistantMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content:
          data.response ||
          "The security gateway returned an empty response.",
        blocked: allowed === false,
        responseTime: data.response_time,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      setSessions((prev) =>
        prev.map((session) =>
          session.id === activeSession &&
            session.title === "New conversation"
            ? {
              ...session,
              title:
                trimmed.length > 30
                  ? `${trimmed.slice(0, 30)}…`
                  : trimmed,
            }
            : session
        )
      );

      /*
       * Refresh the audit trail immediately after a request.
       * This makes the dashboard reactive.
       */
      if (activeView === "audit" || activeView === "logs") {
        await loadAuditTrail();
      }
    } catch (error) {
      console.error(error);

      setSecurity({
        status: "error",
        allowed: null,
        risk: "—",
        reason: "Unable to reach the Sovereign AI backend",
        requestId: "—",
        model: "qwen3:4b",
      });

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content:
            "I couldn't connect to the local Sovereign AI gateway. Make sure the backend is running on port 8000.",
          error: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function openSystemLogs() {
    setActiveView("logs");
  }

  function createNewChat() {
    const id = Date.now();

    // Revoke all session object URLs
    createdUrlsRef.current.forEach((url) => {
      URL.revokeObjectURL(url);
    });
    createdUrlsRef.current.clear();

    clearSelectedImage();

    setSessions((prev) => [
      { id, title: "New conversation", time: "Just now" },
      ...prev,
    ]);

    setActiveSession(id);
    setMessages([]);
    setInput("");
    setActiveView("workspace");
    setDocumentId(null);

    setSecurity({
      status: "ready",
      allowed: null,
      risk: "—",
      reason: "Waiting for a request",
      requestId: "—",
      model: "qwen3:4b",
    });
  }

  function handleKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      if ((input.trim() || selectedImage) && !loading) {
        event.preventDefault();
        sendMessage();
      }
    }
  }

  function copyMessage(content) {
    navigator.clipboard?.writeText(content);
  }

  async function uploadDocument(file) {
    if (!file) return;

    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    if (!allowedTypes.includes(file.type)) {
      setUploadStatus("Please upload a PDF or DOCX file.");
      return;
    }

    setUploading(true);
    setUploadStatus("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${API_URL}/documents/upload`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || `Upload failed with status ${response.status}`
        );
      }

      setDocumentId(data.document_id);

      setUploadStatus(
        `✓ ${data.filename || file.name} uploaded successfully`
      );
    } catch (error) {
      console.error("Document upload error:", error);
      setUploadStatus(
        `Upload failed: ${error.message}`
      );
    } finally {
      setUploading(false);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  function openWorkspace() {
    setActiveView("workspace");
  }

  function openAuditTrail() {
    setActiveView("audit");
  }

  return (
    <div className="app-shell">
      <Sidebar
        sessions={sessions}
        activeSession={activeSession}
        setActiveSession={setActiveSession}
        createNewChat={createNewChat}
        activeView={activeView}
        openWorkspace={openWorkspace}
        openAuditTrail={openAuditTrail}
        openSystemLogs={openSystemLogs}
      />

      <main className="main-area">
        {activeView === "audit" ? (
          <AuditTrail
            events={auditEvents}
            loading={auditLoading}
            error={auditError}
            search={auditSearch}
            setSearch={setAuditSearch}
            filter={auditFilter}
            setFilter={setAuditFilter}
            onRefresh={loadAuditTrail}
          />
        ) : activeView === "logs" ? (
          <SystemLogs events={auditEvents} />
        ) : (
          <>
            <header className="topbar">
              <div className="mobile-brand">
                <Shield size={19} />
                <span>Sovereign AI</span>
              </div>

              <div className="topbar-title">
                <span>{sessionTitle}</span>
                <ChevronDown size={15} />
              </div>

              <div className="topbar-actions">
                <div className="local-badge">
                  <span className="live-dot" />
                  Local
                </div>

                <button
                  className="security-toggle"
                  onClick={() => setMobileSecurityOpen(true)}
                >
                  <ShieldCheck size={17} />
                  Security
                </button>
              </div>
            </header>

            <section className="chat-area">
              {messages.length === 0 ? (
                <WelcomeScreen onPrompt={sendMessage} />
              ) : (
                <div className="conversation">
                  {messages.map((message) => (
                    <Message
                      key={message.id}
                      message={message}
                      onCopy={copyMessage}
                      onSpeak={speakResponse}
                    />
                  ))}

                  {loading && <ProcessingMessage isVision={isVisionLoading} />}

                  <div ref={bottomRef} />
                </div>
              )}
            </section>

            <div className="composer-wrapper">
              <div className="composer">
                {selectedImage && imagePreview && (
                  <div className="composer-image-preview">
                    <div className="composer-image-thumb-wrapper">
                      <img
                        src={imagePreview}
                        alt={selectedImage.name}
                        className="composer-image-thumb"
                      />
                    </div>
                    <span
                      className="composer-image-name"
                      title={selectedImage.name}
                    >
                      {selectedImage.name}
                    </span>
                    <button
                      type="button"
                      className="composer-image-remove"
                      onClick={clearSelectedImage}
                      aria-label="Remove image"
                      title="Remove image"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  style={{ display: "none" }}
                  onChange={(event) => {
                    uploadDocument(event.target.files?.[0]);
                  }}
                />

                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  hidden
                  onChange={(event) => {
                    handleImageSelect(event.target.files?.[0]);
                  }}
                />

                <textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    selectedImage
                      ? "Ask about this image (or press send to analyze)…"
                      : "Message Sovereign AI…"
                  }
                  rows={1}
                  disabled={loading}
                />

                <div className="composer-footer">
                  <div className="composer-hint">
                    <Lock size={13} />
                    <span>Processed through local security policy</span>
                    <button
                      type="button"
                      className="upload-button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                    >
                      <FileText size={15} />
                      {uploading ? "Uploading..." : "Upload document"}
                    </button>
                    <button
                      type="button"
                      className="upload-button image-upload-button"
                      onClick={() => imageInputRef.current?.click()}
                      disabled={loading}
                      title="Attach image for vision analysis"
                    >
                      <ImageIcon size={15} />
                      Attach image
                    </button>
                  </div>

                  <button
                    type="button"
                    className={`voice-button ${isRecording ? "recording" : ""}`}
                    onClick={toggleVoiceRecording}
                    disabled={loading || isTranscribing}
                    aria-label={
                      isRecording
                        ? "Stop voice recording"
                        : "Start voice recording"
                    }
                    title={
                      isRecording
                        ? "Stop recording"
                        : isTranscribing
                          ? "Transcribing..."
                          : "Speak"
                    }
                  >
                    {isTranscribing ? (
                      <RotateCcw className="spin" size={17} />
                    ) : isRecording ? (
                      <Square size={15} />
                    ) : (
                      <Mic size={18} />
                    )}
                  </button>

                  <button
                    className={`send-button ${(input.trim() || selectedImage) ? "active" : ""}`}
                    onClick={() => sendMessage()}
                    disabled={(!input.trim() && !selectedImage) || loading}
                    aria-label="Send message"
                  >
                    {loading ? (
                      <RotateCcw className="spin" size={17} />
                    ) : (
                      <ArrowUp size={18} />
                    )}
                  </button>
                </div>
              </div>

              {uploadStatus && (
                <div className="upload-status">
                  {uploadStatus}
                </div>
              )}

              {imageError && (
                <div className="upload-status image-error-status">
                  {imageError}
                </div>
              )}

              <p className="composer-disclaimer">
                Sovereign AI can make mistakes. Verify important information.
              </p>
            </div>


            {mobileSecurityOpen && (
              <div className="mobile-security-overlay">
                <div className="mobile-security-header">
                  <div>
                    <ShieldCheck size={19} />
                    <span>Security Details</span>
                  </div>

                  <button
                    onClick={() => setMobileSecurityOpen(false)}
                  >
                    <X size={19} />
                  </button>
                </div>

                <SecurityContent
                  security={security}
                  riskLabel={riskLabel}
                  riskClass={riskClass}
                />
              </div>
            )}
          </>
        )}
      </main>

      <SecurityPanel
        security={security}
        riskLabel={riskLabel}
        riskClass={riskClass}
      />
    </div>
  );
}

/* =========================================================
   SIDEBAR
   ========================================================= */

function Sidebar({
  sessions,
  activeSession,
  setActiveSession,
  createNewChat,
  activeView,
  openWorkspace,
  openAuditTrail,
  openSystemLogs,
}) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">
          <Shield size={19} />
        </div>

        <div>
          <div className="brand-name">INDUS AI</div>
          <div className="brand-subtitle">WORKBENCH</div>
        </div>
      </div>

      <button className="new-chat" onClick={createNewChat}>
        <Plus size={17} />
        <span>New chat</span>
        <span className="shortcut">⌘ K</span>
      </button>

      <div className="sidebar-section">
        <div className="section-label">Workspace</div>

        <button
          className={`nav-item ${activeView === "workspace" ? "selected" : ""
            }`}
          onClick={openWorkspace}
        >
          <Sparkles size={16} />
          <span>AI Workspace</span>
        </button>

        <button
          className={`nav-item ${activeView === "audit" ? "selected" : ""
            }`}
          onClick={openAuditTrail}
        >
          <FileText size={16} />
          <span>Audit Trail</span>
        </button>

        <button
          className={`nav-item ${activeView === "logs" ? "selected" : ""
            }`}
          onClick={openSystemLogs}
        >
          <Terminal size={16} />
          <span>System Logs</span>
        </button>
      </div>

      <div className="sidebar-section sessions-section">
        <div className="section-label">Recent sessions</div>

        {sessions.map((session) => (
          <button
            key={session.id}
            className={`session-item ${session.id === activeSession ? "active" : ""
              }`}
            onClick={() => {
              setActiveSession(session.id);
              openWorkspace();
            }}
          >
            <div className="session-icon">
              <Circle size={8} fill="currentColor" />
            </div>

            <div className="session-copy">
              <span>{session.title}</span>
              <small>{session.time}</small>
            </div>
          </button>
        ))}
      </div>

      <div className="sidebar-bottom">
        <div className="security-mini-card">
          <div className="mini-icon">
            <Lock size={15} />
          </div>

          <div>
            <strong>Local inference</strong>
            <span>Your data stays on-device</span>
          </div>

          <div className="mini-live" />
        </div>

        <div className="profile-row">
          <div className="avatar">V</div>

          <div>
            <strong>Developer mode</strong>
            <span>Local environment</span>
          </div>

          <Menu size={17} />
        </div>
      </div>
    </aside>
  );
}

/* =========================================================
   AUDIT TRAIL
   ========================================================= */

function AuditTrail({
  events,
  loading,
  error,
  search,
  setSearch,
  filter,
  setFilter,
  onRefresh,
}) {
  const filteredEvents = useMemo(() => {
    const query = search.trim().toLowerCase();

    return events.filter((event) => {
      const allowed =
        event.allowed === true
          ? "allowed"
          : event.allowed === false
            ? "blocked"
            : "";

      const matchesFilter =
        filter === "all" || allowed === filter;

      if (!matchesFilter) return false;

      if (!query) return true;

      return [
        event.request_id,
        event.action,
        event.reason,
        event.risk_level,
        event.model,
        event.message,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [events, search, filter]);

  const totalEvents = events.length;

  const allowedEvents = events.filter(
    (event) => event.allowed === true
  ).length;

  const blockedEvents = events.filter(
    (event) => event.allowed === false
  ).length;

  const highRiskEvents = events.filter(
    (event) => event.risk_level === "high"
  ).length;

  return (
    <section className="audit-page">
      <div className="audit-page-header">
        <div>
          <div className="eyebrow">SECURITY OBSERVABILITY</div>

          <h1>Audit Trail</h1>

          <p>
            Review every request evaluated by the Sovereign AI security
            boundary.
          </p>
        </div>

        <button
          className="audit-refresh"
          onClick={onRefresh}
          disabled={loading}
        >
          <RotateCcw
            size={16}
            className={loading ? "spin" : ""}
          />
          Refresh
        </button>
      </div>

      <div className="audit-stat-grid">
        <AuditStat
          label="Total events"
          value={totalEvents}
          icon={<FileText size={17} />}
        />

        <AuditStat
          label="Allowed"
          value={allowedEvents}
          icon={<Check size={17} />}
          tone="success"
        />

        <AuditStat
          label="Blocked"
          value={blockedEvents}
          icon={<Shield size={17} />}
          tone="danger"
        />

        <AuditStat
          label="High risk"
          value={highRiskEvents}
          icon={<Zap size={17} />}
          tone="warning"
        />
      </div>

      <div className="audit-toolbar">
        <div className="audit-search">
          <Search size={16} />

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search audit events..."
          />
        </div>

        <div className="audit-filters">
          <button
            className={filter === "all" ? "active" : ""}
            onClick={() => setFilter("all")}
          >
            All
          </button>

          <button
            className={filter === "allowed" ? "active" : ""}
            onClick={() => setFilter("allowed")}
          >
            Allowed
          </button>

          <button
            className={filter === "blocked" ? "active" : ""}
            onClick={() => setFilter("blocked")}
          >
            Blocked
          </button>
        </div>
      </div>

      {error && (
        <div className="audit-error">
          <Shield size={17} />
          <span>{error}</span>
        </div>
      )}

      <div className="audit-table-card">
        <div className="audit-table-header">
          <span>REQUEST</span>
          <span>DECISION</span>
          <span>RISK</span>
          <span>MODEL</span>
          <span>TIME</span>
        </div>

        {loading && events.length === 0 ? (
          <div className="audit-empty">
            <RotateCcw className="spin" size={20} />
            <strong>Loading audit trail…</strong>
            <span>Fetching security events from the local gateway.</span>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="audit-empty">
            <FileText size={22} />
            <strong>No audit events found</strong>
            <span>
              {events.length === 0
                ? "Send a request through the AI workspace to create an event."
                : "Try changing the search or filter."}
            </span>
          </div>
        ) : (
          <div className="audit-table-body">
            {filteredEvents.map((event, index) => (
              <AuditEventRow
                key={
                  event.request_id ||
                  `${event.timestamp}-${index}`
                }
                event={event}
              />
            ))}
          </div>
        )}
      </div>

      <div className="audit-footer">
        <span>
          Showing {filteredEvents.length} of {events.length} events
        </span>

        <span>
          <span className="live-dot" />
          Local audit source
        </span>
      </div>
    </section>
  );
}

function AuditStat({ label, value, icon, tone = "" }) {
  return (
    <div className={`audit-stat ${tone}`}>
      <div className="audit-stat-icon">{icon}</div>

      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function AuditEventRow({ event }) {
  const isAllowed = event.allowed === true;
  const isBlocked = event.allowed === false;

  const timestamp = event.timestamp
    ? new Date(event.timestamp).toLocaleString()
    : "—";

  const risk =
    event.risk_level?.toLowerCase() || "unknown";

  return (
    <div className="audit-event-row">
      <div className="audit-request-cell">
        <div className="audit-event-icon">
          {isBlocked ? (
            <Shield size={15} />
          ) : (
            <Check size={15} />
          )}
        </div>

        <div>
          <strong>
            {event.action || "chat"}
          </strong>

          <code>
            {event.request_id || "No request ID"}
          </code>
        </div>
      </div>

      <div>
        <span
          className={`audit-decision ${isAllowed
            ? "allowed"
            : isBlocked
              ? "blocked"
              : ""
            }`}
        >
          {isAllowed
            ? "ALLOWED"
            : isBlocked
              ? "BLOCKED"
              : "UNKNOWN"}
        </span>
      </div>

      <div>
        <span className={`audit-risk ${risk}`}>
          {risk.toUpperCase()}
        </span>
      </div>

      <div className="audit-model">
        {event.model || "—"}
      </div>

      <div className="audit-time">
        <Clock3 size={13} />
        {timestamp}
      </div>

      <div className="audit-reason">
        {event.reason || "No reason recorded"}
      </div>
    </div>
  );
}

/* =========================================================
   WELCOME
   ========================================================= */

function WelcomeScreen({ onPrompt }) {
  return (
    <div className="welcome">
      <div className="welcome-icon">
        <ShieldCheck size={29} />
      </div>

      <div className="welcome-kicker">
        <span className="live-dot" />
        LOCAL INTELLIGENCE GATEWAY
      </div>

      <h1>
        Secure intelligence,
        <br />
        <span>under your control.</span>
      </h1>

      <p>
        A policy-controlled AI workspace that evaluates every request
        before it reaches the local model.
      </p>

      <div className="starter-grid">
        {starterPrompts.map((prompt) => (
          <button
            key={prompt.title}
            className="starter-card"
            onClick={() => onPrompt(prompt.title)}
          >
            <div>
              <strong>{prompt.title}</strong>
              <span>{prompt.description}</span>
            </div>

            <ArrowUp size={16} />
          </button>
        ))}
      </div>
    </div>
  );
}

/* =========================================================
   CHAT MESSAGE
   ========================================================= */

function Message({ message, onCopy, onSpeak }) {
  if (message.role === "user") {
    return (
      <div className="message-row user-row">
        <div className="user-message">
          {message.imageUrl && (
            <div className="user-message-image-wrapper">
              <img
                src={message.imageUrl}
                alt={message.imageName || "Attached image"}
                className="user-message-image"
              />
              {message.imageName && (
                <div className="user-message-image-name" title={message.imageName}>
                  {message.imageName}
                </div>
              )}
            </div>
          )}
          <div>{message.content}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="message-row assistant-row">
      <div className="assistant-avatar">
        <Shield size={16} />
      </div>

      <div className="assistant-content">
        <div className="assistant-name">
          Sovereign AI

          {message.blocked && (
            <span className="blocked-label">
              Policy blocked
            </span>
          )}
        </div>

        <div
          className={`assistant-message ${message.blocked ? "blocked-response" : ""
            } ${message.error ? "error-response" : ""}`}
        >
          {message.blocked && (
            <div className="blocked-heading">
              <ShieldCheck size={18} />
              <strong>Request blocked</strong>
            </div>
          )}

          <div className="message-text">
            {message.content}
          </div>

          {((message.responseTime !== undefined && !message.blocked && !message.error) || message.isVision) && (
            <div className="message-meta-row">
              {message.isVision && (
                <div className="vision-meta-badge">
                  <span className="vision-badge-name">🖼️ Qwen2.5-VL 3B</span>
                  {message.local && (
                    <span className="vision-badge-local">🔒 Local</span>
                  )}
                </div>
              )}
              {message.responseTime !== undefined && !message.blocked && !message.error && (
                <div className="response-time">
                  <Clock3 size={13} />
                  <span>Response time: {message.responseTime}s</span>
                </div>
              )}
            </div>
          )}

        </div>

        <div className="message-actions">
          <button onClick={() => onCopy(message.content)}>
            <Copy size={13} />
            Copy
          </button>

          <button
            onClick={() => onSpeak(message.content)}
            title="Speak response"
          >
            <Volume2 size={13} />
            Speak
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   PROCESSING
   ========================================================= */

function ProcessingMessage({ isVision }) {
  return (
    <div className="message-row assistant-row">
      <div className="assistant-avatar processing-avatar">
        <Zap size={16} />
      </div>

      <div className="assistant-content">
        <div className="assistant-name">
          Sovereign AI
        </div>

        <div className="processing-card">
          <div className="processing-title">
            {isVision ? "Analyzing image" : "Evaluating request"}
          </div>

          <div className="processing-steps">
            <div className="processing-step active">
              <span />
              {isVision ? "Local Vision Pipeline" : "Policy Engine"}
              <small>{isVision ? "active" : "checking"}</small>
            </div>

            <div className="processing-step">
              <span />
              {isVision ? "Vision inference (Qwen2.5-VL)" : "Risk assessment"}
            </div>

            <div className="processing-step">
              <span />
              {isVision ? "Local response generation" : "Local inference"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   SECURITY PANEL
   ========================================================= */

function SecurityPanel({
  security,
  riskLabel,
  riskClass,
}) {
  return (
    <aside className="security-panel">
      <div className="security-header">
        <div>
          <span className="eyebrow">CONTROL PLANE</span>
          <h2>Security</h2>
        </div>

        <div
          className={`status-orb ${security.status === "blocked"
            ? "orb-danger"
            : security.status === "error"
              ? "orb-danger"
              : "orb-success"
            }`}
        >
          <ShieldCheck size={17} />
        </div>
      </div>

      <SecurityContent
        security={security}
        riskLabel={riskLabel}
        riskClass={riskClass}
      />
    </aside>
  );
}

function SecurityContent({
  security,
  riskLabel,
  riskClass,
}) {
  const isBlocked = security.status === "blocked";
  const isAnalyzing = security.status === "analyzing";
  const isError = security.status === "error";

  return (
    <div className="security-content">
      <div
        className={`security-status-card ${isBlocked
          ? "blocked"
          : isError
            ? "security-error"
            : isAnalyzing
              ? "analyzing"
              : "ready"
          }`}
      >
        <div className="status-card-top">
          <span>
            {isBlocked
              ? "REQUEST BLOCKED"
              : isError
                ? "GATEWAY ERROR"
                : isAnalyzing
                  ? "ANALYZING REQUEST"
                  : "SYSTEM READY"}
          </span>

          <span className="status-dot" />
        </div>

        <strong>
          {isBlocked
            ? "Model execution prevented"
            : isError
              ? "Connection unavailable"
              : isAnalyzing
                ? "Policy engine evaluating"
                : "Policy engine active"}
        </strong>

        <p>{security.reason}</p>
      </div>

      <div className="security-group">
        <div className="security-group-title">
          <span>Policy decision</span>
          <ShieldCheck size={14} />
        </div>

        <div className="security-value-row">
          <span>Decision</span>

          <strong
            className={
              security.allowed === true
                ? "text-success"
                : security.allowed === false
                  ? "text-danger"
                  : ""
            }
          >
            {security.allowed === true
              ? "ALLOWED"
              : security.allowed === false
                ? "BLOCKED"
                : "PENDING"}
          </strong>
        </div>

        <div className="security-value-row">
          <span>Risk level</span>

          <strong className={`risk-text ${riskClass}`}>
            {riskLabel}
          </strong>
        </div>
      </div>

      <div className="security-group">
        <div className="security-group-title">
          <span>Execution</span>
          <Terminal size={14} />
        </div>

        <div className="security-value-row">
          <span>Model</span>
          <strong className="mono">
            {security.model}
          </strong>
        </div>

        <div className="security-value-row">
          <span>Location</span>
          <strong>{security.location}</strong>
        </div>

        <div className="security-value-row">
          <span>Gateway</span>
          <strong className="text-success">
            {security.gateway}
          </strong>
        </div>
      </div>

      <div className="security-group">
        <div className="security-group-title">
          <span>Audit event</span>
          <Clock3 size={14} />
        </div>

        <div className="audit-row">
          <div className="audit-check">
            <Check size={12} />
          </div>

          <div>
            <strong>Request logged</strong>
            <span>Immutable audit trail</span>
          </div>
        </div>

        <div className="request-id">
          <span>REQUEST ID</span>
          <code>{security.requestId}</code>
        </div>
      </div>

      <div className="architecture-note">
        <div className="architecture-icon">
          <Lock size={15} />
        </div>

        <div>
          <strong>Security boundary</strong>
          <span>
            Requests are evaluated before model execution.
          </span>
        </div>
      </div>
    </div>
  );
}
function SystemLogs({ events }) {
  const total = events.length;

  const allowed = events.filter(
    (event) => event.allowed === true
  ).length;

  const blocked = events.filter(
    (event) => event.allowed === false
  ).length;

  const highRisk = events.filter(
    (event) => event.risk_level === "high"
  ).length;

  const recentEvents = events.slice(0, 8);

  return (
    <section className="logs-page">
      <div className="logs-header">
        <div>
          <div className="eyebrow">
            SYSTEM OBSERVABILITY
          </div>

          <h1>Control Plane</h1>

          <p>
            Monitor the health and activity of the
            Sovereign AI security boundary.
          </p>
        </div>

        <div className="system-health">
          <span className="live-dot" />
          <span>All systems operational</span>
        </div>
      </div>

      <div className="logs-stat-grid">
        <div className="logs-stat">
          <div className="logs-stat-icon">
            <ShieldCheck size={18} />
          </div>

          <div>
            <span>Security gateway</span>
            <strong>ENFORCED</strong>
          </div>
        </div>

        <div className="logs-stat">
          <div className="logs-stat-icon">
            <Terminal size={18} />
          </div>

          <div>
            <span>Total requests</span>
            <strong>{total}</strong>
          </div>
        </div>

        <div className="logs-stat">
          <div className="logs-stat-icon">
            <Check size={18} />
          </div>

          <div>
            <span>Allowed</span>
            <strong>{allowed}</strong>
          </div>
        </div>

        <div className="logs-stat">
          <div className="logs-stat-icon">
            <Shield size={18} />
          </div>

          <div>
            <span>Blocked</span>
            <strong>{blocked}</strong>
          </div>
        </div>

        <div className="logs-stat">
          <div className="logs-stat-icon">
            <Zap size={18} />
          </div>

          <div>
            <span>High risk</span>
            <strong>{highRisk}</strong>
          </div>
        </div>
      </div>

      <div className="logs-grid">
        <div className="service-card">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">
                INFRASTRUCTURE
              </span>
              <h2>Services</h2>
            </div>

            <span className="service-count">
              5 / 5 healthy
            </span>
          </div>

          <ServiceRow
            icon={<ShieldCheck size={16} />}
            name="Policy Engine"
            detail="Request evaluation"
          />

          <ServiceRow
            icon={<Zap size={16} />}
            name="Ollama Gateway"
            detail="Local inference"
          />

          <ServiceRow
            icon={<Sparkles size={16} />}
            name="Qwen3:4b"
            detail="Local language model"
          />

          <ServiceRow
            icon={<FileText size={16} />}
            name="Audit Logger"
            detail="Security event persistence"
          />

          <ServiceRow
            icon={<Lock size={16} />}
            name="Security Boundary"
            detail="Pre-inference enforcement"
          />
        </div>

        <div className="event-card">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">
                ACTIVITY
              </span>
              <h2>Recent events</h2>
            </div>
          </div>

          {recentEvents.length === 0 ? (
            <div className="logs-empty">
              <Terminal size={20} />

              <strong>No system events</strong>

              <span>
                Activity will appear after requests
                are processed.
              </span>
            </div>
          ) : (
            <div className="system-event-list">
              {recentEvents.map((event, index) => (
                <SystemEvent
                  key={
                    event.request_id ||
                    `${event.timestamp}-${index}`
                  }
                  event={event}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="architecture-card">
        <div className="architecture-flow">
          <FlowNode
            icon={<Terminal size={16} />}
            label="REQUEST"
          />

          <div className="flow-line" />

          <FlowNode
            icon={<ShieldCheck size={16} />}
            label="POLICY"
          />

          <div className="flow-line" />

          <FlowNode
            icon={<Lock size={16} />}
            label="SECURITY"
          />

          <div className="flow-line" />

          <FlowNode
            icon={<Sparkles size={16} />}
            label="OLLAMA"
          />

          <div className="flow-line" />

          <FlowNode
            icon={<FileText size={16} />}
            label="AUDIT"
          />
        </div>

        <div className="architecture-caption">
          <strong>Enforced execution path</strong>

          <span>
            Every request passes through policy
            evaluation before local model execution.
          </span>
        </div>
      </div>
    </section>
  );
}


function ServiceRow({ icon, name, detail }) {
  return (
    <div className="service-row">
      <div className="service-icon">
        {icon}
      </div>

      <div className="service-copy">
        <strong>{name}</strong>
        <span>{detail}</span>
      </div>

      <div className="service-status">
        <span className="live-dot" />
        ACTIVE
      </div>
    </div>
  );
}


function SystemEvent({ event }) {
  const blocked = event.allowed === false;

  const timestamp = event.timestamp
    ? new Date(event.timestamp).toLocaleTimeString()
    : "—";

  return (
    <div className="system-event">
      <div
        className={`event-indicator ${blocked ? "blocked" : "allowed"
          }`}
      >
        {blocked ? (
          <X size={13} />
        ) : (
          <Check size={13} />
        )}
      </div>

      <div className="system-event-copy">
        <strong>
          {blocked
            ? "Security policy blocked request"
            : "Request processed successfully"}
        </strong>

        <span>
          {event.reason ||
            event.action ||
            "Security event recorded"}
        </span>
      </div>

      <time>{timestamp}</time>
    </div>
  );
}


function FlowNode({ icon, label }) {
  return (
    <div className="flow-node">
      <div className="flow-icon">
        {icon}
      </div>

      <span>{label}</span>
    </div>
  );
}


export default App;