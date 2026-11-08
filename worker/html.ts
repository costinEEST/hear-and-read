import { decodeHTML, decodeHTMLAttribute } from "entities";

export interface HtmlRecord {
  tag: string;
  attributes: Record<string, string>;
  text: string;
  start: number;
  end: number;
  excluded: boolean;
}
interface Group {
  selector: string;
  exclude?: string;
}
const VOID = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);
const CLOSES_P = new Set([
  "address",
  "article",
  "aside",
  "blockquote",
  "div",
  "dl",
  "fieldset",
  "footer",
  "form",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "hgroup",
  "hr",
  "main",
  "menu",
  "nav",
  "ol",
  "p",
  "pre",
  "section",
  "table",
  "ul",
]);

export const normalize = (text: string) => text.replace(/\s+/gu, " ").trim();
export const inside = (record: HtmlRecord, root: HtmlRecord) =>
  record.start > root.start && record.start < root.end;

/** Native selectors collect only extraction records, never a browser DOM or scripts.
 * Text callbacks can split entities/chunks; decode only after concatenation.
 */
export async function scanHtml<T extends string>(
  html: string,
  noise: string,
  groups: Record<T, Group>,
): Promise<Record<T, HtmlRecord[]>> {
  const cleaned = new HTMLRewriter()
    .on(noise, {
      element(element) {
        element.remove();
      },
    })
    .transform(new Response(html));
  // Removal must finish before extraction; removed descendants still receive callbacks
  // in the same rewriter. The input is already bounded by the HTTP layer.
  const input = await cleaned.text();
  const result = {} as Record<T, HtmlRecord[]>;
  let position = 0,
    listDepth = 0;
  const activeGroups: Set<HtmlRecord>[] = [];
  const listScopes = new WeakMap<HtmlRecord, number>();
  const close = (active: Set<HtmlRecord>, record: HtmlRecord) => {
    if (active.delete(record)) record.end = position;
  };
  const rewriter = new HTMLRewriter().on("*", {
    element(element) {
      position++;
      // HTMLRewriter does not synthesize every omitted closing tag. Close the
      // relevant extraction records at HTML's paragraph/list/heading boundaries.
      for (const active of activeGroups)
        for (const record of active) {
          if (
            (record.tag === "p" && CLOSES_P.has(element.tagName)) ||
            (record.tag === "li" &&
              element.tagName === "li" &&
              listScopes.get(record) === listDepth) ||
            (/^h[1-6]$/u.test(record.tag) && /^h[1-6]$/u.test(element.tagName))
          )
            close(active, record);
        }
      if (["ol", "ul"].includes(element.tagName)) {
        listDepth++;
        element.onEndTag(() => {
          for (const active of activeGroups)
            for (const record of active) {
              if (record.tag === "li" && listScopes.get(record) === listDepth)
                close(active, record);
            }
          listDepth--;
        });
      }
    },
  });
  for (const key of Object.keys(groups) as T[]) {
    const records: HtmlRecord[] = [];
    result[key] = records;
    const active = new Set<HtmlRecord>();
    activeGroups.push(active);
    rewriter.on(groups[key].selector, {
      element(element) {
        const attributes = Object.fromEntries(
          Array.from(element.attributes, ([name, value]) => [
            name,
            decodeHTMLAttribute(value),
          ]),
        );
        const record: HtmlRecord = {
          tag: element.tagName,
          attributes,
          text: "",
          start: position,
          end: Infinity,
          excluded: false,
        };
        records.push(record);
        listScopes.set(record, listDepth);
        if (VOID.has(element.tagName)) record.end = position;
        else {
          active.add(record);
          element.onEndTag(() => {
            if (active.delete(record)) record.end = position + 0.5;
          });
        }
      },
      text(chunk) {
        for (const record of active) record.text += chunk.text;
      },
    });
    if (groups[key].exclude)
      rewriter.on(groups[key].exclude!, {
        element() {
          const record = records.at(-1);
          if (record?.start === position) record.excluded = true;
        },
      });
  }
  await rewriter.transform(new Response(input)).arrayBuffer();
  for (const records of Object.values(result) as HtmlRecord[][]) {
    for (const record of records)
      record.text = normalize(decodeHTML(record.text));
  }
  return result;
}
