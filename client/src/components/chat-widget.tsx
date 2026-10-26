import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

function extractScriptSrc(html: string): string | null {
  const match = html.match(/<script[^>]+src=["']([^"']+)["']/i);
  return match ? match[1] : null;
}

export function ChatWidget() {
  const { data } = useQuery<{ script: string }>({
    queryKey: ["/api/admin/chat-widget"],
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!data?.script) return;

    const scriptSrc = extractScriptSrc(data.script);
    if (!scriptSrc) return;

    const existing = document.getElementById("admin-chat-widget-script");
    if (existing) existing.remove();

    const script = document.createElement("script");
    script.id = "admin-chat-widget-script";
    script.src = scriptSrc;
    script.async = true;

    const dataAttrs = data.script.match(/data-[\w-]+="[^"]*"/gi);
    if (dataAttrs) {
      dataAttrs.forEach((attr) => {
        const [key, ...valueParts] = attr.split("=");
        const value = valueParts.join("=").replace(/^"|"$/g, "");
        script.setAttribute(key, value);
      });
    }

    document.body.appendChild(script);

    return () => {
      const el = document.getElementById("admin-chat-widget-script");
      if (el) el.remove();
    };
  }, [data?.script]);

  return null;
}
