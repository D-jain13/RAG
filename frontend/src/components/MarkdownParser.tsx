import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownParserProps {
  content: string;
}

export function MarkdownParser({ content }: MarkdownParserProps) {
  return (
    <div className="prose-chat">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-xl font-bold mt-4 mb-2">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-lg font-semibold mt-4 mb-2">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-base font-semibold mt-4 mb-2">{children}</h3>
          ),
          p: ({ children }) => (
            <p className="my-2 leading-relaxed">{children}</p>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 underline"
            >
              {children}
            </a>
          ),
          code: ({ className, children, ...props }) => (
            <code className={`font-mono text-sm ${className ?? ""}`} {...props}>
              {children}
            </code>
          ),
          pre: ({ children }) => (
            <pre className="bg-neutral-800 text-neutral-100 p-3 rounded-lg overflow-x-auto text-sm font-mono my-3">
              {children}
            </pre>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-neutral-300 pl-4 italic text-neutral-600 my-2">
              {children}
            </blockquote>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}