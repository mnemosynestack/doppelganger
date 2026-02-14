import { useEffect, useMemo, useRef } from 'react';
import { highlightCode, SyntaxLanguage } from '../utils/syntaxHighlight';

interface CodeEditorProps {
    value: string;
    onChange?: (val: string) => void;
    onBlur?: (val: string) => void;
    language: SyntaxLanguage;
    placeholder?: string;
    className?: string;
    readOnly?: boolean;
    variables?: Record<string, any>;
}

const CodeEditor: React.FC<CodeEditorProps> = ({ value, onChange, onBlur, language, placeholder, className, readOnly, variables }) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const preRef = useRef<HTMLPreElement>(null);

    const displayValue = value || placeholder || '';
    const isPlaceholder = !value && !!placeholder;
    const highlighted = useMemo(() => highlightCode(displayValue, language, variables), [displayValue, language, variables]);

    useEffect(() => {
        const textarea = textareaRef.current;
        const pre = preRef.current;
        if (!textarea || !pre) return;
        const syncScroll = () => {
            pre.scrollTop = textarea.scrollTop;
            pre.scrollLeft = textarea.scrollLeft;
        };
        textarea.addEventListener('scroll', syncScroll);
        return () => {
            textarea.removeEventListener('scroll', syncScroll);
        };
    }, []);

    return (
        <div
            className={`code-editor ${className || ''}`}
            onWheel={(event) => {
                const textarea = textareaRef.current;
                if (!textarea) return;
                if (textarea.scrollHeight <= textarea.clientHeight) return;
                textarea.scrollTop += event.deltaY;
                textarea.scrollLeft += event.deltaX;
                textarea.focus();
                event.preventDefault();
            }}
        >
            <pre
                ref={preRef}
                className={`code-editor-pre ${isPlaceholder ? 'code-editor-placeholder' : ''}`}
                aria-hidden
                dangerouslySetInnerHTML={{ __html: highlighted }}
            />
            <textarea
                ref={textareaRef}
                value={value}
                onChange={(e) => onChange?.(e.target.value)}
                onBlur={(e) => onBlur?.(e.target.value)}
                spellCheck={false}
                wrap="off"
                readOnly={readOnly}
                className={`code-editor-textarea ${readOnly ? 'code-editor-textarea-readonly' : ''}`}
                aria-label="Code editor"
                tabIndex={readOnly ? -1 : 0}
            />
        </div>
    );
};

export default CodeEditor;
