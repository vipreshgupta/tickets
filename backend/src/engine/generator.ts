/**
 * Tambola (Housie / 90-ball Bingo) Ticket Generator
 *
 * Generates tickets in books of 6 — together, one book's 6 tickets
 * use every number 1–90 exactly once.
 *
 * Grid rules:
 *   - 3 rows × 9 columns, 15 filled cells, 5 per row, 4 blanks per row
 *   - Column ranges: Col 0 = 1–9, Col 1 = 10–19, …, Col 7 = 70–79, Col 8 = 80–90
 *   - Within a column, numbers sorted ascending row 1→3
 *   - Each column has 1–3 numbers (never 0, never 4+)
 *
 * Algorithm overview:
 *   1. Generate a 6×9 "allocation matrix" — how many numbers each ticket
 *      gets from each column. Row sums = 15, column sums = column sizes.
 *      Uses a valid base matrix + row shuffling + rectangular swaps.
 *   2. Shuffle each column's numbers, then slice them according to the matrix.
 *   3. For each ticket, place numbers into a 3×9 grid via backtracking
 *      so that each row has exactly 5 filled cells.
 */

// ─── Types ──────────────────────────────────────────────────────────

export type TicketGrid = number[][];

export interface Ticket {
  grid: TicketGrid;
  numbers: number[];
  signature: string;
}

export interface Book {
  tickets: Ticket[];
}

export interface BatchResult {
  tickets: Ticket[];
  totalGenerated: number;
  booksGenerated: number;
  duplicatesDiscarded: number;
}

// ─── Constants ──────────────────────────────────────────────────────

/** Column sizes: col0=9, col1-7=10 each, col8=11 → total=90 */
const COLUMN_SIZES = [9, 10, 10, 10, 10, 10, 10, 10, 11];

/**
 * A known valid allocation matrix.
 * Row sums = 15, column sums = [9, 10, 10, 10, 10, 10, 10, 10, 11].
 * Rectangular swaps will introduce variety (including 3s).
 */
const BASE_ALLOCATION: number[][] = [
  [1, 2, 2, 2, 1, 2, 2, 1, 2], // sum = 15
  [2, 2, 1, 1, 2, 2, 1, 2, 2], // sum = 15
  [1, 1, 2, 2, 2, 2, 2, 2, 1], // sum = 15
  [2, 2, 2, 1, 2, 1, 1, 2, 2], // sum = 15
  [2, 1, 2, 2, 1, 2, 2, 1, 2], // sum = 15
  [1, 2, 1, 2, 2, 1, 2, 2, 2], // sum = 15
];

// ─── Utility ────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function computeSignature(numbers: number[]): string {
  return [...numbers].sort((a, b) => a - b).join(",");
}

export function getColumnRange(col: number): number[] {
  if (col < 0 || col > 8) throw new Error(`Invalid column index: ${col}`);
  if (col === 0) return [1, 2, 3, 4, 5, 6, 7, 8, 9];
  if (col === 8) return [80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90];
  const start = col * 10;
  return Array.from({ length: 10 }, (_, i) => start + i);
}

// ─── Allocation Matrix ─────────────────────────────────────────────

/**
 * Generate a randomized allocation matrix by:
 * 1. Deep-copying the base matrix
 * 2. Shuffling rows (preserves both row and column sums)
 * 3. Performing rectangular swaps (+1/-1 on a 2×2 sub-matrix)
 *    which also preserve row and column sums, while introducing
 *    values of 3 and more variety.
 */
function generateAllocationMatrix(): number[][] {
  // Deep copy and shuffle rows
  const matrix = shuffle(BASE_ALLOCATION.map((row) => [...row]));

  // Perform many rectangular swaps for variety
  const SWAP_ITERATIONS = 200;
  for (let i = 0; i < SWAP_ITERATIONS; i++) {
    const r1 = Math.floor(Math.random() * 6);
    let r2 = Math.floor(Math.random() * 5);
    if (r2 >= r1) r2++; // Ensure r2 ≠ r1

    const c1 = Math.floor(Math.random() * 9);
    let c2 = Math.floor(Math.random() * 8);
    if (c2 >= c1) c2++; // Ensure c2 ≠ c1

    // Try +1/-1 rectangular swap
    const delta = Math.random() < 0.5 ? 1 : -1;
    const a = matrix[r1][c1] + delta;
    const b = matrix[r1][c2] - delta;
    const c = matrix[r2][c1] - delta;
    const d = matrix[r2][c2] + delta;

    if (a >= 1 && a <= 3 && b >= 1 && b <= 3 && c >= 1 && c <= 3 && d >= 1 && d <= 3) {
      matrix[r1][c1] = a;
      matrix[r1][c2] = b;
      matrix[r2][c1] = c;
      matrix[r2][c2] = d;
    }
  }

  return matrix;
}

// ─── Grid Building ──────────────────────────────────────────────────

/**
 * Build a 3×9 grid for one ticket given its column data.
 * Uses backtracking to ensure exactly 5 filled cells per row.
 */
function buildGrid(
  colData: { col: number; nums: number[] }[]
): TicketGrid | null {
  const grid: TicketGrid = [Array(9).fill(0), Array(9).fill(0), Array(9).fill(0)];
  const rowCounts = [0, 0, 0];

  // Separate by count
  const threeCols: typeof colData = [];
  const twoCols: typeof colData = [];
  const oneCols: typeof colData = [];

  for (const cd of colData) {
    if (cd.nums.length === 3) threeCols.push(cd);
    else if (cd.nums.length === 2) twoCols.push(cd);
    else if (cd.nums.length === 1) oneCols.push(cd);
  }

  // 3-number columns: all rows filled, no choice
  for (const { col, nums } of threeCols) {
    grid[0][col] = nums[0];
    grid[1][col] = nums[1];
    grid[2][col] = nums[2];
    rowCounts[0]++;
    rowCounts[1]++;
    rowCounts[2]++;
  }

  if (rowCounts.some((c) => c > 5)) return null;

  // Backtrack 2-col then 1-col
  shuffle(twoCols);
  shuffle(oneCols);

  if (!assignRows(rowCounts, twoCols, 0, oneCols, 0, grid)) return null;
  return grid;
}

function assignRows(
  rowCounts: number[],
  twoCols: { col: number; nums: number[] }[],
  twoIdx: number,
  oneCols: { col: number; nums: number[] }[],
  oneIdx: number,
  grid: TicketGrid
): boolean {
  if (twoIdx < twoCols.length) {
    const { col, nums } = twoCols[twoIdx];
    const pairs: [number, number][] = shuffle([[0, 1], [0, 2], [1, 2]] as [number, number][]);

    for (const [r1, r2] of pairs) {
      if (rowCounts[r1] < 5 && rowCounts[r2] < 5) {
        grid[r1][col] = nums[0];
        grid[r2][col] = nums[1];
        rowCounts[r1]++;
        rowCounts[r2]++;

        if (assignRows(rowCounts, twoCols, twoIdx + 1, oneCols, oneIdx, grid)) return true;

        grid[r1][col] = 0;
        grid[r2][col] = 0;
        rowCounts[r1]--;
        rowCounts[r2]--;
      }
    }
    return false;
  }

  if (oneIdx < oneCols.length) {
    const { col, nums } = oneCols[oneIdx];
    const rows = shuffle([0, 1, 2]);

    for (const r of rows) {
      if (rowCounts[r] < 5) {
        grid[r][col] = nums[0];
        rowCounts[r]++;

        if (assignRows(rowCounts, twoCols, twoIdx, oneCols, oneIdx + 1, grid)) return true;

        grid[r][col] = 0;
        rowCounts[r]--;
      }
    }
    return false;
  }

  return rowCounts[0] === 5 && rowCounts[1] === 5 && rowCounts[2] === 5;
}

function extractNumbers(grid: TicketGrid): number[] {
  const nums: number[] = [];
  for (const row of grid) for (const cell of row) if (cell !== 0) nums.push(cell);
  return nums.sort((a, b) => a - b);
}

// ─── Book Generation ────────────────────────────────────────────────

export function generateBook(): Book {
  const MAX_ATTEMPTS = 100;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const result = tryGenerateBook();
    if (result) return result;
  }
  throw new Error("Failed to generate a valid book after maximum attempts");
}

function tryGenerateBook(): Book | null {
  // Step 1: Allocation matrix
  const allocation = generateAllocationMatrix();

  // Step 2: Shuffle each column's numbers
  const columnNumbers: number[][] = [];
  for (let col = 0; col < 9; col++) {
    columnNumbers.push(shuffle([...getColumnRange(col)]));
  }

  // Step 3: Build each ticket
  const tickets: Ticket[] = [];
  const columnPointers = Array(9).fill(0);

  for (let t = 0; t < 6; t++) {
    const colData: { col: number; nums: number[] }[] = [];

    for (let col = 0; col < 9; col++) {
      const count = allocation[t][col];
      const nums = columnNumbers[col]
        .slice(columnPointers[col], columnPointers[col] + count)
        .sort((a, b) => a - b);
      columnPointers[col] += count;
      colData.push({ col, nums });
    }

    const grid = buildGrid(colData);
    if (!grid) return null;

    const numbers = extractNumbers(grid);
    tickets.push({
      grid,
      numbers,
      signature: computeSignature(numbers),
    });
  }

  return { tickets };
}

// ─── Batch Generation ───────────────────────────────────────────────

export interface BatchOptions {
  quantity: number;
  onProgress?: (generated: number, total: number) => void;
}

export function generateBatch(options: BatchOptions): BatchResult {
  const { quantity, onProgress } = options;

  if (quantity < 1 || quantity > 10000) {
    throw new Error(`Invalid quantity: ${quantity}. Must be 1–10000.`);
  }

  const signatures = new Set<string>();
  const tickets: Ticket[] = [];
  let duplicatesDiscarded = 0;
  let booksGenerated = 0;

  const fullBooks = Math.floor(quantity / 6);
  const remainder = quantity % 6;

  for (let b = 0; b < fullBooks; b++) {
    const bookResult = generateBookWithUniqueness(signatures);
    booksGenerated++;
    for (const ticket of bookResult.tickets) {
      tickets.push(ticket);
      signatures.add(ticket.signature);
    }
    duplicatesDiscarded += bookResult.duplicatesDiscarded;
    onProgress?.(tickets.length, quantity);
  }

  if (remainder > 0) {
    const bookResult = generateBookWithUniqueness(signatures);
    booksGenerated++;
    for (let i = 0; i < remainder; i++) {
      tickets.push(bookResult.tickets[i]);
      signatures.add(bookResult.tickets[i].signature);
    }
    duplicatesDiscarded += bookResult.duplicatesDiscarded;
    onProgress?.(tickets.length, quantity);
  }

  return { tickets, totalGenerated: tickets.length, booksGenerated, duplicatesDiscarded };
}

function generateBookWithUniqueness(
  existingSignatures: Set<string>
): { tickets: Ticket[]; duplicatesDiscarded: number } {
  const MAX_RETRIES = 100;
  let duplicatesDiscarded = 0;

  for (let retry = 0; retry < MAX_RETRIES; retry++) {
    const book = generateBook();
    const collisions = book.tickets.filter((t) => existingSignatures.has(t.signature));

    if (collisions.length === 0) {
      return { tickets: book.tickets, duplicatesDiscarded };
    }
    duplicatesDiscarded += collisions.length;
  }
  throw new Error("Failed to generate a unique book after maximum retries");
}

// ─── Validation ─────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateTicket(ticket: Ticket): ValidationResult {
  const errors: string[] = [];
  const { grid } = ticket;

  if (grid.length !== 3) {
    errors.push(`Grid must have 3 rows, has ${grid.length}`);
    return { valid: false, errors };
  }

  for (let r = 0; r < 3; r++) {
    if (grid[r].length !== 9) errors.push(`Row ${r} must have 9 columns, has ${grid[r].length}`);
  }

  const allNumbers = extractNumbers(grid);
  if (allNumbers.length !== 15) errors.push(`Must have 15 numbers, has ${allNumbers.length}`);

  for (let r = 0; r < 3; r++) {
    const filled = grid[r].filter((c: number) => c !== 0).length;
    if (filled !== 5) errors.push(`Row ${r} must have 5 filled cells, has ${filled}`);
  }

  for (let col = 0; col < 9; col++) {
    const colNums: number[] = [];
    for (let r = 0; r < 3; r++) if (grid[r][col] !== 0) colNums.push(grid[r][col]);

    if (colNums.length > 3) errors.push(`Column ${col} has ${colNums.length} numbers (max 3)`);

    const range = getColumnRange(col);
    for (const n of colNums) {
      if (!range.includes(n)) {
        errors.push(`Number ${n} in column ${col} is out of range [${range[0]}–${range[range.length - 1]}]`);
      }
    }

    for (let i = 1; i < colNums.length; i++) {
      if (colNums[i] <= colNums[i - 1]) {
        errors.push(`Column ${col}: not sorted ascending (${colNums.join(", ")})`);
        break;
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validateBatch(tickets: Ticket[]): ValidationResult {
  const errors: string[] = [];
  const signatures = new Set<string>();

  for (let i = 0; i < tickets.length; i++) {
    const result = validateTicket(tickets[i]);
    if (!result.valid) errors.push(`Ticket ${i}: ${result.errors.join("; ")}`);
    if (signatures.has(tickets[i].signature)) errors.push(`Ticket ${i}: duplicate signature`);
    signatures.add(tickets[i].signature);
  }

  return { valid: errors.length === 0, errors };
}
