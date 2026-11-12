import { Document, Page, renderToBuffer, Text, View } from "@react-pdf/renderer";
import type { AgreementDocument } from "@/domain/agreement";
import { TermsBlocks } from "./contract-pdf";
import { renderWithoutLogoOnFailure } from "./logo-fallback";
import { LetterHead, PageFooter, PriceSection, ScheduleSection, ScopeSections, styles } from "./pdf-sections";

/** The agreement as a Letter-size document. Built-in Helvetica only, so no font file travels with it. */
export function AgreementPdf({ document }: { document: AgreementDocument }) {
  const { tenant } = document;
  const accent = { color: tenant.accent };
  // A document built before templates existed has no sections: it draws as the system template does.
  const showSchedule = document.sections?.schedule !== false;

  return (
    <Document title={`${document.number} version ${document.versionNo}`} author={tenant.name}>
      <Page size="LETTER" style={styles.page}>
        {document.mark && (
          <Text fixed style={styles.mark}>
            {document.mark}
          </Text>
        )}

        <LetterHead name={tenant.name} address={tenant.address} phone={tenant.phone} accent={tenant.accent} logo={tenant.logo} />

        <Text style={styles.title}>Preventive maintenance service agreement</Text>
        <View style={styles.meta}>
          <Text style={styles.metaItem}>{document.number}</Text>
          <Text style={styles.metaItem}>Version {document.versionNo}</Text>
          <Text style={styles.metaItem}>{document.customerName}</Text>
          <Text style={styles.metaItem}>{document.siteName}</Text>
        </View>
        <Text style={styles.termLine}>{document.term}</Text>
        {document.validity && <Text style={styles.termLine}>{document.validity}</Text>}

        {document.intro && <TermsBlocks body={document.intro} accent={accent} />}

        <PriceSection lines={document.lines} totalCents={document.totalCents} accent={tenant.accent} />
        {showSchedule && <ScheduleSection schedule={document.schedule} accent={tenant.accent} />}
        <ScopeSections scope={document.scope} accent={tenant.accent} words={document.words} />

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

        {document.footer && <TermsBlocks body={document.footer} accent={accent} />}

        <PageFooter number={document.number} />
      </Page>
    </Document>
  );
}

export async function renderAgreementPdf(document: AgreementDocument): Promise<Uint8Array> {
  return renderWithoutLogoOnFailure(document, document.tenant.logo, (without) => renderToBuffer(<AgreementPdf document={without} />));
}
