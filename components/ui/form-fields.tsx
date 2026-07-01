"use client";

import { useEffect, useMemo, useRef, useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import {
  digitsOnly,
  formatNationalPhone,
  getPhoneCountry,
  maxNationalLength,
  parsePhoneNumber,
  phoneCountries,
  type PhoneCountryCode
} from "@/lib/phone";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

const emailPattern = "[^\\s@]+@[^\\s@]+\\.[^\\s@]+";

type EmailInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

export function EmailInput({ className, onBlur, value, ...props }: EmailInputProps) {
  return (
    <Input
      {...props}
      value={value}
      type="email"
      inputMode="email"
      autoComplete={props.autoComplete ?? "email"}
      autoCapitalize="none"
      spellCheck={false}
      pattern={emailPattern}
      className={className}
      onBlur={(event) => {
        if (value === undefined) {
          event.currentTarget.value = event.currentTarget.value.trim().toLowerCase();
        }
        onBlur?.(event);
      }}
    />
  );
}

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  showLockIcon?: boolean;
};

export function PasswordInput({
  className,
  showLockIcon = false,
  autoComplete = "current-password",
  ...props
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;

  return (
    <div className="relative">
      {showLockIcon && <LockKeyhole className="pointer-events-none absolute left-3 top-3 size-5 text-slate-400" />}
      <Input
        {...props}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        className={cn(showLockIcon && "pl-10", className, "pr-11")}
      />
      <button
        type="button"
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-ink focus:outline-none focus:ring-4 focus:ring-ocean/10"
        onClick={() => setVisible((current) => !current)}
      >
        <Icon className="size-4" />
      </button>
    </div>
  );
}

type PhoneInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "defaultValue" | "onChange"> & {
  containerClassName?: string;
  defaultCountry?: PhoneCountryCode;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
};

export function PhoneInput({
  className,
  containerClassName,
  defaultCountry = "IN",
  defaultValue = "",
  disabled,
  name,
  onValueChange,
  placeholder,
  required,
  ...props
}: PhoneInputProps) {
  const initialPhone = useMemo(() => parsePhoneNumber(defaultValue, defaultCountry), [defaultCountry, defaultValue]);
  const [countryCode, setCountryCode] = useState<PhoneCountryCode>(initialPhone.country.code);
  const [nationalDigits, setNationalDigits] = useState(initialPhone.nationalDigits);
  const inputRef = useRef<HTMLInputElement>(null);
  const country = getPhoneCountry(countryCode);
  const parsedPhone = parsePhoneNumber(nationalDigits, countryCode);
  const hasValue = nationalDigits.length > 0;
  const hiddenValue = hasValue ? parsedPhone.e164 : "";
  const validationMessage =
    hasValue || required
      ? parsedPhone.isValid
        ? ""
        : `Enter a valid ${country.country} mobile number.`
      : "";

  useEffect(() => {
    inputRef.current?.setCustomValidity(validationMessage);
    onValueChange?.(hiddenValue);
  }, [hiddenValue, onValueChange, validationMessage]);

  function updateNationalDigits(rawValue: string, selectedCountryCode = countryCode) {
    const parsedValue = parsePhoneNumber(rawValue, selectedCountryCode);
    const selectedCountry = rawValue.trim().startsWith("+") ? parsedValue.country : getPhoneCountry(selectedCountryCode);
    const nextDigits = parsedValue.nationalDigits.slice(0, maxNationalLength(selectedCountry));

    setCountryCode(selectedCountry.code);
    setNationalDigits(nextDigits);
  }

  return (
    <>
      <div className={cn("flex w-full min-w-0", containerClassName)}>
        <select
          aria-label="Phone country"
          className="h-11 w-[4.25rem] shrink-0 rounded-l-lg border border-line bg-white px-2 text-sm font-semibold text-slate-700 outline-none transition focus:border-ocean focus:ring-4 focus:ring-ocean/10 disabled:cursor-not-allowed disabled:bg-slate-50"
          disabled={disabled}
          value={countryCode}
          onChange={(event) => {
            const nextCountry = getPhoneCountry(event.currentTarget.value);
            setCountryCode(nextCountry.code);
            setNationalDigits((current) => digitsOnly(current).slice(0, maxNationalLength(nextCountry)));
          }}
        >
          {phoneCountries.map((phoneCountry) => (
            <option key={phoneCountry.code} value={phoneCountry.code}>
              {phoneCountry.dialCode}
            </option>
          ))}
        </select>
        <Input
          {...props}
          ref={inputRef}
          type="tel"
          name={undefined}
          disabled={disabled}
          required={required}
          inputMode="tel"
          autoComplete={props.autoComplete ?? "tel-national"}
          placeholder={placeholder ?? country.example}
          title={`Enter a valid ${country.country} mobile number`}
          value={formatNationalPhone(nationalDigits, countryCode)}
          className={cn("min-w-0 flex-1 rounded-l-none border-l-0", className)}
          onChange={(event) => updateNationalDigits(event.currentTarget.value)}
        />
      </div>
      {name && <input type="hidden" name={name} value={hiddenValue} />}
    </>
  );
}
