document.addEventListener("DOMContentLoaded", async () => {
  const noteInput = document.getElementById("note-input");
  const captureBtn = document.getElementById("capture-btn");
  const appendTabBtn = document.getElementById("append-tab-btn");
  const toggleSettingsBtn = document.getElementById("toggle-settings-btn");
  const backCaptureBtn = document.getElementById("back-capture-btn");
  const saveSettingsBtn = document.getElementById("save-settings-btn");
  const captureView = document.getElementById("capture-view");
  const settingsView = document.getElementById("settings-view");
  const normaUrlInput = document.getElementById("norma-url-input");
  const authSecretInput = document.getElementById("auth-secret-input");
  const statusMessage = document.getElementById("status-message");

  // Load saved settings
  const { normaUrl = "http://localhost:3000", authSecret = "" } =
    await chrome.storage.sync.get(["normaUrl", "authSecret"]);

  normaUrlInput.value = normaUrl;
  authSecretInput.value = authSecret;

  // If credentials are not set, show settings view first
  if (!authSecret) {
    showSettings();
    showStatus("Please configure your Norma URL and Access Secret first.", "error");
  }

  function showStatus(text, type = "success") {
    statusMessage.textContent = text;
    statusMessage.className = `status ${type}`;
    statusMessage.classList.remove("hidden");
  }

  function hideStatus() {
    statusMessage.classList.add("hidden");
  }

  function showSettings() {
    captureView.classList.add("hidden");
    settingsView.classList.remove("hidden");
  }

  function showCapture() {
    settingsView.classList.add("hidden");
    captureView.classList.remove("hidden");
    noteInput.focus();
  }

  toggleSettingsBtn.addEventListener("click", () => {
    if (settingsView.classList.contains("hidden")) {
      showSettings();
    } else {
      showCapture();
    }
  });

  backCaptureBtn.addEventListener("click", showCapture);

  saveSettingsBtn.addEventListener("click", async () => {
    const newUrl = normaUrlInput.value.trim() || "http://localhost:3000";
    const newSecret = authSecretInput.value.trim();

    await chrome.storage.sync.set({
      normaUrl: newUrl,
      authSecret: newSecret,
    });

    showStatus("Settings saved successfully!", "success");
    setTimeout(() => {
      hideStatus();
      showCapture();
    }, 1000);
  });

  // Append active tab link
  appendTabBtn.addEventListener("click", async () => {
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tab?.url) {
        const linkMarkdown = `\n[${tab.title || "Link"}](${tab.url})`;
        noteInput.value = (noteInput.value.trim() + " " + linkMarkdown).trim();
        noteInput.focus();
      }
    } catch (err) {
      console.error(err);
    }
  });

  // Send capture
  async function submitNote() {
    const content = noteInput.value.trim();
    if (!content) return;

    const { normaUrl = "http://localhost:3000", authSecret = "" } =
      await chrome.storage.sync.get(["normaUrl", "authSecret"]);

    if (!authSecret) {
      showSettings();
      showStatus("Please set your AUTH_SECRET in settings.", "error");
      return;
    }

    captureBtn.disabled = true;
    captureBtn.textContent = "Saving...";
    hideStatus();

    const cleanUrl = normaUrl.replace(/\/+$/, "");

    try {
      const response = await fetch(`${cleanUrl}/api/notes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authSecret}`,
        },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to communicate with Norma");
      }

      showStatus("✓ Saved to Norma!", "success");
      noteInput.value = "";

      // Close popup shortly after success
      setTimeout(() => {
        window.close();
      }, 700);
    } catch (err) {
      showStatus(err.message || "Connection error.", "error");
    } finally {
      captureBtn.disabled = false;
      captureBtn.textContent = "Capture";
    }
  }

  captureBtn.addEventListener("click", submitNote);

  // Keyboard shortcut: Ctrl+Enter or Cmd+Enter
  noteInput.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      submitNote();
    }
  });
});
