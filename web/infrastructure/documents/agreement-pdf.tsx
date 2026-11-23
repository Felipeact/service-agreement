import { Document, Page, renderToBuffer, Text, View } from "@react-pdf/renderer";
import {
  accentOf,
  DEFAULT_AGREEMENT_DOC,
  hasSection,
  letterheadOf,
  legacyLayout,
  type AgreementDocument,
  type IncludedOptions,
  type LayoutItem,
  type PriceOptions,
  type TitleOptions,
} from "@/domain/agreement";
import { renderWithoutLogoOnFailure } from "./logo-fallback";
import { PageHeaderBlock, RichContent } from "./rich-pdf";
import { loadRichImages, renderWithoutImagesOnFailure, type ImageLoader } from "./rich-images";
import { EquipmentSection, IncludedSection, LayoutBlock, LayoutTable, LetterHead, LetterheadFooter, PageFooter, PriceSection, ScheduleSection, pageFamily, styles } from "./pdf-sections";

/** The agreement as a Letter-size document. Built-in Helvetica only, so no font file travels with it. */
export function AgreementPdf({ document }: { document: AgreementDocument }) {
  const { tenant } = document;
  // A document built before layouts existed has none: it draws as the system layout does (and a document built before templates
  // existed has no sections: every optional one is drawn).
  const doc = document.doc ?? DEFAULT_AGREEMENT_DOC;
  // The template's own colour wins over the company's; either way one colour runs through the whole page.
  const color = accentOf(doc, tenant.accent);
  const accent = { color };
  const font = doc.theme?.font;
  const layout = document.layout ?? legacyLayout(document.intro ?? [], document.footer ?? [], document.sections ?? { schedule: true, scope: true });
  const letterhead = <LetterHead name={tenant.name} address={tenant.address} phone={tenant.phone} accent={color} logo={tenant.logo} options={letterheadOf(doc)} />;
  const includedDrawn = hasSection(layout, "included");

  const draw = (item: LayoutItem, index: number) => {
    if (item.kind === "block") return <LayoutBlock key={index} item={item} accent={color} font={font} />;
    if (item.kind === "table") return <LayoutTable key={index} item={item} accent={color} font={font} />;
    if (item.kind === "rich") return <RichContent key={index} nodes={item.nodes} accent={color} font={font} images={document.images} logo={tenant.logo} />;
    switch (item.key) {
      case "price": {
        const options: PriceOptions = item.options ?? {};
        return (
          <PriceSection key={index} lines={document.lines} totalCents={document.totalCents} accent={color} title={options.title} columns={options.columns} visitsFormat={options.visitsFormat} />
        );
      }
      case "schedule": {
        const options: TitleOptions = item.options ?? {};
        return <ScheduleSection key={index} schedule={document.schedule} accent={color} title={options.title} />;
      }
      case "included": {
        const options: IncludedOptions = item.options ?? {};
        return (
          <IncludedSection
            key={index}
            scope={document.scope}
            accent={color}
            words={document.words}
            title={options.title}
            showFrequency={options.showFrequency}
            uppercase={options.uppercase}
            frequencies={document.frequencies}
          />
        );
      }
      case "equipment": {
        const options: TitleOptions = item.options ?? {};
        return <EquipmentSection key={index} scope={document.scope} accent={color} words={document.words} title={options.title} sayNotRecorded={!includedDrawn} />;
      }
      case "terms":
        return (
          document.terms.length > 0 && (
            <View key={index}>
              <Text style={[styles.h2, accent]} minPresenceAhead={80}>
                Terms
              </Text>
              {document.terms.map((term) => (
                <View key={term.label} style={styles.term} wrap={false}>
                  <Text style={styles.termLabel}>{term.label}</Text>
                  <Text style={{ flex: 1 }}>{term.value}</Text>
                </View>
              ))}
            </View>
          )
        );
      default:
        return null;
    }
  };

  return (
    <Document title={`${document.number} version ${document.versionNo}`} author={tenant.name}>
      <Page size="LETTER" style={[styles.page, { fontFamily: pageFamily(font) }]}>
        {document.mark && (
          <Text fixed style={styles.mark}>
            {document.mark}
          </Text>
        )}

        <PageHeaderBlock header={document.header} fallback={letterhead} every={doc.pageHeader === "every"} accent={color} font={font} images={document.images} logo={tenant.logo} />

        {doc.title.trim() !== "" && <Text style={styles.title}>{doc.title}</Text>}
        {doc.showMeta && (
          <>
            <View style={styles.meta}>
              <Text style={styles.metaItem}>{document.number}</Text>
              <Text style={styles.metaItem}>Version {document.versionNo}</Text>
              <Text style={styles.metaItem}>{document.customerName}</Text>
              <Text style={styles.metaItem}>{document.siteName}</Text>
            </View>
            <Text style={styles.termLine}>{document.term}</Text>
            {document.validity && <Text style={styles.termLine}>{document.validity}</Text>}
          </>
        )}

        {layout.map(draw)}

        {doc.pageFooter === "letterhead" ? (
          <LetterheadFooter name={tenant.name} address={tenant.address} phone={tenant.phone} />
        ) : (
          <PageFooter number={document.number} />
        )}
      </Page>
    </Document>
  );
}

/** `loadImage` reads a designed page's uploaded pictures; without it (or for a document with none) nothing is fetched. */
export async function renderAgreementPdf(document: AgreementDocument, loadImage?: ImageLoader): Promise<Uint8Array> {
  // A document with no designed page is passed on as it came, so it prints exactly as before.
  const images = await loadRichImages(document.layout, loadImage, document.header);
  const withImages = images ? { ...document, images } : document;
  return renderWithoutLogoOnFailure(withImages, document.tenant.logo, (without) => renderWithoutImagesOnFailure(without, (drawn) => renderToBuffer(<AgreementPdf document={drawn} />)));
}
