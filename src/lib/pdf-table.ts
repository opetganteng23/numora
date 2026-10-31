import PDFDocument from "pdfkit";

interface Col {
  title: string;
  width: number;
}

/** Buat PDF tabel A4 lanskap dengan header berulang, nomor halaman, dan waktu cetak. */
export function tablePdf(title: string, subtitle: string, cols: Col[], rows: string[][]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 36, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const left = doc.page.margins.left;
    const bottom = () => doc.page.height - doc.page.margins.bottom - 14;
    const total = cols.reduce((a, c) => a + c.width, 0);
    const scale = (doc.page.width - left - doc.page.margins.right) / total;
    const widths = cols.map((c) => c.width * scale);

    const header = () => {
      let x = left;
      const y = doc.y;
      doc.font("Helvetica-Bold").fontSize(8.5).fillColor("#0f2a4a");
      cols.forEach((c, i) => {
        doc.text(c.title, x, y, { width: widths[i] - 6 });
        x += widths[i];
      });
      doc.moveTo(left, y + 13).lineTo(left + total * scale, y + 13).strokeColor("#9fb3c8").lineWidth(0.6).stroke();
      doc.y = y + 18;
      doc.font("Helvetica").fontSize(8).fillColor("#1b2733");
    };

    doc.font("Helvetica-Bold").fontSize(16).fillColor("#0f2a4a").text(title);
    doc.font("Helvetica").fontSize(9).fillColor("#5b6b7c").text(subtitle).moveDown(0.8);
    header();

    for (const r of rows) {
      const h = Math.max(...r.map((t, i) => doc.heightOfString(t, { width: widths[i] - 6 }))) + 6;
      if (doc.y + h > bottom()) {
        doc.addPage();
        header();
      }
      let x = left;
      const y = doc.y;
      r.forEach((t, i) => {
        doc.text(t, x, y, { width: widths[i] - 6 });
        x += widths[i];
      });
      doc.y = y + h;
    }
    if (rows.length === 0) doc.text("Tidak ada data.");

    const range = doc.bufferedPageRange();
    const stamp = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      doc.font("Helvetica").fontSize(7.5).fillColor("#5b6b7c");
      doc.text(`NUMORA | dicetak ${stamp} WIB | halaman ${i + 1} dari ${range.count}`, left, doc.page.height - doc.page.margins.bottom + 4, { width: total * scale, align: "center", lineBreak: false });
    }
    doc.end();
  });
}
