chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "norma-save-selection",
    title: "Save selection to Norma",
    contexts: ["selection"],
  });

  chrome.contextMenus.create({
    id: "norma-save-page",
    title: "Save current page to Norma",
    contexts: ["page"],
  });
});

async function sendNoteToNorma(content) {
  const { normaUrl = "http://localhost:3000", authSecret = "" } =
    await chrome.storage.sync.get(["normaUrl", "authSecret"]);

  if (!normaUrl || !authSecret) {
    await chrome.action.setBadgeText({ text: "ERR" });
    await chrome.action.setBadgeBackgroundColor({ color: "#ef4444" });
    setTimeout(async () => {
      await chrome.action.setBadgeText({ text: "" });
    }, 3000);
    return;
  }

  const cleanUrl = normaUrl.replace(/\/+$/, "");

  try {
    const res = await fetch(`${cleanUrl}/api/notes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authSecret}`,
      },
      body: JSON.stringify({ content }),
    });

    if (res.ok) {
      await chrome.action.setBadgeText({ text: "OK" });
      await chrome.action.setBadgeBackgroundColor({ color: "#10b981" });
    } else {
      await chrome.action.setBadgeText({ text: "FAIL" });
      await chrome.action.setBadgeBackgroundColor({ color: "#ef4444" });
    }
  } catch (err) {
    await chrome.action.setBadgeText({ text: "OFF" });
    await chrome.action.setBadgeBackgroundColor({ color: "#f59e0b" });
  }

  setTimeout(async () => {
    await chrome.action.setBadgeText({ text: "" });
  }, 2500);
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "norma-save-selection" && info.selectionText) {
    const quote = `"${info.selectionText.trim()}"\n\nSource: ${tab?.url || ""}`;
    await sendNoteToNorma(quote);
  } else if (info.menuItemId === "norma-save-page" && tab) {
    const pageNote = `[${tab.title || "Page"}](${tab.url})`;
    await sendNoteToNorma(pageNote);
  }
});
