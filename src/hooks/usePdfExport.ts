/**
 * usePdfExport — PDF generation via @react-pdf/renderer.
 *
 * Accepts a factory function that returns a react-pdf Document element.
 * pdf().toBlob() runs in a real async task — no DOM, no html2canvas,
 * no main-thread blocking, no app freeze.
 *
 * Usage:
 *   const { exportPDF, shareWhatsApp, isExporting } = usePdfExport(
 *     () => results ? <MyPdfDoc r={results} /> : null,
 *     "filename.pdf",
 *   )
 */

import { useState } from 'react'
import { pdf } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import { toast } from 'sonner'

export function usePdfExport(
  getPdfDoc: () => ReactElement | null,
  filename: string,
) {
  const [isExporting, setIsExporting] = useState(false)

  /** Render the react-pdf Document tree to a Blob. */
  const exportBlob = async (): Promise<Blob | null> => {
    const doc = getPdfDoc()
    if (!doc) return null
    try {
      return await pdf(doc).toBlob()
    } catch (err) {
      console.error('[usePdfExport] pdf().toBlob() failed:', err)
      return null
    }
  }

  /** Download PDF to disk. */
  const exportPDF = async () => {
    if (isExporting) return
    setIsExporting(true)
    const toastId = toast.loading('Gerando PDF…')
    try {
      const blob = await exportBlob()
      if (!blob) {
        toast.error('Erro ao gerar PDF. Tente novamente.', { id: toastId })
        return
      }
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success('PDF exportado com sucesso!', { id: toastId })
    } catch {
      toast.error('Erro ao exportar PDF.', { id: toastId })
    } finally {
      setIsExporting(false)
    }
  }

  /**
   * Share PDF via WhatsApp.
   * Mobile: native Web Share API with PDF attachment.
   * Desktop: download PDF + open WhatsApp Web.
   */
  const shareWhatsApp = async (phone: string) => {
    if (isExporting) return
    if (!phone.trim()) {
      toast.error('Informe o número do WhatsApp.')
      return
    }
    setIsExporting(true)
    const toastId = toast.loading('Gerando PDF…')

    try {
      const digits = phone.replace(/\D/g, '')
      const intlPhone = digits.startsWith('55') ? digits : `55${digits}`
      const text =
        'Olá! Preparei um relatório de simulação de consórcio especialmente para você. ' +
        'Segue o PDF com todos os números e a estratégia recomendada. ' +
        'Qualquer dúvida estou à disposição! 😊'
      const waUrl = `https://wa.me/${intlPhone}?text=${encodeURIComponent(text)}`

      const blob = await exportBlob()
      if (!blob) {
        toast.error('Erro ao gerar PDF.', { id: toastId })
        return
      }

      const file = new File([blob], filename, { type: 'application/pdf' })

      // Try native share sheet (works on iOS/Android with PDF support)
      if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: 'Relatório de Simulação', text })
          toast.dismiss(toastId)
          return
        } catch (err) {
          if ((err as DOMException).name === 'AbortError') {
            toast.dismiss(toastId)
            return
          }
        }
      }

      // Desktop fallback: download + open WhatsApp Web
      const objUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(objUrl)

      setTimeout(() => window.open(waUrl, '_blank'), 800)
      toast.success('PDF baixado! Abrindo WhatsApp para envio…', { id: toastId })
    } catch {
      toast.error('Erro ao compartilhar. Tente exportar o PDF manualmente.', { id: toastId })
    } finally {
      setIsExporting(false)
    }
  }

  return { exportPDF, exportBlob, shareWhatsApp, isExporting }
}
