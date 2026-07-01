import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ businessId: string; documentId: string }>;
};

function safeFileName(fileName: string) {
  return fileName.replace(/[\r\n"]/g, "_");
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { businessId, documentId } = await context.params;
  const document = await prisma.businessKycDocument.findFirst({
    where: {
      id: documentId,
      businessId
    },
    select: {
      fileName: true,
      contentType: true,
      data: true
    }
  });

  if (!document) {
    return NextResponse.json({ error: "KYC document not found" }, { status: 404 });
  }

  const body = document.data.buffer.slice(
    document.data.byteOffset,
    document.data.byteOffset + document.data.byteLength
  ) as ArrayBuffer;

  return new Response(body, {
    headers: {
      "Content-Type": document.contentType,
      "Content-Disposition": `inline; filename="${safeFileName(document.fileName)}"`,
      "Cache-Control": "private, no-store"
    }
  });
}
