import { Controller } from "react-hook-form";
import {
  Field,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { GroupKind, KindFieldProps } from "../types";

const KINDS = [
  { value: "pack", label: "Pack" },
  { value: "path", label: "Path" },
] as const satisfies readonly { value: GroupKind; label: string }[];

/** MF-0059: the group follows one pack, or a path of course packs. */
export function KindField({ control }: KindFieldProps) {
  return (
    <Controller
      control={control}
      name="kind"
      render={({ field, fieldState }) => (
        <FieldSet data-invalid={fieldState.invalid}>
          <FieldLegend variant="label">The group follows</FieldLegend>
          <RadioGroup
            name={field.name}
            value={field.value}
            onValueChange={field.onChange}
            className="flex flex-wrap gap-x-6"
          >
            {KINDS.map((kind) => (
              <Field
                key={kind.value}
                orientation="horizontal"
                className="min-h-10 w-auto"
              >
                <RadioGroupItem
                  id={`group-kind-${kind.value}`}
                  value={kind.value}
                  onBlur={field.onBlur}
                />
                <FieldLabel htmlFor={`group-kind-${kind.value}`}>
                  {kind.label}
                </FieldLabel>
              </Field>
            ))}
          </RadioGroup>
          <FieldError
            errors={fieldState.error ? [fieldState.error] : undefined}
          />
        </FieldSet>
      )}
    />
  );
}
