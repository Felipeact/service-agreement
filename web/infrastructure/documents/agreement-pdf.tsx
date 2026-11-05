import { Document, Page, renderToBuffer, Text, View } from "@react-pdf/renderer";
import type { AgreementDocument } from "@/domain/agreement";
import { LetterHead, PageFooter, PriceSection, ScheduleSection, ScopeSections, styles } from "./pdf-sections";

/** The agreement as a Letter-size document. Built-in Helvetica only, so no font file travels with it. */
export function AgreementPdf({ document }: { document: AgreementDocument }) {
  const { tenant } = document;
  const accent = { color: tenant.accent };

  return (
    <Document title={`${document.number} version ${document.versionNo}`} author={tenant.name}>
      <Page size="LETTER" style={styles.page}>
        {document.mark && (
          <Text fixed style={styles.mark}>
            {document.mark}
          </Text>
        )}

        <LetterHead name={tenant.name} address={tenant.address} phone={tenant.phone} accent={tenant.accent} />

        <Text style={styles.title}>Preventive maintenance service agreement</Text>
        <View style={styles.meta}>
          <Text style={styles.metaItem}>{document.number}</Text>
          <Text style={styles.metaItem}>Version {document.versionNo}</Text>
          <Text style={styles.metaItem}>{document.customerName}</Text>
          <Text style={styles.metaItem}>{document.siteName}</Text>
        </View>
        <Text style={styles.termLine}>{document.term}</Text>
        {document.validity && <Text style={styles.termLine}>{document.validity}</Text>}

        <PriceSection lines={document.lines} totalCents={document.totalCents} accent={tenant.accent} />
        <ScheduleSection schedule={document.schedule} accent={tenant.accent} />
        <ScopeSections scope={document.scope} accent={tenant.accent} />

        {document.terms.length > 0 && (
          <>
            <Text style={[styles.h2, accent]} minPresenceAhead={80}>
              Terms
            </Text>
            {document.terms.map((term) => (
              <View key={term.label} style={styles.term} wrap={false}>
                <Text style={styles.termLabel}>{term.label}</Text>
                <Text style={{ flex: 1 }}>{term.value}</Text>
              </View>
            ))}
          </>
        )}

        <PageFooter number={document.number} />
      </Page>
    </Document>
  );
}

export async function renderAgreementPdf(document: AgreementDocument): Promise<Uint8Array> {
  return new Uint8Array(await renderToBuffer(<AgreementPdf document={document} />));
}
