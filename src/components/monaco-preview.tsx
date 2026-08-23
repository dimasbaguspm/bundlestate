import Editor from "@monaco-editor/react";
import "@/utils/monaco";

/** Monaco-based read-only viewer for a file's decoded text. Lazy-loaded so the
 * heavy monaco-editor bundle (and its worker) is only pulled when the Files
 * tab is actually shown. */
export function MonacoPreview({ language, value }: { language: string; value: string }) {
  return (
    <Editor
      height="100%"
      theme="vs-dark"
      language={language}
      value={value}
      options={{
        readOnly: true,
        minimap: { enabled: false },
        fontSize: 12,
        scrollBeyondLastLine: false,
        wordWrap: "on",
        automaticLayout: true,
      }}
    />
  );
}
