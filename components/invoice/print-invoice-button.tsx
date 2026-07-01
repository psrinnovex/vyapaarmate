"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintInvoiceButton() {
  return (
    <Button variant="secondary" icon={<Printer className="size-4" />} onClick={() => window.print()}>
      Print / Save Invoice
    </Button>
  );
}
