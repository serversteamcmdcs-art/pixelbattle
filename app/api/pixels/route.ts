import { NextRequest, NextResponse } from "next/server";
import { Server } from "socket.io";
import { createServer } from "http";

// In-memory хранилище (для продакшена → Prisma)
let pixels = new Map<string, any>();

// Mock Socket.io (в реальном проекте вынеси в custom server)
const httpServer = createServer();
const io = new Server(httpServer, { path: "/api/socket" });

export async function GET() {
  return NextResponse.json(Array.from(pixels.values()));
}

export async function POST(req: NextRequest) {
  const { x, y, color, username } = await req.json();
  const key = `${x},${y}`;
  const pixel = { x, y, color, username, timestamp: Date.now() };
  pixels.set(key, pixel);

  // Рассылка всем
  io.emit("pixel-placed", pixel);

  return NextResponse.json({ success: true });
}