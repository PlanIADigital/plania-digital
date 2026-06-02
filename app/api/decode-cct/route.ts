import { NextRequest, NextResponse } from "next/server";
import { decodeCCT } from "@/lib/agents/cct-decoder";

export async function POST(request: NextRequest) {
  try {
    const { cct } = await request.json();

    if (!cct || typeof cct !== "string") {
      return NextResponse.json(
        { error: "CCT requerido" },
        { status: 400 }
      );
    }

    if (cct.trim().length !== 10) {
      return NextResponse.json(
        {
          cct: cct.trim().toUpperCase(),
          valido: false,
          error: "El CCT debe tener exactamente 10 caracteres",
        },
        { status: 200 }
      );
    }

    const result = await decodeCCT(cct);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
