document.getElementById("extensionId").textContent = `Extension ID: ${chrome.runtime.id}`;

const aioCheckBtn = document.getElementById("aioCheckBtn");
const aioStatus = document.getElementById("aioStatus");

aioCheckBtn.addEventListener("click", () => {
  const query = document.getElementById("aioQuery").value.trim();
  const myUrl = document.getElementById("aioUrl").value.trim();
  if (!query || !myUrl) {
    aioStatus.textContent = "Enter both a keyword and your page URL.";
    return;
  }

  aioCheckBtn.disabled = true;
  aioStatus.textContent = "Searching…";

  chrome.runtime.sendMessage({ type: "AIO_CHECK", query, myUrl }, (response) => {
    aioCheckBtn.disabled = false;
    if (chrome.runtime.lastError) {
      aioStatus.textContent = `Error: ${chrome.runtime.lastError.message}`;
      return;
    }
    if (response?.error) {
      aioStatus.textContent = `Error: ${response.error}`;
    } else if (response?.posted) {
      aioStatus.textContent = `Posted ${response.cited.length} citation(s) to n8n.`;
    } else {
      aioStatus.textContent = "No AI Overview citations found.";
    }
  });
});
