import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

describe("Card", () => {
  it("renders card structure with slots", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <CardContent>Body</CardContent>
      </Card>,
    );

    expect(screen.getByText("Summary")).toBeInTheDocument();
    expect(screen.getByText("Body")).toBeInTheDocument();

    const card = screen.getByText("Summary").closest("div[data-slot='card']");
    expect(card).toBeInTheDocument();
    expect(card).toHaveClass("bg-card");
  });
});
