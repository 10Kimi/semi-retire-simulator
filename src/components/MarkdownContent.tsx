import ReactMarkdown from 'react-markdown'

type Props = {
  children: string
}

export default function MarkdownContent({ children }: Props) {
  return (
    <article className="text-gray-700">
      <ReactMarkdown
        components={{
          h1: ({ children }) => (
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mt-0 mb-6">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-xl md:text-2xl font-bold text-gray-800 mt-10 mb-3 pb-2 border-b border-gray-200">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-base md:text-lg font-bold text-gray-800 mt-6 mb-2">{children}</h3>
          ),
          p: ({ children }) => (
            <p className="text-sm md:text-base text-gray-700 leading-relaxed mb-4">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc list-outside pl-6 mb-4 space-y-2">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-outside pl-6 mb-4 space-y-2">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="text-sm md:text-base text-gray-700 leading-relaxed">{children}</li>
          ),
          strong: ({ children }) => <strong className="font-bold text-gray-900">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          a: ({ children, href }) => (
            <a
              href={href}
              className="text-blue-600 hover:underline"
              target={href?.startsWith('http') ? '_blank' : undefined}
              rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
            >
              {children}
            </a>
          ),
          hr: () => <hr className="my-8 border-gray-200" />,
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-gray-300 pl-4 italic text-gray-600 my-4">
              {children}
            </blockquote>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </article>
  )
}
