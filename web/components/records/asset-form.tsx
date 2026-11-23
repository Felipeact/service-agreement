"use client";

import type { AssetTypeOption } from "@/application/ports";
import type { AssetInput } from "@/domain/records";
import { itemText } from "@/domain/org-settings";
import { useItemWords } from "@/components/shell/item-words";
import { Select } from "@/components/ui/select";
import { TextInput } from "@/components/ui/text-input";
import { validateAsset } from "@/domain/records";
import { domainSchema, text } from "@/lib/forms/domain-schema";
import type { UseFormRegister } from "react-hook-form";
import { RecordForm } from "./record-form";
import { fieldErrors, type RecordFormState } from "./state";
import { useRecordForm } from "./use-record-form";

export type AssetFormState = RecordFormState<AssetInput>;

type FieldsProps = {
  values: AssetInput;
  state: AssetFormState;
  /** The org's asset types, already ordered by name. */
  types: AssetTypeOption[];
  pending: boolean;
  submitLabel: string;
  cancelHref: string;
  action?: (formData: FormData) => void;
  /** The browser-side form (React Hook Form); without it the fields are plain and post through `action`. */
  onSubmit?: (event: React.FormEvent<HTMLFormElement>) => void;
  register?: UseFormRegister<AssetInput>;
  /** Messages from the browser's check; they win over the server's. */
  errors?: Partial<Record<string, string>>;
};

/** Fields in register order: type, unit #, type/model, location/access. */
export function AssetFields({ values, state, types, register, errors: live, ...form }: FieldsProps) {
  const words = useItemWords();
  const errors = { ...fieldErrors(state), ...live };
  return (
    <RecordForm status={state.status} {...form}>
      <Select id="assetTypeId" label={itemText("Equipment type", words)} error={errors.assetTypeId && itemText(errors.assetTypeId, words)} defaultValue={values.assetTypeId} {...(register ? register("assetTypeId") : { name: "assetTypeId" })}>
        <option value="">Choose a type</option>
        {types.map((type) => (
          <option key={type.id} value={type.id}>
            {`${type.name} (${type.code})`}
          </option>
        ))}
      </Select>
      <TextInput id="unitNo" label="Unit #" error={errors.unitNo} defaultValue={values.unitNo} {...(register ? register("unitNo") : { name: "unitNo" })} />
      <TextInput id="typeModel" label="Type/model" error={errors.typeModel} defaultValue={values.typeModel} {...(register ? register("typeModel") : { name: "typeModel" })} />
      <TextInput id="location" label="Location/access" error={errors.location} defaultValue={values.location} {...(register ? register("location") : { name: "location" })} />
    </RecordForm>
  );
}

type FormProps = {
  initial: AssetInput;
  types: AssetTypeOption[];
  submitLabel: string;
  cancelHref: string;
  action: (state: AssetFormState, formData: FormData) => Promise<AssetFormState>;
};

/** The asset form: checked in the browser first, then sent to the server action, which checks it again. */
export function AssetForm({ initial, action, types, ...props }: FormProps) {
  const schema = domainSchema({ assetTypeId: text(), unitNo: text(), typeModel: text(), location: text() }, (input) =>
    validateAsset(input, types.map((type) => type.id)),
  );
  const { state, pending, register, onSubmit, errors } = useRecordForm<AssetInput, AssetFormState>({ schema, initial, action });
  return <AssetFields values={initial} state={state} types={types} pending={pending} onSubmit={onSubmit} register={register} errors={errors} {...props} />;
}
