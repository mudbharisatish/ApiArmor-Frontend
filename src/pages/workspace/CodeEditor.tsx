import { json } from '@codemirror/lang-json';
import { EditorView } from '@codemirror/view';
import CodeMirror from '@uiw/react-codemirror';

const theme = EditorView.theme({
  '&': { fontSize: '13px', backgroundColor: '#ffffff', borderRadius: '10px' },
  '.cm-content': { fontFamily: 'var(--font-mono)', padding: '12px 0' },
  '.cm-gutters': { backgroundColor: '#f4f2ed', color: '#6c7370', border: 'none', borderRadius: '10px 0 0 10px' },
  '&.cm-focused': { outline: '2px solid #b8974c', outlineOffset: '2px' },
  '.cm-activeLine': { backgroundColor: '#faf6ea' },
  '.cm-activeLineGutter': { backgroundColor: '#ede3c8' },
});

/** CodeMirror 6 for request bodies. Loaded only when the Body tab opens, to keep the app shell small. */
export default function CodeEditor({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      extensions={[json(), theme, EditorView.contentAttributes.of({ 'aria-label': label })]}
      // Tab moves focus out instead of indenting, so the editor is never a keyboard trap.
      indentWithTab={false}
      basicSetup={{ foldGutter: false, highlightActiveLineGutter: true, autocompletion: false }}
      minHeight="220px"
      maxHeight="480px"
      className="overflow-hidden rounded-[10px] border border-line-strong"
    />
  );
}
