import type { ContractRenderer, DocumentRenderer } from "@/application/ports";
import { renderAgreementPdf } from "./agreement-pdf";
import { renderContractPdf } from "./contract-pdf";
import type { ImageLoader } from "./rich-images";

export const reactPdfDocumentRenderer: DocumentRenderer = { renderAgreement: (document) => renderAgreementPdf(document) };

/** The contract's own port (ISP): the same adapter, a second small interface. */
export const reactPdfContractRenderer: ContractRenderer = { renderContract: (document) => renderContractPdf(document) };

/** Both renderers, reading a designed page's uploaded pictures through `loadImage` (rich-templates). */
export function reactPdfRenderers(loadImage: ImageLoader): { documentRenderer: DocumentRenderer; contractRenderer: ContractRenderer } {
  return {
    documentRenderer: { renderAgreement: (document) => renderAgreementPdf(document, loadImage) },
    contractRenderer: { renderContract: (document) => renderContractPdf(document, loadImage) },
  };
}

export type { ImageLoader } from "./rich-images";
