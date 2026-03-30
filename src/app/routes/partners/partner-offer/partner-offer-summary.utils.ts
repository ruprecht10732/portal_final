import { type PublicPartnerOfferResponse } from '../../../core/services/partner-offer.types';

export type ParsedOfferSummary = {
  metaLine: string;
  intro: string;
  workItems: string[];
  attentionPoints: string[];
};

type SummarySection = 'intro' | 'work' | 'attention';

const META_LINE_PATTERN = /^\*\*Omvang\*\*|^\*\*Urgentie\*\*/i;
const WORK_SECTION_PATTERN = /^#{1,6}\s*(werkzaamheden|inbegrepen|wat je gaat doen|uitvoering)/i;
const ATTENTION_SECTION_PATTERN = /^#{1,6}\s*(let op|aandachtspunten|belangrijk|inspectie|vooraf checken)/i;
const BULLET_LINE_PATTERN = /^(-|\*|\d+\.)\s+(.+)$/;

export function normalizeSummaryForPlainText(value: string): string {
  const decoded = decodeHtmlEntities(value);
  return decoded
    .replaceAll(/<[^>]*>/g, ' ')
    .replaceAll('**', '')
    .replaceAll(/^\d+\.\s+/gm, '')
    .replaceAll(/^#{1,6}\s+/gm, '')
    .replaceAll(/^\s*-\s+/gm, '')
    .replaceAll(/\n+/g, ' ')
    .replaceAll(/\s+/g, ' ')
    .trim();
}

export function parseOfferSummarySections(summary: string): ParsedOfferSummary {
  const lines = summary
    .replaceAll('\r\n', '\n')
    .replaceAll('\r', '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && line !== '---');

  const parsed: ParsedOfferSummary = {
    metaLine: '',
    intro: '',
    workItems: [],
    attentionPoints: [],
  };

  let section: SummarySection = 'intro';

  for (const line of lines) {
    if (META_LINE_PATTERN.test(line)) {
      parsed.metaLine = normalizeSummaryForPlainText(line);
      continue;
    }

    const nextSection = detectSummarySection(line);
    if (nextSection) {
      section = nextSection;
      continue;
    }

    const bulletValue = parseBulletLine(line);
    if (bulletValue) {
      section = appendSummaryItem(parsed, section, bulletValue);
      continue;
    }

    const paragraph = normalizeSummaryForPlainText(line);
    if (!paragraph) {
      continue;
    }

    section = appendSummaryParagraph(parsed, section, paragraph);
  }

  parsed.workItems = uniquePreviewItems(parsed.workItems);
  parsed.attentionPoints = uniquePreviewItems(parsed.attentionPoints);
  return parsed;
}

export function buildFallbackAttentionPoints(offer: PublicPartnerOfferResponse | null): string[] {
  if (!offer) {
    return [];
  }

  const points: string[] = [];

  if (offer.requiresInspection !== false) {
    points.push('Plan eerst een schouw of eerste opname om de situatie en bereikbaarheid goed te beoordelen.');
  }

  if ((offer.urgencyLevel || '').toLowerCase() === 'high') {
    points.push('Deze aanvraag staat als urgent gemarkeerd; snelle terugkoppeling en planning zijn waarschijnlijk belangrijk.');
  }

  if ((offer.scopeAssessment || '').toLowerCase() === 'large') {
    points.push('Houd rekening met extra afstemming over materiaal, tijdsduur of fasering omdat dit als een grotere klus is ingeschat.');
  }

  if ((offer.photos?.length || 0) > 0) {
    points.push('Bekijk de foto\'s vooraf; die geven meestal de snelste indicatie van staat, bereikbaarheid en afwerking.');
  }

  if (points.length === 0 && offer.lineItems?.length) {
    points.push('Controleer vooraf of de inbegrepen posten volledig aansluiten op wat u op locatie verwacht aan te treffen.');
  }

  return points.slice(0, 3);
}

function detectSummarySection(line: string): Exclude<SummarySection, 'intro'> | null {
  if (WORK_SECTION_PATTERN.test(line)) {
    return 'work';
  }

  if (ATTENTION_SECTION_PATTERN.test(line)) {
    return 'attention';
  }

  return null;
}

function parseBulletLine(line: string): string {
  const bulletMatch = BULLET_LINE_PATTERN.exec(line);
  if (!bulletMatch?.[2]) {
    return '';
  }

  return normalizeSummaryForPlainText(bulletMatch[2]);
}

function appendSummaryItem(
  parsed: ParsedOfferSummary,
  section: SummarySection,
  value: string,
): SummarySection {
  if (section === 'attention') {
    parsed.attentionPoints.push(value);
    return section;
  }

  parsed.workItems.push(value);
  if (section === 'intro') {
    return 'work';
  }

  return section;
}

function appendSummaryParagraph(
  parsed: ParsedOfferSummary,
  section: SummarySection,
  paragraph: string,
): SummarySection {
  if (section === 'attention') {
    parsed.attentionPoints.push(paragraph);
    return section;
  }

  if (section === 'work') {
    parsed.workItems.push(paragraph);
    return section;
  }

  if (parsed.intro) {
    parsed.workItems.push(paragraph);
    return 'work';
  }

  parsed.intro = paragraph;
  return section;
}

function uniquePreviewItems(items: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const item of items) {
    const normalizedKey = item.toLocaleLowerCase('nl-NL');
    if (seen.has(normalizedKey)) {
      continue;
    }
    seen.add(normalizedKey);
    unique.push(item);
  }

  return unique;
}

function decodeHtmlEntities(value: string): string {
  return value
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&#160;', ' ')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#34;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&apos;', "'");
}