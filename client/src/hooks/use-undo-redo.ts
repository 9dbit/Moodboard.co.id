import { useState, useCallback, useRef } from "react";
import type { Pin } from "@shared/schema";

type PinSnapshot = Pick<Pin,
  "id" | "imageUrl" | "imagePath" | "sourceUrl" | "title" | "descriptionAi" |
  "descriptionCustomInput" | "descriptionFinal" | "descriptionEnabled" |
  "approvalStatus" | "position" | "shotType" | "note" | "tags" |
  "dominantColors" | "width" | "height"
>;

function capturePinSnapshot(pin: Pin): PinSnapshot {
  return {
    id: pin.id,
    imageUrl: pin.imageUrl,
    imagePath: pin.imagePath,
    sourceUrl: pin.sourceUrl,
    title: pin.title,
    descriptionAi: pin.descriptionAi,
    descriptionCustomInput: pin.descriptionCustomInput,
    descriptionFinal: pin.descriptionFinal,
    descriptionEnabled: pin.descriptionEnabled,
    approvalStatus: pin.approvalStatus,
    position: pin.position,
    shotType: pin.shotType,
    note: pin.note,
    tags: pin.tags ? [...pin.tags] : null,
    dominantColors: pin.dominantColors ? [...pin.dominantColors] : null,
    width: pin.width,
    height: pin.height,
  };
}

export function useUndoRedo() {
  const undoStack = useRef<PinSnapshot[][]>([]);
  const redoStack = useRef<PinSnapshot[][]>([]);
  const [undoCount, setUndoCount] = useState(0);
  const [redoCount, setRedoCount] = useState(0);

  const pushSnapshot = useCallback((pins: Pin[]) => {
    const snapshot = pins.map(capturePinSnapshot);
    undoStack.current.push(snapshot);
    redoStack.current = [];
    setUndoCount(undoStack.current.length);
    setRedoCount(0);
  }, []);

  const undo = useCallback(
    (currentPins: Pin[]): PinSnapshot[] | null => {
      if (undoStack.current.length === 0) return null;
      const currentSnapshot = currentPins.map(capturePinSnapshot);
      redoStack.current.push(currentSnapshot);
      const previousState = undoStack.current.pop()!;
      setUndoCount(undoStack.current.length);
      setRedoCount(redoStack.current.length);
      return previousState;
    },
    []
  );

  const redo = useCallback(
    (currentPins: Pin[]): PinSnapshot[] | null => {
      if (redoStack.current.length === 0) return null;
      const currentSnapshot = currentPins.map(capturePinSnapshot);
      undoStack.current.push(currentSnapshot);
      const nextState = redoStack.current.pop()!;
      setUndoCount(undoStack.current.length);
      setRedoCount(redoStack.current.length);
      return nextState;
    },
    []
  );

  const canUndo = undoCount > 0;
  const canRedo = redoCount > 0;

  return { pushSnapshot, undo, redo, canUndo, canRedo, undoCount, redoCount };
}
