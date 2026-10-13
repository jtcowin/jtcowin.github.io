/**
 * Copy emphasis for the Technical Product Marketing page (Version 1.3).
 *
 * The approved copy stays word for word in tpm.json; a paragraph or headline
 * names, beside it, the one phrase that carries emphasis, and this splits the
 * text around it. At most one phrase per paragraph, and the phrase has to be
 * there exactly once, so a copy change can never leave a stray emphasis or
 * silently drop one: the build stops instead.
 */
export interface Part {
  text: string;
  em: boolean;
}

export function emphasize(text: string, phrase: string | null | undefined, where = 'copy'): Part[] {
  if (!phrase) return [{ text, em: false }];
  const at = text.indexOf(phrase);
  if (at < 0 || text.indexOf(phrase, at + 1) >= 0) {
    throw new Error(`[tpm] the emphasis "${phrase}" must appear exactly once in the ${where}`);
  }
  return [
    { text: text.slice(0, at), em: false },
    { text: phrase, em: true },
    { text: text.slice(at + phrase.length), em: false },
  ].filter((p) => p.text);
}
