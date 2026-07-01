"use client";

import { useEffect, useMemo, useState, type SelectHTMLAttributes } from "react";
import {
  businessServiceTypeOptions,
  defaultBusinessServiceTypeName,
  normalizeBusinessServiceType,
  type BusinessServiceTypeOption
} from "@/lib/business-service-types";
import { getBusinessConsoleIcons } from "@/lib/business-console-icons";
import { cn } from "@/lib/utils";

const selectClassName =
  "h-11 w-full rounded-lg border border-line bg-white px-3 text-sm outline-none transition focus:border-ocean focus:ring-4 focus:ring-ocean/10";

type BusinessServiceTypesResponse = {
  serviceTypes?: BusinessServiceTypeOption[];
};

export function BusinessTypeSelect({
  className,
  defaultValue = defaultBusinessServiceTypeName,
  value,
  onChange,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  const [serviceTypes, setServiceTypes] = useState<BusinessServiceTypeOption[]>(businessServiceTypeOptions);
  const [selectedValue, setSelectedValue] = useState(typeof defaultValue === "string" ? defaultValue : defaultBusinessServiceTypeName);

  useEffect(() => {
    const controller = new AbortController();

    async function loadServiceTypes() {
      try {
        const response = await fetch("/api/business-service-types", {
          cache: "no-store",
          signal: controller.signal
        });
        if (!response.ok) return;

        const payload = (await response.json()) as BusinessServiceTypesResponse;
        if (Array.isArray(payload.serviceTypes) && payload.serviceTypes.length > 0) {
          setServiceTypes(payload.serviceTypes);
        }
      } catch {
        if (!controller.signal.aborted) {
          setServiceTypes(businessServiceTypeOptions);
        }
      }
    }

    void loadServiceTypes();

    return () => controller.abort();
  }, []);

  const options = useMemo(() => {
    const selected = typeof defaultValue === "string" ? defaultValue.trim() : "";
    if (!selected) return serviceTypes;

    const hasSelected = serviceTypes.some(
      (serviceType) => normalizeBusinessServiceType(serviceType.name) === normalizeBusinessServiceType(selected)
    );

    if (hasSelected) return serviceTypes;

    return [
      {
        id: `current-${selected}`,
        slug: normalizeBusinessServiceType(selected).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
        name: selected,
        description: "Current business type"
      },
      ...serviceTypes
    ];
  }, [defaultValue, serviceTypes]);

  const iconValue = typeof value === "string" ? value : selectedValue;
  const SelectedIcon = getBusinessConsoleIcons(iconValue).businessIcon;

  return (
    <div className="relative">
      <SelectedIcon className="pointer-events-none absolute left-3 top-3 size-5 text-slate-400" />
      <select
        className={cn(selectClassName, "pl-10", className)}
        value={value}
        defaultValue={value === undefined ? defaultValue : undefined}
        onChange={(event) => {
          setSelectedValue(event.currentTarget.value);
          onChange?.(event);
        }}
        {...props}
      >
        {options.map((serviceType) => (
          <option key={serviceType.id} value={serviceType.name}>
            {serviceType.name}
          </option>
        ))}
      </select>
    </div>
  );
}
