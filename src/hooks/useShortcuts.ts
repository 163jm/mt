import { useEffect } from "react";
import { useStore } from "@/store/useStore";

/** 全局快捷键 */
export function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // 输入框中只处理少数全局键
      const target = e.target as HTMLElement;
      const inEditable =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable ||
        target.classList.contains("monaco-editor");

      const s = useStore.getState();
      const pane = s.panes[s.activePane];
      const ctrl = e.ctrlKey || e.metaKey;

      // Ctrl+S 保存(即使在编辑器内也生效)
      if (ctrl && e.key === "s") {
        e.preventDefault();
        if (s.activeTabId) s.saveTab(s.activeTabId);
        return;
      }
      // Ctrl+W 关闭标签
      if (ctrl && e.key === "w") {
        e.preventDefault();
        if (s.activeTabId) s.closeTab(s.activeTabId);
        return;
      }
      // Ctrl+F 搜索
      if (ctrl && e.key === "f") {
        e.preventDefault();
        s.setSearchOpen(true);
        return;
      }
      // Ctrl+D 收藏
      if (ctrl && e.key === "d") {
        e.preventDefault();
        if (!pane.archivePath) {
          s.addBookmark({ name: pane.path.replace(/^.*[\\/]/, "") || pane.path, path: pane.path, group: "常用" });
          s.toast("已收藏", "success");
        }
        return;
      }
      // Ctrl+1/2 切换窗格数
      if (ctrl && e.key === "1") {
        e.preventDefault();
        s.setDualPane(false);
        return;
      }
      if (ctrl && e.key === "2") {
        e.preventDefault();
        s.setDualPane(true);
        return;
      }

      if (inEditable) return;

      // Ctrl+Y 同步:另一窗格跳转到当前路径(安卓 MT 管理器经典功能)。
      // 放在 inEditable 判断之后,避免与文本编辑器里 Ctrl+Y(重做)冲突。
      if (ctrl && e.key === "y") {
        e.preventDefault();
        s.syncPanes(s.activePane);
        return;
      }
      // Ctrl+A 全选(仅在非输入场景生效,避免与文本框全选冲突)
      if (ctrl && e.key === "a") {
        e.preventDefault();
        s.selectAll(s.activePane);
        return;
      }
      // * 反选(沿用 Total Commander / 经典文件管理器传统按键)
      if (e.key === "*" || (e.shiftKey && e.key === "8" && ctrl)) {
        e.preventDefault();
        s.invertSelect(s.activePane);
        return;
      }

      // Alt+Left/Right 前进后退
      if (e.altKey && e.key === "ArrowLeft") {
        e.preventDefault();
        s.goBack(s.activePane);
        return;
      }
      if (e.altKey && e.key === "ArrowRight") {
        e.preventDefault();
        s.goForward(s.activePane);
        return;
      }

      // Tab 切换激活窗格
      if (e.key === "Tab" && !ctrl) {
        e.preventDefault();
        s.setActivePane(s.activePane === "left" ? "right" : "left");
        return;
      }

      // Backspace 上级
      if (e.key === "Backspace") {
        e.preventDefault();
        s.goUp(s.activePane);
        return;
      }

      // F 键
      if (e.key === "F3") {
        e.preventDefault();
        const cur = pane.cursor ? pane.entries.find((x) => x.path === pane.cursor) : null;
        if (cur && !cur.isDir) s.openEditorForPath(cur.path, "text");
        return;
      }
      if (e.key === "F4") {
        e.preventDefault();
        const cur = pane.cursor ? pane.entries.find((x) => x.path === pane.cursor) : null;
        if (cur && !cur.isDir) s.openEditorForPath(cur.path, "text");
        return;
      }
      if (e.key === "F5") {
        e.preventDefault();
        const srcs = Array.from(pane.selected);
        if (srcs.length && !pane.archivePath) {
          const other = s.activePane === "left" ? "right" : "left";
          import("@/lib/invoke").then((api) =>
            api.copyPaths(srcs, s.panes[other].path).then(() => {
              s.refresh(s.activePane);
              s.refresh(other);
              s.toast("已复制", "success");
            })
          );
        }
        return;
      }
      if (e.key === "F6") {
        e.preventDefault();
        const srcs = Array.from(pane.selected);
        if (srcs.length && !pane.archivePath) {
          const other = s.activePane === "left" ? "right" : "left";
          import("@/lib/invoke").then((api) =>
            api.movePaths(srcs, s.panes[other].path).then(() => {
              s.refresh(s.activePane);
              s.refresh(other);
              s.toast("已移动", "success");
            })
          );
        }
        return;
      }
      if (e.key === "F7") {
        e.preventDefault();
        if (!pane.archivePath) {
          import("@/components/DialogHost").then(({ promptDialog }) =>
            promptDialog("新建文件夹", "名称:", "新建文件夹").then((name) => {
              if (!name) return;
              import("@/lib/invoke").then((api) =>
                api.joinPath(pane.path, name).then((target) =>
                  api.mkdir(target).then(() => s.refresh(s.activePane))
                )
              );
            })
          );
        }
        return;
      }
      if (e.key === "F8") {
        e.preventDefault();
        const srcs = Array.from(pane.selected);
        if (srcs.length && !pane.archivePath) {
          import("@/components/DialogHost").then(({ confirmDialog }) =>
            confirmDialog("删除", `删除 ${srcs.length} 项?`).then((ok) => {
              if (!ok) return;
              import("@/lib/invoke").then((api) =>
                api.deletePaths(srcs).then(() => s.refresh(s.activePane))
              );
            })
          );
        }
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
