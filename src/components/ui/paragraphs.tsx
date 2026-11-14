import { cn } from '@/lib/cn';
import { splitParagraphs } from '@/lib/format';

interface ParagraphsProps {
  /**
   * Rendered inside the last paragraph, after a space (the inline "Less"
   * toggle).
   */
  after?: React.ReactNode;
  className?: string;
  text: string;
}

/**
 * Plain text as real paragraphs: a blank line starts a new `<p>`, a single line
 * break stays visible. Never parses HTML or Markdown.
 */
export function Paragraphs({ text, className, after }: ParagraphsProps): null | React.JSX.Element {
  const paragraphs = splitParagraphs(text);

  if (paragraphs.length === 0) return null;

  return (
    <div className={cn('space-y-3', className)}>
      {paragraphs.map((paragraph, index) => (
        // Static text: paragraphs can repeat and never reorder, so the index is the stable key.
        // eslint-disable-next-line @eslint-react/no-array-index-key
        <p key={index} className="whitespace-pre-line">
          {paragraph}
          {after && index === paragraphs.length - 1 ? <> {after}</> : null}
        </p>
      ))}
    </div>
  );
}
