import React, { useState } from "react";
import { Copy, Check } from "lucide-react";
import { copyToClipboard } from "../utils/clipboard";

interface CopyButtonProps {
  text: string;
  label?: string;
  className?: string;
  iconClassName?: string;
  onCopy?: () => void;
  title?: string;
}

const CopyButton: React.FC<CopyButtonProps> = ({
  text,
  label,
  className,
  iconClassName,
  onCopy,
  title,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const success = await copyToClipboard(text);
    if (success) {
      setCopied(true);
      onCopy?.();
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={
        className ||
        "flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all text-[9px] font-bold uppercase tracking-widest"
      }
      title={title || (copied ? "Copied" : "Copy")}
      type="button"
    >
      {copied ? (
        <Check className={iconClassName || "w-3 h-3 text-green-400"} />
      ) : (
        <Copy className={iconClassName || "w-3 h-3"} />
      )}
      {label && <span>{copied ? "Copied" : label}</span>}
    </button>
  );
};

export default CopyButton;
