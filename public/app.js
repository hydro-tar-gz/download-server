const list = document.getElementById("file-list");
const count = document.getElementById("file-count");
const empty = document.getElementById("empty-state");
const error = document.getElementById("error-state");
const updated = document.getElementById("updated-at");
const pathEl = document.getElementById("path");
const pinnedEl = document.getElementById("pinned");
const pinnedUpdated = document.getElementById("pinned-updated");
const pinnedContent = document.getElementById("pinned-content");

const formatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1
});

const getPathParam = () =>
  new URLSearchParams(window.location.search).get("path") || "";

const formatBytes = (bytes) => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${formatter.format(bytes / Math.pow(k, i))} ${sizes[i]}`;
};

const formatDate = (iso) => {
  const date = new Date(iso);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric"
  });
};

const renderBreadcrumb = (currentPath) => {
  pathEl.innerHTML = "";
  const root = document.createElement("a");
  root.href = "/";
  root.textContent = "root";
  root.addEventListener("click", (event) => {
    event.preventDefault();
    navigateTo("");
  });
  pathEl.append(root);

  if (!currentPath) return;

  const parts = currentPath.split("/").filter(Boolean);
  let acc = "";
  parts.forEach((part) => {
    const divider = document.createElement("span");
    divider.className = "divider";
    divider.textContent = "/";
    pathEl.append(divider);

    acc = acc ? `${acc}/${part}` : part;
    const link = document.createElement("a");
    link.href = `/?path=${encodeURIComponent(acc)}`;
    link.textContent = part;
    link.addEventListener("click", (event) => {
      event.preventDefault();
      navigateTo(acc);
    });
    pathEl.append(link);
  });
};

const renderFiles = (files) => {
  list.innerHTML = "";
  files.forEach((file) => {
    const item = document.createElement("li");
    item.className = "list-item";

    const link = document.createElement("a");
    link.className = "file-name";
    const isDir = file.type === "dir";
    link.href = isDir
      ? `/?path=${encodeURIComponent(file.path)}`
      : file.href;
    link.textContent = file.name;

    if (!isDir) {
      link.setAttribute("download", "");
    } else {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        navigateTo(file.path);
      });
    }

    const meta = document.createElement("div");
    meta.className = "file-meta";

    if (isDir) {
      const badge = document.createElement("span");
      badge.className = "badge folder";
      badge.textContent = "folder";
      meta.append(badge);
    } else {
      const size = document.createElement("span");
      size.textContent = formatBytes(file.size);

      const modified = document.createElement("span");
      modified.textContent = formatDate(file.modifiedAt);

      meta.append(size, modified);
    }

    item.append(link, meta);
    list.append(item);
  });
};

const loadPinned = async () => {
  try {
    const response = await fetch("/api/pinned");
    if (!response.ok) throw new Error("no pinned");
    const data = await response.json();
    pinnedContent.textContent = data.content?.trim() || "";
    pinnedUpdated.textContent = data.updatedAt
      ? formatDate(data.updatedAt)
      : "";
    pinnedEl.hidden = !pinnedContent.textContent;
  } catch {
    pinnedEl.hidden = true;
  }
};

const loadFiles = async (path = getPathParam()) => {
  try {
    const query = path ? `?path=${encodeURIComponent(path)}` : "";
    const response = await fetch(`/api/files${query}`);
    if (!response.ok) throw new Error("bad response");
    const data = await response.json();

    count.textContent = data.count;
    renderFiles(data.files);
    renderBreadcrumb(data.path || "");
    empty.hidden = data.count !== 0;
    error.hidden = true;
    updated.textContent = `updated ${new Date().toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit"
    })}`;
  } catch (err) {
    error.hidden = false;
  }
};

const navigateTo = (path) => {
  const query = path ? `?path=${encodeURIComponent(path)}` : "";
  window.history.pushState({ path }, "", `/${query}`);
  loadFiles(path);
};

window.addEventListener("popstate", (event) => {
  const nextPath = event.state?.path ?? getPathParam();
  loadFiles(nextPath);
});

loadPinned();
loadFiles();
