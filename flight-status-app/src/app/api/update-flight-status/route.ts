import { NextResponse } from "next/server";
import { updateFlightStatus } from "@/lib/api";

export async function POST(request: Request) {
  const body = await request.json();
  try {
    const result = await updateFlightStatus(body);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update flight status" },
      { status: 500 }
    );
  }
}