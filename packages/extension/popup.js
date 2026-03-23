const API = "https://wikiloop-doublecheck.toolforge.org/api/health";

fetch(API)
  .then((r) => r.json())
  .then((data) => {
    document.getElementById("status").textContent =
      `API: ${data.status} · v${data.version}`;
  })
  .catch(() => {
    document.getElementById("status").textContent = "API unreachable";
  });
