import sharp from "sharp";
import PDFDocument from "pdfkit";
import archiver from "archiver";
import fs from "fs";
import path from "path";
import { config } from "../config.js";
import { generateQrBuffer } from "../utils/qr.js";

interface Zone {
  x: number;
  y: number;
  width: number;
  height: number;
  row_index: number;
  column_index: number;
  font: string;
  font_size: number;
  color: string;
  align: string;
}

interface TemplateData {
  backgroundImageUrl: string;
  zones: Zone[];
}

interface TicketRecord {
  id: string;
  ticketIndex: number;
  numbers: number[][]; // 3×9 grid
  qrSignature: string;
}

/**
 * Render all tickets as individual PNG images.
 * Each ticket is rendered onto the background image with numbers at zone positions.
 */
export async function renderTicketImages(
  tickets: TicketRecord[],
  templateData: TemplateData,
  batchId: string,
  onProgress?: (rendered: number, total: number) => Promise<void>
): Promise<string[]> {
  const outputDir = path.join(config.STORAGE_PATH, "output", batchId);
  fs.mkdirSync(outputDir, { recursive: true });

  // Load background image to get dimensions
  const bgPath = path.join(config.STORAGE_PATH, templateData.backgroundImageUrl);
  let bgBuffer: Buffer;
  let bgWidth: number;
  let bgHeight: number;

  if (fs.existsSync(bgPath)) {
    bgBuffer = fs.readFileSync(bgPath);
    const metadata = await sharp(bgBuffer).metadata();
    bgWidth = metadata.width || 800;
    bgHeight = metadata.height || 600;
  } else {
    // Create a default white background if no image
    bgWidth = 1200;
    bgHeight = 600;
    bgBuffer = await sharp({
      create: { width: bgWidth, height: bgHeight, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
    })
      .png()
      .toBuffer();
  }

  const imagePaths: string[] = [];

  for (let i = 0; i < tickets.length; i++) {
    const ticket = tickets[i];
    const filename = `ticket-${String(ticket.ticketIndex).padStart(4, "0")}.png`;
    const outputPath = path.join(outputDir, filename);

    await renderSingleTicket(
      bgBuffer,
      bgWidth,
      bgHeight,
      ticket,
      templateData.zones,
      outputPath
    );

    imagePaths.push(outputPath);

    if (onProgress && i % 10 === 0) {
      await onProgress(i + 1, tickets.length);
    }
  }

  if (onProgress) await onProgress(tickets.length, tickets.length);
  return imagePaths;
}

/**
 * Render a single ticket onto the background image.
 */
async function renderSingleTicket(
  bgBuffer: Buffer,
  bgWidth: number,
  bgHeight: number,
  ticket: TicketRecord,
  zones: Zone[],
  outputPath: string
): Promise<void> {
  const grid = ticket.numbers;

  // Build SVG overlay with numbers at zone positions
  const svgParts: string[] = [];
  svgParts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${bgWidth}" height="${bgHeight}">`
  );

  // Map zones by row and col
  const zoneMap: Map<string, Zone> = new Map();
  for (const zone of zones) {
    zoneMap.set(`${zone.row_index}-${zone.column_index}`, zone);
  }

  // Iterate exactly over the 3x9 grid
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 9; c++) {
      const num = grid[r][c];
      if (num !== 0) {
        const zone = zoneMap.get(`${r}-${c}`);
        if (zone) {
          // Convert percentage coordinates to pixels
          const x = (zone.x / 100) * bgWidth;
          const y = (zone.y / 100) * bgHeight;
          const w = (zone.width / 100) * bgWidth;
          const h = (zone.height / 100) * bgHeight;

          // Scale font size relative to zone height
          const fontSize = Math.min(zone.font_size, h * 0.8);

          // Text anchor based on alignment
          const anchor =
            zone.align === "left" ? "start" : zone.align === "right" ? "end" : "middle";
          const textX =
            zone.align === "left" ? x + 4 : zone.align === "right" ? x + w - 4 : x + w / 2;

          svgParts.push(
            `<text x="${textX}" y="${y + h / 2 + fontSize * 0.35}" ` +
            `font-family="${zone.font}, Arial, sans-serif" ` +
            `font-size="${fontSize}" ` +
            `fill="${zone.color}" ` +
            `text-anchor="${anchor}" ` +
            `font-weight="bold">${num}</text>`
          );
        }
      }
    }
  }

  svgParts.push("</svg>");
  const svgBuffer = Buffer.from(svgParts.join(""));

  // Generate QR code
  const qrBuffer = await generateQrBuffer(ticket.id);
  const qrSize = Math.round(Math.min(bgWidth, bgHeight) * 0.08); // 8% of smallest dimension
  const qrResized = await sharp(qrBuffer).resize(qrSize, qrSize).png().toBuffer();

  // Composite: background + number overlay + QR code
  await sharp(bgBuffer)
    .composite([
      { input: svgBuffer, top: 0, left: 0 },
      {
        input: qrResized,
        top: bgHeight - qrSize - 10,
        left: bgWidth - qrSize - 10,
        blend: "over",
      },
    ])
    .png({ quality: 90 })
    .toFile(outputPath);
}

/**
 * Build a multi-page PDF from ticket images.
 * Default: 4 tickets per A4 page with margins.
 */
export async function buildPdf(
  imagePaths: string[],
  batchId: string,
  onProgress?: (percentWithinPhase: number) => Promise<void>
): Promise<string> {
  const outputDir = path.join(config.STORAGE_PATH, "output", batchId);
  const pdfPath = path.join(outputDir, "tickets.pdf");
  const relativePdfPath = `output/${batchId}/tickets.pdf`;

  return new Promise<string>((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 20,
      autoFirstPage: false,
    });

    const stream = fs.createWriteStream(pdfPath);
    doc.pipe(stream);

    const TICKETS_PER_PAGE = 4;
    const pageWidth = 595.28 - 40; // A4 width minus margins
    const pageHeight = 841.89 - 40;
    const ticketWidth = pageWidth;
    const ticketHeight = (pageHeight - 30) / TICKETS_PER_PAGE; // 30px for spacing
    const spacing = 10;

    for (let i = 0; i < imagePaths.length; i++) {
      if (i % TICKETS_PER_PAGE === 0) {
        doc.addPage();

        // Add cut lines
        if (TICKETS_PER_PAGE > 1) {
          for (let j = 1; j < TICKETS_PER_PAGE && i + j < imagePaths.length; j++) {
            const y = 20 + j * (ticketHeight + spacing) - spacing / 2;
            doc
              .moveTo(10, y)
              .lineTo(585, y)
              .dash(5, { space: 5 })
              .strokeColor("#CCCCCC")
              .lineWidth(0.5)
              .stroke()
              .undash();
          }
        }
      }

      const posIndex = i % TICKETS_PER_PAGE;
      const y = 20 + posIndex * (ticketHeight + spacing);

      try {
        doc.image(imagePaths[i], 20, y, {
          width: ticketWidth,
          height: ticketHeight,
          fit: [ticketWidth, ticketHeight],
          align: "center",
          valign: "center",
        });
      } catch (err) {
        console.error(`Failed to add ticket image ${i} to PDF:`, err);
      }

      if (onProgress && i % 20 === 0) {
        onProgress(Math.round((i / imagePaths.length) * 100)).catch(() => {});
      }
    }

    doc.end();

    stream.on("finish", () => resolve(relativePdfPath));
    stream.on("error", reject);
  });
}

/**
 * Build a ZIP archive of all ticket images.
 */
export async function buildZip(
  imagePaths: string[],
  batchId: string,
  onProgress?: (percentWithinPhase: number) => Promise<void>
): Promise<string> {
  const outputDir = path.join(config.STORAGE_PATH, "output", batchId);
  const zipPath = path.join(outputDir, "tickets.zip");
  const relativeZipPath = `output/${batchId}/tickets.zip`;

  return new Promise<string>((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 6 } });

    output.on("close", () => resolve(relativeZipPath));
    archive.on("error", reject);
    archive.pipe(output);

    for (let i = 0; i < imagePaths.length; i++) {
      const filename = path.basename(imagePaths[i]);
      archive.file(imagePaths[i], { name: filename });

      if (onProgress && i % 20 === 0) {
        onProgress(Math.round((i / imagePaths.length) * 100)).catch(() => {});
      }
    }

    archive.finalize();
  });
}
