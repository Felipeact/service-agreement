import type { ContractRenderer, DocumentRenderer } from "@/application/ports";
import { renderAgreementPdf } from "./agreement-pdf";
import { renderContractPdf } from "./contract-pdf";

export const reactPdfDocumentRenderer: DocumentRenderer = { renderAgreement: renderAgreementPdf };

/** The contract's own port (ISP): the same adapter, a second small interface. */
export const reactPdfContractRenderer: ContractRenderer = { renderContract: renderContractPdf };
