// Perilla 12 — in-memory spreadsheet fixtures for the reader/writer tests.
//
// Fixtures are generated at test time (no binary files in the repo, per
// docs/release/artifact-minimalism-policy.md). exceljs builds the benign
// workbooks; jszip crafts the hostile archives (macro / external-link / OLE
// / zip-bomb variants) by mutating a valid workbook's entries.

import ExcelJS from "exceljs";
import JSZip from "jszip";

export type SheetSpec = {
  name: string;
  /** Cell values per row; exceljs cell values (strings, numbers, dates, formula objects…). */
  rows: ExcelJS.CellValue[][];
};

export async function buildWorkbookBuffer(sheets: SheetSpec[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  for (const sheet of sheets) {
    const worksheet = workbook.addWorksheet(sheet.name);
    for (const row of sheet.rows) worksheet.addRow(row);
  }
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer as ArrayBuffer);
}

export async function buildSingleSheetBuffer(name = "Sheet1", rows: ExcelJS.CellValue[][] = [["a", "b"]]): Promise<Buffer> {
  return buildWorkbookBuffer([{ name, rows }]);
}

/** Clone a valid workbook archive and add an extra zip entry. */
export async function withExtraZipEntry(workbookBuffer: Buffer, entryName: string, content: string | Buffer): Promise<Buffer> {
  const zip = await JSZip.loadAsync(workbookBuffer);
  zip.file(entryName, content);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

/**
 * A zip that self-identifies as a workbook but declares a huge decompressed
 * worksheet — highly compressible, so the file itself stays tiny.
 */
export async function buildDecompressionBombBuffer(declaredBytes: number): Promise<Buffer> {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", "<Types/>");
  zip.file("xl/workbook.xml", "<workbook/>");
  zip.file("xl/worksheets/sheet1.xml", Buffer.alloc(declaredBytes, 0x20));
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

/** A structurally valid zip that claims to be a workbook but carries garbage XML. */
export async function buildGarbageWorkbookBuffer(marker: string): Promise<Buffer> {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", "<Types/>");
  zip.file("xl/workbook.xml", `not-xml-at-all ${marker}`);
  zip.file("xl/worksheets/sheet1.xml", `<<<broken ${marker}`);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
