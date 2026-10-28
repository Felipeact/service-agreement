import type { DocumentRenderer } from "@/application/ports";
import { renderAgreementPdf } from "./agreement-pdf";

export const reactPdfDocumentRenderer: DocumentRenderer = { renderAgreement: renderAgreementPdf };
