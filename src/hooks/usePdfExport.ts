import { type RefObject, useState } from 'react'
import { toast } from 'sonner'
import html2pdf from 'html2pdf.js'

const PDF_OPTIONS = {
  margin: 8,
  image: { type: 'jpeg', quality: 0.96 },
  html2canvas: { scale: 2, useCORS: true, logging: false, allowTaint: true },
  jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
}

/**
 * Shared hook for PDF export across all simulators.
 * - exportPDF(): downloads the PDF directly
 * - exportBlob(): returns the PDF as a Blob (for sharing)
 * - shareWhatsApp(phone): generates PDF then shares via WhatsApp
 *   • Mobile: uses navigator.share() with PDF file attachment (native share sheet)
 *   • Desktop: downloads PDF + opens WhatsApp Web with pre-filled message
 */
export function usePdfExport(
  reportRef: RefObject<HTMLElement | null>,
  filename: string,
) {
  const [isExporting, setIsExporting] = useState(false)

  /**
   * Prepares the hidden report div for capture.
   * Returns the element (or null if not available).
   */
  const prepare = async (): Promise<HTMLElement | null> => {
    if (!reportRef.current) return null
    reportRef.current.style.display = 'block'
    // Two animation frames so the DOM is fully painted before html2canvas captures
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    )
    return reportRef.current
  }

  const cleanup = () => {
    if (reportRef.current) reportRef.current.style.display = 'none'
  }

  /** Download PDF directly. */
  const exportPDF = async () => {
    if (isExporting) return
    setIsExporting(true)
    const el = await prepare()
    if (!el) { setIsExporting(false); return }
    try {
      await html2pdf().set({ ...PDF_OPTIONS, filename }).from(el).save()
    } catch {
      toast.error('Erro ao exportar PDF. Tente novamente.')
    } finally {
      cleanup()
      setIsExporting(false)
    }
  }

  /** Generate PDF as Blob (without triggering download). */
  const exportBlob = async (): Promise<Blob | null> => {
    const el = await prepare()
    if (!el) return null
    try {
      const blob = await html2pdf()
        .set({ ...PDF_OPTIONS, filename })
        .from(el)
        .outputPdf('blob') as Blob
      return blob
    } catch {
      return null
    } finally {
      cleanup()
    }
  }

  /**
   * Share PDF via WhatsApp.
   * @param phone  Phone number — any format, digits-only or formatted. Brazilian numbers
   *               without country code will have +55 prepended automatically.
   */
  const shareWhatsApp = async (phone: string) => {
    if (isExporting) return
    if (!phone.trim()) { toast.error('Informe o número do WhatsApp.'); return }
    setIsExporting(true)

    try {
      // Normalize phone
      const digits = phone.replace(/\D/g, '')
      const intlPhone = digits.startsWith('55') ? digits : `55${digits}`

      const text =
        `Olá! Preparei um relatório de simulação de consórcio especialmente para você. ` +
        `Segue o PDF com todos os números e a estratégia recomendada. ` +
        `Qualquer dúvida estou à disposição! 😊`
      const waUrl = `https://wa.me/${intlPhone}?text=${encodeURIComponent(text)}`

      const blob = await exportBlob()
      if (!blob) { toast.error('Erro ao gerar PDF.'); return }

      const file = new File([blob], filename, { type: 'application/pdf' })

      // Mobile: try native Web Share API with file
      if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: 'Relatório de Simulação', text })
          return
        } catch (err) {
          // AbortError = user cancelled. Any other error falls through.
          if ((err as DOMException).name === 'AbortError') return
        }
      }

      // Desktop fallback: download the PDF then open WhatsApp Web
      const objUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(objUrl)

      // Open WhatsApp Web after a short delay so the download starts
      setTimeout(() => window.open(waUrl, '_blank'), 800)
      toast.success('PDF baixado! Abrindo WhatsApp para envio...')
    } catch {
      toast.error('Erro ao compartilhar. Tente exportar o PDF manualmente.')
    } finally {
      setIsExporting(false)
    }
  }

  return { exportPDF, exportBlob, shareWhatsApp, isExporting }
}
