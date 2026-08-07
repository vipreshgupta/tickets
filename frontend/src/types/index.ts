export interface User {
  id: string;
  email: string;
  name: string | null;
}

export interface Zone {
  x: number;
  y: number;
  width: number;
  height: number;
  row_index: number;
  column_index: number;
  font: string;
  font_size: number;
  color: string;
  align: "left" | "center" | "right";
}

export interface Template {
  id: string;
  name: string;
  backgroundImageUrl: string;
  zones: Zone[];
  createdAt: string;
}

export interface Batch {
  id: string;
  status: string;
  progressPercent: number;
  quantity: number;
  pdfUrl: string | null;
  zipUrl: string | null;
  errorReason: string | null;
  createdAt: string;
  expiresAt: string;
}

export interface TicketVerification {
  verified: boolean;
  message: string;
  ticket?: {
    id: string;
    ticket_index: number;
    numbers: number[][];
    batch_id: string;
    batch_created_at: string;
    batch_size: number;
  };
}

/** Default grid zones for a full 3×9 Tambola grid (27 cells) */
export function getDefaultGridZones(canvasWidth: number, canvasHeight: number): Zone[] {
  const zones: Zone[] = [];
  const cellWidth = canvasWidth / 9;
  const cellHeight = canvasHeight / 3;

  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 9; col++) {
      zones.push({
        x: col * cellWidth,
        y: row * cellHeight,
        width: cellWidth,
        height: cellHeight,
        row_index: row,
        column_index: col,
        font: "Arial",
        font_size: Math.min(32, cellHeight * 0.6),
        color: "#000000",
        align: "center",
      });
    }
  }

  return zones;
}
