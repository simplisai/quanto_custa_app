import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Copia texto para a área de transferência com fallback para navegadores antigos
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    // Tenta o método moderno
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    console.warn("[copyToClipboard] Modern API failed:", err);
  }

  // Fallback: método antigo com textarea temporário
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.top = "0";
    textarea.style.left = "0";
    textarea.style.width = "2em";
    textarea.style.height = "2em";
    textarea.style.padding = "0";
    textarea.style.border = "none";
    textarea.style.outline = "none";
    textarea.style.boxShadow = "none";
    textarea.style.background = "transparent";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    
    const success = document.execCommand("copy");
    document.body.removeChild(textarea);
    return success;
  } catch (err) {
    console.error("[copyToClipboard] Fallback failed:", err);
    return false;
  }
}
