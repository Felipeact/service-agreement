import { Document, Page, renderToBuffer, Text, View } from "@react-pdf/renderer";
import type { ContractDocument } from "@/domain/contract";
import { LetterHead, PageFooter, PriceSection, ScheduleSection, ScopeSections, styles } from "./pdf-sections";

/** One signer's block: who signs, then a line to sign on and a line for the date. Kept whole on one page. */
function SignatureBlock({ heading }: { heading: string }) {
  const line = { borderBottomWidth: 1, borderBottomColor: "#111827", height: 28, marginTop: 6 };
  return (
    <View wrap={false} style={{ marginTop: 18 }}>
      <Text style={{ fontFamily: "Helvetica-Bold" }}>{heading}</Text>
      <View style={line} />
      <Text style={styles.muted}>Signature</Text>
      <View style={{ ...line, height: 20 }} />
      <Text style={styles.muted}>Date</Text>
    </View>
  );
}

/** The contract as a Letter-size document, drawn with the same sections as the agreement. */
export function ContractPdf({ document }: { document: ContractDocument }) {
  const { contractor, signer } = document;
  const accent = { color: contractor.accent };

  return (
    <Document title={`${document.number} contract`} author={contractor.name}>
      <Page size="LETTER" style={styles.page}>
        <LetterHead name={contractor.name} address={contractor.address} phone={contractor.phone} accent={contractor.accent} />

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
        <ScopeSections scope={document.scope} accent={contractor.accent} />

        {document.clauses.length > 0 && (
          <>
            <Text style={[styles.h2, accent]} minPresenceAhead={80}>
              Terms
            </Text>
            {document.clauses.map((clause, index) => (
              <Text key={index} style={{ marginBottom: 4 }}>
                {clause}
              </Text>
            ))}
          </>
        )}

        <View wrap={false} minPresenceAhead={160}>
          <Text style={[styles.h2, accent]}>Signatures</Text>
          <SignatureBlock heading={signer ? `For the Customer: ${signer.name}` : "For the Customer"} />
          <SignatureBlock heading={`For ${contractor.name}`} />
        </View>

        <PageFooter number={document.number} />
      </Page>
    </Document>
  );
}

export async function renderContractPdf(document: ContractDocument): Promise<Uint8Array> {
  return new Uint8Array(await renderToBuffer(<ContractPdf document={document} />));
}
