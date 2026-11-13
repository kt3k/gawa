async function copyText(text, button) {
  const value = text.replace(/\n$/, "");
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    const area = document.createElement("textarea");
    area.value = value;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.left = "-9999px";
    document.body.append(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
  const previous = button.textContent;
  button.textContent = "Copied";
  setTimeout(() => {
    button.textContent = previous;
  }, 1400);
}

for (const button of document.querySelectorAll("[data-copy]")) {
  button.addEventListener("click", () => {
    const panel = button.closest(".panel");
    const block = button.closest(".codeblock");
    const root = panel
      ? panel.querySelector('[role="tabpanel"]:not([hidden])')
      : block;
    const text = root
      ? [...root.querySelectorAll("pre")].map((pre) => pre.innerText).join(
        "\n\n",
      )
      : "";
    copyText(text, button);
  });
}

for (const root of document.querySelectorAll("[data-tabs]")) {
  const tabs = [...root.querySelectorAll('[role="tab"]')];
  const select = (tab) => {
    for (const item of tabs) {
      const on = item === tab;
      item.setAttribute("aria-selected", on ? "true" : "false");
      item.tabIndex = on ? 0 : -1;
      const panel = root.querySelector(
        "#" + item.getAttribute("aria-controls"),
      );
      if (panel) panel.hidden = !on;
    }
  };
  for (const tab of tabs) {
    tab.addEventListener("click", () => select(tab));
    tab.addEventListener("keydown", (event) => {
      const index = tabs.indexOf(tab);
      let next = -1;
      if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
      else if (event.key === "ArrowLeft") {
        next = (index - 1 + tabs.length) % tabs.length;
      } else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = tabs.length - 1;
      else return;
      event.preventDefault();
      tabs[next].focus();
      select(tabs[next]);
    });
  }
}
