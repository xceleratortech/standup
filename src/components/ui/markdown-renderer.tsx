'use client';

import { useMemo, useEffect, useState } from 'react';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeSanitize from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import * as React from 'react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  const [html, setHtml] = useState<string>('');

  useEffect(() => {
    const processMarkdown = async () => {
      const processor = unified()
        .use(remarkParse) // Parse markdown content
        .use(remarkRehype) // Convert to HTML AST
        .use(rehypeSanitize) // Sanitize HTML content
        .use(rehypeStringify); // Convert to HTML string

      const file = await processor.process(content);
      setHtml(String(file));
    };

    processMarkdown();
  }, [content]);

  return (
    <div
      className={`prose-sm prose dark:prose-invert max-w-none ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
