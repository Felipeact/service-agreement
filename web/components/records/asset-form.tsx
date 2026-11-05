"use client";

import { useActionState } from "react";
import type { AssetTypeOption } from "@/application/ports";
import type { AssetInput } from "@/domain/records";
import { Select } from "@/components/ui/select";
import { TextInput } from "@/components/ui/text-input";
import { RecordForm } from "./record-form";
import { fieldErrors, shownValues, type RecordFormState } from "./state";

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
};

/** Fields in register order: type, unit #, type/model, location/access. */
export function AssetFields({ values, state, types, ...form }: FieldsProps) {
  const errors = fieldErrors(state);
  return (
    <RecordForm status={state.status} {...form}>
      <Select id="assetTypeId" name="assetTypeId" label="Equipment type" defaultValue={values.assetTypeId} error={errors.assetTypeId}>
        <option value="">Choose a type</option>
        {types.map((type) => (
          <option key={type.id} value={type.id}>
            {`${type.name} (${type.code})`}
          </option>
        ))}
      </Select>
      <TextInput id="unitNo" name="unitNo" label="Unit #" defaultValue={values.unitNo} error={errors.unitNo} />
      <TextInput id="typeModel" name="typeModel" label="Type/model" defaultValue={values.typeModel} error={errors.typeModel} />
      <TextInput id="location" name="location" label="Location/access" defaultValue={values.location} error={errors.location} />
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

export function AssetForm({ initial, action, ...props }: FormProps) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" });
  return <AssetFields values={shownValues(state, initial)} state={state} pending={pending} action={formAction} {...props} />;
}
