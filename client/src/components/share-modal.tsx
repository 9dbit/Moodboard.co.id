import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Copy,
  ExternalLink,
  Loader2,
  Link2,
  Phone,
  Mail,
  Share2,
  CheckCircle2,
} from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import type { Project } from "@shared/schema";

interface ShareModalProps {
  project: Project;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (data: Partial<Project>) => void;
}

export function ShareModal({ project, open, onOpenChange, onUpdate }: ShareModalProps) {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [localToken, setLocalToken] = useState<string | null>(null);

  const activeToken = localToken || project.shareToken;
  const shareUrl = activeToken
    ? `${window.location.origin}/share/${activeToken}`
    : null;

  const generateShareLink = async () => {
    setIsGenerating(true);
    try {
      const res = await apiRequest("POST", `/api/projects/${project.id}/share`);
      const data = await res.json();
      setLocalToken(data.token);
      queryClient.invalidateQueries({ queryKey: ["/api/projects", project.id] });
      toast({ title: "Share link created" });
    } catch {
      toast({ title: "Failed to generate share link", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const copyLink = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast({ title: "Link copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
  };

  const shareWhatsApp = () => {
    if (!shareUrl) return;
    const text = `Check out this design presentation for ${project.projectName || project.title}: ${shareUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  const shareEmail = () => {
    if (!shareUrl) return;
    const subject = `Design Presentation: ${project.projectName || project.title}`;
    const body = `Hi,\n\nPlease check out this design moodboard for ${project.projectName || project.title}.\n\nView it here: ${shareUrl}\n\nBest regards,\n${project.designerName || "Designer"}\n${project.studioName || "Studio"}`;
    window.open(`mailto:${project.clientEmail || ""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md border-0 p-0 overflow-hidden"
        overlayClassName="bg-transparent"
        style={{ background: "transparent", boxShadow: "none" }}
      >
        <div
          className="rounded-xl p-6 space-y-5 modal-glass-card"
        >
          <div>
            <DialogHeader className="p-0">
              <DialogTitle className="font-serif text-xl text-foreground">Share Presentation</DialogTitle>
              <DialogDescription className="text-xs text-foreground/60">
                Generate a shareable link and send it to your client.
              </DialogDescription>
            </DialogHeader>
          </div>

          {shareUrl ? (
            <div className="space-y-3">
              <div
                className="rounded-lg p-3 flex items-center gap-2"
                style={{
                  background: "hsl(142 76% 36% / 0.1)",
                  border: "1px solid hsl(142 76% 36% / 0.2)",
                }}
              >
                <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                <span className="text-sm font-medium text-foreground">Share link is active</span>
              </div>
              <div className="flex gap-2">
                <Input
                  value={shareUrl}
                  readOnly
                  className="text-xs"
                  style={{
                    background: "hsl(var(--muted) / 0.2)",
                    border: "1px solid hsl(var(--border) / 0.2)",
                  }}
                  data-testid="input-share-url"
                />
                <Button
                  size="icon"
                  variant="outline"
                  onClick={copyLink}
                  data-testid="button-copy-link"
                >
                  {copied ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => window.open(shareUrl, "_blank")}
                data-testid="button-preview-link"
              >
                <ExternalLink className="w-4 h-4 mr-1" />
                Open Preview
              </Button>
            </div>
          ) : (
            <div
              className="text-center py-6 rounded-lg"
              style={{
                background: "hsl(var(--muted) / 0.15)",
                border: "1px solid hsl(var(--border) / 0.15)",
              }}
            >
              <Link2 className="w-8 h-8 text-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-foreground/60 mb-4">
                No share link yet. Generate one to share with clients.
              </p>
              <Button
                onClick={generateShareLink}
                disabled={isGenerating}
                data-testid="button-generate-share"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Link2 className="w-4 h-4 mr-1" />
                    Generate Share Link
                  </>
                )}
              </Button>
            </div>
          )}

          {shareUrl && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-foreground/60 uppercase tracking-wider">Send To Client</p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={shareWhatsApp}
                  data-testid="button-share-whatsapp"
                >
                  <SiWhatsapp className="w-4 h-4 mr-1" />
                  WhatsApp
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={shareEmail}
                  data-testid="button-share-email"
                >
                  <Mail className="w-4 h-4 mr-1" />
                  Email
                </Button>
              </div>
            </div>
          )}

          {project.clientPhone && shareUrl && (
            <div
              className="rounded-lg p-3"
              style={{
                background: "hsl(var(--muted) / 0.2)",
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
                border: "1px solid hsl(var(--border) / 0.15)",
              }}
            >
              <p className="text-[10px] text-foreground/50 uppercase tracking-wider mb-1">Client Info</p>
              <p className="text-sm font-semibold text-foreground">{project.clientOwnerName || "Client"}</p>
              <div className="flex flex-wrap items-center gap-3 mt-1.5">
                {project.clientPhone && (
                  <span className="text-xs text-foreground/60 flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    {project.clientPhone}
                  </span>
                )}
                {project.clientEmail && (
                  <span className="text-xs text-foreground/60 flex items-center gap-1">
                    <Mail className="w-3 h-3" />
                    {project.clientEmail}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
