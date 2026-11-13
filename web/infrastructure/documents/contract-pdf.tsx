import { Document, Page, renderToBuffer, Text, View } from "@react-pdf/renderer";
import { hasSection, type IncludedOptions, type LayoutItem, type PriceOptions, type SignatureOptions, type TitleOptions } from "@/domain/agreement";
import { DEFAULT_CONTRACT_DOC, legacyContractLayout, type ContractDocument, type RenderedBlock } from "@/domain/contract";
import { renderWithoutLogoOnFailure } from "./logo-fallback";
import { EquipmentSection, IncludedSection, LayoutBlock, LetterHead, LetterheadFooter, PageFooter, PriceSection, ScheduleSection, styles } from "./pdf-sections";

/**
 * The DocuSeal text tags of one signer (signature-provider door 5). The provider finds each tag in the PDF, turns it into a
 * field where the tag sits and removes the text (`remove_tags`). Drawn white on the signature and date lines, so a printed
 * copy that never went through the provider shows blank lines to sign on.
 */
export const signerTags = (role: "Customer" | "Contractor") => ({
  signature: `{{Sig;role=${role};type=signature}}`,
  date: `{{Date;role=${role};type=date}}`,
});

/** The customer's printed name and title, a text field the customer fills when the signature block has a Name line (block-editor door 4). */
export const customerNameTag = "{{Name;role=Customer;type=text}}";

const tagStyle = { position: "absolute", left: 4, bottom: 4, fontSize: 9, color: "#FFFFFF" } as const;

/** One signer's block: who signs, an optional caption, then a line to sign on, an optional line for the printed name and a line for the date. Kept whole on one page. */
function SignatureBlock({ heading, caption, role, nameLine = false }: { heading: string; caption?: string; role: "Customer" | "Contractor"; nameLine?: boolean }) {
  const line = { borderBottomWidth: 1, borderBottomColor: "#111827", height: 28, marginTop: 6 };
  const tags = signerTags(role);
  return (
    <View wrap={false} style={{ marginTop: 18 }}>
      <Text style={{ fontFamily: "Helvetica-Bold" }}>{heading}</Text>
      {caption && <Text style={styles.muted}>{caption}</Text>}
      <View style={line}>
        <Text style={tagStyle}>{tags.signature}</Text>
      </View>
      <Text style={styles.muted}>Signature</Text>
      {nameLine && (
        <>
          <View style={{ ...line, height: 20 }}>
            <Text style={tagStyle}>{customerNameTag}</Text>
          </View>
          <Text style={styles.muted}>Name & title (print)</Text>
        </>
      )}
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
  // A document built before layouts existed has none: it draws as the system layout does.
  const doc = document.doc ?? DEFAULT_CONTRACT_DOC;
  const layout = document.layout ?? legacyContractLayout(document.body, true);
  const letterhead = <LetterHead name={contractor.name} address={contractor.address} phone={contractor.phone} accent={contractor.accent} logo={contractor.logo} />;
  const includedDrawn = hasSection(layout, "included");

  const draw = (item: LayoutItem, index: number) => {
    if (item.kind === "block") return <LayoutBlock key={index} item={item} accent={contractor.accent} />;
    switch (item.key) {
      case "price": {
        const options: PriceOptions = item.options ?? {};
        return (
          <View key={index}>
            <PriceSection lines={document.lines} totalCents={document.totalCents} accent={contractor.accent} title={options.title} columns={options.columns} visitsFormat={options.visitsFormat} />
            {document.taxNote && <Text style={[styles.muted, { textAlign: "right" }]}>{document.taxNote}</Text>}
          </View>
        );
      }
      case "schedule": {
        const options: TitleOptions = item.options ?? {};
        return <ScheduleSection key={index} schedule={document.schedule} accent={contractor.accent} title={options.title} />;
      }
      case "included": {
        const options: IncludedOptions = item.options ?? {};
        return (
          <IncludedSection
            key={index}
            scope={document.scope}
            accent={contractor.accent}
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
        return <EquipmentSection key={index} scope={document.scope} accent={contractor.accent} words={document.words} title={options.title} sayNotRecorded={!includedDrawn} />;
      }
      case "signatures": {
        const options: SignatureOptions = item.options ?? {};
        return (
          <View key={index} wrap={false}>
            {options.heading && <Text style={[styles.h2, accent]}>{options.heading}</Text>}
            <SignatureBlock
              heading={options.customerLabel ?? (signer ? `For the Customer: ${signer.name}` : "For the Customer")}
              caption={options.caption}
              role="Customer"
              nameLine={options.nameField === true}
            />
            <SignatureBlock heading={options.contractorLabel ?? `For ${contractor.name}`} caption={options.caption} role="Contractor" />
          </View>
        );
      }
      default:
        return null;
    }
  };

  return (
    <Document title={`${document.number} contract`} author={contractor.name}>
      <Page size="LETTER" style={styles.page}>
        {doc.pageHeader === "every" ? <View fixed>{letterhead}</View> : letterhead}

        {doc.title.trim() !== "" && <Text style={styles.title}>{doc.title}</Text>}
        {doc.showMeta && (
          <>
            <View style={styles.meta}>
              <Text style={styles.metaItem}>{document.number}</Text>
              <Text style={styles.metaItem}>{document.customerName}</Text>
              <Text style={styles.metaItem}>{document.site.name}</Text>
            </View>
            {document.site.address && <Text style={styles.termLine}>{document.site.address}</Text>}
            {signer && <Text style={styles.termLine}>{`${signer.name} · ${signer.email}`}</Text>}
            <Text style={styles.termLine}>{document.term}</Text>
          </>
        )}

        {layout.map(draw)}

        {doc.pageFooter === "letterhead" ? (
          <LetterheadFooter name={contractor.name} address={contractor.address} phone={contractor.phone} />
        ) : (
          <PageFooter number={document.number} />
        )}
      </Page>
    </Document>
  );
}

export async function renderContractPdf(document: ContractDocument): Promise<Uint8Array> {
  return renderWithoutLogoOnFailure(document, document.contractor.logo, (without) => renderToBuffer(<ContractPdf document={without} />));
}
