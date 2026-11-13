import { Font, Image, StyleSheet, Text, View } from "@react-pdf/renderer";
import { MONTH_NAMES, taskLabel, type BlockItem, type DocumentScope, type PriceColumns, type VisitsFormat } from "@/domain/agreement";
import type { ScheduleRow } from "@/domain/agreement";
import { DEFAULT_ITEM_WORDS, itemWas, type ItemWords } from "@/domain/org-settings";
import type { TenantLogo } from "@/domain/org-settings/logo";
import { formatCadExact } from "@/lib/money";
import { logoBox, logoSize } from "./logo";

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

/** The tenant's logo (when it has one), name, address and phone over a rule in its accent colour. */
export function LetterHead({ name, address, phone, accent, logo }: { name: string; address: string | null; phone: string | null; accent: string; logo?: TenantLogo }) {
  const size = logo ? logoSize(logo) : null;
  return (
    <View style={{ borderBottomWidth: 2, borderBottomColor: accent, paddingBottom: 8 }}>
      {logo && size && size.width > 0 && size.height > 0 && (
        // A react-pdf Image draws into the PDF; it is not an HTML img and has no alt prop.
        // eslint-disable-next-line jsx-a11y/alt-text
        <Image src={{ data: Buffer.from(logo.bytes), format: logo.format }} style={{ ...logoBox(size.width, size.height), marginBottom: 6 }} />
      )}
      <Text style={[styles.tenant, { color: accent }]}>{name}</Text>
      {address && <Text style={styles.muted}>{address}</Text>}
      {phone && <Text style={styles.muted}>{phone}</Text>}
    </View>
  );
}

type Lines = { description: string; visitsPerYear: number; costPerVisitCents: number; annualCents: number }[];

export const DEFAULT_PRICE_COLUMNS: PriceColumns = {
  description: "Description",
  visits: "Visits per year",
  perVisit: "Per visit",
  perYear: "Per year",
  total: "Total per year",
};

/** A line's visits as the table prints them: the number, or `4 times per year` / `1 time per year`. */
const visitsText = (count: number, format: VisitsFormat) => (format === "times_per_year" ? `${count} ${count === 1 ? "time" : "times"} per year` : String(count));

/** "Service and price": the lines, the total and "before tax". The title, the column labels and the visits format are the layout options. */
export function PriceSection({
  lines,
  totalCents,
  accent,
  title = "Service and price",
  columns = DEFAULT_PRICE_COLUMNS,
  visitsFormat = "number",
}: {
  lines: Lines;
  totalCents: number;
  accent: string;
  title?: string;
  columns?: PriceColumns;
  visitsFormat?: VisitsFormat;
}) {
  if (lines.length === 0) {
    return (
      <>
        <Text style={[styles.h2, { color: accent }]}>{title}</Text>
        <Text style={styles.muted}>No services priced yet</Text>
      </>
    );
  }
  return (
    <>
      <Text style={[styles.h2, { color: accent }]} minPresenceAhead={60}>
        {title}
      </Text>
      <View style={styles.head}>
        <Text style={cell(4)}>{columns.description}</Text>
        <Text style={cell(1.4)}>{columns.visits}</Text>
        <Text style={[cell(1.6), right]}>{columns.perVisit}</Text>
        <Text style={[cell(1.6), right]}>{columns.perYear}</Text>
      </View>
      {lines.map((line, index) => (
        <View key={index} style={styles.row} wrap={false}>
          <Text style={cell(4)}>{line.description}</Text>
          <Text style={cell(1.4)}>{visitsText(line.visitsPerYear, visitsFormat)}</Text>
          <Text style={[cell(1.6), right]}>{formatCadExact(line.costPerVisitCents)}</Text>
          <Text style={[cell(1.6), right]}>{formatCadExact(line.annualCents)}</Text>
        </View>
      ))}
      <View style={styles.total} wrap={false}>
        <Text>
          {`${columns.total} `}
          {formatCadExact(totalCents)}
        </Text>
      </View>
      <Text style={[styles.muted, right]}>before tax</Text>
    </>
  );
}

/** "Visit schedule" (or the layout title): one row per visited month. */
export function ScheduleSection({ schedule, accent, title = "Visit schedule" }: { schedule: ScheduleRow[]; accent: string; title?: string }) {
  return (
    <>
      <Text style={[styles.h2, { color: accent }]} minPresenceAhead={40}>
        {title}
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

const notRecorded = (words: ItemWords) => (
  <Text style={[styles.muted, { marginTop: 18 }]}>{`The ${words.plural} covered by this version ${itemWas(words)} not recorded`}</Text>
);

/**
 * "Service included" (or the layout title) with one heading per equipment type and its checklist, or the sentence that the
 * version never recorded them. With `showFrequency` a heading reads `AHU (QUARTERLY)` (the units count is not printed), with
 * `uppercase` in capitals.
 */
export function IncludedSection({
  scope,
  accent,
  words = DEFAULT_ITEM_WORDS,
  title = "Service included",
  showFrequency = false,
  uppercase = false,
  frequencies = {},
  sayNotRecorded = true,
}: {
  scope: DocumentScope;
  accent: string;
  words?: ItemWords;
  title?: string;
  showFrequency?: boolean;
  uppercase?: boolean;
  frequencies?: Record<string, string>;
  /** Whether a scope nobody recorded prints its sentence here (the equipment section prints it when this one is not in the layout). */
  sayNotRecorded?: boolean;
}) {
  if (scope.kind === "hidden") return null;
  if (scope.kind === "not_recorded") return sayNotRecorded ? notRecorded(words) : null;
  const heading = (type: (typeof scope.types)[number]) => {
    const text = showFrequency ? `${type.name}${frequencies[type.code] ? ` (${frequencies[type.code]})` : ""}` : `${type.name}, ${units(type.assets.length)}`;
    return uppercase ? text.toUpperCase() : text;
  };
  return (
    <>
      <Text style={[styles.h2, { color: accent }]} minPresenceAhead={80}>
        {title}
      </Text>
      {scope.recordedOn && <Text style={styles.muted}>Scope recorded {date.format(scope.recordedOn)}</Text>}
      {scope.types.map((type) => (
        <View key={type.code}>
          <Text style={styles.type} minPresenceAhead={40}>
            {heading(type)}
          </Text>
          {type.tasks.map((task, index) => (
            <Text key={index} style={styles.task}>
              {`- ${taskLabel(task)}`}
            </Text>
          ))}
        </View>
      ))}
    </>
  );
}

/** The org item heading ("Equipment" by default, or the layout title) with one row per asset under its type. */
export function EquipmentSection({
  scope,
  accent,
  words = DEFAULT_ITEM_WORDS,
  title,
  sayNotRecorded = false,
}: {
  scope: DocumentScope;
  accent: string;
  words?: ItemWords;
  title?: string;
  sayNotRecorded?: boolean;
}) {
  if (scope.kind === "hidden") return null;
  if (scope.kind === "not_recorded") return sayNotRecorded ? notRecorded(words) : null;
  return (
    <>
      <Text style={[styles.h2, { color: accent }]} minPresenceAhead={80}>
        {title ?? words.Plural}
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

/** "Service included" and the org item heading ("Equipment" by default), or the sentence that the version never recorded them. */
export function ScopeSections({ scope, accent, words = DEFAULT_ITEM_WORDS }: { scope: DocumentScope; accent: string; words?: ItemWords }) {
  return (
    <>
      <IncludedSection scope={scope} accent={accent} words={words} />
      <EquipmentSection scope={scope} accent={accent} words={words} />
    </>
  );
}

const INDENT = 16;

/** A text block of a layout: a heading of level 1 in the title style and any other heading in the section style, everything else as body text; indented by its level and starting a page when it says so. */
export function LayoutBlock({ item, accent }: { item: BlockItem; accent: string }) {
  const indent = { marginLeft: (item.indent ?? 0) * INDENT };
  if (item.type === "heading") {
    return (
      <Text style={item.level === 1 ? [styles.title, indent] : [styles.h2, { color: accent }, indent]} minPresenceAhead={80} break={item.pageBreakBefore}>
        {item.text}
      </Text>
    );
  }
  return (
    <Text style={[{ marginBottom: 4 }, indent]} break={item.pageBreakBefore}>
      {item.text}
    </Text>
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

/** The company name, address and phone at the foot of every page, in place of the number and page count. */
export function LetterheadFooter({ name, address, phone }: { name: string; address: string | null; phone: string | null }) {
  return (
    <View fixed style={styles.footer}>
      <Text>{name}</Text>
      {address && <Text>{address}</Text>}
      {phone && <Text>{phone}</Text>}
    </View>
  );
}
