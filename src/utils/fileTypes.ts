import { extOf } from "./format";

// 文件类型颜色 + 推荐编辑器类型
export interface TypeInfo {
  color: string;
  editor?: "text" | "hex" | "image" | "json" | "xml";
  language?: string;
  label?: string;
}

const TEXT_EXTS = new Set([
  "txt", "log", "md", "rst", "ini", "cfg", "conf", "toml", "yaml", "yml",
  "env", "gitignore", "properties", "csv", "tsv", "sh", "bat", "ps1", "cmd",
  "c", "cc", "cpp", "h", "hpp", "cs", "java", "kt", "go", "rs", "py", "rb",
  "php", "js", "jsx", "ts", "tsx", "mjs", "cjs", "swift", "dart", "scala",
  "sql", "graphql", "gql", "lua", "pl", "r", "vim", "asm", "s", "gradle",
  "makefile", "mk", "dockerfile", "tf", "hcl", "proto", "thrift",
]);

const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "ico", "avif"]);

const LANG_MAP: Record<string, string> = {
  js: "javascript", mjs: "javascript", cjs: "javascript",
  jsx: "javascript", ts: "typescript", tsx: "typescript",
  json: "json", xml: "xml", html: "html", htm: "html", css: "css", scss: "scss",
  less: "less", md: "markdown", py: "python", rb: "ruby", php: "php",
  java: "java", kt: "kotlin", go: "go", rs: "rust", c: "c", cc: "cpp",
  cpp: "cpp", h: "c", hpp: "cpp", cs: "csharp", swift: "swift", dart: "dart",
  sql: "sql", sh: "shell", bash: "shell", yml: "yaml", yaml: "yaml",
  toml: "ini", ini: "ini", properties: "ini", conf: "ini", graphql: "graphql",
  dockerfile: "dockerfile", lua: "lua", proto: "proto", html4: "html",
};

const COLOR_MAP: Record<string, string> = {
  // 代码
  js: "#f0db4f", mjs: "#f0db4f", cjs: "#f0db4f", jsx: "#61dafb", ts: "#3178c6",
  tsx: "#3178c6", json: "#f0a020", xml: "#e37933", html: "#e34c26", css: "#2965f1",
  scss: "#cd6799", py: "#3572A5", rb: "#cc342d", php: "#777bb3", java: "#b07219",
  kt: "#F18E33", go: "#00ADD8", rs: "#dea584", c: "#555555", cpp: "#f34b7d",
  cs: "#178600", swift: "#F05138", dart: "#00B4AB", sql: "#e38c00", sh: "#89e051",
  yml: "#cb171e", yaml: "#cb171e", toml: "#9c4221", md: "#3dd6c4",
  // 压缩包
  zip: "#f0a020", rar: "#9b4f96", "7z": "#3dd6c4", tar: "#e8794a", gz: "#e8794a",
  tgz: "#e8794a", bz2: "#e8794a", xz: "#e8794a",
  // 图片
  png: "#a371f7", jpg: "#a371f7", jpeg: "#a371f7", gif: "#a371f7", webp: "#a371f7",
  svg: "#ffb13b", bmp: "#a371f7", ico: "#a371f7",
  // 文档
  pdf: "#e0556b", doc: "#2b579a", docx: "#2b579a", xls: "#217346", xlsx: "#217346",
  ppt: "#d24726", pptx: "#d24726",
  // 媒体
  mp3: "#6cc04a", wav: "#6cc04a", flac: "#6cc04a", mp4: "#ff7b00", mkv: "#ff7b00",
  avi: "#ff7b00", mov: "#ff7b00",
  // 二进制
  exe: "#8b929e", dll: "#8b929e", so: "#8b929e", bin: "#8b929e", dat: "#8b929e",
};

const NO_EXT_LABEL: Record<string, string> = {
  dockerfile: "DOCKER",
  makefile: "MAKE",
  gitignore: "GIT",
  license: "LIC",
};

export function getTypeInfo(name: string): TypeInfo {
  const ext = extOf(name);
  const lowerName = name.toLowerCase();

  if (NO_EXT_LABEL[lowerName]) {
    return { color: "#8b929e", editor: "text", language: "plaintext", label: NO_EXT_LABEL[lowerName] };
  }

  if (IMAGE_EXTS.has(ext)) {
    return { color: COLOR_MAP[ext] || "#a371f7", editor: "image", label: ext || "IMG" };
  }
  if (ext === "json") {
    return { color: "#f0a020", editor: "json", language: "json", label: "JSON" };
  }
  if (ext === "xml") {
    return { color: "#e37933", editor: "xml", language: "xml", label: "XML" };
  }
  if (TEXT_EXTS.has(ext)) {
    return {
      color: COLOR_MAP[ext] || "#8b929e",
      editor: "text",
      language: LANG_MAP[ext] || "plaintext",
      label: ext ? ext.toUpperCase().slice(0, 4) : "TXT",
    };
  }
  // 未知扩展名 -> 默认用 HEX 编辑器查看(可切换)
  return {
    color: COLOR_MAP[ext] || "#8b929e",
    editor: ext ? "hex" : "text",
    language: "plaintext",
    label: ext ? ext.toUpperCase().slice(0, 4) : "FILE",
  };
}

export function isImageExt(ext: string): boolean {
  return IMAGE_EXTS.has(ext.toLowerCase());
}
