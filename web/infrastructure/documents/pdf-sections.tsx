import { Font, StyleSheet, Text, View } from "@react-pdf/renderer";
import { MONTH_NAMES, taskLabel, type DocumentScope } from "@/domain/agreement";
import type { ScheduleRow } from "@/domain/agreement";
import { DEFAULT_ITEM_WORDS, itemWas, type ItemWords } from "@/domain/org-settings";
import { formatCadExact } from "@/lib/money";

/** Ordinary words stay whole; a word longer than a column can hold is cut every 12 characters, so it wraps instead of running off the page. */
Font.registerHyphenationCallback((word) => (word.length <= 20 ? [word] : (word.match(/.{1,12}/gu) ?? [word])));

export const date = new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeZone: "America/Vancouver" });

const INK = "#111827";
const INK_2 = "#646b78";
const HAIRLINE = "#e5e7eb";
const DRAFT_RED = "#b91c1c";

/** The look the agreement and the contract share: one adapter draws both (AD-063). */
export const styles = StyleSheet.create({
  page: { paddingTop: 54, paddingBottom: 60, paddingHorizontal: 48, fontFamily: "Helvetica", fontSize: 10, color: INK },
  mark: { position: "absolute", top: 20, left: 48, right: 48, textAlign: "center", fontSize: 9, fontFamily: "Helvetica-Bold", color: DRAFT_RED },
  footer: { position: "absolute", bottom: 24, left: 48, right: 48, flexDirection: "row", justifyContent: "space-between", fontSize: 8, color: INK_2 },
  tenant: { fontSize: 15, fontFamily: "Helvetica-Bold" },
  muted: { color: INK_2 },
  title: { fontSize: 13, fontFamily: "Helvetica-Bold", marginTop: 18 },
  meta: { marginTop: 4, flexDirection: "row", flexWrap: "wrap" },
  metaItem: { marginRight: 18 },
  termLine: { marginTop: 4 },
  h2: { fontSize: 11, fontFamily: "Helvetica-Bold", marginTop: 18, marginBottom: 6 },
  head: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: HAIRLINE, paddingBottom: 3, fontFamily: "Helvetica-Bold", fontSize: 9 },
  row: { flexDirection: "row", paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: HAIRLINE },
  total: { flexDirection: "row", justifyContent: "flex-end", marginTop: 6, fontFamily: "Helvetica-Bold" },
  type: { fontFamily: "Helvetica-Bold", marginTop: 8 },
  task: { marginLeft: 10, marginTop: 1 },
  term: { flexDirection: "row", paddingVertical: 2 },
  termLabel: { width: 130, color: INK_2 },
});

export const cell = (flex: number) => ({ flex, paddingRight: 6 });
export const right = { textAlign: "right" as const };

const units = (count: number) => `${count} ${count === 1 ? "unit" : "units"}`;

/** The tenant's name, address and phone over a rule in its accent colour. */
export function LetterHead({ name, address, phone, accent }: { name: string; address: string | null; phone: string | null; accent: string }) {
  return (
    <View style={{ borderBottomWidth: 2, borderBottomColor: accent, paddingBottom: 8 }}>
      <Text style={[styles.tenant, { color: accent }]}>{name}</Text>
      {address && <Text style={styles.muted}>{address}</Text>}
      {phone && <Text style={styles.muted}>{phone}</Text>}
    </View>
  );
}

type Lines = { description: string; visitsPerYear: number; costPerVisitCents: number; annualCents: number }[];

/** "Service and price": the lines, the total and "before tax". */
export function PriceSection({ lines, totalCents, accent }: { lines: Lines; totalCents: number; accent: string }) {
  if (lines.length === 0) {
    return (
      <>
        <Text style={[styles.h2, { color: accent }]}>Service and price</Text>
        <Text style={styles.muted}>No services priced yet</Text>
      </>
    );
  }
  return (
    <>
      <Text style={[styles.h2, { color: accent }]} minPresenceAhead={60}>
        Service and price
      </Text>
      <View style={styles.head}>
        <Text style={cell(4)}>Description</Text>
        <Text style={cell(1.4)}>Visits per year</Text>
        <Text style={[cell(1.6), right]}>Per visit</Text>
        <Text style={[cell(1.6), right]}>Per year</Text>
      </View>
      {lines.map((line, index) => (
        <View key={index} style={styles.row} wrap={false}>
          <Text style={cell(4)}>{line.description}</Text>
          <Text style={cell(1.4)}>{line.visitsPerYear}</Text>
          <Text style={[cell(1.6), right]}>{formatCadExact(line.costPerVisitCents)}</Text>
          <Text style={[cell(1.6), right]}>{formatCadExact(line.annualCents)}</Text>
        </View>
      ))}
      <View style={styles.total} wrap={false}>
        <Text>Total per year {formatCadExact(totalCents)}</Text>
      </View>
      <Text style={[styles.muted, right]}>before tax</Text>
    </>
  );
}

/** "Visit schedule": one row per visited month. */
export function ScheduleSection({ schedule, accent }: { schedule: ScheduleRow[]; accent: string }) {
  return (
    <>
      <Text style={[styles.h2, { color: accent }]} minPresenceAhead={40}>
        Visit schedule
      </Text>
      {schedule.length === 0 ? (
        <Text style={styles.muted}>No visits scheduled yet</Text>
      ) : (
        schedule.map((row) => (
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
    </>
  );
}

/** "Service included" and the org's item heading ("Equipment" by default), or the sentence that the version never recorded them. */
export function ScopeSections({ scope, accent, words = DEFAULT_ITEM_WORDS }: { scope: DocumentScope; accent: string; words?: ItemWords }) {
  if (scope.kind === "not_recorded") {
    return <Text style={[styles.muted, { marginTop: 18 }]}>{`The ${words.plural} covered by this version ${itemWas(words)} not recorded`}</Text>;
  }
  return (
    <>
      <Text style={[styles.h2, { color: accent }]} minPresenceAhead={80}>
        Service included
      </Text>
      {scope.recordedOn && <Text style={styles.muted}>Scope recorded {date.format(scope.recordedOn)}</Text>}
      {scope.types.map((type) => (
        <View key={type.code}>
          <Text style={styles.type} minPresenceAhead={40}>{`${type.name}, ${units(type.assets.length)}`}</Text>
          {type.tasks.map((task, index) => (
            <Text key={index} style={styles.task}>
              {`- ${taskLabel(task)}`}
            </Text>
          ))}
        </View>
      ))}

      <Text style={[styles.h2, { color: accent }]} minPresenceAhead={80}>
        {words.Plural}
      </Text>
      {scope.types.map((type) => (
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
  );
}

/** The number and "Page x of y" on every page. */
export function PageFooter({ number }: { number: string }) {
  return (
    <View fixed style={styles.footer}>
      <Text>{number}</Text>
      <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
    </View>
  );
}
