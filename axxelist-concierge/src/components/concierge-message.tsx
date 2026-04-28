"use client";

type ConciergeMessageProps = {
  role: "user" | "assistant";
  content: string;
};

export function ConciergeMessage({ role, content }: ConciergeMessageProps) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[88%] rounded-2xl px-4 py-2 text-sm leading-6 ${
          isUser ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-800"
        }`}
      >
        {content}
      </div>
    </div>
  );
}
