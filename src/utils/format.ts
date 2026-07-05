// 格式化工具

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 100 ? 0 : v >= 10 ? 1 : 2)} ${units[i]}`;
}

export function formatDate(ms: number): string {
  if (!ms) return "";
  const d = new Date(ms);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  if (i <= 0) return "";
  return name.slice(i + 1).toLowerCase();
}

/** 路径分段,用于面包屑 */
export function pathParts(path: string): { name: string; path: string }[] {
  // 兼容 Windows 盘符 C:\ 与 Unix /
  const parts: { name: string; path: string }[] = [];
  if (/^[a-zA-Z]:\\/.test(path)) {
    const drive = path.slice(0, 3); // C:\
    parts.push({ name: drive.replace("\\", ""), path: drive });
    const rest = path.slice(3);
    if (rest) {
      let acc = drive;
      for (const seg of rest.split(/[\\/]/).filter(Boolean)) {
        acc = acc.endsWith("\\") ? acc + seg : acc + "\\" + seg;
        parts.push({ name: seg, path: acc });
      }
    }
  } else {
    // unix 风格
    parts.push({ name: "/", path: "/" });
    let acc = "";
    for (const seg of path.split("/").filter(Boolean)) {
      acc += "/" + seg;
      parts.push({ name: seg, path: acc });
    }
  }
  return parts;
}

export function basename(path: string): string {
  const norm = path.replace(/[\\/]+$/, "");
  const i = Math.max(norm.lastIndexOf("\\"), norm.lastIndexOf("/"));
  return i >= 0 ? norm.slice(i + 1) : norm;
}

export function dirname(path: string): string {
  const norm = path.replace(/[\\/]+$/, "");
  if (/^[a-zA-Z]:\\?$/.test(norm)) return norm;
  const i = Math.max(norm.lastIndexOf("\\"), norm.lastIndexOf("/"));
  if (i <= 0) return i === 0 ? "/" : norm;
  return norm.slice(0, i).replace(/[\\/]+$/, "") || (norm[1] === ":" ? norm.slice(0, 3) : "/");
}

export function joinPathLocal(base: string, name: string): string {
  if (!base) return name;
  if (base.endsWith("\\") || base.endsWith("/")) return base + name;
  const sep = base.includes("\\") ? "\\" : "/";
  return base + sep + name;
}
