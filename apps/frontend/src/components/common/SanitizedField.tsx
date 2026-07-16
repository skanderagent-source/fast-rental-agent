import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';
import {
  fieldInputAttributes,
  sanitizeFieldInput,
  type FieldKind,
} from '../../lib/inputSanitize';

type SanitizedInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'inputMode'> & {
  kind: FieldKind;
  value: string;
  maxLength: number;
  onChange: (value: string) => void;
};

export function SanitizedInput({
  kind,
  value,
  maxLength,
  onChange,
  ...props
}: SanitizedInputProps) {
  const attrs = fieldInputAttributes(kind);

  return (
    <input
      {...props}
      {...attrs}
      value={value}
      maxLength={maxLength}
      onChange={(event) => onChange(sanitizeFieldInput(event.target.value, kind, maxLength))}
    />
  );
}

type SanitizedTextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> & {
  kind: Extract<FieldKind, 'multiline' | 'plain'>;
  value: string;
  maxLength: number;
  onChange: (value: string) => void;
};

export function SanitizedTextarea({
  kind,
  value,
  maxLength,
  onChange,
  ...props
}: SanitizedTextareaProps) {
  return (
    <textarea
      {...props}
      value={value}
      maxLength={maxLength}
      onChange={(event) => onChange(sanitizeFieldInput(event.target.value, kind, maxLength))}
    />
  );
}
