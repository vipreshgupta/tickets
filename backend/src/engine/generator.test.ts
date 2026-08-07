import { describe, it, expect } from "vitest";
import {
  generateBook,
  generateBatch,
  validateTicket,
  validateBatch,
  getColumnRange,
  computeSignature,
  type Ticket,
} from "./generator.js";

// ─── Column Range Tests ─────────────────────────────────────────────

describe("getColumnRange", () => {
  it("column 0 contains 1–9", () => {
    const range = getColumnRange(0);
    expect(range).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("column 1 contains 10–19", () => {
    const range = getColumnRange(1);
    expect(range).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
  });

  it("column 8 contains 80–90", () => {
    const range = getColumnRange(8);
    expect(range).toEqual([80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90]);
  });

  it("throws for invalid column", () => {
    expect(() => getColumnRange(-1)).toThrow();
    expect(() => getColumnRange(9)).toThrow();
  });
});

// ─── Single Ticket Validation ───────────────────────────────────────

describe("Single Ticket Validation", () => {
  it("every ticket has exactly 15 numbers", () => {
    const book = generateBook();
    for (const ticket of book.tickets) {
      expect(ticket.numbers).toHaveLength(15);
    }
  });

  it("every ticket has 5 numbers per row", () => {
    const book = generateBook();
    for (const ticket of book.tickets) {
      for (let r = 0; r < 3; r++) {
        const filled = ticket.grid[r].filter((c) => c !== 0).length;
        expect(filled).toBe(5);
      }
    }
  });

  it("every column has 1–3 numbers (never 0, never 4+)", () => {
    const book = generateBook();
    for (const ticket of book.tickets) {
      for (let col = 0; col < 9; col++) {
        const colNums = [
          ticket.grid[0][col],
          ticket.grid[1][col],
          ticket.grid[2][col],
        ].filter((n) => n !== 0);
        expect(colNums.length).toBeGreaterThanOrEqual(1);
        expect(colNums.length).toBeLessThanOrEqual(3);
      }
    }
  });

  it("every column's numbers are within range", () => {
    const book = generateBook();
    for (const ticket of book.tickets) {
      for (let col = 0; col < 9; col++) {
        const range = getColumnRange(col);
        for (let r = 0; r < 3; r++) {
          const val = ticket.grid[r][col];
          if (val !== 0) {
            expect(range).toContain(val);
          }
        }
      }
    }
  });

  it("numbers are sorted ascending within each column", () => {
    const book = generateBook();
    for (const ticket of book.tickets) {
      for (let col = 0; col < 9; col++) {
        const colNums = [
          ticket.grid[0][col],
          ticket.grid[1][col],
          ticket.grid[2][col],
        ].filter((n) => n !== 0);
        for (let i = 1; i < colNums.length; i++) {
          expect(colNums[i]).toBeGreaterThan(colNums[i - 1]);
        }
      }
    }
  });

  it("validateTicket passes for generated tickets", () => {
    const book = generateBook();
    for (const ticket of book.tickets) {
      const result = validateTicket(ticket);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    }
  });
});

// ─── Book Validation ────────────────────────────────────────────────

describe("Book of 6", () => {
  it("generates exactly 6 tickets", () => {
    const book = generateBook();
    expect(book.tickets).toHaveLength(6);
  });

  it("uses every number 1–90 exactly once across all 6 tickets", () => {
    const book = generateBook();
    const allNumbers: number[] = [];
    for (const ticket of book.tickets) {
      allNumbers.push(...ticket.numbers);
    }
    allNumbers.sort((a, b) => a - b);
    expect(allNumbers).toHaveLength(90);

    const expected = Array.from({ length: 90 }, (_, i) => i + 1);
    expect(allNumbers).toEqual(expected);
  });

  it("all 6 tickets in a book are individually valid", () => {
    const book = generateBook();
    for (const ticket of book.tickets) {
      const result = validateTicket(ticket);
      expect(result.valid).toBe(true);
    }
  });
});

// ─── Batch Generation ───────────────────────────────────────────────

describe("Batch Generation", () => {
  it("generates exactly N tickets for batch divisible by 6", () => {
    const result = generateBatch({ quantity: 12 });
    expect(result.tickets).toHaveLength(12);
    expect(result.totalGenerated).toBe(12);
  });

  it("generates exactly N tickets for batch NOT divisible by 6", () => {
    const result = generateBatch({ quantity: 10 });
    expect(result.tickets).toHaveLength(10);
    expect(result.totalGenerated).toBe(10);
  });

  it("generates exactly N tickets for small odd batch", () => {
    const result = generateBatch({ quantity: 7 });
    expect(result.tickets).toHaveLength(7);
  });

  it("all tickets in a batch have unique signatures", () => {
    const result = generateBatch({ quantity: 30 });
    const signatures = new Set(result.tickets.map((t) => t.signature));
    expect(signatures.size).toBe(30);
  });

  it("every ticket in a batch is individually valid", () => {
    const result = generateBatch({ quantity: 24 });
    for (const ticket of result.tickets) {
      const validation = validateTicket(ticket);
      expect(validation.valid).toBe(true);
    }
  });

  it("validateBatch passes for a generated batch", () => {
    const result = generateBatch({ quantity: 18 });
    const validation = validateBatch(result.tickets);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  it("calls onProgress callback", () => {
    const progressCalls: [number, number][] = [];
    generateBatch({
      quantity: 12,
      onProgress: (generated, total) => {
        progressCalls.push([generated, total]);
      },
    });
    expect(progressCalls.length).toBeGreaterThan(0);
    expect(progressCalls[progressCalls.length - 1][0]).toBe(12);
  });

  it("handles batch of size 1", () => {
    const result = generateBatch({ quantity: 1 });
    expect(result.tickets).toHaveLength(1);
    const validation = validateTicket(result.tickets[0]);
    expect(validation.valid).toBe(true);
  });

  it("handles minimum batch of 10", () => {
    const result = generateBatch({ quantity: 10 });
    expect(result.tickets).toHaveLength(10);
    const validation = validateBatch(result.tickets);
    expect(validation.valid).toBe(true);
  });
});

// ─── Large Batch Stress Test ────────────────────────────────────────

describe("Large Batch (100 tickets)", () => {
  it("generates 100 unique valid tickets", () => {
    const result = generateBatch({ quantity: 100 });
    expect(result.tickets).toHaveLength(100);

    // All unique
    const signatures = new Set(result.tickets.map((t) => t.signature));
    expect(signatures.size).toBe(100);

    // All valid
    const validation = validateBatch(result.tickets);
    expect(validation.valid).toBe(true);
  });
});

// ─── Signature Tests ────────────────────────────────────────────────

describe("computeSignature", () => {
  it("produces the same signature regardless of input order", () => {
    const sig1 = computeSignature([5, 3, 1, 90, 45]);
    const sig2 = computeSignature([90, 1, 45, 3, 5]);
    expect(sig1).toBe(sig2);
  });

  it("produces different signatures for different number sets", () => {
    const sig1 = computeSignature([1, 2, 3]);
    const sig2 = computeSignature([1, 2, 4]);
    expect(sig1).not.toBe(sig2);
  });
});

// ─── Consistency / Repeatability ────────────────────────────────────

describe("Generation Consistency", () => {
  it("generates 10 books without failure", () => {
    for (let i = 0; i < 10; i++) {
      const book = generateBook();
      expect(book.tickets).toHaveLength(6);
      for (const ticket of book.tickets) {
        const v = validateTicket(ticket);
        expect(v.valid).toBe(true);
      }
    }
  });
});
