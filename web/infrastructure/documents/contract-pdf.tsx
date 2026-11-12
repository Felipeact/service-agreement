import { Document, Page, renderToBuffer, Text, View } from "@react-pdf/renderer";
import type { ContractDocument, RenderedBlock } from "@/domain/contract";
import { renderWithoutLogoOnFailure } from "./logo-fallback";
import { LetterHead, PageFooter, PriceSection, ScheduleSection, ScopeSections, styles } from "./pdf-sections";

/**
 * The DocuSeal text tags of one signer (signature-provider door 5). The provider finds each tag in the PDF, turns it into a
 * field where the tag sits and removes the text (`remove_tags`). Drawn white on the signature and date lines, so a printed
 * copy that never went through the provider shows blank lines to sign on.
 */
export const signerTags = (role: "Customer" | "Contractor") => ({
  signature: `{{Sig;role=${role};type=signature}}`,
  date: `{{Date;role=${role};type=date}}`,
});

const tagStyle = { position: "absolute", left: 4, bottom: 4, fontSize: 9, color: "#FFFFFF" } as const;

/** One signer's block: who signs, then a line to sign on and a line for the date. Kept whole on one page. */
function SignatureBlock({ heading, role }: { heading: string; role: "Customer" | "Contractor" }) {
  const line = { borderBottomWidth: 1, borderBottomColor: "#111827", height: 28, marginTop: 6 };
  const tags = signerTags(role);
  return (
    <View wrap={false} style={{ marginTop: 18 }}>
      <Text style={{ fontFamily: "Helvetica-Bold" }}>{heading}</Text>
      <View style={line}>
        <Text style={tagStyle}>{tags.signature}</Text>
      </View>
      <Text style={styles.muted}>Signature</Text>
      <View style={{ ...line, height: 20 }}>
        <Text style={tagStyle}>{tags.date}</Text>
      </View>
      <Text style={styles.muted}>Date</Text>
    </View>
  );
}

/** The contract's terms as its template version words them: a heading in the second-level style, everything else as body text. */
export function TermsBlocks({ body, accent }: { body: RenderedBlock[]; accent: { color: string } }) {
  return (
    <>
      {body.map((block, index) =>
        block.type === "heading" ? (
          <Text key={index} style={[styles.h2, accent]} minPresenceAhead={80}>
            {block.text}
          </Text>
        ) : (
          <Text key={index} style={{ marginBottom: 4 }}>
            {block.text}
          </Text>
        ),
      )}
    </>
  );
}

/** The contract as a Letter-size document, drawn with the same sections as the agreement. */
export function ContractPdf({ document }: { document: ContractDocument }) {
  const { contractor, signer } = document;
  const accent = { color: contractor.accent };

  return (
    <Document title={`${document.number} contract`} author={contractor.name}>
      <Page size="LETTER" style={styles.page}>
        <LetterHead name={contractor.name} address={contractor.address} phone={contractor.phone} accent={contractor.accent} logo={contractor.logo} />

        <Text style={styles.title}>Service Contract</Text>
        <View style={styles.meta}>
          <Text style={styles.metaItem}>{document.number}</Text>
          <Text style={styles.metaItem}>{document.customerName}</Text>
          <Text style={styles.metaItem}>{document.site.name}</Text>
        </View>
        {document.site.address && <Text style={styles.termLine}>{document.site.address}</Text>}
        {signer && <Text style={styles.termLine}>{`${signer.name} · ${signer.email}`}</Text>}
        <Text style={styles.termLine}>{document.term}</Text>

        <PriceSection lines={document.lines} totalCents={document.totalCents} accent={contractor.accent} />
        {document.taxNote && <Text style={[styles.muted, { textAlign: "right" }]}>{document.taxNote}</Text>}
        <ScheduleSection schedule={document.schedule} accent={contractor.accent} />
        <ScopeSections scope={document.scope} accent={contractor.accent} words={document.words} />

        <TermsBlocks body={document.body} accent={accent} />

        <View wrap={false} minPresenceAhead={160}>
          <Text style={[styles.h2, accent]}>Signatures</Text>
          <SignatureBlock heading={signer ? `For the Customer: ${signer.name}` : "For the Customer"} role="Customer" />
          <SignatureBlock heading={`For ${contractor.name}`} role="Contractor" />
        </View>

        <PageFooter number={document.number} />
      </Page>
    </Document>
  );
}

export async function renderContractPdf(document: ContractDocument): Promise<Uint8Array> {
  return renderWithoutLogoOnFailure(document, document.contractor.logo, (without) => renderToBuffer(<ContractPdf document={without} />));
}
