import { useEffect, useState } from "react";
import { useStore } from "@/store/useStore";
import { useShortcuts } from "@/hooks/useShortcuts";
import Toolbar from "@/components/Toolbar";
import BookmarkSidebar from "@/components/BookmarkSidebar";
import FilePane from "@/components/FilePane";
import Splitter from "@/components/Splitter";
import EditorArea from "@/components/editors/EditorArea";
import StatusBar from "@/components/StatusBar";
import SearchPanel from "@/components/search/SearchPanel";
import Toasts from "@/components/Toasts";
import ContextMenuHost from "@/components/ContextMenuHost";
import DialogHost from "@/components/DialogHost";

export default function App() {
  const init = useStore((s) => s.init);
  const theme = useStore((s) => s.theme);
  const dualPane = useStore((s) => s.dualPane);
  const splitRatio = useStore((s) => s.splitRatio);
  const editorTabs = useStore((s) => s.editorTabs);
  const editorFullscreen = useStore((s) => s.editorFullscreen);
  const configLoaded = useStore((s) => s.configLoaded);
  const [editorRatio, setEditorRatio] = useState(0.45);

  useShortcuts();

  useEffect(() => {
    init();
  }, [init]);

  // 应用主题类到 body
  useEffect(() => {
    document.body.classList.remove("theme-dark", "theme-light");
    document.body.classList.add(`theme-${theme}`);
  }, [theme]);

  if (!configLoaded) {
    return (
      <div className="h-full flex items-center justify-center text-muted">
        正在加载 MT 管理器…
      </div>
    );
  }

  const hasEditor = editorTabs.length > 0;

  return (
    <div className="h-full flex flex-col bg-bg text-fg">
      <Toolbar />
      <div className="flex-1 flex min-h-0">
        <BookmarkSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 flex min-h-0">
            {editorFullscreen ? (
              <EditorArea />
            ) : (
              <>
                <div
                  className="flex min-h-0"
                  style={{ height: hasEditor ? `${(1 - editorRatio) * 100}%` : "100%" }}
                >
                  <FilePane side="left" />
                  {dualPane && (
                    <>
                      <Splitter
                        orientation="vertical"
                        ratio={splitRatio}
                        onResize={useStore.getState().setSplitRatio}
                      />
                      <FilePane side="right" />
                    </>
                  )}
                </div>
                {hasEditor && (
                  <>
                    <Splitter
                      orientation="horizontal"
                      ratio={editorRatio}
                      onResize={setEditorRatio}
                    />
                    <div className="flex-1 min-h-0" style={{ height: `${editorRatio * 100}%` }}>
                      <EditorArea />
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      <StatusBar />
      <SearchPanel />
      <Toasts />
      <ContextMenuHost />
      <DialogHost />
      <BusyOverlay />
    </div>
  );
}

function BusyOverlay() {
  const busy = useStore((s) => s.busy);
  if (!busy) return null;
  return (
    <div className="fixed top-0 left-0 right-0 z-[800] pointer-events-none">
      <div className="progress-bar" style={{ width: "40%", animation: "pb 1.2s ease-in-out infinite" }} />
      <style>{`@keyframes pb { 0%{width:0} 50%{width:70%} 100%{width:95%} }`}</style>
    </div>
  );
}
