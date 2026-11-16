import { check } from "./server";
export async function extractDocument(bytes: ArrayBuffer, name: string) {
  check(
    bytes.byteLength <= 12 * 1024 * 1024,
    "Automatic extraction supports files up to 12 MB.",
  );
  let text = "";
  if (/\.pdf$/i.test(name)) {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    check(
      pdf.numPages <= 100,
      "Automatic extraction supports up to 100 pages.",
    );
    text = (await extractText(pdf, { mergePages: true })).text;
  } else if (/\.docx$/i.test(name)) {
    const mammoth = await import("mammoth");
    text = (await mammoth.extractRawText({ buffer: Buffer.from(bytes) })).value;
  } else if (/\.(txt|md|csv)$/i.test(name))
    text = new TextDecoder().decode(bytes);
  else return { text: "", extractionStatus: "unsupported" };
  text = text
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return {
    text: text.slice(0, 150000),
    extractionStatus: text.length < 200 ? "needs-review" : "ok",
  };
}
