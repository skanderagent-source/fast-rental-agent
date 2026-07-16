import { useId, useState } from 'react';

type PasswordInputProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: 'current-password' | 'new-password' | 'off';
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
};

export function PasswordInput({
  id,
  value,
  onChange,
  placeholder,
  autoComplete = 'current-password',
  disabled = false,
  className,
  style,
}: PasswordInputProps) {
  const fallbackId = useId();
  const inputId = id ?? fallbackId;
  const [revealed, setRevealed] = useState(false);

  return (
    <div className={`password-input${className ? ` ${className}` : ''}`} style={style}>
      <input
        id={inputId}
        type={revealed ? 'text' : 'password'}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        className="password-input__toggle"
        aria-label={revealed ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
        disabled={disabled}
        onClick={() => setRevealed((open) => !open)}
      >
        {revealed ? 'Masquer' : 'Afficher'}
      </button>
    </div>
  );
}
