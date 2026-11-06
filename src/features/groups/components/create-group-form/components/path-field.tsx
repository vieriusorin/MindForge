import { Controller } from "react-hook-form";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PathFieldProps } from "../types";

/** MF-0059 (Q3): creating a path group enrolls the creator, and joining enrolls each member. */
export function PathField({ control, paths, notice }: PathFieldProps) {
  return (
    <Controller
      control={control}
      name="pathSlug"
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor="path">Learning path</FieldLabel>
          <Select
            name={field.name}
            value={field.value}
            onValueChange={field.onChange}
          >
            <SelectTrigger
              id="path"
              className="w-full"
              aria-invalid={fieldState.invalid}
              aria-describedby={notice ? "path-notice" : undefined}
              onBlur={field.onBlur}
              ref={field.ref}
            >
              <SelectValue placeholder="Choose a path" />
            </SelectTrigger>
            <SelectContent>
              {paths.map((p) => (
                <SelectItem key={p.slug} value={p.slug}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {notice ? (
            <FieldDescription id="path-notice">{notice}</FieldDescription>
          ) : null}
          <FieldError
            errors={fieldState.error ? [fieldState.error] : undefined}
          />
        </Field>
      )}
    />
  );
}
