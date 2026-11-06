import { Controller } from "react-hook-form";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PackFieldProps } from "../types";

export function PackField({ control, packs }: PackFieldProps) {
  return (
    <Controller
      control={control}
      name="packSlug"
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor="pack">Learning pack</FieldLabel>
          <Select
            name={field.name}
            value={field.value}
            onValueChange={field.onChange}
          >
            <SelectTrigger
              id="pack"
              className="w-full"
              aria-invalid={fieldState.invalid}
              onBlur={field.onBlur}
              ref={field.ref}
            >
              <SelectValue placeholder="Choose a pack" />
            </SelectTrigger>
            <SelectContent>
              {packs.map((p) => (
                <SelectItem key={p.slug} value={p.slug}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError
            errors={fieldState.error ? [fieldState.error] : undefined}
          />
        </Field>
      )}
    />
  );
}
