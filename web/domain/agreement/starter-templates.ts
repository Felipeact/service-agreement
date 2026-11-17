import type { AgreementTemplateBodyV1 } from "./template";

const SECTIONS = { schedule: true, scope: true } as const;

/**
 * The templates a company starts with when it has none of its own: a quarterly commercial heating and cooling agreement, an annual boiler one and
 * an annual backflow one. Visit months are filled in; prices are left for the estimator, who knows the job. The equipment codes are
 * the catalog's; a code an org does not have is ignored when the template is used. Names are what the Templates list shows.
 */
export const STARTER_TEMPLATES: readonly AgreementTemplateBodyV1[] = [
  {
    schema: 1,
    name: "Commercial heating and cooling, quarterly",
    description: "Four visits a year for rooftop units, air handlers, make-up air and fans.",
    intro: [
      { type: "heading", text: "Scope of service" },
      { type: "paragraph", text: "We will carry out four scheduled preventive maintenance visits a year on the equipment listed below, and report anything that needs repair." },
    ],
    footer: [],
    sections: SECTIONS,
    preset: {
      termMonths: 12,
      lines: [
        { description: "Quarterly service: rooftop units and air handlers", visitMonths: [3, 6, 9, 12], assetTypeCodes: ["RTU", "AHU"], costPerVisitCents: null },
        { description: "Quarterly service: make-up air and fans", visitMonths: [3, 6, 9, 12], assetTypeCodes: ["MUA", "EXHAUST_FAN", "SUPPLY_FAN"], costPerVisitCents: null },
      ],
    },
  },
  {
    schema: 1,
    name: "Boiler, annual",
    description: "One inspection and tune-up a year before the heating season.",
    intro: [
      { type: "heading", text: "Scope of service" },
      { type: "paragraph", text: "We will inspect, clean and tune the boilers and their controls once a year, ahead of the heating season, and report anything that needs repair." },
    ],
    footer: [],
    sections: SECTIONS,
    preset: {
      termMonths: 12,
      lines: [{ description: "Annual boiler inspection and tune-up", visitMonths: [9], assetTypeCodes: ["BOILER", "EXPANSION_TANK", "AIR_SEPARATOR"], costPerVisitCents: null }],
    },
  },
  {
    schema: 1,
    name: "Backflow, annual",
    description: "One test and report a year for backflow preventers.",
    intro: [
      { type: "heading", text: "Scope of service" },
      { type: "paragraph", text: "We will test each backflow preventer once a year and give you the test report for your records and the water authority." },
    ],
    footer: [],
    sections: SECTIONS,
    preset: {
      termMonths: 12,
      lines: [{ description: "Annual backflow preventer test and report", visitMonths: [4], assetTypeCodes: ["BACKFLOW_PREVENTER"], costPerVisitCents: null }],
    },
  },
];
