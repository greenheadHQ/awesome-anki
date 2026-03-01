import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

describe("Dialog", () => {
  it("renders open dialog content", () => {
    const onOpenChange = vi.fn();

    render(
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rollback</DialogTitle>
            <DialogDescription>Confirm rollback action</DialogDescription>
          </DialogHeader>
          <DialogClose>Close dialog</DialogClose>
        </DialogContent>
      </Dialog>,
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Rollback")).toBeInTheDocument();
    expect(screen.getByText("Confirm rollback action")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /close dialog/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
