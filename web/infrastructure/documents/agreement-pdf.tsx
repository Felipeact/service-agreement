import { Document, Font, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";
import { MONTH_NAMES, taskLabel, type AgreementDocument } from "@/domain/agreement";
import { formatCadExact } from "@/lib/money";

/** Ordinary words stay whole; a word longer than a column can hold is cut every 12 characters, so it wraps instead of running off the page. */
Font.registerHyphenationCallback((word) => (word.length <= 20 ? [word] : (word.match(/.{1,12}/gu) ?? [word])));

const date = new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeZone: "America/Vancouver" });

const INK = "#111827";
const INK_2 = "#646b78";
const HAIRLINE = "#e5e7eb";
const DRAFT_RED = "#b91c1c";

const styles = StyleSheet.create({
  page: { paddingTop: 54, paddingBottom: 60, paddingHorizontal: 48, fontFamily: "Helvetica", fontSize: 10, color: INK },
  mark: { position: "absolute", top: 20, left: 48, right: 48, textAlign: "center", fontSize: 9, fontFamily: "Helvetica-Bold", color: DRAFT_RED },
  footer: { position: "absolute", bottom: 24, left: 48, right: 48, flexDirection: "row", justifyContent: "space-between", fontSize: 8, color: INK_2 },
  tenant: { fontSize: 15, fontFamily: "Helvetica-Bold" },
  muted: { color: INK_2 },
  title: { fontSize: 13, fontFamily: "Helvetica-Bold", marginTop: 18 },
  meta: { marginTop: 4, flexDirection: "row", flexWrap: "wrap" },
  metaItem: { marginRight: 18 },
  h2: { fontSize: 11, fontFamily: "Helvetica-Bold", marginTop: 18, marginBottom: 6 },
  head: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: HAIRLINE, paddingBottom: 3, fontFamily: "Helvetica-Bold", fontSize: 9 },
  row: { flexDirection: "row", paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: HAIRLINE },
  total: { flexDirection: "row", justifyContent: "flex-end", marginTop: 6, fontFamily: "Helvetica-Bold" },
  type: { fontFamily: "Helvetica-Bold", marginTop: 8 },
  task: { marginLeft: 10, marginTop: 1 },
  term: { flexDirection: "row", paddingVertical: 2 },
  termLabel: { width: 130, color: INK_2 },
});

const cell = (flex: number) => ({ flex, paddingRight: 6 });
const right = { textAlign: "right" as const };

const units = (count: number) => `${count} ${count === 1 ? "unit" : "units"}`;

/** The agreement as a Letter-size document. Built-in Helvetica only, so no font file travels with it. */
export function AgreementPdf({ document }: { document: AgreementDocument }) {
  const { tenant, scope } = document;
  const accent = { color: tenant.accent };
  const rule = { borderBottomWidth: 2, borderBottomColor: tenant.accent, paddingBottom: 8 };
  const types = scope.kind === "listed" ? scope.types : [];

  return (
    <Document title={`${document.number} version ${document.versionNo}`} author={tenant.name}>
      <Page size="LETTER" style={styles.page}>
        {document.mark && (
          <Text fixed style={styles.mark}>
            {document.mark}
          </Text>
        )}

        <View style={rule}>
          <Text style={[styles.tenant, accent]}>{tenant.name}</Text>
          {tenant.address && <Text style={styles.muted}>{tenant.address}</Text>}
          {tenant.phone && <Text style={styles.muted}>{tenant.phone}</Text>}
        </View>

        <Text style={styles.title}>Preventive maintenance service agreement</Text>
        <View style={styles.meta}>
          <Text style={styles.metaItem}>{document.number}</Text>
          <Text style={styles.metaItem}>Version {document.versionNo}</Text>
          <Text style={styles.metaItem}>{document.customerName}</Text>
          <Text style={styles.metaItem}>{document.siteName}</Text>
        </View>

        {document.lines.length === 0 ? (
          <>
            <Text style={[styles.h2, accent]}>Service and price</Text>
            <Text style={styles.muted}>No services priced yet</Text>
          </>
        ) : (
          <>
            <Text style={[styles.h2, accent]} minPresenceAhead={60}>
              Service and price
            </Text>
            <View style={styles.head}>
              <Text style={cell(4)}>Description</Text>
              <Text style={cell(1.4)}>Visits per year</Text>
              <Text style={[cell(1.6), right]}>Per visit</Text>
              <Text style={[cell(1.6), right]}>Per year</Text>
            </View>
            {document.lines.map((line, index) => (
              <View key={index} style={styles.row} wrap={false}>
                <Text style={cell(4)}>{line.description}</Text>
                <Text style={cell(1.4)}>{line.visitsPerYear}</Text>
                <Text style={[cell(1.6), right]}>{formatCadExact(line.costPerVisitCents)}</Text>
                <Text style={[cell(1.6), right]}>{formatCadExact(line.annualCents)}</Text>
              </View>
            ))}
            <View style={styles.total} wrap={false}>
              <Text>Total per year {formatCadExact(document.totalCents)}</Text>
            </View>
            <Text style={[styles.muted, right]}>before tax</Text>
          </>
        )}

        <Text style={[styles.h2, accent]} minPresenceAhead={40}>
          Visit schedule
        </Text>
        {document.schedule.length === 0 ? (
          <Text style={styles.muted}>No visits scheduled yet</Text>
        ) : (
          document.schedule.map((row) => (
            <View key={row.month} style={styles.row} wrap={false}>
              <Text style={cell(1.4)}>{MONTH_NAMES[row.month - 1]}</Text>
              <View style={cell(6)}>
                <Text>{row.equipment.join(", ")}</Text>
                {row.tasks.map((task) => (
                  <Text key={`${task.type}:${task.description}`}>{`${task.type}: ${task.description}`}</Text>
                ))}
              </View>
            </View>
          ))
        )}

        {scope.kind === "not_recorded" ? (
          <Text style={[styles.muted, { marginTop: 18 }]}>The equipment covered by this version was not recorded</Text>
        ) : (
          <>
            <Text style={[styles.h2, accent]} minPresenceAhead={80}>
              Service included
            </Text>
            {scope.recordedOn && <Text style={styles.muted}>Scope recorded {date.format(scope.recordedOn)}</Text>}
            {types.map((type) => (
              <View key={type.code}>
                <Text style={styles.type} minPresenceAhead={40}>{`${type.name}, ${units(type.assets.length)}`}</Text>
                {type.tasks.map((task, index) => (
                  <Text key={index} style={styles.task}>
                    {`- ${taskLabel(task)}`}
                  </Text>
                ))}
              </View>
            ))}

            <Text style={[styles.h2, accent]} minPresenceAhead={80}>
              Equipment
            </Text>
            {types.map((type) => (
              <View key={type.code}>
                <Text style={styles.type} minPresenceAhead={40}>
                  {type.name}
                </Text>
                {type.assets.map((asset, index) => (
                  <View key={index} style={styles.row} wrap={false}>
                    <Text style={cell(1.4)}>{asset.unitNo ?? ""}</Text>
                    <Text style={cell(2.6)}>{asset.typeModel ?? ""}</Text>
                    <Text style={cell(3)}>{asset.location ?? ""}</Text>
                  </View>
                ))}
              </View>
            ))}
          </>
        )}

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

        <View fixed style={styles.footer}>
          <Text>{document.number}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export async function renderAgreementPdf(document: AgreementDocument): Promise<Uint8Array> {
  return new Uint8Array(await renderToBuffer(<AgreementPdf document={document} />));
}
