export type PhoneCountryCode = "IN" | "US" | "GB" | "AE";

export type PhoneCountry = {
  code: PhoneCountryCode;
  country: string;
  dialCode: string;
  example: string;
  nationalLengths: number[];
  leadingPattern?: RegExp;
  trunkPrefix?: string;
};

export const phoneCountries: PhoneCountry[] = [
  {
    code: "IN",
    country: "India",
    dialCode: "+91",
    example: "98765 43210",
    nationalLengths: [10],
    leadingPattern: /^[6-9]/,
    trunkPrefix: "0"
  },
  {
    code: "US",
    country: "United States",
    dialCode: "+1",
    example: "(415) 555-0132",
    nationalLengths: [10],
    leadingPattern: /^[2-9]/
  },
  {
    code: "GB",
    country: "United Kingdom",
    dialCode: "+44",
    example: "7400 123 456",
    nationalLengths: [10],
    leadingPattern: /^7/,
    trunkPrefix: "0"
  },
  {
    code: "AE",
    country: "United Arab Emirates",
    dialCode: "+971",
    example: "50 123 4567",
    nationalLengths: [9],
    leadingPattern: /^5/,
    trunkPrefix: "0"
  }
];

const countriesByLongestDialCode = [...phoneCountries].sort(
  (a, b) => b.dialCode.length - a.dialCode.length
);

export function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

export function getPhoneCountry(code: string | undefined): PhoneCountry {
  return phoneCountries.find((country) => country.code === code) ?? phoneCountries[0];
}

export function maxNationalLength(country: PhoneCountry) {
  return Math.max(...country.nationalLengths);
}

function stripTrunkPrefix(value: string, country: PhoneCountry) {
  const maxLength = maxNationalLength(country);
  if (country.trunkPrefix && value.startsWith(country.trunkPrefix) && value.length === maxLength + 1) {
    return value.slice(country.trunkPrefix.length);
  }

  return value;
}

function getCountryFromDialDigits(value: string) {
  return countriesByLongestDialCode.find((country) => value.startsWith(digitsOnly(country.dialCode)));
}

export function parsePhoneNumber(value: unknown, fallbackCountryCode: PhoneCountryCode = "IN") {
  const rawValue = typeof value === "string" ? value.trim() : "";
  const defaultCountry = getPhoneCountry(fallbackCountryCode);
  const valueDigits = digitsOnly(rawValue);
  let country = defaultCountry;
  let nationalDigits = valueDigits;

  if (rawValue.startsWith("+")) {
    const matchedCountry = getCountryFromDialDigits(valueDigits);
    if (matchedCountry) {
      country = matchedCountry;
      nationalDigits = valueDigits.slice(digitsOnly(matchedCountry.dialCode).length);
    }
  } else {
    const matchedCountry = getCountryFromDialDigits(valueDigits);
    if (matchedCountry) {
      const withoutDialCode = valueDigits.slice(digitsOnly(matchedCountry.dialCode).length);
      if (withoutDialCode.length >= Math.min(...matchedCountry.nationalLengths)) {
        country = matchedCountry;
        nationalDigits = withoutDialCode;
      }
    }
  }

  nationalDigits = stripTrunkPrefix(nationalDigits, country);
  const isValidLength = country.nationalLengths.includes(nationalDigits.length);
  const isValidLeadingDigit = !country.leadingPattern || country.leadingPattern.test(nationalDigits);
  const isValid = Boolean(nationalDigits) && isValidLength && isValidLeadingDigit;
  const e164 = `${country.dialCode}${nationalDigits}`;

  return {
    country,
    nationalDigits,
    e164,
    formattedNational: formatNationalPhone(nationalDigits, country.code),
    isValid
  };
}

export function normalizePhoneForStorage(value: unknown, fallbackCountryCode: PhoneCountryCode = "IN") {
  const parsed = parsePhoneNumber(value, fallbackCountryCode);
  if (parsed.isValid) return parsed.e164;
  return typeof value === "string" ? value.trim() : value;
}

export function formatNationalPhone(value: string, countryCode: PhoneCountryCode = "IN") {
  const digits = digitsOnly(value);

  if (countryCode === "US") {
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  }

  if (countryCode === "GB") {
    if (digits.length <= 4) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 4)} ${digits.slice(4)}`;
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 10)}`;
  }

  if (countryCode === "AE") {
    if (digits.length <= 2) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
    return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 9)}`;
  }

  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)} ${digits.slice(5, 10)}`;
}
