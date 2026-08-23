import * as monaco from "monaco-editor";
import { loader } from "@monaco-editor/react";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";

/**
 * Wire @monaco-editor/react to the locally-bundled monaco-editor (no CDN),
 * and point Monaco at the editor worker so the readonly viewer works offline.
 * Imported once for its side effects before any <Editor> mounts.
 */
self.MonacoEnvironment = {
  getWorker() {
    return new editorWorker();
  },
};

loader.config({ monaco });

export { monaco };
