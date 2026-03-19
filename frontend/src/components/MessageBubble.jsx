import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { formatCost, formatDate } from '../utils/formatters';

function MessageBubble({ message, index, expandedTypes, activeTypeFilters, hideMetadata, toolResults = [] }) {
  // Per-block overrides: Map<blockId, boolean>
  // When a type's expand state changes, overrides are cleared
  const [blockOverrides, setBlockOverrides] = useState(new Map());
  const prevTypesRef = useRef(expandedTypes);

  // Clear per-block overrides when type-level state changes
  useEffect(() => {
    const prev = JSON.stringify(prevTypesRef.current);
    const curr = JSON.stringify(expandedTypes);
    if (prev !== curr) {
      prevTypesRef.current = expandedTypes;
      setBlockOverrides(new Map());
    }
  }, [expandedTypes]);

  if (!message) return null;

  const toggleBlock = (blockId, typeKey) => {
    const newOverrides = new Map(blockOverrides);
    if (newOverrides.has(blockId)) {
      // Remove override → go back to type default
      newOverrides.delete(blockId);
    } else {
      // Set override to opposite of type default
      const typeDefault = expandedTypes.includes(typeKey);
      newOverrides.set(blockId, !typeDefault);
    }
    setBlockOverrides(newOverrides);
  };

  // Block is expanded if: override says so, or type default says so
  const isBlockExpanded = (blockId, typeKey) => {
    if (blockOverrides.has(blockId)) return blockOverrides.get(blockId);
    return expandedTypes.includes(typeKey);
  };

  // Check if a content type is visible given active filters
  const isContentVisible = (type) => {
    if (activeTypeFilters.length === 0) return true;
    return activeTypeFilters.includes(type);
  };

  // User message
  if (message.role === 'user') {
    const content = Array.isArray(message.content) ? message.content : [{ type: 'text', text: message.content }];
    const textParts = content.filter(c => c.type === 'text');
    const imageParts = content.filter(c => c.type === 'image');
    const textContent = textParts.map(c => c.text).join('\n') || '';

    return (
      <div className="flex justify-end animate-fade-in">
        <div className="max-w-[80%] bg-blue-600/20 border border-blue-500/30 rounded-lg p-4">
          {imageParts.length > 0 && (
            <div className={`flex flex-wrap gap-2 ${textContent ? 'mb-3' : ''}`}>
              {imageParts.map((img, idx) => (
                <ImageBlock key={idx} data={img.data} mimeType={img.mimeType} />
              ))}
            </div>
          )}
          {textContent && (
            <div className="text-sm text-white whitespace-pre-wrap break-words">
              <Markdown text={textContent} />
            </div>
          )}
          {message.timestamp && (
            <div className="text-xs text-gray-500 mt-2">
              {formatDate(message.timestamp)}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Assistant message
  if (message.role === 'assistant') {
    const content = Array.isArray(message.content) ? message.content : [];
    const thinkingParts = content.filter(c => c.type === 'thinking');
    const textParts = content.filter(c => c.type === 'text');
    const toolCalls = content.filter(c => c.type === 'toolCall');

    const showThinking = isContentVisible('thinking');
    const showText = isContentVisible('assistant');
    const showTools = isContentVisible('tools');

    // If nothing to show, skip
    const hasVisibleContent = 
      (showThinking && thinkingParts.length > 0) ||
      (showText && textParts.length > 0) ||
      (showTools && toolCalls.length > 0) ||
      (message.model || message.usage); // always show metadata if it exists
    
    if (!hasVisibleContent && activeTypeFilters.length > 0) return null;

    return (
      <div className="flex justify-start animate-fade-in min-w-0">
        <div className="max-w-[90%] min-w-0 space-y-2">
          {/* Thinking blocks */}
          {showThinking && thinkingParts.map((thinking, idx) => {
            const blockId = `thinking-${index}-${idx}`;
            const expanded = isBlockExpanded(blockId, 'thinking');
            return (
              <CollapsibleBlock
                key={`t-${idx}`}
                title="💭 Thinking"
                isCollapsed={!expanded}
                onToggle={() => toggleBlock(blockId, 'thinking')}
                color="purple"
              >
                <div className="text-sm text-purple-200 whitespace-pre-wrap font-mono">
                  {thinking.thinking}
                </div>
              </CollapsibleBlock>
            );
          })}

          {/* Text content */}
          {showText && textParts.map((text, idx) => (
            <div key={`txt-${idx}`} className="bg-bg-tertiary border border-white/10 rounded-lg p-4">
              <div className="text-sm text-gray-200 whitespace-pre-wrap break-words prose prose-invert max-w-none">
                <Markdown text={text.text} />
              </div>
            </div>
          ))}

          {/* Tool calls — paired with results */}
          {showTools && toolCalls.map((toolCall, idx) => {
            const blockId = `tool-${index}-${idx}`;
            const expanded = isBlockExpanded(blockId, 'tools');
            let argsObject;
            try {
              argsObject = typeof toolCall.arguments === 'string'
                ? JSON.parse(toolCall.arguments)
                : toolCall.arguments;
            } catch (e) {
              argsObject = { error: 'Failed to parse arguments', raw: toolCall.arguments };
            }
            // Find matching tool result
            const matchingResult = toolResults.find(r => r.toolCallId === toolCall.id);
            const resultContent = matchingResult
              ? (Array.isArray(matchingResult.content) ? matchingResult.content.map(c => c.text || '').join('\n') : '')
              : null;
            const isError = matchingResult?.isError;

            return (
              <CollapsibleBlock
                key={`tc-${idx}`}
                title={`🔧 ${toolCall.name}`}
                subtitle={toolCall.id}
                isCollapsed={!expanded}
                onToggle={() => toggleBlock(blockId, 'tools')}
                color={isError ? 'red' : 'teal'}
              >
                <div className="space-y-2">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1 font-medium">Input</div>
                    <CodeBlock
                      code={JSON.stringify(argsObject, null, 2)}
                      language="json"
                    />
                  </div>
                  {resultContent != null && (
                    <div>
                      <div className={`text-[10px] uppercase tracking-wider mb-1 font-medium ${isError ? 'text-red-400' : 'text-gray-500'}`}>
                        {isError ? 'Error' : 'Output'}
                      </div>
                      <pre className="text-xs text-gray-300 whitespace-pre-wrap break-all font-mono bg-black/30 p-3 rounded max-h-96 overflow-y-auto">
                        {resultContent || '(empty result)'}
                      </pre>
                    </div>
                  )}
                </div>
              </CollapsibleBlock>
            );
          })}

          {/* Metadata (hidden when step header already shows it) */}
          {!hideMetadata && (message.model || message.usage) && (
            <div className="flex items-center gap-3 text-xs text-gray-500 px-2 flex-wrap">
              {message.model && (
                <span className="font-mono">{message.model.split('/').pop()}</span>
              )}
              {message.usage && (
                <>
                  {message.usage.input != null && (
                    <span>📥 {message.usage.input.toLocaleString()}</span>
                  )}
                  {message.usage.output != null && (
                    <span>📤 {message.usage.output.toLocaleString()}</span>
                  )}
                  {message.usage.cost?.total != null && (
                    <span className="text-green-400">{formatCost(message.usage.cost.total)}</span>
                  )}
                </>
              )}
              {message.stopReason && (
                <span className="text-gray-600">• {message.stopReason}</span>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Tool result
  if (message.role === 'toolResult') {
    const blockId = `result-${index}`;
    const expanded = isBlockExpanded(blockId, 'tools');
    const content = Array.isArray(message.content) ? message.content : [];
    const textContent = content.map(c => c.text || '').join('\n');

    return (
      <div className="flex justify-start animate-fade-in min-w-0">
        <div className="max-w-[90%] min-w-0">
          <CollapsibleBlock
            title={`📦 ${message.toolName || 'Tool Result'}`}
            subtitle={message.toolCallId}
            isCollapsed={!expanded}
            onToggle={() => toggleBlock(blockId, 'tools')}
            color={message.isError ? 'red' : 'gray'}
          >
            <pre className="text-xs text-gray-300 whitespace-pre-wrap break-all font-mono bg-black/30 p-3 rounded">
              {textContent || '(empty result)'}
            </pre>
          </CollapsibleBlock>
        </div>
      </div>
    );
  }

  return null;
}

function CollapsibleBlock({ title, subtitle, children, isCollapsed, onToggle, color = 'gray' }) {
  const colors = {
    purple: 'bg-purple-500/10 border-purple-500/30 text-purple-400',
    teal: 'bg-teal-500/10 border-teal-500/30 text-teal-400',
    red: 'bg-red-500/10 border-red-500/30 text-red-400',
    gray: 'bg-gray-500/10 border-gray-500/30 text-gray-400',
  };

  return (
    <div className={`rounded-lg border ${colors[color]} overflow-hidden`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2 text-left min-w-0">
          <span className="text-sm font-medium flex-shrink-0">{title}</span>
          {subtitle && <span className="text-xs opacity-70 font-mono truncate">{subtitle}</span>}
        </div>
        <svg
          className={`w-4 h-4 transition-transform flex-shrink-0 ml-2 ${isCollapsed ? '' : 'rotate-180'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {!isCollapsed && (
        <div className="p-3 border-t border-current/20 overflow-hidden min-w-0">
          {children}
        </div>
      )}
    </div>
  );
}

function CodeBlock({ code, language = 'javascript' }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group overflow-hidden">
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 px-2 py-1 bg-bg-quaternary hover:bg-bg-tertiary rounded text-xs text-gray-400 hover:text-white transition-all opacity-0 group-hover:opacity-100 z-10"
      >
        {copied ? '✓ Copied' : 'Copy'}
      </button>
      <SyntaxHighlighter
        language={language}
        style={vscDarkPlus}
        wrapLongLines={true}
        customStyle={{
          margin: 0,
          borderRadius: '0.5rem',
          fontSize: '0.75rem',
          background: 'rgba(0, 0, 0, 0.3)',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
          overflowWrap: 'break-word',
        }}
        codeTagProps={{
          style: {
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            overflowWrap: 'break-word',
          },
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

function ImageBlock({ data, mimeType }) {
  const [lightbox, setLightbox] = useState(false);
  const src = `data:${mimeType || 'image/png'};base64,${data}`;

  return (
    <>
      <button
        onClick={() => setLightbox(true)}
        className="block rounded-lg overflow-hidden border border-white/10 hover:border-white/30 transition-colors cursor-zoom-in group"
      >
        <img
          src={src}
          alt="Attached image"
          className="max-h-48 max-w-full object-contain group-hover:brightness-110 transition-all"
          loading="lazy"
        />
      </button>
      {lightbox && <ImageLightbox src={src} onClose={() => setLightbox(false)} />}
    </>
  );
}

function ImageLightbox({ src, onClose }) {
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm cursor-zoom-out"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/70 hover:text-white bg-black/50 rounded-full w-10 h-10 flex items-center justify-center text-xl transition-colors z-10"
      >
        ✕
      </button>
      <img
        src={src}
        alt="Full size image"
        className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>,
    document.body
  );
}

function Markdown({ text }) {
  if (!text) return null;

  const parts = text.split(/(```[\s\S]*?```|`[^`]+`)/g);

  return parts.map((part, idx) => {
    if (part.startsWith('```')) {
      const match = part.match(/```(\w+)?\n?([\s\S]*?)```/);
      if (match) {
        const language = match[1] || 'text';
        const code = match[2];
        return <CodeBlock key={idx} code={code} language={language} />;
      }
    }

    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={idx} className="bg-bg-quaternary px-1.5 py-0.5 rounded text-sm font-mono text-blue-300">
          {part.slice(1, -1)}
        </code>
      );
    }

    return (
      <span key={idx}>
        {part.split('\n').map((line, lineIdx) => {
          line = line.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
          line = line.replace(/\*([^*]+)\*/g, '<em>$1</em>');
          line = line.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-accent hover:text-accent-hover underline">$1</a>');

          return (
            <span key={lineIdx}>
              <span dangerouslySetInnerHTML={{ __html: line }} />
              {lineIdx < part.split('\n').length - 1 && <br />}
            </span>
          );
        })}
      </span>
    );
  });
}

export default MessageBubble;
