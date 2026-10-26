import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sparkles,
  Trash2,
  Tag,
  Palette,
  Camera,
  Eye,
  EyeOff,
  MessageSquare,
  Loader2,
  X,
  Plus,
} from "lucide-react";
import type { Pin } from "@shared/schema";

const shotTypes = [
  "facade",
  "interior",
  "detail",
  "lighting",
  "furniture",
  "landscape",
  "material",
  "bathroom",
  "kitchen",
  "bedroom",
  "pool",
];

interface PinDetailSheetProps {
  pin: Pin;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: () => void;
  projectId: number;
}

export function PinDetailSheet({ pin, open, onOpenChange, onDelete, projectId }: PinDetailSheetProps) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    title: pin.title || "",
    descriptionCustomInput: pin.descriptionCustomInput || "",
    descriptionEnabled: pin.descriptionEnabled ?? true,
    shotType: pin.shotType || "",
    note: pin.note || "",
    tags: pin.tags || [],
  });
  const [newTag, setNewTag] = useState("");

  useEffect(() => {
    setForm({
      title: pin.title || "",
      descriptionCustomInput: pin.descriptionCustomInput || "",
      descriptionEnabled: pin.descriptionEnabled ?? true,
      shotType: pin.shotType || "",
      note: pin.note || "",
      tags: pin.tags || [],
    });
  }, [pin]);

  const updatePin = useMutation({
    mutationFn: async (data: Partial<Pin>) => {
      const res = await apiRequest("PATCH", `/api/pins/${pin.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "pins"] });
    },
  });

  const generatePinDescription = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/pins/${pin.id}/generate-description`);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "pins"] });
      toast({ title: "Description generated" });
    },
    onError: () => {
      toast({ title: "Failed to generate description", variant: "destructive" });
    },
  });

  const handleSave = () => {
    updatePin.mutate(form);
    onOpenChange(false);
  };

  const addTag = () => {
    if (newTag.trim() && !form.tags.includes(newTag.trim())) {
      setForm({ ...form, tags: [...form.tags, newTag.trim()] });
      setNewTag("");
    }
  };

  const removeTag = (tag: string) => {
    setForm({ ...form, tags: form.tags.filter((t) => t !== tag) });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-serif">Image Details</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-5">
          <div className="relative rounded-xl overflow-hidden ring-1 ring-border">
            <img
              src={pin.imagePath || pin.imageUrl || "/images/sample-detail.png"}
              alt={pin.title || "Image"}
              className="w-full h-auto object-cover max-h-72"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/images/sample-detail.png";
              }}
              data-testid="img-pin-detail"
            />
            {pin.dominantColors && pin.dominantColors.length > 0 && (
              <div className="absolute bottom-0 left-0 right-0 flex h-2">
                {pin.dominantColors.map((color, i) => (
                  <div
                    key={i}
                    className="flex-1"
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            )}
          </div>

          {pin.dominantColors && pin.dominantColors.length > 0 && (
            <div>
              <label className="text-sm font-medium mb-2 flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5" />
                Color Palette
              </label>
              <div className="flex gap-2">
                {pin.dominantColors.map((color, i) => (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <div
                      className="w-8 h-8 rounded-lg ring-1 ring-border"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {color}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Separator />

          <div>
            <label className="text-sm font-medium mb-1.5 block">Title</label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Image title"
              data-testid="input-pin-title"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Shot Type</label>
            <Select
              value={form.shotType}
              onValueChange={(value) => setForm({ ...form, shotType: value })}
            >
              <SelectTrigger data-testid="select-shot-type">
                <div className="flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-muted-foreground" />
                  <SelectValue placeholder="Select shot type" />
                </div>
              </SelectTrigger>
              <SelectContent>
                {shotTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5" />
                Description
              </label>
              <Switch
                checked={form.descriptionEnabled}
                onCheckedChange={(checked) =>
                  setForm({ ...form, descriptionEnabled: checked })
                }
                data-testid="switch-pin-description"
              />
            </div>
            <Textarea
              value={form.descriptionCustomInput}
              onChange={(e) =>
                setForm({ ...form, descriptionCustomInput: e.target.value })
              }
              placeholder="Custom description or keywords for AI..."
              className="min-h-[60px]"
              data-testid="input-pin-description"
            />
            <Button
              variant="outline"
              className="w-full mt-2"
              onClick={() => generatePinDescription.mutate()}
              disabled={generatePinDescription.isPending}
              data-testid="button-generate-pin-description"
            >
              <Sparkles className="w-4 h-4 mr-1" />
              {generatePinDescription.isPending
                ? "Generating..."
                : "Generate AI Description"}
            </Button>
            {pin.descriptionFinal && (
              <div className="mt-2 p-2.5 rounded-xl glass">
                <p className="text-xs leading-relaxed">{pin.descriptionFinal}</p>
              </div>
            )}
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5" />
              Tags
            </label>
            <div className="flex gap-2 mb-2">
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addTag()}
                placeholder="Add a tag"
                data-testid="input-pin-tag"
              />
              <Button
                size="icon"
                variant="outline"
                onClick={addTag}
                data-testid="button-add-tag"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {form.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {form.tags.map((tag, i) => (
                  <Badge key={i} variant="secondary" className="gap-1">
                    {tag}
                    <button onClick={() => removeTag(tag)} className="ml-0.5">
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Notes</label>
            <Textarea
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder="Internal notes about this image..."
              className="min-h-[60px]"
              data-testid="input-pin-note"
            />
          </div>

          <Separator />

          <div className="flex gap-2">
            <Button
              variant="destructive"
              className="flex-1"
              onClick={onDelete}
              data-testid="button-delete-pin"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Delete
            </Button>
            <Button className="flex-1" onClick={handleSave} data-testid="button-save-pin">
              Save Changes
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
